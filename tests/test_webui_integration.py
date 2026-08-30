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
        self.assertIsNotNone(
            config.register.get_config_option("WebUI", "WebUIEnabled")
        )

    def test_webui_host_and_port_are_safely_normalized(self) -> None:
        from musicbot.config import Config

        config = object.__new__(Config)
        config.webui_host = "0.0.0.0"
        config.webui_port = 99999

        config._normalize_webui_settings()

        self.assertEqual(config.webui_host, "127.0.0.1")
        self.assertEqual(config.webui_port, 8765)


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


if __name__ == "__main__":
    unittest.main()
