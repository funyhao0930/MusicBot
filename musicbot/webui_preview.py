"""Standalone, local-only preview server for the MusicBot Web UI."""

from __future__ import annotations

import argparse
import copy
import ipaddress
import threading
import webbrowser
from pathlib import Path
from typing import Any

from aiohttp import web


ASSET_DIR = Path(__file__).with_name("webui_assets")
ASSET_CONTENT_TYPES = {
    "styles.css": "text/css",
    "app.js": "application/javascript",
    "icon-shuffle.svg": "image/svg+xml",
    "icon-skip-previous.svg": "image/svg+xml",
    "icon-play.svg": "image/svg+xml",
    "icon-pause.svg": "image/svg+xml",
    "icon-skip-next.svg": "image/svg+xml",
    "icon-repeat.svg": "image/svg+xml",
    "icon-repeat-one.svg": "image/svg+xml",
    "icon-stop.svg": "image/svg+xml",
    "icon-state-dot.svg": "image/svg+xml",
}


def _track(
    title: str,
    source: str,
    duration: int,
    requested_by: str = "Preview User",
) -> dict[str, Any]:
    return {
        "title": title,
        "url": source,
        "duration": duration,
        "requested_by": requested_by,
        "thumbnail": "",
    }


def _playlist_track(title: str, source: str) -> dict[str, str]:
    return {"title": title, "source": source}


def _option(
    section: str,
    option: str,
    value: Any,
    kind: str,
    display_option: str,
    display_comment: str,
) -> dict[str, Any]:
    return {
        "section": section,
        "option": option,
        "value": value,
        "type": kind,
        "editable": True,
        "sensitive": False,
        "comment": display_comment,
        "display_section": "預覽設定",
        "display_option": display_option,
        "display_comment": display_comment,
    }


class PreviewState:
    """Mutable demo data that lives only for the preview process lifetime."""

    def __init__(self) -> None:
        self.history: list[dict[str, Any]] = []
        self.player = {
            "state": "playing",
            "progress": 68,
            "volume": 0.42,
            "shuffle": False,
            "repeat_mode": "off",
            "repeat_song": False,
            "repeat_all": False,
            "can_previous": True,
            "voice_channel": {
                "id": "preview-lounge",
                "name": "Preview Lounge",
            },
            "current": _track("Neon Tide", "preview://neon-tide", 245),
            "queue": [
                _track("Violet Afterglow", "preview://violet-afterglow", 198),
                _track("Midnight Current", "preview://midnight-current", 231),
                _track("Starlit Signal", "preview://starlit-signal", 214),
            ],
        }
        self.playlists = [
            {
                "name": "深夜預覽",
                "filename": "深夜預覽.txt",
                "deletable": True,
                "tracks": [
                    _playlist_track("Neon Tide", "preview://neon-tide"),
                    _playlist_track(
                        "Violet Afterglow",
                        "preview://violet-afterglow",
                    ),
                    _playlist_track(
                        "Midnight Current",
                        "preview://midnight-current",
                    ),
                ],
            },
            {
                "name": "系統示範清單",
                "filename": "系統示範清單.txt",
                "deletable": False,
                "tracks": [
                    _playlist_track(
                        "Starlit Signal",
                        "preview://starlit-signal",
                    ),
                ],
            },
        ]
        self.options = [
            _option(
                "WebUI",
                "WebUIPort",
                8765,
                "integer",
                "本機連接埠",
                "純預覽模式使用的連接埠。",
            ),
            _option(
                "MusicBot",
                "DefaultVolume",
                0.42,
                "number",
                "預設音量",
                "只會改變這次預覽中的假資料。",
            ),
            _option(
                "MusicBot",
                "AutoPlaylist",
                True,
                "boolean",
                "自動播放",
                "預覽用開關，不會寫入設定檔。",
            ),
        ]
        self.permission_groups = [
            {
                "name": "Default",
                "display_name": "預設使用者",
                "options": [
                    _option(
                        "Default",
                        "MaxSongs",
                        5,
                        "integer",
                        "最多歌曲數",
                        "每位使用者可加入的歌曲數。",
                    ),
                    _option(
                        "Default",
                        "AllowPlaylists",
                        True,
                        "boolean",
                        "允許播放清單",
                        "純預覽模式下可自由切換。",
                    ),
                ],
            },
            {
                "name": "DJ",
                "display_name": "DJ",
                "options": [
                    _option(
                        "DJ",
                        "MaxSongs",
                        25,
                        "integer",
                        "最多歌曲數",
                        "DJ 群組的示範限制。",
                    ),
                ],
            },
        ]
        self.logs = [
            "2026-09-01 14:00:00 INFO PREVIEW 純預覽伺服器已啟動",
            "2026-09-01 14:00:00 INFO PREVIEW 未連線 Discord，也未讀取 Bot Token",
            "2026-09-01 14:00:01 INFO PREVIEW 示範資料已載入記憶體",
        ]

    def player_payload(self) -> dict[str, Any]:
        payload = copy.deepcopy(self.player)
        payload["can_previous"] = bool(self.history) or bool(
            payload.get("current")
        )
        return payload

    def playlist(self, name: str) -> dict[str, Any]:
        for playlist in self.playlists:
            if playlist["name"] == name:
                return playlist
        raise web.HTTPNotFound(text="Unknown preview playlist")


