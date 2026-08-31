import tempfile
import subprocess
import unittest
from collections import deque
from html.parser import HTMLParser
from pathlib import Path
from types import SimpleNamespace

from aiohttp.test_utils import TestClient, TestServer


class _Option:
    def __init__(
        self,
        section,
        option,
        dest,
        default,
        getter="get",
        editable=True,
        comment="",
        invisible=False,
    ):
        self.section = section
        self.option = option
        self.dest = dest
        self.default = default
        self.getter = getter
        self.editable = editable
        self.comment = comment
        self.invisible = invisible


class _Config:
    def __init__(self):
        self.default_volume = 0.25
        self._login_token = "never-return-this"
        self.register = SimpleNamespace(
            option_list=[
                _Option(
                    "MusicBot",
                    "DefaultVolume",
                    "default_volume",
                    0.15,
                    getter="getfloat",
                    comment="Default player volume",
                ),
                _Option(
                    "Credentials",
                    "Token",
                    "_login_token",
                    "",
                    editable=False,
                    comment="Discord token",
                ),
            ],
            get_config_option=lambda section, option: next(
                (
                    item
                    for item in self.register.option_list
                    if item.section == section and item.option == option
                ),
                None,
            ),
        )
        self.saved = []

    def update_option(self, option, value):
        if option.option == "DefaultVolume":
            try:
                parsed = float(value)
            except ValueError:
                return False
            setattr(self, option.dest, parsed)
            return True
        return False

    def save_option(self, option):
        self.saved.append(option.option)
        return True


class _Playlist:
    def __init__(self, entries):
        self.entries = deque(entries)

    def delete_entry_at_index(self, index):
        self.entries.rotate(-index)
        item = self.entries.popleft()
        self.entries.rotate(index)
        return item

    def insert_entry_at_index(self, index, entry):
        self.entries.rotate(-index)
        self.entries.appendleft(entry)
        self.entries.rotate(index)

    async def add_entry_from_info(self, info, **_kwargs):
        entry = SimpleNamespace(
            title=info.title,
            url=info.url,
            thumbnail_url=info.thumbnail_url,
            duration=info.duration,
            author=None,
        )
        self.entries.append(entry)
        return entry, len(self.entries)


class _Player:
    def __init__(self, guild, entries):
        self.voice_client = SimpleNamespace(
            guild=guild,
            channel=SimpleNamespace(id=7, name="深夜電台"),
            is_connected=lambda: True,
        )
        self.playlist = _Playlist(entries)
        self.current_entry = None
        self.progress = 0
        self.volume = 0.25
        self.is_playing = False
        self.is_paused = False
        self.is_stopped = True
        self.is_dead = False

    def play(self):
        self.is_stopped = False
        self.is_playing = True


class _Downloader:
    def __init__(self):
        self.calls = []
        self.fail_queries = set()

    async def extract_info(self, query, **_kwargs):
        self.calls.append(query)
        if query in self.fail_queries:
            raise RuntimeError("metadata lookup failed")
        return SimpleNamespace(
            title=f"Result for {query}",
            url="https://example.test/result",
            thumbnail_url="https://example.test/result.jpg",
            duration=120,
            has_entries=False,
        )


class _AutoPlaylist:
    def __init__(self, name, tracks=None):
        self.filename = f"{name}.txt"
        self.data = list(tracks or [])
        self.loaded = False

    def __iter__(self):
        return iter(self.data)

    def create_file(self):
        return None

    async def load(self, force=False):
        self.loaded = True

    async def add_track(self, track):
        if track not in self.data:
            self.data.append(track)

    async def remove_track(self, track, **_kwargs):
        self.data.remove(track)


class _AutoPlaylistManager:
    def __init__(self):
        self.playlists = {"default": _AutoPlaylist("default", ["track one"])}

    @property
    def playlist_names(self):
        return list(self.playlists)

    def discover_playlists(self):
        return None

    def get_playlist(self, filename):
        name = Path(filename).stem
        if name not in self.playlists:
            self.playlists[name] = _AutoPlaylist(name)
        return self.playlists[name]

    def is_protected_playlist(self, filename):
        return Path(filename).stem in {"default", "history", "autoplaylist"}

    def delete_playlist(self, filename):
        name = Path(filename).stem
        if name in {"default", "history", "autoplaylist"}:
            raise PermissionError("System playlists are protected")
        if name not in self.playlists:
            raise LookupError("Playlist does not exist")
        del self.playlists[name]


class _Permissions:
    def __init__(self):
        option = _Option(
            "Default",
            "MaxSongs",
            "max_songs",
            8,
            getter="getint",
            comment="Maximum queued songs",
        )
        self.groups = {"Default": SimpleNamespace(name="Default", max_songs=8)}
        self.register = SimpleNamespace(
            option_list=[option],
            get_config_option=lambda section, name: next(
                (
                    item
                    for item in self.register.option_list
                    if item.section == section and item.option == name
                ),
                None,
            ),
            get_option_dict=lambda group: {
                item.option: item
                for item in self.register.option_list
                if item.section == group
            },
        )
        self.saved = []

    def update_option(self, option, value):
        try:
            parsed = int(value)
        except ValueError:
            return False
        self.groups[option.section].max_songs = parsed
        return True

    def save_group(self, group):
        self.saved.append(group)
        return True

    def add_group(self, name):
        self.groups[name] = SimpleNamespace(name=name, max_songs=8)
        self.register.option_list.append(
            _Option(
                name,
                "MaxSongs",
                "max_songs",
                8,
                getter="getint",
                comment="Maximum queued songs",
            )
        )

    def remove_group(self, name):
        del self.groups[name]
        self.register.option_list = [
            option
            for option in self.register.option_list
            if option.section != name
        ]


