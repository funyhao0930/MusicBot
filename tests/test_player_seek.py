import unittest
from collections import deque
from types import SimpleNamespace


class _SeekEntry:
    duration = 180.0

    def __init__(self) -> None:
        self.start_time = None

    def set_start_time(self, position: float) -> None:
        self.start_time = position


class MusicPlayerSeekTests(unittest.TestCase):
    def test_seek_requeues_once_without_changing_loop_modes(self) -> None:
        from musicbot.player import MusicPlayer

        entry = _SeekEntry()
        queued = object()
        stopped = []
        emitted = []
        player = object.__new__(MusicPlayer)
        player._current_entry = entry
        player._current_player = SimpleNamespace(stop=lambda: stopped.append(True))
        player._source = object()
        player._stderr_future = None
        player._seek_position = None
        player.repeatsong = True
        player.loopqueue = True
        player.playlist = SimpleNamespace(entries=deque([queued]))
        player.bot = SimpleNamespace(config=SimpleNamespace(save_videos=True))
        player.stop = lambda: None
        player.emit = lambda event, **kwargs: emitted.append(event)

        player.seek(72.5)
        self.assertEqual(stopped, [True])
        self.assertEqual(player._seek_position, 72.5)

        player._playback_finished()

        self.assertEqual(entry.start_time, 72.5)
        self.assertEqual(list(player.playlist.entries), [entry, queued])
        self.assertTrue(player.repeatsong)
        self.assertTrue(player.loopqueue)
        self.assertIsNone(player._seek_position)
        self.assertIn("finished-playing", emitted)

    def test_seek_rejects_invalid_positions(self) -> None:
        from musicbot.player import MusicPlayer

        entry = _SeekEntry()
        player = object.__new__(MusicPlayer)
        player._current_entry = entry
        player._current_player = SimpleNamespace(stop=lambda: None)
        player._seek_position = None

        for position in (-1, 181, float("nan"), float("inf")):
            with self.subTest(position=position):
                with self.assertRaises(ValueError):
                    player.seek(position)
