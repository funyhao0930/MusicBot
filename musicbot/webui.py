"""Local-only web control helpers and server for MusicBot."""

from __future__ import annotations

import asyncio
import copy
import logging
import math
import pathlib
import re
import secrets
import time
import webbrowser
from typing import Any, Dict
from urllib.parse import urlsplit

from aiohttp import web

from .webui_i18n import localize_option, localize_permission_group


log = logging.getLogger(__name__)

_SENSITIVE_PARTS = ("token", "secret", "password", "cookie", "oauth")
_LOG_SECRET_RE = re.compile(
    r"(?i)(token|secret|password|cookie|authorization|oauth)(\s*[:=]\s*)(\S.*)$"
)
_ASSET_CONTENT_TYPES = {
    "styles.css": "text/css",
    "app.js": "application/javascript",
}
_PROTECTED_PERMISSION_GROUPS = {"owner", "default"}


def is_loopback_host(host: str) -> bool:
    """Return True only for the host forms accepted by the local Web UI."""
    if not host:
        return False

    hostname = host.strip().lower()
    if hostname.startswith("["):
        hostname = hostname.split("]", 1)[0].lstrip("[")
    else:
        hostname = hostname.split(":", 1)[0]

    return hostname in {"127.0.0.1", "localhost"}


def validate_write_security(
    *, host: str, origin: str, supplied_token: str, expected_token: str
) -> None:
    """Reject state-changing requests that are not from this local UI session."""
    if not expected_token or supplied_token != expected_token:
        raise PermissionError("Invalid CSRF token")

    if not is_loopback_host(host):
        raise PermissionError("Web UI requests must use a loopback host")

    parsed = urlsplit(origin)
    if parsed.scheme not in {"http", "https"} or not is_loopback_host(parsed.netloc):
        raise PermissionError("Web UI requests must use a loopback origin")

    if parsed.netloc.lower() != host.lower():
        raise PermissionError("Origin and Host must match")


def _is_sensitive_option(section: str, option: str) -> bool:
    combined = f"{section} {option}".lower()
    return section.lower() == "credentials" or any(
        part in combined for part in _SENSITIVE_PARTS
    )


def _json_safe(value: Any) -> Any:
    if isinstance(value, set):
        return sorted(value)
    if hasattr(value, "as_posix"):
        return str(value)
    if isinstance(value, tuple):
        return list(value)
    return value


def config_option_to_payload(config: Any, option: Any) -> Dict[str, Any]:
    """Convert a registered config option into a UI-safe JSON payload."""
    sensitive = _is_sensitive_option(option.section, option.option)
    editable = bool(option.editable) and not sensitive
    value = None if sensitive else _json_safe(getattr(config, option.dest, None))
    display_section, display_option, display_comment = localize_option(
        option.section, option.option, option.comment
    )

    value_type = type(option.default).__name__
    if option.getter == "getboolean":
        value_type = "boolean"
    elif option.getter in {"getint", "getdatasize"}:
        value_type = "integer"
    elif option.getter in {"getfloat", "getduration"}:
        value_type = "number"
    elif option.getter in {"getidset", "getstrset"}:
        value_type = "list"
    else:
        value_type = "string"

    return {
        "section": option.section,
        "option": option.option,
        "display_section": display_section,
        "display_option": display_option,
        "display_comment": display_comment,
        "value": value,
        "type": value_type,
        "comment": option.comment,
        "editable": editable,
        "sensitive": sensitive,
    }


def normalize_volume(value: Any) -> float:
    """Parse a player volume and clamp it to MusicBot's supported range."""
    if isinstance(value, bool):
        raise ValueError("Volume must be a number")
    try:
        parsed = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("Volume must be a number") from exc
    if not math.isfinite(parsed):
        raise ValueError("Volume must be finite")
    return max(0.01, min(parsed, 1.0))


