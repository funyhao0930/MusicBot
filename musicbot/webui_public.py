"""Authenticated loopback API intended for a separate HTTPS proxy."""

from __future__ import annotations

import logging
import os
import pathlib
import secrets
from typing import Any

from aiohttp import web

from .webui import MusicBotWebUI, public_api_routes


log = logging.getLogger(__name__)

DEFAULT_PUBLIC_PORT = 8766
DEFAULT_PROXY_TOKEN_PATH = pathlib.Path("data/webui-public-proxy.token")
_SAFE_SERVER_ERROR = "伺服器暫時無法處理請求，請稍後再試。"
_WRITE_METHODS = {"POST", "PATCH", "PUT", "DELETE"}


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
            if exc.status < 500:
                raise
            log.exception("Public Web UI returned an HTTP server error")
            return self._safe_server_error()
        except Exception:
            log.exception("Public Web UI request failed")
            return self._safe_server_error()

        if response.status >= 500:
            log.error(
                "Public Web UI handler returned HTTP %s for %s",
                response.status,
                request.path,
            )
            return self._safe_server_error()
        return response

    @staticmethod
    def _safe_server_error() -> web.Response:
        return web.json_response(
            {"ok": False, "error": _SAFE_SERVER_ERROR}, status=500
        )

    def create_app(self) -> web.Application:
        app = web.Application(middlewares=[self._public_security_middleware])
        app.add_routes(public_api_routes(self))
        return app
