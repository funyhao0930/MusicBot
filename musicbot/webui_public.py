"""Authenticated loopback API intended for a separate HTTPS proxy."""

from __future__ import annotations

import logging
import ipaddress
import os
import pathlib
import re
import secrets
from typing import Any
from urllib.parse import parse_qs, urlsplit

from aiohttp import web

from .webui import MusicBotWebUI, public_api_routes


log = logging.getLogger(__name__)

DEFAULT_PUBLIC_PORT = 8766
DEFAULT_PROXY_TOKEN_PATH = pathlib.Path("data/webui-public-proxy.token")
_SAFE_SERVER_ERROR = "伺服器暫時無法處理請求，請稍後再試。"
_SAFE_CLIENT_ERRORS = {
    400: "請求內容不正確。",
    401: "禁止存取。",
    403: "禁止存取。",
    404: "找不到此功能。",
    405: "不支援此操作。",
    409: "目前狀態無法完成此操作。",
}
_WRITE_METHODS = {"POST", "PATCH", "PUT", "DELETE"}
_URL_SCHEME = re.compile(r"^([a-z][a-z0-9+.-]*):(.*)$", re.IGNORECASE)
_YOUTUBE_VIDEO_ID = re.compile(r"^[A-Za-z0-9_-]{11}$")
_YOUTUBE_HOSTS = {
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
}


def validate_public_media_input(raw_value: Any) -> str:
    """Allow public searches and narrowly-scoped YouTube content URLs only."""
    value = str(raw_value or "").strip()
    if not value:
        raise ValueError("A search phrase or YouTube URL is required")
    if value.startswith(("//", "\\\\")):
        raise ValueError("Scheme-relative URLs are not allowed")

    scheme_match = _URL_SCHEME.match(value)
    if scheme_match and scheme_match.group(2).startswith((" ", "\t")):
        return value

    if not scheme_match:
        authority = value.split("/", 1)[0]
        host_candidate = authority.rsplit(":", 1)[0].strip("[]").lower()
        try:
            address = ipaddress.ip_address(host_candidate)
        except ValueError:
            address = None
        if (
            address is not None
            or host_candidate == "localhost"
            or host_candidate.endswith((".local", ".internal"))
            or (" " not in value and "." in host_candidate)
        ):
            raise ValueError("Public URLs must be approved YouTube URLs")
        return value

    scheme = scheme_match.group(1).lower()
    if scheme not in {"http", "https"} or not scheme_match.group(2).startswith("//"):
        raise ValueError("Public URLs must use HTTP or HTTPS")

    parsed = urlsplit(value)
    host = (parsed.hostname or "").lower().rstrip(".")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Public URL has an invalid port") from exc
    if parsed.username or parsed.password or port not in {None, 80, 443}:
        raise ValueError("Public URL credentials and custom ports are not allowed")

    if host == "youtu.be":
        if not _YOUTUBE_VIDEO_ID.fullmatch(parsed.path.strip("/")):
            raise ValueError("YouTube short URL has an invalid video ID")
        return value

    if host not in _YOUTUBE_HOSTS:
        raise ValueError("Public URLs must point to YouTube")

    query = parse_qs(parsed.query)
    path = parsed.path.rstrip("/") or "/"
    if path == "/watch" and query.get("v"):
        return value
    if path == "/playlist" and query.get("list"):
        return value
    if any(path.startswith(prefix) and len(path) > len(prefix) for prefix in (
        "/shorts/", "/live/", "/embed/"
    )):
        return value
    raise ValueError("Only direct YouTube video and playlist URLs are allowed")


def load_or_create_proxy_token(
    token_path: pathlib.Path | str = DEFAULT_PROXY_TOKEN_PATH,
) -> str:
    """Load the private proxy token, creating a high-entropy token once."""
    path = pathlib.Path(token_path)
    try:
        token = path.read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        token = ""

    if token:
        return token

    path.parent.mkdir(parents=True, exist_ok=True)
    generated = secrets.token_urlsafe(48)
    try:
        descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        token = path.read_text(encoding="utf-8").strip()
        if not token:
            raise RuntimeError("Public proxy token file is empty")
        return token

    with os.fdopen(descriptor, "w", encoding="utf-8", newline="") as token_file:
        token_file.write(generated)
    return generated


class MusicBotPublicWebUI(MusicBotWebUI):
    """Minimal authenticated API bound exclusively to IPv4 loopback."""

    def __init__(
        self,
        bot: Any,
        *,
        port: int = DEFAULT_PUBLIC_PORT,
        proxy_token: str | None = None,
        token_path: pathlib.Path | str = DEFAULT_PROXY_TOKEN_PATH,
    ) -> None:
        token = proxy_token or load_or_create_proxy_token(token_path)
        if not token:
            raise ValueError("Public proxy token must not be empty")
        self.proxy_token = token
        super().__init__(bot, host="127.0.0.1", port=port, auto_open=False)

    @web.middleware
    async def _public_security_middleware(
        self, request: web.Request, handler: Any
    ) -> web.StreamResponse:
        supplied_proxy_token = request.headers.get("X-MusicBot-Proxy-Token", "")
        if not supplied_proxy_token or not secrets.compare_digest(
            supplied_proxy_token, self.proxy_token
        ):
            return self._error("禁止存取", status=403)

        route_status = getattr(request.match_info.route, "status", None)
        if request.method in _WRITE_METHODS and route_status != 404:
            supplied_csrf = request.headers.get("X-MusicBot-CSRF", "")
            if not supplied_csrf or not secrets.compare_digest(
                supplied_csrf, self.csrf_token
            ):
                return self._error("禁止存取", status=403)

        try:
            response = await handler(request)
        except web.HTTPException as exc:
            log.warning("Public Web UI returned HTTP %s", exc.status)
            return self._safe_error(exc.status)
        except Exception as exc:
            log.error(
                "Public Web UI request failed (%s)", type(exc).__name__
            )
            return self._safe_server_error()

        if response.status >= 400:
            log.warning("Public Web UI handler returned HTTP %s", response.status)
            return self._safe_error(response.status)
        return response

    @staticmethod
    def _safe_error(status: int) -> web.Response:
        if status >= 500:
            return MusicBotPublicWebUI._safe_server_error()
        message = _SAFE_CLIENT_ERRORS.get(status, "無法完成此請求。")
        return web.json_response({"ok": False, "error": message}, status=status)

    @staticmethod
    def _safe_server_error() -> web.Response:
        return web.json_response(
            {"ok": False, "error": _SAFE_SERVER_ERROR}, status=500
        )

    def create_app(self) -> web.Application:
        app = web.Application(middlewares=[self._public_security_middleware])
        app.add_routes(public_api_routes(self))
        return app

    @staticmethod
    def _playlist_sources(playlist: Any) -> list[str]:
        safe_sources = []
        for source in playlist:
            try:
                safe_sources.append(validate_public_media_input(source))
            except ValueError:
                log.warning("Public Web UI omitted an unsupported playlist source")
        return safe_sources

    async def _handle_queue_add(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            validate_public_media_input(body.get("query"))
        except ValueError as exc:
            return self._error(str(exc))
        return await super()._handle_queue_add(request)

    async def _handle_playlists_post(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            if str(body.get("action", "")).strip().lower() == "add":
                validate_public_media_input(body.get("track"))
        except ValueError as exc:
            return self._error(str(exc))
        return await super()._handle_playlists_post(request)
