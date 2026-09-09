import unittest
from collections import deque


class _Entry:
    def __init__(self, name: str) -> None:
        self.name = name


class _Playlist:
    def __init__(self, entries) -> None:
        self.entries = deque(entries)


class _PlaybackSource:
    def __init__(self) -> None:
        self.stopped = False

    def stop(self) -> None:
        self.stopped = True


class MusicPlayerQueueSelectionTests(unittest.TestCase):
    def _player(self, entries):
        from musicbot.player import MusicPlayer

        player = object.__new__(MusicPlayer)
        player.playlist = _Playlist(entries)
        player._current_entry = _Entry("current")
        player._current_player = _PlaybackSource()
        player.repeatsong = True
        return player

    def test_selecting_a_queue_entry_skips_earlier_pending_tracks(self) -> None:
        first = _Entry("first")
        selected = _Entry("selected")
        after = _Entry("after")
        player = self._player([first, selected, after])
        playback = player._current_player

        result = player.play_queue_index(1)

        self.assertIs(result, selected)
        self.assertTrue(playback.stopped)
        self.assertFalse(player.repeatsong)
        self.assertEqual(
            [entry.name for entry in player.playlist.entries],
            ["selected", "after"],
        )

    def test_failed_transition_restores_the_queue_and_repeat_state(self) -> None:
        entries = [_Entry("first"), _Entry("second")]
        player = self._player(entries)
        player._current_player = None

        with self.assertRaises(RuntimeError):
            player.play_queue_index(1)

        self.assertEqual(list(player.playlist.entries), entries)
        self.assertTrue(player.repeatsong)

    def test_invalid_index_does_not_change_the_queue(self) -> None:
        entries = [_Entry("first")]
        player = self._player(entries)

        with self.assertRaises(ValueError):
            player.play_queue_index(2)

        self.assertEqual(list(player.playlist.entries), entries)


if __name__ == "__main__":
    unittest.main()
