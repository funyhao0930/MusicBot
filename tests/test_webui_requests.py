import unittest
from collections import deque
from types import SimpleNamespace


class WebRequestEntryTests(unittest.TestCase):
    def _entry(self, **info_fields):
        from musicbot.downloader import YtdlpResponseDict
        from musicbot.entry import URLPlaylistEntry

        bot = SimpleNamespace(
            downloader=None,
            filecache=None,
            config=SimpleNamespace(default_speed=1.0),
        )
        playlist = SimpleNamespace(bot=bot)
        info = YtdlpResponseDict(
            {
                "__input_subject": "night drive",
                "title": "Night Drive",
                "duration": 180,
                **info_fields,
            }
        )
        return URLPlaylistEntry(playlist, info)

    def test_web_ui_requests_are_not_auto_playlist_entries(self) -> None:
        from musicbot.constants import WEBUI_REQUEST_INFO_KEY

        entry = self._entry(**{WEBUI_REQUEST_INFO_KEY: True})

        self.assertTrue(entry.from_web_ui)
        self.assertFalse(entry.from_auto_playlist)

    def test_entries_nobody_requested_still_belong_to_the_auto_playlist(self) -> None:
        entry = self._entry()

        self.assertFalse(entry.from_web_ui)
        self.assertTrue(entry.from_auto_playlist)

    def test_the_web_ui_mark_is_saved_with_the_persistent_queue(self) -> None:
        from musicbot.constants import WEBUI_REQUEST_INFO_KEY

        entry = self._entry(**{WEBUI_REQUEST_INFO_KEY: True})

        self.assertTrue(entry.__json__()["data"]["info"][WEBUI_REQUEST_INFO_KEY])


class _QueuedEntry:
    def __init__(self, name, author=None, from_web_ui=False) -> None:
        self.name = name
        self.author = author
        self.from_web_ui = from_web_ui


class RoundRobinWebRequestTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        import logging

        from musicbot.utils import _add_logger_level

        # MusicBot registers its extra log levels at startup, not on import.
        if not hasattr(logging.Logger, "everything"):
            _add_logger_level("EVERYTHING", 1)

    def test_web_ui_requests_take_turns_instead_of_being_dropped(self) -> None:
        from musicbot.playlist import Playlist

        alice = SimpleNamespace(id=1, name="alice")
        playlist = object.__new__(Playlist)
        playlist.entries = deque(
            [
                _QueuedEntry("alice-1", author=alice),
                _QueuedEntry("alice-2", author=alice),
                _QueuedEntry("web-1", from_web_ui=True),
                _QueuedEntry("web-2", from_web_ui=True),
                _QueuedEntry("auto-1"),
            ]
        )

        playlist.reorder_for_round_robin()

        # auto playlist filler still makes way, as round-robin always did
        self.assertEqual(
            [entry.name for entry in playlist.entries],
            ["alice-1", "web-1", "alice-2", "web-2"],
        )


if __name__ == "__main__":
    unittest.main()
