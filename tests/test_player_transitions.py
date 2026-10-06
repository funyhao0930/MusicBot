import asyncio
import unittest
from collections import deque
from types import SimpleNamespace


class _Entry:
    duration = 180.0

    def __init__(self, name: str, start_time: float = 0.0) -> None:
        self.name = name
        self.start_time = start_time

    def set_start_time(self, position: float) -> None:
        self.start_time = position


class _Harness:
    """A MusicPlayer stripped down to what playback transitions touch."""

    def __init__(
        self,
        current,
        queued=(),
        *,
        state="PLAYING",
        loopqueue=False,
        repeatsong=False,
        save_videos=True,
    ) -> None:
        from musicbot.player import MusicPlayer, MusicPlayerState

        self.stops = []
        self.events = []
        self.cleanups = []
        player = object.__new__(MusicPlayer)
        player._play_history = deque()
        player._previous_transition = False
        player._current_entry = current
        player._current_player = None
        player._source = object()
        player._stderr_future = None
        player._seek_position = None
        player.repeatsong = repeatsong
        player.loopqueue = loopqueue
        player.shuffle = False
        player.state = MusicPlayerState[state]
        player.playlist = SimpleNamespace(entries=deque(queued))
        player.bot = SimpleNamespace(
            config=SimpleNamespace(save_videos=save_videos),
            create_task=lambda target, name=None: self.cleanups.append(target),
        )
        # the cleanup coroutine is replaced by the entry it would delete
        player._handle_file_cleanup = lambda entry: entry
        player.stop = lambda: self.stops.append(True)
        player.emit = lambda event, **kwargs: self.events.append((event, kwargs))
        self.player = player

    def names(self):
        return [entry.name for entry in self.player.playlist.entries]


class PlaybackFinishedTransitionTests(unittest.TestCase):
    def test_stopped_track_waits_at_the_queue_head_without_history(self) -> None:
        current = _Entry("current", start_time=95.0)
        harness = _Harness(
            current,
            [_Entry("queued")],
            state="STOPPED",
            loopqueue=True,
            repeatsong=True,
        )

        harness.player._playback_finished()

        self.assertEqual(harness.names(), ["current", "queued"])
        self.assertEqual(current.start_time, 0)
        self.assertEqual(list(harness.player._play_history), [])
        event, details = harness.events[-1]
        self.assertEqual(event, "finished-playing")
        self.assertTrue(details["stopped"])

    def test_killed_player_keeps_nothing_and_deletes_the_file(self) -> None:
        current = _Entry("current")
        harness = _Harness(current, state="DEAD", loopqueue=True, save_videos=False)

        harness.player._playback_finished()

        self.assertEqual(harness.names(), [])
        self.assertEqual(list(harness.player._play_history), [])
        self.assertEqual(harness.cleanups, [current])
        # the callback must not bring a dead player back to the stopped state
        self.assertEqual(harness.stops, [])

    def test_finished_track_is_not_marked_as_stopped(self) -> None:
        harness = _Harness(_Entry("current"))

        harness.player._playback_finished()

        event, details = harness.events[-1]
        self.assertEqual(event, "finished-playing")
        self.assertFalse(details["stopped"])

    def test_loop_all_restarts_a_seeked_track_from_the_beginning(self) -> None:
        current = _Entry("current", start_time=120.0)
        harness = _Harness(current, [_Entry("queued")], loopqueue=True)

        harness.player._playback_finished()

        self.assertEqual(harness.names(), ["queued", "current"])
        self.assertEqual(current.start_time, 0)
        self.assertEqual(list(harness.player._play_history), [current])


class PreviousTrackTransitionTests(unittest.TestCase):
    def _harness(self, previous, current, queued):
        harness = _Harness(current, queued, loopqueue=True)
        harness.player._play_history = deque([previous])
        harness.player._current_player = SimpleNamespace(stop=lambda: None)
        return harness

    def test_loop_all_moves_the_looped_copy_instead_of_duplicating_it(self) -> None:
        previous = _Entry("previous")
        current = _Entry("current")
        # loop-all re-appended the finished track to the end of the queue
        harness = self._harness(previous, current, [_Entry("queued"), previous])

        harness.player.previous()

        self.assertEqual(harness.names(), ["previous", "current", "queued"])

    def test_failed_previous_restores_the_looped_copy(self) -> None:
        previous = _Entry("previous")
        current = _Entry("current")
        harness = self._harness(previous, current, [_Entry("queued"), previous])
        harness.player._current_player = None

        with self.assertRaises(RuntimeError):
            harness.player.previous()

        self.assertEqual(harness.names(), ["queued", "previous"])
        self.assertEqual(list(harness.player._play_history), [previous])
        self.assertFalse(harness.player._previous_transition)

    def test_single_looping_song_is_queued_once(self) -> None:
        only = _Entry("only")
        harness = self._harness(only, only, [])

        harness.player.previous()

        self.assertEqual(harness.names(), ["only"])


class FinishedPlayingHandlerTests(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls) -> None:
        import logging

        from musicbot.utils import _add_logger_level

        # MusicBot registers its extra log levels at startup, not on import.
        if not hasattr(logging.Logger, "everything"):
            _add_logger_level("EVERYTHING", 1)

    async def _finish(self, *, stopped: bool):
        from musicbot.bot import MusicBot

        guild = SimpleNamespace(id=1)
        queued = SimpleNamespace(author=None, channel=None)
        plays = []
        serialized = []

        bot = object.__new__(MusicBot)
        bot.loop = asyncio.get_running_loop()
        bot.logout_called = False
        bot.config = SimpleNamespace(
            enable_queue_history_global=False,
            enable_queue_history_guilds=False,
            leave_after_queue_empty=False,
            delete_nowplaying=False,
            auto_playlist=True,
        )
        bot.server_data = {1: SimpleNamespace(current_playing_url="")}

        async def serialize_queue(target_guild):
            serialized.append(target_guild)

        bot.serialize_queue = serialize_queue
        player = SimpleNamespace(
            voice_client=SimpleNamespace(guild=guild, is_connected=lambda: True),
            playlist=_QueueStub([queued]),
            current_entry=None,
            is_dead=False,
            autoplaylist=[],
            play=lambda _continue=False: plays.append(_continue),
        )

        await bot.on_player_finished_playing(player, stopped=stopped)
        return plays, serialized

    async def test_stopped_player_does_not_start_the_next_song(self) -> None:
        plays, serialized = await self._finish(stopped=True)

        self.assertEqual(plays, [])
        self.assertEqual(len(serialized), 1)

    async def test_finished_song_still_continues_with_the_queue(self) -> None:
        plays, _serialized = await self._finish(stopped=False)

        self.assertEqual(plays, [True])


class _QueueStub:
    def __init__(self, entries) -> None:
        self.entries = deque(entries)

    def __len__(self) -> int:
        return len(self.entries)

    def peek(self):
        return self.entries[0] if self.entries else None


if __name__ == "__main__":
    unittest.main()
