import unittest
from collections import deque
from types import SimpleNamespace


class _SeekEntry:
    duration = 180.0

    def __init__(self) -> None:
        self.start_time = None

    def set_start_time(self, position: float) -> None:
        self.start_time = position


class _HistoryEntry(_SeekEntry):
    def __init__(self, name: str, start_time: float = 0.0) -> None:
        super().__init__()
        self.name = name
        self.start_time = start_time


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

    def test_previous_requeues_current_track_after_history_entry_once(self) -> None:
        from musicbot.player import MusicPlayer

        previous = _HistoryEntry("previous", start_time=75.0)
        current = _HistoryEntry("current", start_time=25.0)
        queued = _HistoryEntry("queued")
        stopped = []
        emitted = []
        player = object.__new__(MusicPlayer)
        player._play_history = deque([previous])
        player._previous_transition = False
        player._current_entry = current
        player._current_player = SimpleNamespace(stop=lambda: stopped.append(True))
        player._source = object()
        player._stderr_future = None
        player._seek_position = None
        player.repeatsong = True
        player.loopqueue = True
        player.shuffle = False
        player.playlist = SimpleNamespace(entries=deque([queued]))
        player.bot = SimpleNamespace(config=SimpleNamespace(save_videos=True))
        player.stop = lambda: None
        player.emit = lambda event, **kwargs: emitted.append(event)

        player.previous()

        self.assertEqual(stopped, [True])
        self.assertEqual(previous.start_time, 0.0)
        self.assertEqual(list(player.playlist.entries), [previous, current, queued])
        self.assertFalse(player.can_previous)

        player._playback_finished()

        self.assertEqual(list(player.playlist.entries), [previous, current, queued])
        self.assertEqual(list(player._play_history), [])
        self.assertIn("finished-playing", emitted)

    def test_completed_tracks_keep_only_the_latest_twenty_history_entries(self) -> None:
        from musicbot.player import MusicPlayer

        history = deque(_HistoryEntry(f"old-{index}") for index in range(20))
        current = _HistoryEntry("current")
        player = object.__new__(MusicPlayer)
        player._play_history = history
        player._previous_transition = False
        player._current_entry = current
        player._current_player = None
        player._source = object()
        player._stderr_future = None
        player._seek_position = None
        player.repeatsong = False
        player.loopqueue = False
        player.shuffle = False
        player.state = SimpleNamespace(name="PLAYING")
        player.playlist = SimpleNamespace(entries=deque())
        player.bot = SimpleNamespace(config=SimpleNamespace(save_videos=True))
        player.stop = lambda: None
        player.emit = lambda *args, **kwargs: None

        player._playback_finished()

        self.assertEqual(len(player._play_history), 20)
        self.assertEqual(player._play_history[0].name, "old-1")
        self.assertEqual(player._play_history[-1].name, "current")

    def test_single_repeat_resets_saved_start_time_before_requeue(self) -> None:
        from musicbot.player import MusicPlayer, MusicPlayerState

        entry = _HistoryEntry("repeat", start_time=176.5)
        player = object.__new__(MusicPlayer)
        player._play_history = deque()
        player._previous_transition = False
        player._current_entry = entry
        player._current_player = None
        player._source = object()
        player._stderr_future = None
        player._seek_position = None
        player.repeatsong = True
        player.loopqueue = False
        player.shuffle = False
        player.state = MusicPlayerState.PLAYING
        player.playlist = SimpleNamespace(entries=deque())
        player.bot = SimpleNamespace(config=SimpleNamespace(save_videos=True))
        player.stop = lambda: None
        player.emit = lambda *args, **kwargs: None

        player._playback_finished()

        self.assertEqual(entry.start_time, 0.0)
        self.assertEqual(list(player.playlist.entries), [entry])
