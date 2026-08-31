import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace


class AutoPlaylistManagerTests(unittest.TestCase):
    def test_delete_playlist_removes_custom_file_and_manager_entry(self):
        from musicbot.autoplaylist import AutoPlaylistManager

        with tempfile.TemporaryDirectory() as directory:
            playlist_dir = Path(directory)
            playlist_file = playlist_dir / "late-night.txt"
            playlist_file.write_text("track one\n", encoding="utf8")
            bot = SimpleNamespace(
                config=SimpleNamespace(
                    auto_playlist_dir=playlist_dir,
                    enable_queue_history_global=False,
                )
            )
            manager = AutoPlaylistManager(bot)

            manager.delete_playlist("late-night.txt")

            self.assertFalse(playlist_file.exists())
            self.assertNotIn("late-night", manager.playlist_names)

    def test_delete_playlist_protects_system_file(self):
        from musicbot.autoplaylist import AutoPlaylistManager

        with tempfile.TemporaryDirectory() as directory:
            playlist_dir = Path(directory)
            playlist_file = playlist_dir / "default.txt"
            playlist_file.write_text("track one\n", encoding="utf8")
            bot = SimpleNamespace(
                config=SimpleNamespace(
                    auto_playlist_dir=playlist_dir,
                    enable_queue_history_global=False,
                )
            )
            manager = AutoPlaylistManager(bot)

            with self.assertRaises(PermissionError):
                manager.delete_playlist("default.txt")

            self.assertTrue(playlist_file.exists())

    def test_delete_playlist_protects_system_file_case_insensitively(self):
        from musicbot.autoplaylist import AutoPlaylistManager

        with tempfile.TemporaryDirectory() as directory:
            playlist_dir = Path(directory)
            playlist_file = playlist_dir / "default.txt"
            playlist_file.write_text("track one\n", encoding="utf8")
            bot = SimpleNamespace(
                config=SimpleNamespace(
                    auto_playlist_dir=playlist_dir,
                    enable_queue_history_global=False,
                )
            )
            manager = AutoPlaylistManager(bot)

            with self.assertRaises(PermissionError):
                manager.delete_playlist("DEFAULT.txt")

            self.assertTrue(playlist_file.exists())


if __name__ == "__main__":
    unittest.main()
