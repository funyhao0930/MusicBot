import asyncio
import unittest
from collections import defaultdict, deque
from types import SimpleNamespace
from unittest import mock

import discord


class VoiceReconnectQueueTest(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        import logging

        from musicbot.utils import _add_logger_level

        # MusicBot registers its extra log levels at startup, not on import.
        if not hasattr(logging.Logger, "everything"):
            _add_logger_level("EVERYTHING", 1)
        if not hasattr(logging.Logger, "voicedebug"):
            _add_logger_level("VOICEDEBUG", 6)

    def _bot(self):
        from musicbot.bot import MusicBot

        bot = object.__new__(MusicBot)
        bot.players = {}
        bot._reconnect_snapshots = {}
        bot.aiolocks = defaultdict(asyncio.Lock)
        bot.config = SimpleNamespace(persistent_queue=False)
        return bot

    async def test_api_disconnect_keeps_queue_for_the_reconnect(self) -> None:
        bot = self._bot()
        channel = object.__new__(discord.VoiceChannel)
        channel.id = 20
        channel.name = "遊戲室"
        guild = SimpleNamespace(id=1, name="guild", voice_client=None)
        channel.guild = guild
        old_player = SimpleNamespace(
            current_entry="now",
            playlist=SimpleNamespace(entries=deque(["next"])),
            serialize=lambda sort_keys=False: '{"queue": "saved"}',
        )
        bot.players[1] = old_player
        bot.server_data = {1: SimpleNamespace(auto_join_channel=channel)}
        bot.get_guild = lambda gid: guild
        bot.get_channel = lambda cid: channel
        snapshots_at_reconnect = []

        async def disconnect_voice_client(target):
            bot.players.pop(target.id, None)

        async def get_player(target, create=False, *, deserialize=False):
            snapshots_at_reconnect.append(dict(bot._reconnect_snapshots))
            return SimpleNamespace(is_stopped=False)

        bot.disconnect_voice_client = disconnect_voice_client
        bot.get_player = get_player

        handled = await bot._handle_api_disconnect(SimpleNamespace(channel=channel))

        self.assertTrue(handled)
        self.assertEqual(snapshots_at_reconnect, [{1: '{"queue": "saved"}'}])

    async def test_new_player_restores_the_snapshot_once(self) -> None:
        bot = self._bot()
        bot._reconnect_snapshots[1] = '{"queue": "saved"}'
        voice_client = object.__new__(discord.VoiceClient)
        channel = SimpleNamespace(guild=SimpleNamespace(id=1))

        async def get_voice_client(target):
            return voice_client

        bot.get_voice_client = get_voice_client
        restored = SimpleNamespace(playlist=["a", "b"])
        restored.on = lambda event, handler: restored

        with mock.patch("musicbot.bot.Playlist"), mock.patch(
            "musicbot.bot.MusicPlayer.from_json", return_value=restored
        ) as from_json:
            player = await bot.get_player(channel, create=True, deserialize=True)

        self.assertIs(player, restored)
        self.assertIs(bot.players[1], restored)
        self.assertEqual(from_json.call_args.args[0], '{"queue": "saved"}')
        self.assertEqual(bot._reconnect_snapshots, {})


if __name__ == "__main__":
    unittest.main()