def entry_to_payload(entry: Any) -> Dict[str, Any]:
    """Return the player metadata safe and useful for the browser UI."""
    author = getattr(entry, "author", None)
    requested_by = "Auto playlist"
    requested_by_id = None
    if author is not None:
        requested_by = getattr(author, "display_name", None) or getattr(
            author, "name", "Unknown"
        )
        requested_by_id = getattr(author, "id", None)

    duration = getattr(entry, "duration", None)
    return {
        "title": str(getattr(entry, "title", "Unknown")),
        "url": str(getattr(entry, "url", "")),
        "thumbnail": str(getattr(entry, "thumbnail_url", "") or ""),
        "duration": float(duration) if duration is not None else None,
        "requested_by": requested_by,
        "requested_by_id": requested_by_id,
    }


def redact_log_line(line: str) -> str:
    """Redact common credential-shaped values before logs reach the browser."""
    return _LOG_SECRET_RE.sub(r"\1\2[REDACTED]", line.rstrip("\r\n"))


class MusicBotWebUI:
    """A local-only aiohttp control surface attached to a MusicBot instance."""

    def __init__(
        self,
        bot: Any,
        *,
        host: str = "127.0.0.1",
        port: int = 8765,
        auto_open: bool = False,
        log_file: pathlib.Path | str = pathlib.Path("logs/musicbot.log"),
        asset_dir: pathlib.Path | str | None = None,
    ) -> None:
        if host not in {"127.0.0.1", "localhost"}:
            raise ValueError("MusicBot Web UI may only bind to a loopback host")
        if not 1 <= int(port) <= 65535:
            raise ValueError("Web UI port must be between 1 and 65535")

        self.bot = bot
        self.host = host
        self.port = int(port)
        self.auto_open = auto_open
        self.log_file = pathlib.Path(log_file)
        self.asset_dir = (
            pathlib.Path(asset_dir)
            if asset_dir is not None
            else pathlib.Path(__file__).with_name("webui_assets")
        )
        self.csrf_token = secrets.token_urlsafe(32)
        self._runner: web.AppRunner | None = None
        self._site: web.TCPSite | None = None
        self._playlist_title_cache: Dict[str, str] = {}
        self._playlist_title_semaphore = asyncio.Semaphore(6)

    @web.middleware
    async def _security_middleware(
        self, request: web.Request, handler: Any
    ) -> web.StreamResponse:
        if not is_loopback_host(request.host):
            return self._error("Local access only", status=403)

        if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
            try:
                validate_write_security(
                    host=request.host,
                    origin=request.headers.get("Origin", ""),
                    supplied_token=request.headers.get("X-MusicBot-CSRF", ""),
                    expected_token=self.csrf_token,
                )
            except PermissionError as exc:
                return self._error(str(exc), status=403)

        return await handler(request)

    def create_app(self) -> web.Application:
        app = web.Application(middlewares=[self._security_middleware])
        app.add_routes(
            [
                web.get("/", self._handle_index),
                web.get("/assets/{name}", self._handle_asset),
                web.get("/api/status", self._handle_status),
                web.get("/api/guilds", self._handle_guilds),
                web.get("/api/player", self._handle_player),
                web.post("/api/player/action", self._handle_player_action),
                web.post("/api/player/volume", self._handle_player_volume),
                web.post("/api/player/seek", self._handle_player_seek),
                web.post("/api/queue/add", self._handle_queue_add),
                web.post("/api/queue/reorder", self._handle_queue_reorder),
                web.delete("/api/queue/{index}", self._handle_queue_delete),
                web.get("/api/config", self._handle_config),
                web.patch("/api/config", self._handle_config_patch),
                web.post("/api/config/reload", self._handle_config_reload),
                web.get("/api/logs", self._handle_logs),
                web.get("/api/playlists", self._handle_playlists),
                web.get(
                    "/api/playlists/{name}/titles",
                    self._handle_playlist_titles,
                ),
                web.post("/api/playlists", self._handle_playlists_post),
                web.delete(
                    "/api/playlists/{name}/{index}",
                    self._handle_playlist_track_delete,
                ),
                web.get("/api/permissions", self._handle_permissions),
                web.patch("/api/permissions", self._handle_permissions_patch),
                web.post("/api/permissions/group", self._handle_permission_group),
                web.post("/api/restart", self._handle_restart),
            ]
        )
        return app

    async def start(self) -> None:
        if self._runner is not None:
            return
        self._runner = web.AppRunner(self.create_app(), access_log=None)
        await self._runner.setup()
        self._site = web.TCPSite(self._runner, self.host, self.port)
        await self._site.start()
        if self.auto_open:
            webbrowser.open(f"http://{self.host}:{self.port}")

    async def stop(self) -> None:
        if self._runner is None:
            return
        await self._runner.cleanup()
        self._runner = None
        self._site = None

    @staticmethod
    def _error(message: str, *, status: int = 400) -> web.Response:
        return web.json_response({"ok": False, "error": message}, status=status)

    async def _handle_index(self, _request: web.Request) -> web.StreamResponse:
        index_file = self.asset_dir / "index.html"
        if not index_file.is_file():
            return self._error("Web UI assets are missing", status=500)
        return web.Response(
            text=index_file.read_text(encoding="utf-8"),
            content_type="text/html",
            charset="utf-8",
        )

    async def _handle_asset(self, request: web.Request) -> web.StreamResponse:
        name = request.match_info["name"]
        if name not in _ASSET_CONTENT_TYPES:
            raise web.HTTPNotFound()
        asset = self.asset_dir / name
        if not asset.is_file():
            raise web.HTTPNotFound()
        return web.Response(
            text=asset.read_text(encoding="utf-8"),
            content_type=_ASSET_CONTENT_TYPES[name],
            charset="utf-8",
        )

    async def _json_body(self, request: web.Request) -> Dict[str, Any]:
        try:
            body = await request.json()
        except Exception as exc:
            raise ValueError("Request body must be valid JSON") from exc
        if not isinstance(body, dict):
            raise ValueError("Request body must be a JSON object")
        return body

    def _guild_id_from(self, raw_value: Any) -> int:
        try:
            guild_id = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise ValueError("guild_id must be an integer") from exc
        if guild_id <= 0:
            raise ValueError("guild_id must be positive")
        return guild_id

    def _player_for(self, guild_id: int) -> Any:
        player = getattr(self.bot, "players", {}).get(guild_id)
        if player is None:
            raise LookupError("No active player for this server")
        return player

    @staticmethod
    def _player_state(player: Any) -> str:
        if bool(getattr(player, "is_dead", False)):
            return "dead"
        if bool(getattr(player, "is_paused", False)):
            return "paused"
        if bool(getattr(player, "is_playing", False)):
            return "playing"
        if bool(getattr(player, "is_stopped", False)):
            return "stopped"
        return "waiting"

    def _player_payload(self, guild_id: int, player: Any) -> Dict[str, Any]:
        voice_client = getattr(player, "voice_client", None)
        channel = getattr(voice_client, "channel", None)
        current_entry = getattr(player, "current_entry", None)
        playlist = getattr(player, "playlist", None)
        entries = list(getattr(playlist, "entries", []))
        repeat_song = bool(getattr(player, "repeatsong", False))
        repeat_all = bool(getattr(player, "loopqueue", False))
        repeat_mode = "song" if repeat_song else "all" if repeat_all else "off"

        return {
            "guild_id": guild_id,
            "state": self._player_state(player),
            "connected": bool(
                voice_client
                and getattr(voice_client, "is_connected", lambda: False)()
            ),
            "voice_channel": (
                {
                    "id": getattr(channel, "id", None),
                    "name": getattr(channel, "name", "Unknown channel"),
                }
                if channel is not None
                else None
            ),
            "current": entry_to_payload(current_entry) if current_entry else None,
            "progress": float(getattr(player, "progress", 0.0) or 0.0),
            "volume": float(getattr(player, "volume", 0.0) or 0.0),
            "repeat_mode": repeat_mode,
            "repeat_song": repeat_song,
            "repeat_all": repeat_all,
            "queue": [entry_to_payload(entry) for entry in entries],
        }

    async def _handle_status(self, _request: web.Request) -> web.Response:
        init_time = float(getattr(self.bot, "_init_time", time.time()))
        return web.json_response(
            {
                "ok": True,
                "ready": bool(getattr(self.bot, "init_ok", False)),
                "network_outage": bool(
                    getattr(self.bot, "network_outage", False)
                ),
                "uptime_seconds": max(0.0, time.time() - init_time),
                "latency_ms": round(
                    float(getattr(self.bot, "latency", 0.0) or 0.0) * 1000, 1
                ),
                "guild_count": len(getattr(self.bot, "guilds", [])),
                "player_count": len(getattr(self.bot, "players", {})),
                "csrf_token": self.csrf_token,
            }
        )

    async def _handle_guilds(self, _request: web.Request) -> web.Response:
        guilds = []
        players = getattr(self.bot, "players", {})
        for guild in getattr(self.bot, "guilds", []):
            player = players.get(guild.id)
            guilds.append(
                {
                    "id": str(guild.id),
                    "name": guild.name,
                    "available": not bool(getattr(guild, "unavailable", False)),
                    "has_player": player is not None,
                    "player_state": self._player_state(player) if player else "idle",
                }
            )
        return web.json_response({"ok": True, "guilds": guilds})

    async def _handle_player(self, request: web.Request) -> web.Response:
        try:
            guild_id = self._guild_id_from(request.query.get("guild_id"))
            player = self._player_for(guild_id)
        except ValueError as exc:
            return self._error(str(exc))
        except LookupError as exc:
            return self._error(str(exc), status=404)
        return web.json_response(self._player_payload(guild_id, player))

    async def _handle_player_action(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            guild_id = self._guild_id_from(body.get("guild_id"))
            player = self._player_for(guild_id)
            action = str(body.get("action", "")).lower()

            if action == "pause":
                player.pause()
            elif action == "resume":
                player.resume()
            elif action == "skip":
                player.repeatsong = False
                player.skip()
            elif action == "stop":
                player.stop()
            elif action in {"repeat", "repeat_song", "repeat_all", "repeat_off"}:
                if action != "repeat_off" and getattr(player, "current_entry", None) is None:
                    raise ValueError("No song is currently playing")

                if action == "repeat":
                    if bool(getattr(player, "repeatsong", False)):
                        action = "repeat_all"
                    elif bool(getattr(player, "loopqueue", False)):
                        action = "repeat_off"
                    else:
                        action = "repeat_song"

                if action == "repeat_song":
                    player.repeatsong = True
                    player.loopqueue = False
                elif action == "repeat_all":
                    player.repeatsong = False
                    player.loopqueue = True
                else:
                    player.repeatsong = False
                    player.loopqueue = False
            elif action == "shuffle":
                player.playlist.shuffle()
            elif action == "clear":
                player.playlist.clear()
            else:
                raise ValueError("Unknown player action")
        except ValueError as exc:
            return self._error(str(exc))
        except LookupError as exc:
            return self._error(str(exc), status=404)
        except RuntimeError as exc:
            return self._error(str(exc), status=409)

        return web.json_response(
            {"ok": True, "player": self._player_payload(guild_id, player)}
        )

    async def _handle_player_volume(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            guild_id = self._guild_id_from(body.get("guild_id"))
            player = self._player_for(guild_id)
            player.volume = normalize_volume(body.get("volume"))
        except ValueError as exc:
            return self._error(str(exc))
        except LookupError as exc:
            return self._error(str(exc), status=404)

        return web.json_response({"ok": True, "volume": player.volume})

    async def _handle_player_seek(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            guild_id = self._guild_id_from(body.get("guild_id"))
            player = self._player_for(guild_id)
            position = float(body.get("position"))
            if not math.isfinite(position):
                raise ValueError("position must be a finite number")
            player.seek(position)
        except (TypeError, ValueError) as exc:
            return self._error(str(exc))
        except LookupError as exc:
            return self._error(str(exc), status=404)
        except RuntimeError as exc:
            return self._error(str(exc), status=409)

        return web.json_response(
            {
                "ok": True,
                "position": position,
                "player": self._player_payload(guild_id, player),
            }
        )

    async def _handle_queue_add(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            guild_id = self._guild_id_from(body.get("guild_id"))
            player = self._player_for(guild_id)
            query = str(body.get("query", "")).strip()
            if not query:
                raise ValueError("A URL or search phrase is required")
            if len(query) > 2048:
                raise ValueError("The queue request is too long")

            info = await self.bot.downloader.extract_info(
                query, download=False, process=True
            )
            if not info:
                raise ValueError("No playable result was found")
            if bool(getattr(info, "has_entries", False)):
                entries, _position = await player.playlist.import_from_info(
                    info, channel=None, author=None, head=False
                )
                if not entries:
                    raise ValueError("The playlist did not contain playable tracks")
                entry = entries[0]
                added_count = len(entries)
            else:
                entry, _position = await player.playlist.add_entry_from_info(
                    info, channel=None, author=None, head=False
                )
                added_count = 1

            if bool(getattr(player, "is_stopped", False)):
                player.play()
        except (TypeError, ValueError) as exc:
            return self._error(str(exc))
        except LookupError as exc:
            return self._error(str(exc), status=404)
        except Exception as exc:
            return self._error(f"Unable to add this track: {exc}", status=502)

        return web.json_response(
            {
                "ok": True,
                "added_count": added_count,
                "entry": entry_to_payload(entry),
                "queue": [entry_to_payload(e) for e in player.playlist.entries],
            }
        )

    async def _handle_queue_reorder(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            guild_id = self._guild_id_from(body.get("guild_id"))
            player = self._player_for(guild_id)
            source_index = int(body.get("source_index"))
            target_index = int(body.get("target_index"))
            queue_length = len(player.playlist.entries)
            if not 0 <= source_index < queue_length:
                raise ValueError("source_index is outside the queue")
            if not 0 <= target_index < queue_length:
                raise ValueError("target_index is outside the queue")

            entry = player.playlist.delete_entry_at_index(source_index)
            player.playlist.insert_entry_at_index(target_index, entry)
        except (TypeError, ValueError) as exc:
            return self._error(str(exc))
        except LookupError as exc:
            return self._error(str(exc), status=404)

        return web.json_response(
            {"ok": True, "queue": [entry_to_payload(e) for e in player.playlist.entries]}
        )

    async def _handle_queue_delete(self, request: web.Request) -> web.Response:
        try:
            guild_id = self._guild_id_from(request.query.get("guild_id"))
            player = self._player_for(guild_id)
            index = int(request.match_info["index"])
            if not 0 <= index < len(player.playlist.entries):
                raise ValueError("Queue index is outside the queue")
            removed = player.playlist.delete_entry_at_index(index)
        except (TypeError, ValueError) as exc:
            return self._error(str(exc))
        except LookupError as exc:
            return self._error(str(exc), status=404)

        return web.json_response(
            {
                "ok": True,
                "removed": entry_to_payload(removed),
                "queue": [entry_to_payload(e) for e in player.playlist.entries],
            }
        )

    async def _handle_config(self, _request: web.Request) -> web.Response:
        config = self.bot.config
        options = [
            config_option_to_payload(config, option)
            for option in config.register.option_list
        ]
        return web.json_response({"ok": True, "options": options})

    async def _handle_config_patch(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            section = str(body.get("section", ""))
            option_name = str(body.get("option", ""))
            option = self.bot.config.register.get_config_option(section, option_name)
            if option is None:
                raise LookupError("Unknown config option")
            if not bool(option.editable) or _is_sensitive_option(section, option_name):
                raise PermissionError("This option cannot be changed from the Web UI")

            value = body.get("value", "")
            if isinstance(value, bool):
                value = "yes" if value else "no"
            elif isinstance(value, list):
                value = ", ".join(str(item) for item in value)
            else:
                value = str(value)

            if not self.bot.config.update_option(option, value):
                raise ValueError("The value is invalid for this option")
            if not self.bot.config.save_option(option):
                raise OSError("The config file could not be saved")
        except PermissionError as exc:
            return self._error(str(exc), status=403)
        except LookupError as exc:
            return self._error(str(exc), status=404)
        except (OSError, ValueError) as exc:
            return self._error(str(exc), status=400)

        return web.json_response(
            {
                "ok": True,
                "option": config_option_to_payload(self.bot.config, option),
            }
        )

    async def _handle_config_reload(self, _request: web.Request) -> web.Response:
        try:
            from .config import Config

            config_file = getattr(self.bot, "_config_file", None)
            if config_file is None:
                raise RuntimeError("MusicBot config file path is unavailable")
            new_config = Config(config_file)
            await new_config.async_validate(self.bot)
            self.bot.config = new_config
        except Exception as exc:
            return self._error(f"Config reload failed: {exc}", status=400)
        return web.json_response({"ok": True})

    async def _handle_logs(self, request: web.Request) -> web.Response:
        try:
            limit = int(request.query.get("limit", "200"))
        except ValueError:
            return self._error("limit must be an integer")
        limit = max(1, min(limit, 500))

        if not self.log_file.is_file():
            return web.json_response({"ok": True, "lines": [], "available": False})

        try:
            lines = self.log_file.read_text(
                encoding="utf-8", errors="replace"
            ).splitlines()
        except OSError as exc:
            return self._error(f"Unable to read logs: {exc}", status=500)

        return web.json_response(
            {
                "ok": True,
                "available": True,
                "lines": [redact_log_line(line) for line in lines[-limit:]],
                "total_lines": len(lines),
            }
        )

    @staticmethod
    def _playlist_name(raw_name: Any) -> str:
        name = str(raw_name or "").strip()
        if name.lower().endswith(".txt"):
            name = name[:-4].strip()
        if not name or len(name) > 80:
            raise ValueError("Playlist name must contain 1 to 80 characters")
        if name in {".", ".."} or ".." in name:
            raise ValueError("Playlist name cannot contain path traversal")
        if any(char in name for char in "/\\\r\n\0") or any(
            ord(char) < 32 for char in name
        ):
            raise ValueError("Playlist name contains invalid characters")
        return name

    async def _playlist_payload(self, name: str) -> Dict[str, Any]:
        playlist = self.bot.playlist_mgr.get_playlist(f"{name}.txt")
        await playlist.load()
        tracks = [
            {
                "source": source,
                "title": self._playlist_title_cache.get(source, source),
            }
            for source in playlist
        ]
        return {
            "name": name,
            "filename": playlist.filename,
            "tracks": tracks,
        }

    async def _playlist_track_payload(self, source: str) -> Dict[str, str]:
        cached_title = self._playlist_title_cache.get(source)
        if cached_title is not None:
            return {"source": source, "title": cached_title}

        title = source
        try:
            async with self._playlist_title_semaphore:
                info = await self.bot.downloader.extract_info(
                    source, download=False, process=True
                )
            extracted_title = str(getattr(info, "title", "") or "").strip()
            if extracted_title:
                title = extracted_title
        except Exception:
            log.debug(
                "Unable to resolve a playlist track title; using its original source.",
                exc_info=True,
            )

        self._playlist_title_cache[source] = title
        return {"source": source, "title": title}

    async def _handle_playlists(self, _request: web.Request) -> web.Response:
        manager = self.bot.playlist_mgr
        manager.discover_playlists()
        playlists = []
        for name in sorted(manager.playlist_names, key=str.casefold):
            playlists.append(await self._playlist_payload(name))
        return web.json_response({"ok": True, "playlists": playlists})

    async def _handle_playlist_titles(self, request: web.Request) -> web.Response:
        try:
            name = self._playlist_name(request.match_info["name"])
            playlist = self.bot.playlist_mgr.get_playlist(f"{name}.txt")
            await playlist.load()
            tracks = await asyncio.gather(
                *(self._playlist_track_payload(source) for source in playlist)
            )
        except (OSError, ValueError) as exc:
            return self._error(str(exc), status=400)

        return web.json_response({"ok": True, "name": name, "tracks": tracks})

    async def _handle_playlists_post(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            action = str(body.get("action", "")).strip().lower()
            if action not in {"create", "add"}:
                raise ValueError("Playlist action must be create or add")
            name = self._playlist_name(body.get("name"))
            playlist = self.bot.playlist_mgr.get_playlist(f"{name}.txt")
            playlist.create_file()
            await playlist.load(force=True)

            if action == "add":
                track = str(body.get("track", "")).strip()
                if not track:
                    raise ValueError("A track URL or search phrase is required")
                if len(track) > 2048:
                    raise ValueError("The playlist track is too long")
                await playlist.add_track(track)
        except (OSError, ValueError) as exc:
            return self._error(str(exc), status=400)

        return web.json_response(
            {"ok": True, "playlist": await self._playlist_payload(name)}
        )

    async def _handle_playlist_track_delete(
        self, request: web.Request
    ) -> web.Response:
        try:
            name = self._playlist_name(request.match_info["name"])
            index = int(request.match_info["index"])
            playlist = self.bot.playlist_mgr.get_playlist(f"{name}.txt")
            await playlist.load()
            tracks = list(playlist)
            if not 0 <= index < len(tracks):
                raise ValueError("Playlist track index is outside the playlist")
            await playlist.remove_track(tracks[index], delete_from_ap=True)
        except (OSError, TypeError, ValueError) as exc:
            return self._error(str(exc), status=400)

        return web.json_response(
            {"ok": True, "playlist": await self._playlist_payload(name)}
        )

    async def _handle_permissions(self, _request: web.Request) -> web.Response:
        permissions = self.bot.permissions
        groups = []
        for name, group in permissions.groups.items():
            options = []
            for option in permissions.register.option_list:
                if option.section != name:
                    continue
                options.append(config_option_to_payload(group, option))
            groups.append(
                {
                    "name": name,
                    "display_name": localize_permission_group(name),
                    "options": options,
                }
            )
        return web.json_response({"ok": True, "groups": groups})

    async def _handle_permissions_patch(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            group_name = str(body.get("group", "")).strip()
            option_name = str(body.get("option", "")).strip()
            if not group_name or group_name not in self.bot.permissions.groups:
                raise LookupError("Unknown permission group")
            option = self.bot.permissions.register.get_config_option(
                group_name, option_name
            )
            if option is None:
                raise LookupError("Unknown permission option")
            if not bool(option.editable):
                raise PermissionError("This permission option is read-only")

            value = body.get("value", "")
            if isinstance(value, bool):
                value = "yes" if value else "no"
            elif isinstance(value, list):
                value = ", ".join(str(item) for item in value)
            else:
                value = str(value)

            if not self.bot.permissions.update_option(option, value):
                raise ValueError("The value is invalid for this permission")
            if not self.bot.permissions.save_group(group_name):
                raise OSError("The permissions file could not be saved")
        except PermissionError as exc:
            return self._error(str(exc), status=403)
        except LookupError as exc:
            return self._error(str(exc), status=404)
        except (OSError, ValueError) as exc:
            return self._error(str(exc), status=400)

        group = self.bot.permissions.groups[group_name]
        return web.json_response(
            {
                "ok": True,
                "option": config_option_to_payload(group, option),
            }
        )

    @staticmethod
    def _permission_group_name(raw_name: Any) -> str:
        name = str(raw_name or "").strip()
        if not name or len(name) > 64:
            raise ValueError("Permission group name must contain 1 to 64 characters")
        if any(char in name for char in "[]\r\n") or any(
            ord(char) < 32 for char in name
        ):
            raise ValueError("Permission group name contains invalid characters")
        return name

    def _create_permission_group(self, name: str, source: str | None = None) -> None:
        permissions = self.bot.permissions
        if name in permissions.groups:
            raise ValueError("A permission group with this name already exists")
        if source is not None and source not in permissions.groups:
            raise LookupError("Source permission group does not exist")

        permissions.add_group(name)
        try:
            if source is not None:
                source_group = permissions.groups[source]
                target_group = permissions.groups[name]
                source_options = permissions.register.get_option_dict(source)
                target_options = permissions.register.get_option_dict(name)
                for option_name, target_option in target_options.items():
                    source_option = source_options.get(option_name)
                    if source_option is None:
                        continue
                    setattr(
                        target_group,
                        target_option.dest,
                        copy.deepcopy(getattr(source_group, source_option.dest)),
                    )
            if not permissions.save_group(name):
                raise OSError("The permission group could not be saved")
        except Exception:
            permissions.remove_group(name)
            raise

    def _delete_permission_group(self, name: str) -> None:
        permissions = self.bot.permissions
        if name.lower() in _PROTECTED_PERMISSION_GROUPS:
            raise PermissionError("Owner and Default permission groups are protected")
        if name not in permissions.groups:
            raise LookupError("Permission group does not exist")

        previous_group = permissions.groups[name]
        previous_options = [
            option
            for option in permissions.register.option_list
            if option.section == name
        ]
        permissions.remove_group(name)
        if permissions.save_group(name):
            return

        permissions.groups[name] = previous_group
        option_list = getattr(permissions.register, "_option_list", None)
        if option_list is not None:
            option_list.extend(previous_options)
        else:
            permissions.register.option_list.extend(previous_options)
        raise OSError("The permission group could not be deleted")

    async def _handle_permission_group(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            action = str(body.get("action", "")).strip().lower()
            if action not in {"create", "clone", "rename", "delete"}:
                raise ValueError("Unknown permission group action")

            if action == "create":
                name = self._permission_group_name(body.get("name"))
                self._create_permission_group(name)
            elif action == "clone":
                source = self._permission_group_name(body.get("source"))
                name = self._permission_group_name(body.get("name"))
                self._create_permission_group(name, source=source)
            elif action == "rename":
                source = self._permission_group_name(body.get("source"))
                if source.lower() in _PROTECTED_PERMISSION_GROUPS:
                    raise PermissionError(
                        "Owner and Default permission groups cannot be renamed"
                    )
                name = self._permission_group_name(body.get("name"))
                self._create_permission_group(name, source=source)
                try:
                    self._delete_permission_group(source)
                except Exception:
                    self._delete_permission_group(name)
                    raise
            else:
                name = self._permission_group_name(body.get("name"))
                self._delete_permission_group(name)
        except PermissionError as exc:
            return self._error(str(exc), status=403)
        except LookupError as exc:
            return self._error(str(exc), status=404)
        except (OSError, ValueError) as exc:
            return self._error(str(exc), status=400)

        return web.json_response(
            {
                "ok": True,
                "groups": list(self.bot.permissions.groups),
            }
        )

    async def _handle_restart(self, request: web.Request) -> web.Response:
        try:
            body = await self._json_body(request)
            mode = str(body.get("mode", "")).strip().lower()
            if mode not in {"soft", "full"}:
                raise ValueError("Restart mode must be soft or full")

            from . import exceptions

            restart_code = (
                exceptions.RestartCode.RESTART_SOFT
                if mode == "soft"
                else exceptions.RestartCode.RESTART_FULL
            )
            self.bot.exit_signal = exceptions.RestartSignal(code=restart_code)

            async def delayed_logout() -> None:
                await asyncio.sleep(0)
                await self.bot.logout()

            asyncio.create_task(delayed_logout(), name="MusicBot-WebUI-Restart")
        except ValueError as exc:
            return self._error(str(exc), status=400)

        return web.json_response(
            {"ok": True, "mode": mode, "message": "Restart scheduled"},
            status=202,
        )
