import pathlib
import unittest
from types import SimpleNamespace
from unittest.mock import patch


class WebUIConfigIntegrationTests(unittest.TestCase):
    def test_options_file_registers_local_webui_settings(self) -> None:
        from musicbot.config import Config

        config = Config(pathlib.Path("config/options.ini"))

        self.assertTrue(config.webui_enabled)
        self.assertEqual(config.webui_host, "127.0.0.1")
        self.assertEqual(config.webui_port, 8765)
        self.assertTrue(config.webui_auto_open)
        self.assertTrue(config.webui_public_enabled)
        self.assertEqual(config.webui_public_port, 8766)
        self.assertIsNotNone(
            config.register.get_config_option("WebUI", "WebUIEnabled")
        )
        self.assertIsNotNone(
            config.register.get_config_option("WebUI", "WebUIPublicEnabled")
        )

    def test_webui_host_and_port_are_safely_normalized(self) -> None:
        from musicbot.config import Config

        config = object.__new__(Config)
        config.webui_host = "0.0.0.0"
        config.webui_port = 99999
        config.webui_public_port = 99999

        config._normalize_webui_settings()

        self.assertEqual(config.webui_host, "127.0.0.1")
        self.assertEqual(config.webui_port, 8765)
        self.assertEqual(config.webui_public_port, 8766)

    def test_public_webui_port_never_conflicts_with_local_port(self) -> None:
        from musicbot.config import Config

        config = object.__new__(Config)
        config.webui_host = "127.0.0.1"
        config.webui_port = 8766
        config.webui_public_port = 8766

        config._normalize_webui_settings()

        self.assertEqual(config.webui_port, 8766)
        self.assertEqual(config.webui_public_port, 8767)


class WebUILifecycleIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_musicbot_starts_and_stops_enabled_webui(self) -> None:
        from musicbot.bot import MusicBot

        instances = []

        class FakeWebUI:
            def __init__(self, bot, **kwargs):
                self.bot = bot
                self.kwargs = kwargs
                self.started = False
                self.stopped = False
                instances.append(self)

            async def start(self):
                self.started = True

            async def stop(self):
                self.stopped = True

        fake_bot = SimpleNamespace(
            config=SimpleNamespace(
                webui_enabled=True,
                webui_host="127.0.0.1",
                webui_port=8765,
                webui_auto_open=False,
            ),
            webui=None,
        )

        with patch("musicbot.bot.MusicBotWebUI", FakeWebUI):
            await MusicBot._start_webui(fake_bot)
            self.assertEqual(len(instances), 1)
            self.assertTrue(instances[0].started)
            self.assertEqual(instances[0].kwargs["port"], 8765)

            await MusicBot._stop_webui(fake_bot)
            self.assertTrue(instances[0].stopped)
            self.assertIsNone(fake_bot.webui)

    async def test_webui_bind_failure_does_not_abort_musicbot_startup(self) -> None:
        from musicbot.bot import MusicBot

        class FailingWebUI:
            def __init__(self, *_args, **_kwargs):
                pass

            async def start(self):
                raise OSError("port busy")

        fake_bot = SimpleNamespace(
            config=SimpleNamespace(
                webui_enabled=True,
                webui_host="127.0.0.1",
                webui_port=8765,
                webui_auto_open=False,
            ),
            webui=None,
        )

        with patch("musicbot.bot.MusicBotWebUI", FailingWebUI):
            await MusicBot._start_webui(fake_bot)

        self.assertIsNone(fake_bot.webui)

    async def test_musicbot_starts_and_stops_public_webui_independently(self) -> None:
        from musicbot import bot as bot_module
        from musicbot.bot import MusicBot

        self.assertTrue(
            hasattr(bot_module, "MusicBotPublicWebUI"),
            "MusicBot must import the public Web UI server",
        )
        instances = []

        class FakePublicWebUI:
            def __init__(self, bot, **kwargs):
                self.bot = bot
                self.kwargs = kwargs
                self.started = False
                self.stopped = False
                instances.append(self)

            async def start(self):
                self.started = True

            async def stop(self):
                self.stopped = True

        fake_bot = SimpleNamespace(
            config=SimpleNamespace(
                webui_public_enabled=True,
                webui_public_port=8766,
            ),
            webui=object(),
            webui_public=None,
        )

        with patch.object(bot_module, "MusicBotPublicWebUI", FakePublicWebUI):
            await MusicBot._start_webui_public(fake_bot)
            self.assertEqual(len(instances), 1)
            self.assertTrue(instances[0].started)
            self.assertEqual(instances[0].kwargs["port"], 8766)
            self.assertIsNotNone(fake_bot.webui)

            await MusicBot._stop_webui_public(fake_bot)

        self.assertTrue(instances[0].stopped)
        self.assertIsNone(fake_bot.webui_public)
        self.assertIsNotNone(fake_bot.webui)

    async def test_public_webui_failure_does_not_stop_local_webui(self) -> None:
        from musicbot import bot as bot_module
        from musicbot.bot import MusicBot

        self.assertTrue(
            hasattr(bot_module, "MusicBotPublicWebUI"),
            "MusicBot must import the public Web UI server",
        )

        class FailingPublicWebUI:
            def __init__(self, *_args, **_kwargs):
                pass

            async def start(self):
                raise OSError("public port busy")

        local_webui = object()
        fake_bot = SimpleNamespace(
            config=SimpleNamespace(
                webui_public_enabled=True,
                webui_public_port=8766,
            ),
            webui=local_webui,
            webui_public=None,
        )

        with patch.object(bot_module, "MusicBotPublicWebUI", FailingPublicWebUI):
            await MusicBot._start_webui_public(fake_bot)

        self.assertIs(fake_bot.webui, local_webui)
        self.assertIsNone(fake_bot.webui_public)


if __name__ == "__main__":
    unittest.main()
