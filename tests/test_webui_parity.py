import pathlib
import unittest


ROOT = pathlib.Path(__file__).parents[1]
LOCAL_ASSETS = ROOT / "musicbot" / "webui_assets"
PUBLIC_APP = ROOT / ".sites-sync" / "app"


class SharedWebUiParityTests(unittest.TestCase):
    def test_local_queue_rows_expose_the_public_reorder_controls(self) -> None:
        """Queue rows must provide button controls when drag-and-drop is unavailable."""
        local_app = (LOCAL_ASSETS / "app.js").read_text(encoding="utf-8")
        public_dashboard = (PUBLIC_APP / "dashboard.tsx").read_text(encoding="utf-8")

        self.assertIn('aria-label="向上移動"', public_dashboard)
        self.assertIn('aria-label="向下移動"', public_dashboard)
        self.assertIn('onReorder(index,index-1)', public_dashboard)
        self.assertIn('onReorder(index,index+1)', public_dashboard)
        self.assertIn('aria-label="清空播放佇列"', public_dashboard)

        self.assertIn('class="queue-move-up icon-button"', local_app)
        self.assertIn('class="queue-move-down icon-button"', local_app)
        self.assertIn("reorderQueue(index, index - 1)", local_app)
        self.assertIn("reorderQueue(index, index + 1)", local_app)
        self.assertIn('state.mutationBusy || index === 0 ? " disabled"', local_app)
        self.assertIn('state.mutationBusy || index === queue.length - 1 ? " disabled"', local_app)
        self.assertIn("row.draggable = !state.mutationBusy", local_app)
        self.assertIn("if (state.mutationBusy || state.draggingIndex === null", local_app)
        local_html = (LOCAL_ASSETS / "index.html").read_text(encoding="utf-8")
        self.assertIn('class="queue-clear icon-button danger"', local_html)
        self.assertIn('aria-label="清空播放佇列"', local_html)

    def test_local_uses_the_public_nonblocking_connection_and_busy_contract(self) -> None:
        """Mutations cannot overlap, and connection loss cannot hide the controls."""
        local_html = (LOCAL_ASSETS / "index.html").read_text(encoding="utf-8")
        local_app = (LOCAL_ASSETS / "app.js").read_text(encoding="utf-8")
        public_app = (PUBLIC_APP / "musicbot-public.tsx").read_text(encoding="utf-8")

        self.assertIn("const [busy, setBusy]", public_app)
        self.assertIn('className="offline-banner"', public_app)
        self.assertIn("mutationBusy: false", local_app)
        self.assertIn("async function runMutation", local_app)
        self.assertIn("if (state.mutationBusy) return null", local_app)
        self.assertIn("setInterval(refreshSnapshot, 2000)", local_app)
        self.assertIn('id="offline-banner"', local_html)

    def test_every_shared_mutation_uses_the_same_busy_gate(self) -> None:
        """Shared edits cannot race polling or submit duplicate requests."""
        local_app = (LOCAL_ASSETS / "app.js").read_text(encoding="utf-8")

        for operation in (
            "async function setPlayerVolume",
            "async function addTrackToQueue",
            "async function queuePlaylistTracks",
            "async function addTrackToPlaylist",
        ):
            start = local_app.index(operation)
            end = local_app.find("\n}\n", start) + 3
            self.assertIn("return runMutation(async () =>", local_app[start:end])

        self.assertIn("function syncQueueRowControls(queue)", local_app)
        self.assertIn(
            "syncQueueRowControls(queue);\n    syncQueueSelectionControls(queue);\n    return;",
            local_app,
        )

    def test_local_playlist_controls_match_the_public_workbench_contract(self) -> None:
        """The shared playlist workbench keeps the public creation and row controls."""
        local_html = (LOCAL_ASSETS / "index.html").read_text(encoding="utf-8")
        local_app = (LOCAL_ASSETS / "app.js").read_text(encoding="utf-8")
        public_playlists = (PUBLIC_APP / "playlists.tsx").read_text(encoding="utf-8")

        self.assertIn("setShowCreate", public_playlists)
        self.assertIn("playlist-tab", public_playlists)
        self.assertIn('aria-label="加入佇列"', public_playlists)
        self.assertIn('aria-label="從播放清單移除"', public_playlists)

        self.assertIn('id="playlist-create-form"', local_html)
        self.assertIn('id="playlist-create-name"', local_html)
        self.assertIn("function setPlaylistCreateOpen", local_app)
        self.assertIn('class="playlist-tab-name"', local_app)
        self.assertIn('class="playlist-queue icon-button"', local_app)
        self.assertIn('class="playlist-remove icon-button danger"', local_app)

    def test_local_shared_controls_keep_the_public_responsive_visual_contract(self) -> None:
        """Queue actions and connection feedback remain usable on small or reduced-motion screens."""
        local_css = (LOCAL_ASSETS / "styles.css").read_text(encoding="utf-8")
        public_css = (PUBLIC_APP / "globals.css").read_text(encoding="utf-8")

        self.assertIn(".icon-button", public_css)
        self.assertIn(".offline-banner", public_css)
        self.assertIn("@media(prefers-reduced-motion:reduce)", public_css)

        self.assertIn(".queue-row-actions", local_css)
        self.assertIn(".icon-button", local_css)
        self.assertIn(".offline-banner", local_css)
        self.assertIn(".is-mutating .queue-item", local_css)


if __name__ == "__main__":
    unittest.main()