def _json_error(message: str, status: int = 400) -> web.Response:
    return web.json_response({"ok": False, "error": message}, status=status)


async def _json_body(request: web.Request) -> dict[str, Any]:
    try:
        body = await request.json()
    except Exception:
        return {}
    return body if isinstance(body, dict) else {}


def _preview_host(value: str) -> str:
    if value.lower() == "localhost":
        return value
    try:
        address = ipaddress.ip_address(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(
            "預覽模式只能綁定 localhost 或 loopback IP"
        ) from exc
    if not address.is_loopback:
        raise argparse.ArgumentTypeError(
            "預覽模式只能綁定 localhost 或 loopback IP"
        )
    return value


def create_preview_app() -> web.Application:
    state = PreviewState()
    app = web.Application()

    async def index(_request: web.Request) -> web.Response:
        html = (ASSET_DIR / "index.html").read_text(encoding="utf-8")
        html = html.replace(
            "<small>本機控制中心</small>",
            "<small>純預覽模式 · 不會連線 Discord</small>",
        )
        html = html.replace("Local only", "Preview only")
        return web.Response(
            text=html,
            content_type="text/html",
            charset="utf-8",
        )

    async def asset(request: web.Request) -> web.Response:
        name = request.match_info["name"]
        content_type = ASSET_CONTENT_TYPES.get(name)
        path = ASSET_DIR / name
        if not content_type or not path.is_file():
            raise web.HTTPNotFound()
        return web.Response(body=path.read_bytes(), content_type=content_type)

    async def status(_request: web.Request) -> web.Response:
        return web.json_response(
            {
                "ok": True,
                "ready": True,
                "network_outage": False,
                "latency_ms": 0,
                "csrf_token": "preview-mode",
                "preview_mode": True,
            }
        )

    async def guilds(_request: web.Request) -> web.Response:
        return web.json_response(
            {
                "ok": True,
                "guilds": [
                    {
                        "id": "preview",
                        "name": "預覽伺服器（假資料）",
                    }
                ],
            }
        )

    async def player(_request: web.Request) -> web.Response:
        return web.json_response(state.player_payload())

    async def player_action(request: web.Request) -> web.Response:
        body = await _json_body(request)
        action = str(body.get("action", ""))
        current = state.player.get("current")
        queue = state.player["queue"]

        if action == "pause" and current:
            state.player["state"] = "paused"
        elif action == "resume" and current:
            state.player["state"] = "playing"
        elif action == "shuffle":
            state.player["shuffle"] = not state.player["shuffle"]
        elif action in {"repeat_song", "repeat_all", "repeat_off"}:
            mode = action.removeprefix("repeat_")
            state.player["repeat_mode"] = mode
            state.player["repeat_song"] = mode == "song"
            state.player["repeat_all"] = mode == "all"
        elif action == "skip":
            if current:
                state.history.append(current)
            state.player["current"] = queue.pop(0) if queue else None
            state.player["progress"] = 0
            state.player["state"] = (
                "playing" if state.player["current"] else "stopped"
            )
        elif action == "previous":
            if state.history:
                if current:
                    queue.insert(0, current)
                state.player["current"] = state.history.pop()
            state.player["progress"] = 0
            state.player["state"] = (
                "playing" if state.player["current"] else "stopped"
            )
        elif action == "stop":
            state.player["state"] = "stopped"
            state.player["progress"] = 0
        elif action == "clear":
            queue.clear()
        else:
            return _json_error("Unknown preview player action")

        return web.json_response(
            {"ok": True, "player": state.player_payload()}
        )

    async def player_volume(request: web.Request) -> web.Response:
        body = await _json_body(request)
        try:
            volume = float(body.get("volume", 25))
        except (TypeError, ValueError):
            return _json_error("volume must be a number")
        if volume > 1:
            volume /= 100
        state.player["volume"] = max(0.01, min(volume, 1.0))
        return web.json_response(
            {"ok": True, "player": state.player_payload()}
        )

    async def player_seek(request: web.Request) -> web.Response:
        body = await _json_body(request)
        try:
            position = float(body.get("position", 0))
        except (TypeError, ValueError):
            return _json_error("position must be a number")
        duration = float(
            (state.player.get("current") or {}).get("duration", 0)
        )
        position = max(0, min(position, duration))
        state.player["progress"] = position
        return web.json_response(
            {
                "ok": True,
                "position": position,
                "player": state.player_payload(),
            }
        )

    async def queue_add(request: web.Request) -> web.Response:
        body = await _json_body(request)
        query = str(body.get("query", "")).strip()
        if not query:
            return _json_error("請輸入預覽歌曲名稱")
        entry = _track(
            query,
            f"preview://queue-{len(state.player['queue']) + 1}",
            205,
        )
        state.player["queue"].append(entry)
        return web.json_response(
            {
                "ok": True,
                "entry": copy.deepcopy(entry),
                "queue": copy.deepcopy(state.player["queue"]),
            }
        )

    async def queue_reorder(request: web.Request) -> web.Response:
        body = await _json_body(request)
        queue = state.player["queue"]
        try:
            source = int(body.get("source_index"))
            target = int(body.get("target_index"))
        except (TypeError, ValueError):
            return _json_error("Queue index is outside the preview queue")
        if not 0 <= source < len(queue) or not 0 <= target < len(queue):
            return _json_error("Queue index is outside the preview queue")
        entry = queue.pop(source)
        queue.insert(target, entry)
        return web.json_response(
            {"ok": True, "queue": copy.deepcopy(queue)}
        )

    async def queue_delete(request: web.Request) -> web.Response:
        queue = state.player["queue"]
        try:
            queue.pop(int(request.match_info["index"]))
        except (ValueError, IndexError):
            return _json_error("Queue index is outside the preview queue")
        return web.json_response(
            {"ok": True, "queue": copy.deepcopy(queue)}
        )

    async def playlists(_request: web.Request) -> web.Response:
        return web.json_response(
            {"ok": True, "playlists": copy.deepcopy(state.playlists)}
        )

    async def playlists_post(request: web.Request) -> web.Response:
        body = await _json_body(request)
        action = str(body.get("action", ""))
        name = str(body.get("name", "")).strip()
        if not name:
            return _json_error("請輸入播放清單名稱")
        if action not in {"create", "add"}:
            return _json_error("Unknown preview playlist action")

        try:
            playlist_data = state.playlist(name)
        except web.HTTPNotFound:
            playlist_data = {
                "name": name,
                "filename": f"{name}.txt",
                "deletable": True,
                "tracks": [],
            }
            state.playlists.append(playlist_data)

        if action == "add":
            source = str(body.get("track", "")).strip()
            if not source:
                return _json_error("請輸入歌曲")
            playlist_data["tracks"].append(
                _playlist_track(source, source)
            )

        return web.json_response(
            {"ok": True, "playlist": copy.deepcopy(playlist_data)}
        )

    async def playlist_title(request: web.Request) -> web.Response:
        playlist_data = state.playlist(request.match_info["name"])
        try:
            track = playlist_data["tracks"][
                int(request.match_info["index"])
            ]
        except (ValueError, IndexError):
            return _json_error(
                "Playlist index is outside the preview playlist"
            )
        return web.json_response(
            {"ok": True, "track": copy.deepcopy(track)}
        )

    async def playlist_queue(request: web.Request) -> web.Response:
        playlist_data = state.playlist(request.match_info["name"])
        entries = [
            _track(
                track["title"],
                track["source"],
                210,
                "Preview Playlist",
            )
            for track in playlist_data["tracks"]
        ]
        state.player["queue"].extend(entries)
        return web.json_response(
            {
                "ok": True,
                "added_count": len(entries),
                "queue": copy.deepcopy(state.player["queue"]),
            }
        )

    async def playlist_tracks(request: web.Request) -> web.Response:
        playlist_data = state.playlist(request.match_info["name"])
        body = await _json_body(request)
        tracks = body.get("tracks")
        if not isinstance(tracks, list) or not tracks:
            return _json_error("tracks must be a non-empty list")
        existing = {track["source"] for track in playlist_data["tracks"]}
        added = 0
        skipped = 0
        for raw in tracks:
            source = str(raw).strip()
            if not source or source in existing:
                skipped += 1
                continue
            playlist_data["tracks"].append(
                _playlist_track(source, source)
            )
            existing.add(source)
            added += 1
        return web.json_response(
            {
                "ok": True,
                "added_count": added,
                "skipped_count": skipped,
                "playlist": copy.deepcopy(playlist_data),
            }
        )

    async def playlist_track_delete(request: web.Request) -> web.Response:
        playlist_data = state.playlist(request.match_info["name"])
        try:
            playlist_data["tracks"].pop(
                int(request.match_info["index"])
            )
        except (ValueError, IndexError):
            return _json_error(
                "Playlist index is outside the preview playlist"
            )
        return web.json_response(
            {"ok": True, "playlist": copy.deepcopy(playlist_data)}
        )

    async def playlist_delete(request: web.Request) -> web.Response:
        playlist_data = state.playlist(request.match_info["name"])
        if not playlist_data["deletable"]:
            return _json_error("這是受保護的示範播放清單", status=403)
        state.playlists.remove(playlist_data)
        return web.json_response(
            {"ok": True, "name": playlist_data["name"]}
        )

    async def config_get(_request: web.Request) -> web.Response:
        return web.json_response(
            {"ok": True, "options": copy.deepcopy(state.options)}
        )

    async def config_patch(request: web.Request) -> web.Response:
        body = await _json_body(request)
        for option in state.options:
            if (
                option["section"] == body.get("section")
                and option["option"] == body.get("option")
            ):
                option["value"] = body.get("value")
                return web.json_response(
                    {"ok": True, "option": copy.deepcopy(option)}
                )
        return _json_error("Unknown preview option", status=404)

    async def config_reload(_request: web.Request) -> web.Response:
        return web.json_response({"ok": True, "preview_mode": True})

    async def logs(request: web.Request) -> web.Response:
        try:
            limit = max(
                1,
                min(int(request.query.get("limit", "200")), 500),
            )
        except ValueError:
            limit = 200
        return web.json_response(
            {
                "ok": True,
                "available": True,
                "lines": state.logs[-limit:],
                "total_lines": len(state.logs),
            }
        )

    async def permissions_get(_request: web.Request) -> web.Response:
        return web.json_response(
            {
                "ok": True,
                "groups": copy.deepcopy(state.permission_groups),
            }
        )

    async def permissions_patch(request: web.Request) -> web.Response:
        body = await _json_body(request)
        for group in state.permission_groups:
            if group["name"] != body.get("group"):
                continue
            for option in group["options"]:
                if option["option"] == body.get("option"):
                    option["value"] = body.get("value")
                    return web.json_response(
                        {"ok": True, "option": copy.deepcopy(option)}
                    )
        return _json_error("Unknown preview permission", status=404)

    async def permission_group(request: web.Request) -> web.Response:
        body = await _json_body(request)
        action = str(body.get("action", ""))
        source = str(body.get("source", "")).strip()
        name = str(body.get("name", "")).strip()

        if action == "delete":
            state.permission_groups[:] = [
                group
                for group in state.permission_groups
                if group["name"] != source
            ]
        elif action in {"create", "clone", "rename"} and name:
            source_group = next(
                (
                    group
                    for group in state.permission_groups
                    if group["name"] == source
                ),
                None,
            )
            if action == "rename" and source_group:
                source_group["name"] = name
                source_group["display_name"] = name
            else:
                options = copy.deepcopy(
                    source_group["options"] if source_group else []
                )
                state.permission_groups.append(
                    {
                        "name": name,
                        "display_name": name,
                        "options": options,
                    }
                )
        else:
            return _json_error(
                "Unknown preview permission group action"
            )

        return web.json_response(
            {
                "ok": True,
                "groups": copy.deepcopy(state.permission_groups),
            }
        )

    async def restart(_request: web.Request) -> web.Response:
        state.logs.append(
            "2026-09-01 14:00:10 INFO PREVIEW 已忽略機器人重啟要求"
        )
        return web.json_response(
            {
                "ok": True,
                "preview_mode": True,
                "message": "純預覽模式不會啟動或重啟音樂機器人",
            }
        )

    app.add_routes(
        [
            web.get("/", index),
            web.get("/assets/{name}", asset),
            web.get("/api/status", status),
            web.get("/api/guilds", guilds),
            web.get("/api/player", player),
            web.post("/api/player/action", player_action),
            web.post("/api/player/volume", player_volume),
            web.post("/api/player/seek", player_seek),
            web.post("/api/queue/add", queue_add),
            web.post("/api/queue/reorder", queue_reorder),
            web.delete("/api/queue/{index}", queue_delete),
            web.get("/api/playlists", playlists),
            web.post("/api/playlists", playlists_post),
            web.get("/api/playlists/{name}/titles/{index}", playlist_title),
            web.post("/api/playlists/{name}/queue", playlist_queue),
            web.post("/api/playlists/{name}/tracks", playlist_tracks),
            web.delete(
                "/api/playlists/{name}/{index}",
                playlist_track_delete,
            ),
            web.delete("/api/playlists/{name}", playlist_delete),
            web.get("/api/config", config_get),
            web.patch("/api/config", config_patch),
            web.post("/api/config/reload", config_reload),
            web.get("/api/logs", logs),
            web.get("/api/permissions", permissions_get),
            web.patch("/api/permissions", permissions_patch),
            web.post("/api/permissions/group", permission_group),
            web.post("/api/restart", restart),
        ]
    )
    return app


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(
        description="啟動 MusicBot Web UI 純預覽模式"
    )
    parser.add_argument("--host", type=_preview_host, default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="不要自動開啟瀏覽器",
    )
    args = parser.parse_args(argv)

    url = f"http://{args.host}:{args.port}/"
    if not args.no_open:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    print(f"純預覽模式：{url}")
    print("不會連線 Discord、不會讀取 Bot Token。按 Ctrl+C 關閉。")
    web.run_app(
        create_preview_app(),
        host=args.host,
        port=args.port,
        print=None,
    )


if __name__ == "__main__":
    main()
