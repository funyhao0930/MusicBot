import ast
import pathlib
import unittest
from collections import deque
from types import SimpleNamespace

from aiohttp.test_utils import TestClient, TestServer


class WebUISecurityTests(unittest.TestCase):
    def test_loopback_host_accepts_only_local_browser_hosts(self) -> None:
        from musicbot.webui import is_loopback_host

        self.assertTrue(is_loopback_host("127.0.0.1:8765"))
        self.assertTrue(is_loopback_host("localhost:8765"))
        self.assertFalse(is_loopback_host("0.0.0.0:8765"))
        self.assertFalse(is_loopback_host("192.168.1.50:8765"))
        self.assertFalse(is_loopback_host("musicbot.example.com"))

    def test_write_security_requires_matching_csrf_and_local_origin(self) -> None:
        from musicbot.webui import validate_write_security

        validate_write_security(
            host="127.0.0.1:8765",
            origin="http://127.0.0.1:8765",
            supplied_token="session-token",
            expected_token="session-token",
        )

        with self.assertRaises(PermissionError):
            validate_write_security(
                host="127.0.0.1:8765",
                origin="http://127.0.0.1:8765",
                supplied_token="wrong",
                expected_token="session-token",
            )

        with self.assertRaises(PermissionError):
            validate_write_security(
                host="127.0.0.1:8765",
                origin="https://example.com",
                supplied_token="session-token",
                expected_token="session-token",
            )


class WebUIDataTests(unittest.TestCase):
    @staticmethod
    def _registered_option_names(path: pathlib.Path) -> list[tuple[str, str]]:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        options = []
        for node in ast.walk(tree):
            if (
                not isinstance(node, ast.Call)
                or not isinstance(node.func, ast.Attribute)
                or node.func.attr != "init_option"
            ):
                continue
            keywords = {keyword.arg: keyword.value for keyword in node.keywords}
            option = keywords.get("option")
            section = keywords.get("section")
            if not isinstance(option, ast.Constant) or not isinstance(option.value, str):
                continue
            section_name = (
                section.value
                if isinstance(section, ast.Constant) and isinstance(section.value, str)
                else "Default"
            )
            options.append((section_name, option.value))
        return options

    def test_all_settings_and_permissions_have_traditional_chinese_labels(self) -> None:
        from musicbot.webui import config_option_to_payload

        root = pathlib.Path(__file__).parents[1]
        option_sources = (
            root / "musicbot" / "config.py",
            root / "musicbot" / "permissions.py",
        )

        for source in option_sources:
            for section, option_name in self._registered_option_names(source):
                option = SimpleNamespace(
                    section=section,
                    option=option_name,
                    dest="value",
                    getter="get",
                    default="",
                    comment="Original English comment",
                    editable=True,
                )
                payload = config_option_to_payload(SimpleNamespace(value=""), option)

                self.assertRegex(payload.get("display_option", ""), r"[\u4e00-\u9fff]")
                self.assertRegex(payload.get("display_comment", ""), r"[\u4e00-\u9fff]")

        permission_group = SimpleNamespace(
            section="Default",
            option="MaxSongs",
            dest="value",
            getter="getint",
            default=0,
            comment="Original English comment",
            editable=True,
        )
        payload = config_option_to_payload(SimpleNamespace(value=8), permission_group)
        self.assertEqual(payload.get("display_section"), "預設")

    def test_sensitive_config_options_never_return_values(self) -> None:
        from musicbot.webui import config_option_to_payload

        option = SimpleNamespace(
            section="Credentials",
            option="Spotify_ClientSecret",
            dest="spotify_clientsecret",
            getter="get",
            default="",
            comment="Spotify secret",
            editable=False,
        )
        config = SimpleNamespace(spotify_clientsecret="top-secret")

        payload = config_option_to_payload(config, option)

        self.assertTrue(payload["sensitive"])
        self.assertIsNone(payload["value"])
        self.assertFalse(payload["editable"])
        self.assertNotIn("top-secret", repr(payload))

    def test_volume_is_limited_to_supported_range(self) -> None:
        from musicbot.webui import normalize_volume

        self.assertEqual(normalize_volume(0.25), 0.25)
        self.assertEqual(normalize_volume(0), 0.01)
        self.assertEqual(normalize_volume(3), 1.0)
        with self.assertRaises(ValueError):
            normalize_volume("loud")

    def test_entry_payload_contains_safe_player_metadata(self) -> None:
        from musicbot.webui import entry_to_payload

        entry = SimpleNamespace(
            title="Night Drive",
            url="https://example.test/track",
            thumbnail_url="https://example.test/cover.jpg",
            duration=183.5,
            author=SimpleNamespace(id=42, display_name="西呱呱"),
        )

        payload = entry_to_payload(entry)

        self.assertEqual(payload["title"], "Night Drive")
        self.assertEqual(payload["duration"], 183.5)
        self.assertEqual(payload["thumbnail"], "https://example.test/cover.jpg")
        self.assertEqual(payload["requested_by"], "西呱呱")
        self.assertNotIn("filename", payload)