class WebUIExtendedAPITests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        from musicbot.webui import MusicBotWebUI

        self.temp = tempfile.TemporaryDirectory()
        self.log_file = Path(self.temp.name) / "musicbot.log"
        self.log_file.write_text(
            "INFO ready\nToken = super-secret\nERROR playback failed\n",
            encoding="utf-8",
        )
        self.guild = SimpleNamespace(id=1, name="測試伺服器", unavailable=False)
        self.entry = SimpleNamespace(
            title="Night Drive",
            url="https://example.test/1",
            thumbnail_url="",
            duration=183,
            author=None,
        )
        self.config = _Config()
        self.player = _Player(self.guild, [self.entry])
        self.bot = SimpleNamespace(
            guilds=[self.guild],
            players={1: self.player},
            config=self.config,
            permissions=_Permissions(),
            downloader=_Downloader(),
            playlist_mgr=_AutoPlaylistManager(),
            user=SimpleNamespace(id=9, name="MusicBot"),
            _init_time=100.0,
            init_ok=True,
            network_outage=False,
            latency=0.01,
            exit_signal=None,
            logout_called_by_test=False,
            server_data={},
        )

        async def logout():
            self.bot.logout_called_by_test = True

        self.bot.logout = logout
        self.webui = MusicBotWebUI(
            self.bot,
            host="127.0.0.1",
            port=8765,
            log_file=self.log_file,
        )
        self.client = TestClient(TestServer(self.webui.create_app()))
        await self.client.start_server()

    async def asyncTearDown(self):
        await self.client.close()
        self.temp.cleanup()

    def _headers(self):
        return {
            "Origin": str(self.client.make_url("/"))[:-1],
            "X-MusicBot-CSRF": self.webui.csrf_token,
        }

    async def test_root_and_assets_expose_the_animated_player_ui(self):
        response = await self.client.get("/")
        self.assertEqual(response.status, 200)
        html = await response.text()
        self.assertIn("糖音機 控制中心", html)
        self.assertIn("<strong>糖音機</strong>", html)
        self.assertIn("糖音機 會依序播放", html)
        self.assertIn('aria-label="糖音機 日誌"', html)
        self.assertIn("控制台暫時失去 糖音機 回應", html)
        self.assertIn("正在播放", html)
        self.assertIn('id="new-playlist"', html)
        self.assertIn('id="permission-add-group"', html)
        self.assertIn('id="restart-soft"', html)
        self.assertIn('id="restart-full"', html)
        self.assertIn('id="repeat-song"', html)
        self.assertIn('data-action="repeat_song"', html)
        self.assertIn('id="playlist-delete"', html)
        self.assertIn("關閉循環", html)
        self.assertIn('aria-pressed="false"', html)
        self.assertIn('/assets/styles.css?v=7', html)
        self.assertIn('/assets/app.js?v=11', html)

        response = await self.client.get("/assets/styles.css")
        self.assertEqual(response.status, 200)
        css = await response.text()
        self.assertIn("--motion-page", css)
        self.assertIn("prefers-reduced-motion", css)
        self.assertIn("@keyframes page-in", css)
        self.assertIn("@keyframes page-out", css)
        self.assertIn("@keyframes queue-in", css)
        self.assertIn("@keyframes control-pop", css)
        self.assertIn("@keyframes saved-flash", css)
        self.assertIn("@keyframes toast-in", css)
        self.assertIn("@keyframes title-loading-pulse", css)

        response = await self.client.get("/assets/app.js")
        self.assertEqual(response.status, 200)
        javascript = await response.text()
        self.assertIn("/api/playlists", javascript)
        self.assertIn("/api/permissions/group", javascript)
        self.assertIn("/api/restart", javascript)
        self.assertIn("image.onload = () =>", javascript)
        self.assertIn("image.onerror = () =>", javascript)
        self.assertIn('image.removeAttribute("src")', javascript)
        self.assertIn("fallback.hidden = false", javascript)
        self.assertIn(r'"song": "\u55ae\u66f2\u5faa\u74b0"', javascript)
        self.assertIn(r'"all": "\u5168\u90e8\u5faa\u74b0"', javascript)
        self.assertIn(r'"off": "\u95dc\u9589\u5faa\u74b0"', javascript)
        self.assertIn('repeat.dataset.action = nextAction', javascript)
        self.assertIn('class="button ghost playlist-queue"', javascript)
        self.assertIn("歌名載入中…", javascript)
        self.assertIn("playlist-track-title-loading", javascript)
        self.assertIn('DELETE', javascript)

    async def test_volume_control_is_grouped_with_transport_controls(self):
        class _TransportVolumeParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.stack = []
                self.volume_is_in_transport = False

            def handle_starttag(self, tag, attrs):
                attributes = dict(attrs)
                is_transport = (
                    tag == "div"
                    and "transport" in attributes.get("class", "").split()
                )
                parent_is_transport = self.stack[-1][1] if self.stack else False
                is_in_transport = parent_is_transport or is_transport
                if attributes.get("id") == "volume-range":
                    self.volume_is_in_transport = is_in_transport
                if tag not in {"input", "img", "meta", "link", "br", "hr"}:
                    self.stack.append((tag, is_in_transport))

            def handle_endtag(self, _tag):
                if self.stack:
                    self.stack.pop()

        response = await self.client.get("/")
        self.assertEqual(response.status, 200)
        parser = _TransportVolumeParser()
        parser.feed(await response.text())

        self.assertTrue(parser.volume_is_in_transport)

    async def test_long_track_titles_scroll_only_when_they_overflow(self):
        response = await self.client.get("/")
        self.assertEqual(response.status, 200)
        html = await response.text()
        self.assertIn('id="track-title-viewport"', html)

        response = await self.client.get("/assets/styles.css")
        self.assertEqual(response.status, 200)
        css = await response.text()
        self.assertIn("@keyframes title-marquee", css)
        self.assertIn("mask-image", css)
        self.assertIn("-webkit-mask-image", css)

        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");

