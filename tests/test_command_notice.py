import unittest
import logging
import pathlib
import tempfile
from types import SimpleNamespace

import discord

from musicbot.constructs import _append_command_usage_notice


DEFAULT_NOTICE = "提醒：請大家不要再使用這個舊方法，改用網頁控制。"


class CommandUsageNoticeTests(unittest.TestCase):
    def test_appends_notice_to_text_command_response(self) -> None:
        result = _append_command_usage_notice("已加入播放佇列", DEFAULT_NOTICE)

        self.assertEqual(
            result,
            "已加入播放佇列\n\n提醒：請大家不要再使用這個舊方法，改用網頁控制。",
        )

    def test_uses_custom_notice_text(self) -> None:
        result = _append_command_usage_notice(
            "已加入播放佇列", "請改用控制中心操作。"
        )

        self.assertEqual(result, "已加入播放佇列\n\n請改用控制中心操作。")

    def test_empty_notice_leaves_command_response_unchanged(self) -> None:
        result = _append_command_usage_notice("已加入播放佇列", "")

        self.assertEqual(result, "已加入播放佇列")

    def test_appends_notice_to_embed_description(self) -> None:
        embed = discord.Embed(title="目前播放")

        result = _append_command_usage_notice(embed, DEFAULT_NOTICE)

        self.assertIs(result, embed)
        self.assertEqual(
            embed.description,
            "提醒：請大家不要再使用這個舊方法，改用網頁控制。",
        )


class CommandResponseDeliveryTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        if not hasattr(logging, "NOISY"):
            logging.NOISY = 4

    async def test_safe_send_message_appends_notice_when_marked(self) -> None:
        from musicbot.bot import MusicBot

        class FakeChannel:
            def __init__(self) -> None:
                self.sent_content = None

            async def send(self, content, *, tts=False):
                self.sent_content = content
                return object()

        bot = object.__new__(MusicBot)
        bot.config = SimpleNamespace(
            delete_messages=False,
            delete_invoking=False,
            command_usage_notice="請改用控制中心操作。",
        )
        channel = FakeChannel()

        await bot.safe_send_message(
            channel,
            "已加入播放佇列",
            command_response=True,
        )

        self.assertEqual(
            channel.sent_content,
            "已加入播放佇列\n\n請改用控制中心操作。",
        )


class CommandUsageNoticeConfigTests(unittest.TestCase):
    def test_loads_custom_notice_from_chat_config(self) -> None:
        from musicbot.config import Config

        options = pathlib.Path("config/example_options.ini").read_text(
            encoding="utf-8"
        )
        options = options.replace(
            "CommandUsageNotice = 提醒：請大家不要再使用這個舊方法，改用網頁控制。",
            "CommandUsageNotice = 請改用控制中心操作。",
        )

        with tempfile.TemporaryDirectory() as temp_dir:
            options_path = pathlib.Path(temp_dir) / "options.ini"
            options_path.write_text(options, encoding="utf-8")
            config = Config(options_path)

        self.assertEqual(config.command_usage_notice, "請改用控制中心操作。")


if __name__ == "__main__":
    unittest.main()