class _FakePlaylist:
    def __init__(self, entries):
        self.entries = deque(entries)

    def __len__(self):
        return len(self.entries)

    def shuffle(self):
        self.entries.reverse()

    def clear(self):
        self.entries.clear()

    def delete_entry_at_index(self, index):
        self.entries.rotate(-index)
        item = self.entries.popleft()
        self.entries.rotate(index)
        return item

    def insert_entry_at_index(self, index, entry):
        self.entries.rotate(-index)
        self.entries.appendleft(entry)
        self.entries.rotate(index)


class _FakePlayer:
    def __init__(self, guild, entries):
        self.voice_client = SimpleNamespace(
            guild=guild,
            channel=SimpleNamespace(id=7, name="深夜電台"),
            is_connected=lambda: True,
        )
        self.playlist = _FakePlaylist(entries)
        self.current_entry = entries[0]
        self.progress = 41.5
        self.volume = 0.25
        self.is_playing = True
        self.is_paused = False
        self.is_stopped = False
        self.is_dead = False
        self.repeatsong = False
        self.loopqueue = False
        self.calls = []

    def pause(self):
        self.calls.append("pause")
        self.is_playing = False
        self.is_paused = True

    def resume(self):
        self.calls.append("resume")
        self.is_playing = True
        self.is_paused = False

    def skip(self):
        self.calls.append("skip")

    def stop(self):
        self.calls.append("stop")
        self.is_stopped = True

    def seek(self, position):
        self.calls.append(("seek", position))
        self.progress = position


class WebUIAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        from musicbot.webui import MusicBotWebUI

        self.guild = SimpleNamespace(id=1, name="測試伺服器", unavailable=False)
        self.entries = [
            SimpleNamespace(
                title="Night Drive",
                url="https://example.test/1",
                thumbnail_url="https://example.test/1.jpg",
                duration=183.5,
                author=SimpleNamespace(id=42, display_name="西呱呱"),
            ),
            SimpleNamespace(
                title="After Rain",
                url="https://example.test/2",
                thumbnail_url="",
                duration=201,
                author=None,
            ),
        ]
        self.player = _FakePlayer(self.guild, self.entries)
        self.bot = SimpleNamespace(
            guilds=[self.guild],
            players={1: self.player},
            config=SimpleNamespace(register=SimpleNamespace(option_list=[])),
            permissions=SimpleNamespace(groups={}),
            user=SimpleNamespace(id=9, name="MusicBot"),
            _init_time=100.0,
            init_ok=True,
            network_outage=False,
            latency=0.042,
        )
        self.webui = MusicBotWebUI(self.bot, host="127.0.0.1", port=8765)
        self.client = TestClient(TestServer(self.webui.create_app()))
        await self.client.start_server()

    async def asyncTearDown(self) -> None:
        await self.client.close()

    def _write_headers(self):
        origin = str(self.client.make_url("/"))[:-1]
        return {
            "Origin": origin,
            "X-MusicBot-CSRF": self.webui.csrf_token,
        }

    async def test_status_and_player_snapshot(self) -> None:
        response = await self.client.get("/api/status")
        self.assertEqual(response.status, 200)
        status = await response.json()
        self.assertTrue(status["ready"])
        self.assertEqual(status["guild_count"], 1)
        self.assertEqual(status["player_count"], 1)

        response = await self.client.get("/api/player?guild_id=1")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(payload["state"], "playing")
        self.assertEqual(payload["current"]["title"], "Night Drive")
        self.assertEqual(len(payload["queue"]), 2)
        self.assertEqual(payload["voice_channel"]["name"], "深夜電台")

    async def test_guild_endpoint_serializes_snowflake_as_string(self) -> None:
        guild_id = 1363416878059487264
        self.guild.id = guild_id
        self.bot.players = {guild_id: self.player}

        response = await self.client.get("/api/guilds")
        self.assertEqual(response.status, 200)
        payload = await response.json()

        self.assertEqual(payload["guilds"][0]["id"], str(guild_id))

    async def test_player_action_and_volume_are_applied(self) -> None:
        response = await self.client.post(
            "/api/player/action",
            json={"guild_id": 1, "action": "pause"},
            headers=self._write_headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(self.player.calls, ["pause"])

        response = await self.client.post(
            "/api/player/volume",
            json={"guild_id": 1, "volume": 0.6},
            headers=self._write_headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(self.player.volume, 0.6)

    async def test_repeat_actions_select_song_all_and_off_modes(self) -> None:
        expected_modes = (
            ("repeat_song", True, False, "song"),
            ("repeat_all", False, True, "all"),
            ("repeat_off", False, False, "off"),
        )

        for action, repeat_song, repeat_all, mode in expected_modes:
            response = await self.client.post(
                "/api/player/action",
                json={"guild_id": 1, "action": action},
                headers=self._write_headers(),
            )
            self.assertEqual(response.status, 200)
            payload = await response.json()
            self.assertEqual(self.player.repeatsong, repeat_song)
            self.assertEqual(self.player.loopqueue, repeat_all)
            self.assertEqual(payload["player"]["repeat_mode"], mode)
            self.assertEqual(payload["player"]["repeat_song"], repeat_song)
            self.assertEqual(payload["player"]["repeat_all"], repeat_all)

    async def test_legacy_repeat_action_cycles_without_unknown_error(self) -> None:
        expected_modes = ("song", "all", "off")
        for mode in expected_modes:
            response = await self.client.post(
                "/api/player/action",
                json={"guild_id": 1, "action": "repeat"},
                headers=self._write_headers(),
            )
            self.assertEqual(response.status, 200)
            payload = await response.json()
            self.assertEqual(payload["player"]["repeat_mode"], mode)

        self.player.repeatsong = True
        response = await self.client.post(
            "/api/player/action",
            json={"guild_id": 1, "action": "skip"},
            headers=self._write_headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertFalse(self.player.repeatsong)
        self.assertEqual(self.player.calls[-1], "skip")

    async def test_player_seek_moves_to_requested_position(self) -> None:
        response = await self.client.post(
            "/api/player/seek",
            json={"guild_id": 1, "position": 92.5},
            headers=self._write_headers(),
        )
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(self.player.calls[-1], ("seek", 92.5))
        self.assertEqual(payload["position"], 92.5)

        response = await self.client.post(
            "/api/player/seek",
            json={"guild_id": 1, "position": "not-a-number"},
            headers=self._write_headers(),
        )
        self.assertEqual(response.status, 400)

    async def test_queue_reorder_moves_the_requested_entry(self) -> None:
        response = await self.client.post(
            "/api/queue/reorder",
            json={"guild_id": 1, "source_index": 1, "target_index": 0},
            headers=self._write_headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(self.player.playlist.entries[0].title, "After Rain")

    async def test_write_endpoint_rejects_missing_csrf(self) -> None:
        response = await self.client.post(
            "/api/player/action",
            json={"guild_id": 1, "action": "pause"},
        )
        self.assertEqual(response.status, 403)
        self.assertEqual(self.player.calls, [])


if __name__ == "__main__":
    unittest.main()
