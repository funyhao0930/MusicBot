import tempfile
import subprocess
import unittest
from collections import deque
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
    async def extract_info(self, query, **_kwargs):
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
        self.assertIn("MusicBot 控制中心", html)
        self.assertIn("正在播放", html)
        self.assertIn('id="new-playlist"', html)
        self.assertIn('id="permission-add-group"', html)
        self.assertIn('id="restart-soft"', html)
        self.assertIn('id="restart-full"', html)
        self.assertIn('id="repeat-song"', html)
        self.assertIn('data-action="repeat_song"', html)
        self.assertIn("關閉循環", html)
        self.assertIn('aria-pressed="false"', html)
        self.assertIn('/assets/styles.css?v=2', html)
        self.assertIn('/assets/app.js?v=5', html)

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
let apiCalls = 0;
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
    apiCalls += 1;
    return {
      playlists: [{
        name: "default",
        tracks: Array.from({ length: 2530 }, (_, index) => "track-" + index),
      }],
    };
  };
`, context);
Object.defineProperty(context, "apiCalls", {
  get() { return apiCalls; },
  set(value) { apiCalls = value; },
});

(async () => {
  await vm.runInContext("loadPlaylists()", context);
  const firstCount = elements.get("#playlist-tracks").children.length;
  if (firstCount > 101) {
    throw new Error(`initial render created ${firstCount} nodes instead of one batch`);
  }
  if (apiCalls !== 1) throw new Error(`expected one API call, got ${apiCalls}`);

  await vm.runInContext("loadPlaylists()", context);
  if (apiCalls !== 1) throw new Error("cached playlist data was fetched again");

  const loadMore = elements.get("#playlist-tracks").children.at(-1);
  if (!loadMore || !loadMore.listeners.click) {
    throw new Error("large playlist did not expose a load-more control");
  }
  loadMore.listeners.click();
  const secondCount = elements.get("#playlist-tracks").children.length;
  if (secondCount <= firstCount || secondCount > 201) {
    throw new Error(`load-more rendered an unexpected node count: ${secondCount}`);
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
        self.assertEqual(payload["playlists"][0]["tracks"], ["track one"])

        response = await self.client.post(
            "/api/playlists",
            json={"action": "create", "name": "late-night"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 200)
        self.assertIn("late-night", self.bot.playlist_mgr.playlists)

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

    async def test_playlist_name_rejects_path_traversal(self):
        response = await self.client.post(
            "/api/playlists",
            json={"action": "create", "name": "../outside"},
            headers=self._headers(),
        )
        self.assertEqual(response.status, 400)


if __name__ == "__main__":
    unittest.main()
