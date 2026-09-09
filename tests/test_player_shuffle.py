import unittest
from collections import deque
from types import SimpleNamespace


class _Entry:
    def __init__(self, name: str) -> None:
        self.name = name


class _Playlist:
    def __init__(self, entries) -> None:
        self.entries = deque(entries)
        self.shuffle_calls = 0

    def shuffle(self) -> None:
        self.shuffle_calls += 1
        self.entries.reverse()


class MusicPlayerShuffleTests(unittest.TestCase):
    def _player(self, entries):
        from musicbot.player import MusicPlayer

        player = object.__new__(MusicPlayer)
        player.playlist = _Playlist(entries)
        player.shuffle = False
        player.emit = lambda *args, **kwargs: None
        return player

    def test_disabling_shuffle_restores_the_original_queue_once(self) -> None:
        first = _Entry("first")
        second = _Entry("second")
        third = _Entry("third")
        player = self._player([first, second, third])

        player.set_shuffle(True)

        self.assertTrue(player.shuffle)
        self.assertEqual(
            [entry.name for entry in player.playlist.entries],
            ["third", "second", "first"],
        )
        self.assertEqual(player.playlist.shuffle_calls, 1)

        player.set_shuffle(False)

        self.assertFalse(player.shuffle)
        self.assertEqual(
            [entry.name for entry in player.playlist.entries],
            ["first", "second", "third"],
        )
        self.assertEqual(player.playlist.shuffle_calls, 1)

    def test_disabling_shuffle_keeps_new_entries_and_drops_removed_entries(self) -> None:
        first = _Entry("first")
        second = _Entry("second")
        third = _Entry("third")
        added = _Entry("added")
        player = self._player([first, second, third])

        player.set_shuffle(True)
        player.playlist.entries.remove(second)
        player.playlist.entries.append(added)
        player.set_shuffle(False)

        self.assertEqual(
            [entry.name for entry in player.playlist.entries],
            ["first", "third", "added"],
        )

    def test_adding_an_entry_does_not_reshuffle_an_enabled_queue(self) -> None:
        first = _Entry("first")
        second = _Entry("second")
        added = _Entry("added")
        player = self._player([first, second])

        player.set_shuffle(True)
        player.playlist.entries.append(added)
        player.on_entry_added(player.playlist, added)

        self.assertEqual(player.playlist.shuffle_calls, 1)
        self.assertEqual(
            [entry.name for entry in player.playlist.entries],
            ["second", "first", "added"],
        )

    def test_looping_a_track_does_not_reshuffle_an_enabled_queue(self) -> None:
        from musicbot.player import MusicPlayerState

        current = _Entry("current")
        queued = _Entry("queued")
        player = self._player([queued])
        player._current_entry = current
        player._current_player = None
        player._source = object()
        player._stderr_future = None
        player._seek_position = None
        player._previous_transition = False
        player._play_history = deque()
        player.repeatsong = False
        player.loopqueue = True
        player.shuffle = True
        player.state = MusicPlayerState.PLAYING
        player.bot = SimpleNamespace(config=SimpleNamespace(save_videos=True))
        player.stop = lambda: None

        player._playback_finished()

        self.assertEqual(player.playlist.shuffle_calls, 0)
        self.assertEqual(
            [entry.name for entry in player.playlist.entries],
            ["queued", "current"],
        )
