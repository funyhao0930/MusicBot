import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).parents[1]
LOCAL_ASSETS = ROOT / "musicbot" / "webui_assets"
SITE = ROOT / ".sites-sync"

_spec = importlib.util.spec_from_file_location(
    "sync_public_site", ROOT / "tools" / "sync_public_site.py"
)
sync_public_site = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(sync_public_site)


@unittest.skipUnless(SITE.is_dir(), ".sites-sync submodule is not checked out")
class SharedWebUiParityTests(unittest.TestCase):
    def test_public_site_serves_the_local_assets_verbatim(self) -> None:
        """The public site must be regenerated whenever the local Web UI changes."""
        stale = sync_public_site.stale_paths(sync_public_site.expected_files())
        self.assertEqual(
            [],
            [str(path.relative_to(ROOT)) for path in stale],
            "Run: python tools/sync_public_site.py",
        )

    def test_public_page_is_the_local_page_in_public_mode(self) -> None:
        local_html = (LOCAL_ASSETS / "index.html").read_text(encoding="utf-8")
        public_html = sync_public_site.build_public_html(local_html)

        self.assertIn('<html lang="zh-Hant" data-mode="public">', public_html)
        self.assertIn("<title>糖音機網頁控制中心</title>", public_html)
        self.assertIn('property="og:image"', public_html)
        self.assertIn("<small>公開控制中心</small>", public_html)
        self.assertNotIn("data-public-text", public_html)
        self.assertNotIn("本機控制中心", public_html)
        # Everything after the head is shared markup, so the bodies stay structurally equal.
        self.assertEqual(local_html.count("<section"), public_html.count("<section"))
        self.assertIn('src="/assets/app.js', public_html)

    def test_local_only_pages_are_hidden_and_unreachable_in_public_mode(self) -> None:
        local_html = (LOCAL_ASSETS / "index.html").read_text(encoding="utf-8")
        local_css = (LOCAL_ASSETS / "styles.css").read_text(encoding="utf-8")
        local_app = (LOCAL_ASSETS / "app.js").read_text(encoding="utf-8")

        for page in ("settings", "permissions", "logs"):
            self.assertIn(f'data-page="{page}" data-local-only', local_html)
            self.assertIn(f'data-page-panel="{page}" data-local-only', local_html)
        self.assertIn(
            'html[data-mode="public"] [data-local-only] { display: none !important; }',
            local_css,
        )
        self.assertIn(
            'if (isPublicMode() && next.hasAttribute?.("data-local-only")) return;',
            local_app,
        )

    def test_public_root_route_serves_the_generated_page(self) -> None:
        route = (SITE / "app" / "route.ts").read_text(encoding="utf-8")

        self.assertIn("from './webui-html.generated'", route)
        self.assertIn("text/html; charset=utf-8", route)
        self.assertFalse((SITE / "app" / "page.tsx").exists())


if __name__ == "__main__":
    unittest.main()
