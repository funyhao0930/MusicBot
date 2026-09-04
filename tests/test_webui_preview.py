import argparse
import unittest
from pathlib import Path

from aiohttp.test_utils import TestClient, TestServer

from musicbot.webui_preview import _preview_host, create_preview_app


class PreviewLauncherTests(unittest.TestCase):
    def test_double_click_launcher_defaults_to_port_8877(self):
        launcher = (Path(__file__).parents[1] / "preview_webui.bat").read_text(
            encoding="utf-8"
        )

        self.assertIn('IF "%~1"==""', launcher)
        self.assertIn('SET "PREVIEW_ARGS=--port 8877"', launcher)
        self.assertIn('SET "PREVIEW_ARGS=%*"', launcher)
        self.assertIn("preview_webui.py %PREVIEW_ARGS%", launcher)


class WebUIPreviewTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.client = TestClient(TestServer(create_preview_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()

    async def test_preview_serves_existing_ui_assets_and_demo_snapshot(self):
        response = await self.client.get("/")
        self.assertEqual(response.status, 200)
        html = await response.text()
        self.assertIn("純預覽模式 · 不會連線 Discord", html)
        self.assertIn("Preview only", html)

        response = await self.client.get("/assets/app.js")
        self.assertEqual(response.status, 200)
        self.assertEqual(response.content_type, "application/javascript")

        response = await self.client.get("/assets/styles.css")
        self.assertEqual(response.status, 200)
        self.assertEqual(response.content_type, "text/css")

        response = await self.client.get("/assets/not-allowed.js")
        self.assertEqual(response.status, 404)

        status = await (await self.client.get("/api/status")).json()
        self.assertTrue(status["ready"])
        self.assertTrue(status["preview_mode"])
        self.assertEqual(status["csrf_token"], "preview-mode")

        guilds = await (await self.client.get("/api/guilds")).json()
        self.assertEqual(guilds["guilds"][0]["id"], "preview")

        player = await (
            await self.client.get("/api/player?guild_id=preview")
        ).json()
        self.assertEqual(player["state"], "playing")
        self.assertEqual(player["current"]["title"], "Neon Tide")
        self.assertGreaterEqual(len(player["queue"]), 2)

    async def test_preview_actions_mutate_only_in_memory_demo_state(self):
        paused = await (
            await self.client.post(
                "/api/player/action",
                json={"guild_id": "preview", "action": "pause"},
            )
        ).json()
        self.assertEqual(paused["player"]["state"], "paused")

        volume = await (
            await self.client.post(
                "/api/player/volume",
                json={"guild_id": "preview", "volume": 67},
            )
        ).json()
        self.assertAlmostEqual(volume["player"]["volume"], 0.67)

        added = await (
            await self.client.post(
                "/api/queue/add",
                json={"guild_id": "preview", "query": "新的預覽歌曲"},
            )
        ).json()
        self.assertEqual(added["entry"]["title"], "新的預覽歌曲")
        self.assertEqual(added["queue"][-1]["title"], "新的預覽歌曲")

        settings = await (await self.client.get("/api/config")).json()
        self.assertGreaterEqual(len(settings["options"]), 2)

        permissions = await (await self.client.get("/api/permissions")).json()
        self.assertGreaterEqual(len(permissions["groups"]), 1)

        logs = await (await self.client.get("/api/logs?limit=50")).json()
        self.assertTrue(any("PREVIEW" in line for line in logs["lines"]))

    async def test_invalid_playlist_action_does_not_create_a_playlist(self):
        before = await (await self.client.get("/api/playlists")).json()

        response = await self.client.post(
            "/api/playlists",
            json={"action": "unknown", "name": "不該建立"},
        )

        self.assertEqual(response.status, 400)
        after = await (await self.client.get("/api/playlists")).json()
        self.assertEqual(after["playlists"], before["playlists"])

    def test_preview_has_a_standalone_windows_launcher(self):
        root = Path(__file__).parents[1]
        launcher = root / "preview_webui.bat"
        script = root / "preview_webui.py"
        self.assertTrue(launcher.is_file())
        self.assertTrue(script.is_file())
        self.assertIn("preview_webui.py", launcher.read_text(encoding="utf-8"))
        self.assertIn("musicbot.webui_preview", script.read_text(encoding="utf-8"))

    def test_preview_host_rejects_non_loopback_bind_addresses(self):
        self.assertEqual(_preview_host("localhost"), "localhost")
        self.assertEqual(_preview_host("127.0.0.2"), "127.0.0.2")
        self.assertEqual(_preview_host("::1"), "::1")
        with self.assertRaises(argparse.ArgumentTypeError):
            _preview_host("0.0.0.0")


if __name__ == "__main__":
    unittest.main()