function createClassList() {
  const values = new Set();
  return {
    add(name) { values.add(name); },
    remove(name) { values.delete(name); },
    toggle(name, force) {
      if (force === undefined) {
        if (values.has(name)) values.delete(name);
        else values.add(name);
      } else if (force) values.add(name);
      else values.delete(name);
    },
    contains(name) { return values.has(name); },
  };
}

const properties = new Map();
const viewport = {
  clientWidth: 420,
  classList: createClassList(),
  style: {
    setProperty(name, value) { properties.set(name, value); },
    removeProperty(name) { properties.delete(name); },
  },
};
const title = { scrollWidth: 680, textContent: "A very long track title" };
const document = {
  addEventListener() {},
  querySelector(selector) {
    if (selector === "#track-title-viewport") return viewport;
    if (selector === "#track-title") return title;
    return null;
  },
  querySelectorAll() { return []; },
};
const context = {
  document,
  window: { addEventListener() {}, confirm() { return false; }, prompt() { return null; } },
  console,
  fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setInterval() {},
  setTimeout() {},
  URLSearchParams,
  encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);

vm.runInContext("updateTrackTitleOverflow()", context);
if (!viewport.classList.contains("is-overflowing")) {
  throw new Error("overflowing title did not enable marquee mode");
}
if (properties.get("--title-overflow") !== "260px") {
  throw new Error(`wrong marquee distance: ${properties.get("--title-overflow")}`);
}

title.scrollWidth = 300;
vm.runInContext("updateTrackTitleOverflow()", context);
if (viewport.classList.contains("is-overflowing")) {
  throw new Error("short title incorrectly kept marquee mode enabled");
}
if (properties.has("--title-overflow")) {
  throw new Error("short title kept the previous marquee distance");
}
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_queue_does_not_rebuild_when_snapshot_is_unchanged(self):
        response = await self.client.get("/assets/styles.css")
        self.assertEqual(response.status, 200)
        css = await response.text()
        self.assertIn("overflow-x: hidden", css)
        self.assertIn("overflow-y: auto", css)

        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");

function createElement() {
  const parts = {};
  return {
    children: [],
    hidden: false,
    textContent: "",
    className: "",
    draggable: false,
    dataset: {},
    listeners: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    replaceChildren(...nodes) {
      this.replaceCount = (this.replaceCount || 0) + 1;
      this.children = nodes;
    },
    querySelector(selector) {
      if (!parts[selector]) parts[selector] = createElement();
      return parts[selector];
    },
    set innerHTML(value) {},
  };
}

const list = createElement();
const count = createElement();
const empty = createElement();
const document = {
  addEventListener() {},
  createElement,
  querySelector(selector) {
    if (selector === "#queue-list") return list;
    if (selector === "#queue-count") return count;
    if (selector === "#queue-empty") return empty;
    return createElement();
  },
  querySelectorAll() { return []; },
};
const context = {
  document,
  window: { addEventListener() {}, confirm() { return false; }, prompt() { return null; } },
  console,
  fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setInterval() {},
  setTimeout() {},
  URLSearchParams,
  encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);

const firstSnapshot = [{
  title: "Night Drive",
  url: "https://example.test/night-drive",
  duration: 180,
  requested_by: "tester",
}];
vm.runInContext(`renderQueue(${JSON.stringify(firstSnapshot)})`, context);
vm.runInContext(`renderQueue(${JSON.stringify(firstSnapshot)})`, context);
if (list.replaceCount !== 1) {
  throw new Error(`unchanged queue rebuilt ${list.replaceCount} times`);
}

const changedSnapshot = [{ ...firstSnapshot[0], duration: 181 }];
vm.runInContext(`renderQueue(${JSON.stringify(changedSnapshot)})`, context);
if (list.replaceCount !== 2) {
  throw new Error("changed queue did not rebuild");
}
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_frontend_preserves_large_discord_guild_ids(self):
        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");
const domListeners = {};

function createElement() {
  return {
    value: "",
    hidden: false,
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append() {},
    replaceChildren(...children) { this.children = children; },
    querySelectorAll() { return []; },
  };
}

const guildSelect = createElement();
const genericElement = createElement();
const document = {
  addEventListener(name, callback) { domListeners[name] = callback; },
  createElement,
  querySelector(selector) {
    return selector === "#guild-select" ? guildSelect : genericElement;
  },
  querySelectorAll() { return []; },
};
const context = {
  document,
  window: { confirm() { return false; } },
  console,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setInterval() {},
  setTimeout(callback) { callback(); },
  URLSearchParams,
  encodeURIComponent,
};

vm.createContext(context);
vm.runInContext(source, context);
const guildId = "1363416878059487264";
const legacyPayload = `{"ok":true,"guilds":[{"id":${guildId},"name":"DT's house"}]}`;
const parsedLegacyPayload = vm.runInContext(
  `parseApiPayload("/api/guilds", ${JSON.stringify(legacyPayload)})`,
  context,
);
if (parsedLegacyPayload.guilds[0].id !== guildId) {
  throw new Error("legacy numeric guild ID lost precision while parsing");
}

