import configparser
import pathlib
import tempfile
import unittest
from types import SimpleNamespace

from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

from tests.test_webui import _FakePlayer


class PublicRouteDefinitionTests(unittest.TestCase):
    def test_webui_exports_the_public_route_contract(self) -> None:
        from musicbot import webui

        self.assertTrue(
            hasattr(webui, "public_api_routes"),
            "musicbot.webui must expose reusable public API routes",
        )


class PublicWebUIAPITests(unittest.IsolatedAsyncioTestCase):
    proxy_token = "proxy-token-for-tests"

    def _bot(self):
        guild = SimpleNamespace(id=1, name="測試伺服器", unavailable=False)
        entry = SimpleNamespace(
            title="Night Drive",
            url="https://example.test/1",
            thumbnail_url="",
            duration=183,
            author=None,
        )
        player = _FakePlayer(guild, [entry])
        bot = SimpleNamespace(
            guilds=[guild],
            players={1: player},
            config=SimpleNamespace(register=SimpleNamespace(option_list=[])),
            permissions=SimpleNamespace(groups={}),
            user=SimpleNamespace(id=9, name="MusicBot"),
            _init_time=100.0,
            init_ok=True,
            network_outage=False,
            latency=0.01,
        )
        return bot, player

    def _public_class(self):
        try:
            from musicbot.webui_public import MusicBotPublicWebUI
        except ImportError as exc:
            self.fail(f"public Web UI module is missing: {exc}")
        return MusicBotPublicWebUI

    async def _start_client(self, ui_class=None):
        bot, player = self._bot()
        cls = ui_class or self._public_class()
        ui = cls(bot, port=8766, proxy_token=self.proxy_token)
        client = TestClient(TestServer(ui.create_app()))
        await client.start_server()
        self.addAsyncCleanup(client.close)
        return ui, client, player

    def _proxy_headers(self):
        return {"X-MusicBot-Proxy-Token": self.proxy_token}

    async def test_public_server_is_fixed_to_loopback_and_default_port(self) -> None:
        bot, _player = self._bot()
        ui = self._public_class()(bot, proxy_token=self.proxy_token)

        self.assertEqual(ui.host, "127.0.0.1")
        self.assertEqual(ui.port, 8766)

    async def test_every_public_request_requires_the_proxy_token(self) -> None:
        _ui, client, _player = await self._start_client()

        missing = await client.get("/api/status")
        wrong = await client.get(
            "/api/status",
            headers={"X-MusicBot-Proxy-Token": "wrong"},
        )
        accepted = await client.get(
            "/api/status",
            headers=self._proxy_headers(),
        )

        self.assertEqual(missing.status, 403)
        self.assertEqual(wrong.status, 403)
        self.assertEqual(accepted.status, 200)

    async def test_public_write_requires_proxy_token_and_existing_csrf(self) -> None:
        ui, client, player = await self._start_client()
        body = {"guild_id": 1, "action": "pause"}

        no_csrf = await client.post(
            "/api/player/action",
            json=body,
            headers=self._proxy_headers(),
        )
        wrong_proxy = await client.post(
            "/api/player/action",
            json=body,
            headers={
                "X-MusicBot-Proxy-Token": "wrong",
                "X-MusicBot-CSRF": ui.csrf_token,
            },
        )
        accepted = await client.post(
            "/api/player/action",
            json=body,
            headers={
                **self._proxy_headers(),
                "X-MusicBot-CSRF": ui.csrf_token,
            },
        )

        self.assertEqual(no_csrf.status, 403)
        self.assertEqual(wrong_proxy.status, 403)
        self.assertEqual(accepted.status, 200)
        self.assertEqual(player.calls, ["pause"])

    async def test_public_app_registers_only_the_approved_routes(self) -> None:
        ui, _client, _player = await self._start_client()
        routes = {
            (route.method, route.resource.canonical)
            for route in ui.create_app().router.routes()
            if route.method != "HEAD"
        }

        self.assertEqual(
            routes,
            {
                ("GET", "/api/status"),
                ("GET", "/api/guilds"),
                ("GET", "/api/player"),
                ("POST", "/api/player/action"),
                ("POST", "/api/player/volume"),
                ("POST", "/api/player/seek"),
                ("POST", "/api/queue/add"),
                ("POST", "/api/queue/reorder"),
                ("DELETE", "/api/queue/{index}"),
                ("GET", "/api/playlists"),
                ("GET", "/api/playlists/{name}/titles"),
                ("POST", "/api/playlists"),
                ("DELETE", "/api/playlists/{name}/{index}"),
                ("POST", "/api/playlists/{name}/queue"),
            },
        )

    async def test_private_local_endpoints_are_not_found_publicly(self) -> None:
        _ui, client, _player = await self._start_client()
        headers = self._proxy_headers()

        for path in ("/api/config", "/api/permissions", "/api/logs"):
            response = await client.get(path, headers=headers)
            self.assertEqual(response.status, 404, path)

        response = await client.post("/api/restart", json={}, headers=headers)
        self.assertEqual(response.status, 404)

    async def test_public_unhandled_exception_returns_safe_chinese_error(self) -> None:
        base = self._public_class()

        class ExplodingPublicWebUI(base):
            async def _handle_status(self, _request):
                raise RuntimeError("database password=super-secret")

        _ui, client, _player = await self._start_client(ExplodingPublicWebUI)
        response = await client.get(
            "/api/status",
            headers=self._proxy_headers(),
        )
        payload = await response.json()

        self.assertEqual(response.status, 500)
        self.assertEqual(payload["error"], "伺服器暫時無法處理請求，請稍後再試。")
        self.assertNotIn("super-secret", repr(payload))
        self.assertNotIn("password", repr(payload))

    async def test_public_handler_5xx_body_is_replaced_with_safe_error(self) -> None:
        base = self._public_class()

        class LeakingPublicWebUI(base):
            async def _handle_status(self, _request):
                return web.json_response(
                    {"error": "filesystem secret path"}, status=500
                )

        _ui, client, _player = await self._start_client(LeakingPublicWebUI)
        response = await client.get(
            "/api/status",
            headers=self._proxy_headers(),
        )
        payload = await response.json()

        self.assertEqual(response.status, 500)
        self.assertEqual(payload["error"], "伺服器暫時無法處理請求，請稍後再試。")
        self.assertNotIn("filesystem secret path", repr(payload))


