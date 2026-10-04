"""Copy the local Web UI into the public site so both serve identical assets.

musicbot/webui_assets is the single source of truth. This script copies every
asset into .sites-sync/public/assets and embeds index.html (with public-mode
tweaks) into .sites-sync/app/webui-html.generated.ts.

Usage:
    python tools/sync_public_site.py          # write the public site files
    python tools/sync_public_site.py --check  # exit 1 if they are out of date
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL_ASSETS = ROOT / "musicbot" / "webui_assets"
SITE = ROOT / ".sites-sync"
PUBLIC_ASSETS = SITE / "public" / "assets"
GENERATED_HTML = SITE / "app" / "webui-html.generated.ts"

SITE_TITLE = "糖音機網頁控制中心"
SITE_DESCRIPTION = "手指輕點，免指令。無限暢享無廣告音樂!"
# Replaced with the request origin by app/route.ts so link previews get absolute URLs.
ORIGIN_PLACEHOLDER = "%MUSICBOT_ORIGIN%"
TEXT_SUFFIXES = {".css", ".js", ".svg", ".html", ".json"}

_PUBLIC_TEXT = re.compile(
    r'<(?P<tag>[a-z0-9]+)(?P<before>[^>]*?) data-public-text="(?P<text>[^"]*)"'
    r"(?P<after>[^>]*)>[^<]*</(?P=tag)>"
)


def _replace_once(source: str, old: str, new: str) -> str:
    if source.count(old) != 1:
        raise SystemExit(f"index.html 中找不到唯一的 {old!r}，請更新 sync_public_site.py")
    return source.replace(old, new)


def build_public_html(local_html: str) -> str:
    """Turn the local index.html into the public page without forking its markup."""
    page = local_html.replace("\r\n", "\n")
    page = _replace_once(page, '<html lang="zh-Hant">', '<html lang="zh-Hant" data-mode="public">')
    page = re.sub(r"<title>[^<]*</title>", f"<title>{SITE_TITLE}</title>", page, count=1)
    page = _PUBLIC_TEXT.sub(
        lambda m: f"<{m['tag']}{m['before']}{m['after']}>{m['text']}</{m['tag']}>", page
    )

    title = html.escape(SITE_TITLE)
    description = html.escape(SITE_DESCRIPTION)
    image = f"{ORIGIN_PLACEHOLDER}/og-image.webp"
    meta = "\n".join(
        f"  {tag}"
        for tag in (
            f'<meta name="description" content="{description}">',
            f'<meta property="og:title" content="{title}">',
            f'<meta property="og:description" content="{description}">',
            '<meta property="og:type" content="website">',
            f'<meta property="og:image" content="{image}">',
            '<meta property="og:image:width" content="405">',
            '<meta property="og:image:height" content="451">',
            '<meta property="og:image:alt" content="糖音機 公開控制中心預覽圖片">',
            '<meta name="twitter:card" content="summary_large_image">',
            f'<meta name="twitter:title" content="{title}">',
            f'<meta name="twitter:description" content="{description}">',
            f'<meta name="twitter:image" content="{image}">',
            '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        )
    )
    return _replace_once(page, "</head>", f"{meta}\n</head>")


def expected_files() -> dict[Path, bytes]:
    files: dict[Path, bytes] = {}
    for asset in sorted(LOCAL_ASSETS.iterdir()):
        if asset.is_file() and asset.name != "index.html":
            data = asset.read_bytes()
            if asset.suffix in TEXT_SUFFIXES:
                # Git autocrlf may check files out as CRLF; keep the copies stable.
                data = data.replace(b"\r\n", b"\n")
            files[PUBLIC_ASSETS / asset.name] = data

    public_html = build_public_html((LOCAL_ASSETS / "index.html").read_text(encoding="utf-8"))
    generated = (
        "// 由 tools/sync_public_site.py 從 musicbot/webui_assets/index.html 產生，請勿手動修改。\n"
        f"export const ORIGIN_PLACEHOLDER = {json.dumps(ORIGIN_PLACEHOLDER)};\n"
        f"export const WEBUI_HTML = {json.dumps(public_html, ensure_ascii=False)};\n"
    )
    files[GENERATED_HTML] = generated.encode("utf-8")
    return files


def _is_current(path: Path, data: bytes) -> bool:
    if not path.is_file():
        return False
    current = path.read_bytes()
    if path.suffix in TEXT_SUFFIXES | {".ts"}:
        current = current.replace(b"\r\n", b"\n")
    return current == data


def stale_paths(files: dict[Path, bytes]) -> list[Path]:
    stale = [path for path, data in files.items() if not _is_current(path, data)]
    if PUBLIC_ASSETS.is_dir():
        stale += [path for path in PUBLIC_ASSETS.iterdir() if path not in files]
    return stale


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--check", action="store_true", help="只檢查，不寫入")
    args = parser.parse_args()

    files = expected_files()
    stale = stale_paths(files)
    if args.check:
        for path in stale:
            print(f"過期: {path.relative_to(ROOT)}")
        if stale:
            print("公開網站與本地 Web UI 不一致，請執行 python tools/sync_public_site.py")
        return 1 if stale else 0

    PUBLIC_ASSETS.mkdir(parents=True, exist_ok=True)
    for path in stale:
        if path in files:
            path.write_bytes(files[path])
        else:
            path.unlink()
        print(f"已更新: {path.relative_to(ROOT)}")
    if not stale:
        print("公開網站已與本地 Web UI 一致")
    return 0


if __name__ == "__main__":
    sys.exit(main())