vm.runInContext(
  `renderGuilds([{ id: "${guildId}", name: "DT's house" }])`,
  context,
);
if (vm.runInContext("state.guildId", context) !== guildId) {
  throw new Error("renderGuilds changed the Discord guild ID precision");
}

vm.runInContext("refreshSnapshot = () => {}; animateProgress = () => {};", context);
domListeners.DOMContentLoaded();
guildSelect.listeners.change({ target: { value: guildId } });
if (vm.runInContext("state.guildId", context) !== guildId) {
  throw new Error("guild selection changed the Discord guild ID precision");
}
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_playlist_page_batches_large_lists_and_reuses_cached_data(self):
        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");

function createElement(tag = "div") {
  const children = [];
  const element = {
    tagName: tag.toUpperCase(),
    children,
    value: "",
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    textContent: "",
    className: "",
    classList: { add() {}, remove() {}, toggle() {} },
    listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append(...nodes) { children.push(...nodes); },
    replaceChildren(...nodes) { children.splice(0, children.length, ...nodes); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (!this._parts) this._parts = {};
      if (!this._parts[selector]) this._parts[selector] = createElement();
      return this._parts[selector];
    },
  };
  Object.defineProperty(element, "innerHTML", {
    set() {},
    get() { return ""; },
  });
  return element;
}

const elements = new Map();
for (const id of [
  "#playlist-title", "#playlist-count", "#playlist-empty",
  "#playlist-add-form", "#playlist-tracks", "#playlist-tabs",
]) elements.set(id, createElement());
elements.get("#playlist-add-form").querySelectorAll = () => [];