class PublicProxyTokenTests(unittest.TestCase):
    def test_proxy_token_is_created_once_with_high_entropy(self) -> None:
        try:
            from musicbot.webui_public import load_or_create_proxy_token
        except ImportError as exc:
            self.fail(f"public proxy token support is missing: {exc}")

        with tempfile.TemporaryDirectory() as temp_dir:
            token_path = pathlib.Path(temp_dir) / "data" / "proxy.token"
            first = load_or_create_proxy_token(token_path)
            second = load_or_create_proxy_token(token_path)

            self.assertEqual(first, second)
            self.assertEqual(token_path.read_text(encoding="utf-8"), first)
            self.assertGreaterEqual(len(first), 64)
            self.assertNotIn("\n", first)


class PublicWebUIOptionsFileTests(unittest.TestCase):
    def test_example_disables_public_api_and_local_options_enable_it(self) -> None:
        example = configparser.ConfigParser(interpolation=None)
        example.read("config/example_options.ini", encoding="utf-8")
        local = configparser.ConfigParser(interpolation=None)
        local.read("config/options.ini", encoding="utf-8")

        self.assertFalse(example.getboolean("WebUI", "WebUIPublicEnabled"))
        self.assertEqual(example.getint("WebUI", "WebUIPublicPort"), 8766)
        self.assertTrue(local.getboolean("WebUI", "WebUIPublicEnabled"))
        self.assertEqual(local.getint("WebUI", "WebUIPublicPort"), 8766)


if __name__ == "__main__":
    unittest.main()