const document = {
  addEventListener() {},
  createElement,
  querySelector(selector) { return elements.get(selector) || createElement(); },
  querySelectorAll() { return []; },
};
let playlistCalls = 0;
let titleCalls = 0;
const context = {
  document,
  window: { confirm() { return false; }, prompt() { return null; } },
  console,
  fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setInterval() {},
  setTimeout(callback) { callback(); },
  URLSearchParams,
  encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(`
  api = async path => {
    if (path === "/api/playlists") {
      playlistCalls += 1;
      return {
        playlists: [{
          name: "default",
          tracks: Array.from({ length: 2530 }, (_, index) => "track-" + index),
        }],
      };
    }
    if (path.startsWith("/api/playlists/default/titles/")) {
      titleCalls += 1;
      const index = Number(path.split("/").at(-1));
      return {
        track: {
          source: "track-" + index,
          title: "Title " + index,
        },
      };
    }
    throw new Error("unexpected API path: " + path);
  };
`, context);
Object.defineProperty(context, "playlistCalls", {
  get() { return playlistCalls; },
  set(value) { playlistCalls = value; },
});
Object.defineProperty(context, "titleCalls", {
  get() { return titleCalls; },
  set(value) { titleCalls = value; },
});

(async () => {
  await vm.runInContext("loadPlaylists()", context);
  const firstCount = elements.get("#playlist-tracks").children.length;
  if (firstCount > 101) {
    throw new Error(`initial render created ${firstCount} nodes instead of one batch`);
  }
  if (playlistCalls !== 1) {
    throw new Error(`expected one playlist API call, got ${playlistCalls}`);
  }
  if (titleCalls !== 100) {
    throw new Error(`expected one title API call per visible track, got ${titleCalls}`);
  }
  await Promise.resolve();
  await Promise.resolve();
  if (elements.get("#playlist-tracks").children[0].querySelector("strong").textContent !== "Title 0") {
    throw new Error("completed title did not update its playlist row");
  }

  await vm.runInContext("loadPlaylists()", context);
  if (playlistCalls !== 1) throw new Error("cached playlist data was fetched again");
  if (titleCalls !== 100) throw new Error("cached playlist titles were fetched again");

  const loadMore = elements.get("#playlist-tracks").children.at(-1);
  if (!loadMore || !loadMore.listeners.click) {
    throw new Error("large playlist did not expose a load-more control");
  }
  loadMore.listeners.click();
  const secondCount = elements.get("#playlist-tracks").children.length;
  if (secondCount <= firstCount || secondCount > 201) {
    throw new Error(`load-more rendered an unexpected node count: ${secondCount}`);
  }
  if (titleCalls !== 200) {
    throw new Error(`load-more did not start title loading, got ${titleCalls} calls`);
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_playlist_page_selects_a_non_empty_list_before_titles_finish(self):
        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");

function createElement(tag = "div") {
  const children = [];
  const element = {
    tagName: tag.toUpperCase(),
    children,
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    textContent: "",
    className: "",
    classList: { add() {}, remove() {}, toggle() {} },
    listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append(...nodes) { children.push(...nodes); },
    replaceChildren(...nodes) { children.splice(0, children.length, ...nodes); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (!this._parts) this._parts = {};
      if (!this._parts[selector]) this._parts[selector] = createElement();
      return this._parts[selector];
    },
  };
  Object.defineProperty(element, "innerHTML", {
    set() {},
    get() { return ""; },
  });
  return element;
}

const elements = new Map();
for (const id of [
  "#playlist-title", "#playlist-count", "#playlist-empty",
  "#playlist-add-form", "#playlist-tracks", "#playlist-tabs",
]) elements.set(id, createElement());
elements.get("#playlist-add-form").querySelectorAll = () => [];

const document = {
  addEventListener() {},
  createElement,
  querySelector(selector) { return elements.get(selector) || createElement(); },
  querySelectorAll() { return []; },
};
const calls = [];
const context = {
  document,
  window: { confirm() { return false; }, prompt() { return null; } },
  console,
  fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setInterval() {},
  setTimeout(callback) { callback(); },
  URLSearchParams,
  encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(`
  api = async path => {
    calls.push(path);
    if (path === "/api/playlists") {
      return {
        playlists: [
          { name: "default", tracks: [] },
          {
            name: "西呱歌單",
            tracks: [{
              source: "https://example.test/night-drive",
              title: "https://example.test/night-drive",
            }],
          },
        ],
      };
    }
    if (path === "/api/playlists/%E8%A5%BF%E5%91%B1%E6%AD%8C%E5%96%AE/titles/0") {
      return new Promise(() => {});
    }
    throw new Error("unexpected API path: " + path);
  };
`, context);
Object.defineProperty(context, "calls", { get() { return calls; } });

(async () => {
  await vm.runInContext("loadPlaylists()", context);
  if (vm.runInContext("state.currentPlaylist", context) !== "西呱歌單") {
    throw new Error("the first non-empty playlist was not selected");
  }
  if (elements.get("#playlist-title").textContent !== "西呱歌單") {
    throw new Error("playlist title was not rendered before metadata completed");
  }
  if (elements.get("#playlist-tracks").children.length !== 1) {
    throw new Error("playlist source was not rendered immediately");
  }
  if (elements.get("#playlist-tracks").children[0].querySelector("strong").textContent !== "歌名載入中…") {
    throw new Error("playlist row did not show the title loading state");
  }
  if (!calls.includes("/api/playlists/%E8%A5%BF%E5%91%B1%E6%AD%8C%E5%96%AE/titles/0")) {
    throw new Error("background title loading did not start");
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_playlist_track_button_adds_source_to_current_guild_queue(self):
        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");

function createElement(tag = "div") {
  const children = [];
  const element = {
    tagName: tag.toUpperCase(),
    children,
    hidden: false,
    disabled: false,
    dataset: {},
    style: {},
    textContent: "",
    className: "",
    classList: { add() {}, remove() {}, toggle() {} },
    listeners: {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append(...nodes) { children.push(...nodes); },
    replaceChildren(...nodes) { children.splice(0, children.length, ...nodes); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (!this._parts) this._parts = {};
      if (!this._parts[selector]) this._parts[selector] = createElement();
      return this._parts[selector];
    },
  };
  Object.defineProperty(element, "innerHTML", {
    set() {},
    get() { return ""; },
  });
  return element;
}

const elements = new Map();
for (const id of [
  "#playlist-title", "#playlist-count", "#playlist-empty",
  "#playlist-add-form", "#playlist-tracks", "#playlist-tabs",
  "#queue-list", "#queue-count", "#queue-empty", "#toast-region",
]) elements.set(id, createElement());
elements.get("#playlist-add-form").querySelectorAll = () => [];

const document = {
  addEventListener() {},
  createElement,
  querySelector(selector) { return elements.get(selector) || createElement(); },
  querySelectorAll() { return []; },
};
const calls = [];
const context = {
  document,
  window: { confirm() { return false; }, prompt() { return null; } },
  console,
  fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => 0 },
  requestAnimationFrame() {},
  setInterval() {},
  setTimeout(callback) { callback(); },
  URLSearchParams,
  encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(`
  state.guildId = "1363416878059487264";
  state.currentPlaylist = "default";
  state.playlists = [{
    name: "default",
    tracks: [{ title: "Night Drive", source: "https://example.test/night-drive" }],
  }];
  api = async (path, options) => {
    calls.push({ path, body: options.body });
    return {
      entry: { title: "Night Drive" },
      queue: [{
        title: "Night Drive",
        url: "https://example.test/night-drive",
        duration: 180,
        requested_by: "Auto playlist",
      }],
    };
  };
  renderPlaylistEditor();
`, context);
Object.defineProperty(context, "calls", { get() { return calls; } });

(async () => {
  const row = elements.get("#playlist-tracks").children[0];
  if (!row) throw new Error("playlist row was not rendered");
  const queueButton = row.querySelector(".playlist-queue");
  if (!queueButton.listeners.click) throw new Error("queue button has no click handler");
  await queueButton.listeners.click();
  if (calls.length !== 1) throw new Error(`expected one API call, got ${calls.length}`);
  if (calls[0].path !== "/api/queue/add") throw new Error("wrong queue endpoint");
  if (calls[0].body.guild_id !== "1363416878059487264") {
    throw new Error("queue request used the wrong guild");
  }
  if (calls[0].body.query !== "https://example.test/night-drive") {
    throw new Error("queue request did not use the playlist source");
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_playlist_delete_button_confirms_and_removes_selected_playlist(self):
        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");

function createElement(tag = "div") {
  const children = [];
  const element = {
    tagName: tag.toUpperCase(), children, hidden: false, disabled: false,
    dataset: {}, style: {}, textContent: "", className: "", listeners: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append(...nodes) { children.push(...nodes); },
    replaceChildren(...nodes) { children.splice(0, children.length, ...nodes); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (!this._parts) this._parts = {};
      if (!this._parts[selector]) this._parts[selector] = createElement();
      return this._parts[selector];
    },
  };
  Object.defineProperty(element, "innerHTML", { set() {}, get() { return ""; } });
  return element;
}

const elements = new Map();
for (const id of [
  "#playlist-title", "#playlist-count", "#playlist-empty", "#playlist-add-form",
  "#playlist-tracks", "#playlist-tabs", "#playlist-delete", "#toast-region",
]) elements.set(id, createElement());
elements.get("#playlist-add-form").querySelectorAll = () => [];
const context = {
  document: {
    addEventListener() {},
    createElement,
    querySelector(selector) { return elements.get(selector) || createElement(); },
  },
  window: { confirm() { return true; } },
  console, fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => 0 }, requestAnimationFrame() {}, setTimeout(callback) { callback(); },
  encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(`
  state.currentPlaylist = "晚安歌單";
  state.playlists = [
    { name: "晚安歌單", deletable: true, tracks: [{ source: "track one", title: "Track One" }] },
    { name: "default", deletable: false, tracks: [] },
  ];
  const calls = [];
  api = async (path, options) => { calls.push({ path, method: options.method }); return { ok: true }; };
  renderPlaylistEditor();
  deletePlaylist();
`, context);

(async () => {
  await new Promise(resolve => setTimeout(resolve, 0));
  const calls = vm.runInContext("calls", context);
  if (calls.length !== 1 || calls[0].method !== "DELETE") throw new Error("delete request was not sent");
  if (calls[0].path !== "/api/playlists/%E6%99%9A%E5%AE%89%E6%AD%8C%E5%96%AE") throw new Error("wrong delete endpoint");
  if (vm.runInContext("state.playlists.some(item => item.name === '晚安歌單')", context)) {
    throw new Error("deleted playlist remained in UI state");
  }
  if (vm.runInContext("state.currentPlaylist", context) !== "default") {
    throw new Error("UI did not select the next available playlist");
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_playlist_all_queue_button_imports_selected_playlist(self):
        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");

function createElement(tag = "div") {
  const children = [];
  const element = {
    tagName: tag.toUpperCase(), children, hidden: false, disabled: false,
    dataset: {}, style: {}, textContent: "", className: "", listeners: {},
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append(...nodes) { children.push(...nodes); },
    replaceChildren(...nodes) { children.splice(0, children.length, ...nodes); },
    querySelectorAll() { return []; },
    querySelector(selector) {
      if (!this._parts) this._parts = {};
      if (!this._parts[selector]) this._parts[selector] = createElement();
      return this._parts[selector];
    },
  };
  Object.defineProperty(element, "innerHTML", { set() {}, get() { return ""; } });
  return element;
}

const elements = new Map();
for (const id of [
  "#playlist-title", "#playlist-count", "#playlist-empty", "#playlist-add-form",
  "#playlist-tracks", "#playlist-tabs", "#playlist-queue-all", "#queue-list",
  "#queue-count", "#queue-empty", "#toast-region",
]) elements.set(id, createElement());
elements.get("#playlist-add-form").querySelectorAll = () => [];
const domListeners = {};
const document = {
  addEventListener(name, callback) { domListeners[name] = callback; },
  createElement,
  querySelector(selector) { return elements.get(selector) || createElement(); },
  querySelectorAll() { return []; },
};
const calls = [];
const context = {
  document,
  window: { confirm() { return false; }, prompt() { return null; } },
  console, fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => 0 }, requestAnimationFrame() {}, setInterval() {},
  setTimeout(callback) { callback(); }, URLSearchParams, encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(`
  refreshSnapshot = () => {};
  state.guildId = "1363416878059487264";
  state.currentPlaylist = "晚安歌單";
  state.playlists = [{ name: "晚安歌單", tracks: [
    { title: "Night Drive", source: "https://example.test/night-drive" },
    { title: "Moonlight", source: "https://example.test/moonlight" },
  ] }];
  api = async (path, options) => {
    calls.push({ path, body: options.body });
    return { added_count: 2, queue: [] };
  };
`, context);
Object.defineProperty(context, "calls", { get() { return calls; } });
domListeners.DOMContentLoaded();

(async () => {
  const button = elements.get("#playlist-queue-all");
  if (!button.listeners.click) throw new Error("all queue button has no click handler");
  await button.listeners.click({ currentTarget: button });
  if (calls.length !== 1) throw new Error(`expected one API call, got ${calls.length}`);
  if (calls[0].path !== "/api/playlists/%E6%99%9A%E5%AE%89%E6%AD%8C%E5%96%AE/queue") {
    throw new Error("all queue button used the wrong endpoint");
  }
  if (calls[0].body.guild_id !== "1363416878059487264") {
    throw new Error("all queue request used the wrong guild");
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_progress_slider_previews_then_seeks_once(self):
        app_js = Path(__file__).parents[1] / "musicbot" / "webui_assets" / "app.js"
        harness = r"""
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync(process.argv[1], "utf8");
const domListeners = {};

function createElement() {
  return {
    value: "",
    max: 100,
    disabled: false,
    hidden: false,
    textContent: "",
    dataset: {},
    style: {},
    listeners: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener(name, callback) { this.listeners[name] = callback; },
    append() {},
    replaceChildren() {},
    querySelector() { return createElement(); },
    querySelectorAll() { return []; },
  };
}

const elements = new Map();
for (const id of [
  "#progress-range", "#time-current", "#time-total", "#guild-select",
  "#volume-range", "#volume-output", "#add-track-form", "#new-playlist",
  "#playlist-add-form", "#settings-search", "#reload-config", "#restart-soft",
  "#restart-full", "#permission-add-group", "#refresh-logs", "#log-level",
  "#log-search", "#art-stage", "#track-title", "#track-meta", "#album-art",
  "#album-image", "#album-fallback", "#play-toggle", "#repeat-song",
  "#queue-list", "#queue-count", "#queue-empty",
]) elements.set(id, createElement());

const document = {
  addEventListener(name, callback) { domListeners[name] = callback; },
  createElement,
  querySelector(selector) { return elements.get(selector) || createElement(); },
  querySelectorAll() { return []; },
};
let now = 5000;
const calls = [];
const context = {
  document,
  window: { confirm() { return false; }, prompt() { return null; } },
  console,
  fetch: async () => { throw new Error("unexpected fetch"); },
  performance: { now: () => now },
  requestAnimationFrame() {},
  setInterval() {},
  setTimeout(callback) { callback(); },
  URLSearchParams,
  encodeURIComponent,
};
vm.createContext(context);
vm.runInContext(source, context);
vm.runInContext(`
  refreshSnapshot = () => {};
  api = async (path, options) => {
    calls.push({ path, body: options.body });
    return {
      position: options.body.position,
      player: {
        state: "playing",
        current: { title: "Night Drive", url: "track", duration: 180, requested_by: "tester" },
        voice_channel: { name: "radio" },
        progress: options.body.position,
        volume: .25,
        queue: [],
      },
    };
  };
`, context);
Object.defineProperty(context, "calls", { get() { return calls; } });
domListeners.DOMContentLoaded();
vm.runInContext(`
  state.guildId = "1363416878059487264";
  renderPlayer({
    state: "playing",
    current: { title: "Night Drive", url: "track", duration: 180, requested_by: "tester" },
    voice_channel: { name: "radio" },
    progress: 10,
    volume: .25,
    queue: [],
  });
`, context);

const range = elements.get("#progress-range");
range.value = "90";
range.listeners.input({ target: range });
if (elements.get("#time-current").textContent !== "1:30") {
  throw new Error("drag preview did not update the displayed time");
}
if (calls.length !== 0) throw new Error("input sent seek before the slider was released");

vm.runInContext("animateProgress()", context);
if (range.value !== "90") throw new Error("background progress overwrote the dragged value");

(async () => {
  await range.listeners.change({ target: range });
  if (calls.length !== 1) throw new Error(`expected one seek request, got ${calls.length}`);
  if (calls[0].path !== "/api/player/seek" || calls[0].body.position !== 90) {
    throw new Error("seek request used the wrong endpoint or position");
  }
  if (vm.runInContext("state.scrubbing", context) !== false) {
    throw new Error("scrubbing state was not cleared after seek");
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
"""
        result = subprocess.run(
            ["node", "-e", harness, str(app_js)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    async def test_config_api_redacts_secret_and_persists_editable_value(self):
        response = await self.client.get("/api/config")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        serialized = repr(payload)
        self.assertNotIn("never-return-this", serialized)
        token = next(item for item in payload["options"] if item["option"] == "Token")
        self.assertTrue(token["sensitive"])
        self.assertIsNone(token["value"])

        response = await self.client.patch(
            "/api/config",
            json={
                "section": "MusicBot",
                "option": "DefaultVolume",
                "value": "0.55",
            },
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(self.config.default_volume, 0.55)
        self.assertEqual(self.config.saved, ["DefaultVolume"])

    async def test_log_api_redacts_credentials(self):
        response = await self.client.get("/api/logs?limit=20")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        text = "\n".join(payload["lines"])
        self.assertIn("INFO ready", text)
        self.assertIn("[REDACTED]", text)
        self.assertNotIn("super-secret", text)

    async def test_queue_add_and_delete(self):
        response = await self.client.post(
            "/api/queue/add",
            json={"guild_id": 1, "query": "city pop"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(payload["entry"]["title"], "Result for city pop")
        self.assertTrue(self.player.is_playing)

        response = await self.client.delete(
            "/api/queue/0?guild_id=1",
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(len(self.player.playlist.entries), 1)

    async def test_playlist_queue_add_imports_every_track_in_playlist_order(self):
        self.bot.playlist_mgr.playlists["default"].data = [
            "first track",
            "second track",
        ]

        response = await self.client.post(
            "/api/playlists/default/queue",
            json={"guild_id": 1},
            headers=self._headers(),
        )

        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(payload["added_count"], 2)
        self.assertEqual(self.bot.downloader.calls, ["first track", "second track"])
        self.assertEqual(
            [entry["title"] for entry in payload["queue"][-2:]],
            ["Result for first track", "Result for second track"],
        )

    async def test_playlist_queue_add_rejects_empty_playlist(self):
        self.bot.playlist_mgr.playlists["default"].data = []

        response = await self.client.post(
            "/api/playlists/default/queue",
            json={"guild_id": 1},
            headers=self._headers(),
        )

        self.assertEqual(response.status, 400)
        self.assertEqual(self.bot.downloader.calls, [])

    async def test_permission_option_can_be_read_and_saved(self):
        response = await self.client.get("/api/permissions")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(payload["groups"][0]["name"], "Default")
        self.assertEqual(payload["groups"][0]["options"][0]["value"], 8)

        response = await self.client.patch(
            "/api/permissions",
            json={"group": "Default", "option": "MaxSongs", "value": 12},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(self.bot.permissions.groups["Default"].max_songs, 12)
        self.assertEqual(self.bot.permissions.saved, ["Default"])

    async def test_restart_accepts_only_soft_or_full_and_logs_out(self):
        from musicbot import exceptions

        response = await self.client.post(
            "/api/restart",
            json={"mode": "soft"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 202)
        self.assertIsInstance(self.bot.exit_signal, exceptions.RestartSignal)
        self.assertEqual(
            self.bot.exit_signal.restart_code,
            exceptions.RestartCode.RESTART_SOFT,
        )
        await __import__("asyncio").sleep(0)
        self.assertTrue(self.bot.logout_called_by_test)

        response = await self.client.post(
            "/api/restart",
            json={"mode": "upgrade"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 400)

    async def test_permission_group_create_clone_rename_and_delete(self):
        response = await self.client.post(
            "/api/permissions/group",
            json={"action": "create", "name": "DJ"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertIn("DJ", self.bot.permissions.groups)

        self.bot.permissions.groups["DJ"].max_songs = 22
        response = await self.client.post(
            "/api/permissions/group",
            json={"action": "clone", "source": "DJ", "name": "Guests"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(self.bot.permissions.groups["Guests"].max_songs, 22)

        response = await self.client.post(
            "/api/permissions/group",
            json={"action": "rename", "source": "Guests", "name": "Listeners"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertNotIn("Guests", self.bot.permissions.groups)
        self.assertEqual(self.bot.permissions.groups["Listeners"].max_songs, 22)

        response = await self.client.post(
            "/api/permissions/group",
            json={"action": "delete", "name": "Listeners"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertNotIn("Listeners", self.bot.permissions.groups)

    async def test_permission_group_protects_default_and_rejects_bad_names(self):
        response = await self.client.post(
            "/api/permissions/group",
            json={"action": "delete", "name": "Default"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 403)

        response = await self.client.post(
            "/api/permissions/group",
            json={"action": "create", "name": "[broken]\nname"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 400)

    async def test_playlist_create_add_and_remove_track(self):
        response = await self.client.get("/api/playlists")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(payload["playlists"][0]["name"], "default")
        self.assertEqual(
            payload["playlists"][0]["tracks"],
            [{"source": "track one", "title": "track one"}],
        )
        self.assertFalse(payload["playlists"][0]["deletable"])
        self.assertEqual(self.bot.downloader.calls, [])

        response = await self.client.get("/api/playlists/default/titles")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(
            payload["tracks"],
            [{"source": "track one", "title": "Result for track one"}],
        )
        self.assertEqual(self.bot.downloader.calls, ["track one"])

        response = await self.client.get("/api/playlists/default/titles")
        self.assertEqual(response.status, 200)
        self.assertEqual(self.bot.downloader.calls, ["track one"])

        response = await self.client.post(
            "/api/playlists",
            json={"action": "create", "name": "late-night"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertIn("late-night", self.bot.playlist_mgr.playlists)
        payload = await response.json()
        self.assertTrue(payload["playlist"]["deletable"])

        response = await self.client.post(
            "/api/playlists",
            json={
                "action": "add",
                "name": "late-night",
                "track": "https://example.test/song",
            },
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(
            self.bot.playlist_mgr.playlists["late-night"].data,
            ["https://example.test/song"],
        )

        response = await self.client.delete(
            "/api/playlists/late-night/0",
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertEqual(self.bot.playlist_mgr.playlists["late-night"].data, [])

        response = await self.client.delete(
            "/api/playlists/late-night",
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertNotIn("late-night", self.bot.playlist_mgr.playlists)

    async def test_playlist_delete_protects_system_and_active_playlists(self):
        response = await self.client.delete(
            "/api/playlists/default",
            headers=self._headers(),
        )
        self.assertEqual(response.status, 403)

        await self.client.post(
            "/api/playlists",
            json={"action": "create", "name": "active"},
            headers=self._headers(),
        )
        self.bot.server_data[1] = SimpleNamespace(
            autoplaylist=self.bot.playlist_mgr.playlists["active"]
        )
        response = await self.client.delete(
            "/api/playlists/active",
            headers=self._headers(),
        )
        self.assertEqual(response.status, 409)
        self.assertIn("active", self.bot.playlist_mgr.playlists)

    async def test_playlist_title_falls_back_to_source_when_lookup_fails(self):
        source = "https://example.test/unavailable"
        self.bot.playlist_mgr.playlists["default"].data = [source]
        self.bot.downloader.fail_queries.add(source)

        response = await self.client.get("/api/playlists/default/titles")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(
            payload["tracks"],
            [{"source": source, "title": source}],
        )

    async def test_single_playlist_title_resolves_and_uses_cache(self):
        response = await self.client.get("/api/playlists/default/titles/0")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(
            payload["track"],
            {"source": "track one", "title": "Result for track one"},
        )
        self.assertEqual(self.bot.downloader.calls, ["track one"])

        response = await self.client.get("/api/playlists/default/titles/0")
        self.assertEqual(response.status, 200)
        self.assertEqual(self.bot.downloader.calls, ["track one"])

    async def test_single_playlist_title_rejects_invalid_index(self):
        response = await self.client.get("/api/playlists/default/titles/1")
        self.assertEqual(response.status, 400)

    async def test_single_playlist_title_falls_back_to_source_when_lookup_fails(self):
        source = "https://example.test/unavailable-single"
        self.bot.playlist_mgr.playlists["default"].data = [source]
        self.bot.downloader.fail_queries.add(source)

        response = await self.client.get("/api/playlists/default/titles/0")
        self.assertEqual(response.status, 200)
        payload = await response.json()
        self.assertEqual(payload["track"], {"source": source, "title": source})

    async def test_playlist_name_rejects_path_traversal(self):
        response = await self.client.post(
            "/api/playlists",
            json={"action": "create", "name": "../outside"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 400)


if __name__ == "__main__":
    unittest.main()
