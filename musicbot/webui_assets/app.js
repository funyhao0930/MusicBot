"use strict";

const state = {
  csrf: "",
  guildId: null,
  player: null,
  currentUrl: "",
  skipDirection: 1,
  lastSync: 0,
  connected: false,
  mutationBusy: false,
  // bumped by every finished mutation, so a snapshot fetched before it is dropped
  playerVersion: 0,
  scrubbing: false,
  draggingIndex: null,
  suppressQueueClick: false,
  queueRenderKey: null,
  // the queue the rows on screen were built from; reused rows read their song from here
  renderedQueue: [],
  selectedQueueIndexes: new Set(),
  settings: [],
  playlists: [],
  playlistsLoaded: false,
  playlistTitleLoads: {},
  playlistVisibleCounts: {},
  currentPlaylist: "",
  playlistCreateOpen: false,
  permissions: [],
  logs: [],
};

const PLAYLIST_BATCH_SIZE = 100;
const REPEAT_LABELS = {
  "song": "\u55ae\u66f2\u5faa\u74b0",
  "all": "\u5168\u90e8\u5faa\u74b0",
  "off": "\u95dc\u9589\u5faa\u74b0",
};
const REPEAT_NEXT_ACTIONS = {
  "off": "repeat_song",
  "song": "repeat_all",
  "all": "repeat_off",
};
const PLAY_PAUSE_PATHS = {
  play: ["M7 4.5 L12.5 8 L12.5 16 L7 19.5 Z", "M12.5 8 L19.5 12 L19.5 12 L12.5 16 Z"],
  pause: ["M6.5 5 L10.2 5 L10.2 19 L6.5 19 Z", "M13.8 5 L17.5 5 L17.5 19 L13.8 19 Z"],
};
// data-px names the 11x11 dot-matrix glyph that 3.0 swaps in; 2.0 keeps the stroked paths
const ADD_DONE_ICON = '<svg class="done-check" data-px="check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const QUEUE_ACTION_ICONS = {
  grip: '<svg data-px="grip" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14"/><path d="M5 12h14"/><path d="M5 16h14"/></svg>',
  queue: '<svg data-px="queue" viewBox="0 0 24 24" aria-hidden="true"><path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/></svg>',
  remove: '<svg data-px="trash" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
};
const NOTE_ICON = '<svg class="i" data-px="note" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
const THUMB_PLAY_ICON = '<span class="thumb-play" aria-hidden="true"><svg data-px="play" viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg></span>';

// ---------- 3.0 pixel icons ----------
// "#" is a lit dot and "o" a dim one (the moon's dark side). "a" and "b" are lit dots grouped into
// <g class="px-a|px-b"> so 3.0 can move them like 2.0 moves its paths: arrowheads, skip triangles, sound waves.
const PIXEL_ICONS = {
  play: ["...........", "...#.......", "...##......", "...###.....", "...####....", "...#####...", "...####....", "...###.....", "...##......", "...#.......", "..........."],
  pause: ["...........", "..##...##..", "..##...##..", "..##...##..", "..##...##..", "..##...##..", "..##...##..", "..##...##..", "..##...##..", "..##...##..", "..........."],
  next: ["...........", "..a.....#..", "..aa....#..", "..aaa...#..", "..aaaa..#..", "..aaaaa.#..", "..aaaa..#..", "..aaa...#..", "..aa....#..", "..a.....#..", "..........."],
  prev: ["...........", "..#.....a..", "..#....aa..", "..#...aaa..", "..#..aaaa..", "..#.aaaaa..", "..#..aaaa..", "..#...aaa..", "..#....aa..", "..#.....a..", "..........."],
  stop: ["...........", "...........", "..#######..", "..#######..", "..#######..", "..#######..", "..#######..", "..#######..", "..#######..", "...........", "..........."],
  shuffle: ["...........", "...........", "........a..", "##....##aaa", "..#..#..a..", "...##......", "...##......", "..#..#..b..", "##....##bbb", "........b..", "..........."],
  repeat: ["...........", ".......a...", ".######aa..", ".#.....a...", ".#.........", ".#.......#.", ".........#.", "...b.....#.", "..bb######.", "...b.......", "..........."],
  volume: ["...........", "....#...b..", "...##....b.", "####..a..b.", "####..a..b.", "####..a..b.", "####..a..b.", "...##....b.", "....#...b..", "...........", "..........."],
  search: ["...........", "..####.....", ".#....#....", "#......#...", "#......#...", "#......#...", ".#....#....", "..####.#...", "........#..", ".........#.", "..........."],
  settings: ["....###....", ".##.###.##.", ".#########.", "..#######..", "####...####", "####...####", "####...####", "..#######..", ".#########.", ".##.###.##.", "....###...."],
  home: ["...........", ".....#.....", "....###....", "...#####...", "..#######..", ".#########.", "..#######..", "..##...##..", "..##...##..", "..##...##..", "..........."],
  list: ["...........", "...........", "##.########", "...........", "##.########", "...........", "##.########", "...........", "##.########", "...........", "..........."],
  queue: ["...........", "#######....", "...........", "#######....", "...........", "####..#....", "......##...", "####..###..", "......##...", "......#....", "..........."],
  lock: ["...........", "...#####...", "..#.....#..", "..#.....#..", ".#########.", ".#########.", ".####.####.", ".####.####.", ".#########.", ".#########.", "..........."],
  log: ["...........", "..#######..", "..#.....##.", "..#.###..#.", "..#......#.", "..#.####.#.", "..#......#.", "..#.###..#.", "..#......#.", "..########.", "..........."],
  plus: ["...........", "...........", ".....#.....", ".....#.....", ".....#.....", "..#######..", ".....#.....", ".....#.....", ".....#.....", "...........", "..........."],
  check: ["...........", "...........", "...........", ".........#.", "........#..", ".#.....#...", "..#...#....", "...#.#.....", "....#......", "...........", "..........."],
  user: ["...........", "....###....", "...#####...", "...#####...", "...#####...", "....###....", "...........", "..#######..", ".#########.", ".#########.", "..........."],
  moon: ["...........", "...###oo...", "..###oooo..", ".###oooooo.", ".###oooooo.", ".###oooooo.", ".###oooooo.", ".####ooooo.", "..#####oo..", "...#####...", "..........."],
  sun: [".....#.....", ".#.......#.", "....###....", "...#####...", "..#######..", "#.#######.#", "..#######..", "...#####...", "....###....", ".#.......#.", ".....#....."],
  note: ["...........", "....######.", "....######.", "....#....#.", "....#....#.", "....#....#.", "..###..###.", ".####.####.", ".####.####.", "..##...##..", "..........."],
  trash: ["...........", "....###....", ".#########.", "...........", "..#.#.#.#..", "..#.#.#.#..", "..#.#.#.#..", "..#.#.#.#..", "..#.#.#.#..", "...#####...", "..........."],
  grip: ["...........", "...........", "....#.#....", "...........", "....#.#....", "...........", "....#.#....", "...........", "....#.#....", "...........", "..........."],
  down: ["...........", "...........", "...........", "..#.....#..", "...#...#...", "....#.#....", ".....#.....", "...........", "...........", "...........", "..........."],
};

function pixelIconMarkup(name) {
  const rows = PIXEL_ICONS[name];
  if (!rows) return "";
  const groups = { base: "", a: "", b: "" };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const dot = row[x];
      if (dot === ".") continue;
      // each dot gets its own small delay and scatter, so a glyph that appears assembles dot by dot
      const delay = Math.round(((x * 7 + y * 13) % 29) / 28 * 280);
      const sx = (((x * 5 + y * 3) % 5) - 2) * .6;
      const sy = (((x * 3 + y * 7) % 5) - 2) * .6;
      const rect = `<rect class="${dot === "o" ? "px-off" : "px-on"}" x="${x + .11}" y="${y + .11}" width=".78" height=".78" rx=".22" style="--d:${delay}ms;--sx:${sx}px;--sy:${sy}px"/>`;
      groups[dot === "a" || dot === "b" ? dot : "base"] += rect;
    }
  });
  return groups.base
    + (groups.a ? `<g class="px-a">${groups.a}</g>` : "")
    + (groups.b ? `<g class="px-b">${groups.b}</g>` : "");
}

// swaps every svg[data-px] under root for its dot-matrix glyph, once
function applyPixelIcons(root = document) {
  if (uiVersion() !== "3" || typeof root?.querySelectorAll !== "function") return;
  const svgs = [...root.querySelectorAll("svg[data-px]")];
  if (root.matches?.("svg[data-px]")) svgs.push(root);
  svgs.forEach(svg => {
    if (svg.dataset?.pxDone) return;
    const markup = pixelIconMarkup(svg.dataset?.px);
    if (!markup) return;
    svg.innerHTML = markup;
    svg.setAttribute?.("viewBox", "0 0 11 11");
    svg.classList?.add?.("px");
    svg.dataset.pxDone = "1";
  });
}
// YouTube's 4:3 thumbnails letterbox 16:9 videos; those get zoomed past the bars
const LETTERBOXED_THUMBNAIL = /\/(?:hq|sd)?default\.(?:jpg|webp)/;
const QUEUE_SCROLL_EDGE = 64;
let queueDragPoint = null;
let queueDragFrame = null;
// the pointer that lifted a queue row by its handle: { pointerId, row, grabOffset, dy }
let queueDrag = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function prefersReducedMotion() {
  return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

function replayAnimation(node, className) {
  if (!node?.classList) return;
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

function isLetterboxed(url) {
  return LETTERBOXED_THUMBNAIL.test(String(url || ""));
}

function playlistHue(name) {
  let hash = 0;
  for (const char of String(name || "")) hash = (hash * 31 + char.codePointAt(0)) % 360;
  return hash;
}

function kickTransportGlyph(button) {
  const glyph = button?.querySelector?.(".transport-glyph");
  if (glyph && !prefersReducedMotion()) replayAnimation(glyph, "is-kicked");
}

function setProgressVisual(seconds, total) {
  const percent = total > 0 ? Math.min(100, Math.max(0, seconds / total * 100)) : 0;
  $("#progress-track")?.style?.setProperty?.("--progress-fill", `${percent}%`);
  // the 3.0 stage repeats the time in dot-matrix digits, big enough to read from across the desk
  const clock = $("#np-clock");
  if (clock && "textContent" in clock) clock.textContent = formatTime(seconds);
  const clockTotal = $("#np-clock-total");
  if (clockTotal && "textContent" in clockTotal) clockTotal.textContent = `/ ${formatTime(total)}`;
  globalThis.LumenLite?.syncRange?.($("#progress-range"));
  // the range's value is raw seconds; screen readers hear the same "1:23 / 3:45" the time labels show
  const range = $("#progress-range");
  const spoken = total > 0 ? `${formatTime(seconds)} / ${formatTime(total)}` : "尚未播放";
  if (range?.setAttribute && range.getAttribute?.("aria-valuetext") !== spoken) range.setAttribute("aria-valuetext", spoken);
}

function setVolumeVisual(volume) {
  $("#volume-range")?.setAttribute?.("aria-valuetext", `${Math.round(volume)}%`);
  const level = volume <= 0 ? 0 : volume <= 40 ? 1 : 2;
  const icon = $("#volume-icon");
  if (typeof icon?.classList?.add !== "function") return;
  icon.classList.remove("lv-0", "lv-1", "lv-2");
  icon.classList.add(`lv-${level}`);
}

function buttonLabel(button) {
  return button?.querySelector?.(":scope > .lg-btn-label") || button;
}

function flashAddButton(form) {
  const button = form?.querySelector?.('button[type="submit"]');
  if (!button || typeof button.classList?.add !== "function") return;
  clearTimeout(button.doneTimer);
  // a 3.0 glass button keeps its light layers; only the label inside changes
  const label = buttonLabel(button);
  if (!button.dataset.label) button.dataset.label = label.textContent;
  button.classList.add("is-done");
  label.innerHTML = `${ADD_DONE_ICON}已加入`;
  button.doneTimer = setTimeout(() => {
    button.classList.remove("is-done");
    label.textContent = button.dataset.label;
  }, 1400);
}

function captureRowRects(list) {
  const rects = new Map();
  if (typeof list?.querySelectorAll !== "function") return rects;
  list.querySelectorAll(".queue-item").forEach(row => {
    if (row.dataset?.key) rects.set(row.dataset.key, row.getBoundingClientRect());
  });
  return rects;
}

// FLIP: rows that survive a rebuild glide from their old slot instead of re-entering
function animateQueueReflow(rows, previousRects) {
  if (!previousRects.size || prefersReducedMotion()) return;
  rows.forEach(row => {
    const before = previousRects.get(row.dataset?.key);
    if (!before) {
      row.classList.add("is-new");
      return;
    }
    if (typeof row.animate !== "function") return;
    row.classList.add("is-settled");
    const after = row.getBoundingClientRect();
    const dy = before.top - after.top;
    if (Math.abs(dy) < 1) return;
    row.animate(
      [{ transform: `translateY(${dy}px)` }, { transform: "translateY(0)" }],
      { duration: 520, easing: "cubic-bezier(.22, 1, .36, 1)" },
    );
  });
}

const pageTitles = {
  dashboard: "今晚播什麼？",
  playlists: "播放清單",
  settings: "機器人設定",
  permissions: "權限群組",
  logs: "執行日誌",
};

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function lumen() {
  const L = globalThis.LumenLite;
  return uiVersion() === "3" && L?.active?.() ? L : null;
}

function toast(message, type = "info", meme = type === "error" ? "gugugaga" : "") {
  // 3.0: a Lumen glass capsule blown up at the top of the screen; swipe it up to dismiss
  const L = lumen();
  if (L) { L.toast(message, { error: type === "error", meme, duration: 3600 }); return; }
  const node = document.createElement("div");
  node.className = `toast${type === "error" ? " is-error" : ""}${meme ? " has-meme" : ""}`;
  node.textContent = message;
  if (meme) {
    const image = document.createElement("img");
    image.className = "toast-meme";
    image.src = `/assets/meme-${meme}.webp`;
    image.alt = "";
    node.append(image);
  }
  const bar = document.createElement("span");
  bar.className = "toast-bar";
  node.append(bar);
  $("#toast-region").append(node);
  setTimeout(() => dismissToast(node), 2800);
}

function dismissToast(node) {
  if (!node || node.isLeaving) return;
  node.isLeaving = true;
  node.classList.add("is-leaving");
  node.addEventListener("animationend", () => node.remove(), { once: true });
}

// stays up until the returned dismiss runs, for requests that may take a while
function pendingToast(message) {
  const L = lumen();
  if (L) return L.toast(message, { spinner: true, duration: Infinity });
  const node = document.createElement("div");
  node.className = "toast is-pending";
  node.setAttribute?.("role", "status");
  const spinner = document.createElement("span");
  spinner.className = "toast-spinner";
  spinner.setAttribute?.("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = message;
  node.append(spinner, text);
  $("#toast-region").append(node);
  return () => dismissToast(node);
}

function syncLoudMeme(volume) {
  const loud = $("#meme-loud");
  if (loud) loud.hidden = volume < 100;
}

function parseApiPayload(path, text) {
  const safeText = path.startsWith("/api/guilds")
    ? text.replace(/("id"\s*:\s*)(\d{16,})/g, '$1"$2"')
    : text;
  return JSON.parse(safeText);
}

async function api(path, options = {}) {
  const config = { ...options, headers: { ...(options.headers || {}) } };
  if (config.body && typeof config.body !== "string") {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }
  if (config.method && config.method !== "GET") {
    config.headers["X-MusicBot-CSRF"] = state.csrf;
  }
  const response = await fetch(path, config);
  const responseText = await response.text();
  let payload;
  try {
    payload = parseApiPayload(path, responseText);
  } catch {
    payload = { error: "伺服器回傳了無法解析的內容" };
  }
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    // the public proxy rewrites error text, so callers branch on the status instead
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setConnected(connected, message = "已連線") {
  state.connected = connected;
  const pill = $("#connection-pill");
  pill.classList.toggle("is-offline", !connected);
  $("#connection-text").textContent = message;
  const banner = $("#offline-banner");
  if (banner) banner.hidden = connected;
  if (connected) $("#reconnect-layer").hidden = true;
}

function setMutationBusy(busy) {
  state.mutationBusy = busy;
  document.body?.classList?.toggle("is-mutating", busy);
  if (document.querySelectorAll) {
    $$("[data-mutation-control]").forEach(control => { control.disabled = busy; });
  }
  const createButton = $("#new-playlist");
  if (createButton) createButton.disabled = busy;
  if (state.player) renderPlayer(state.player);
  else syncQueueSelectionControls([]);
  if (state.playlistsLoaded) renderPlaylistEditor();
}

async function runMutation(work) {
  if (state.mutationBusy) return null;
  setMutationBusy(true);
  try {
    return await work();
  } finally {
    state.playerVersion += 1;
    setMutationBusy(false);
  }
}

// mutations answer with the new queue; the snapshot keeps it so later re-renders agree
function applyQueue(queue) {
  if (state.player) state.player = { ...state.player, queue };
  renderQueue(queue);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isPublicMode() {
  return document.documentElement?.dataset?.mode === "public";
}

// ---------- Interface version (2.0 / 3.0) and the 3.0 night / day theme ----------
// each browser keeps its own choice; the inline script in index.html applies it before the first paint
const UI_VERSION_KEY = "musicbot.uiVersion";
const UI_THEME_KEY = "musicbot.uiTheme";
const UI_INTRO_KEY = "musicbot.uiIntroDismissed";
// set by 2.0 right before it reloads into 3.0; read once by the head script and playUiWelcome()
const UI_WELCOME_KEY = "musicbot.uiWelcome";
// the same for 3.0 → 2.0: 2.0 then plays playUiOldie() once
const UI_OLDIE_KEY = "musicbot.uiOldie";

function readPreference(key) {
  try { return globalThis.localStorage?.getItem?.(key) ?? null; } catch { return null; }
}

function writePreference(key, value) {
  try { globalThis.localStorage?.setItem?.(key, value); return true; } catch { return false; }
}

function uiVersion() {
  return document.documentElement?.dataset?.ui === "3" ? "3" : "2";
}

function uiTheme() {
  return document.documentElement?.dataset?.theme === "light" ? "light" : "dark";
}

// a fresh page is simpler and safer than restyling a live one: the shells differ on phones
function setUiVersion(version) {
  const next = version === "3" ? "3" : "2";
  writePreference(UI_VERSION_KEY, next);
  if (next === uiVersion()) return;
  // the next page plays its arrival once: the 3.0 welcome, or 2.0 teasing whoever went back to it
  try { globalThis.sessionStorage?.setItem?.(next === "3" ? UI_WELCOME_KEY : UI_OLDIE_KEY, "1"); } catch { /* no arrival then */ }
  const reload = () => globalThis.location?.reload?.();
  if (prefersReducedMotion()) { reload(); return; }
  // the old look blurs back and sinks into the dark the next one starts from, so the reload never flashes
  const root = document.documentElement;
  const leave = () => {
    root?.style?.setProperty?.("--ui-leave-bg", next === "2" ? "#050506" : readPreference(UI_THEME_KEY) === "light" ? "#e3e1dc" : "#08090b");
    root?.classList?.add?.("is-ui-leaving");
  };
  // 3.0 first lets the glass slide over to the chosen version
  let slide = 0;
  const options = $(".ui-version-options");
  if (lumen() && options?._lgPill) {
    $$("[data-ui-version]").forEach(button => button.classList?.toggle?.("is-active", button.dataset.uiVersion === next));
    lumen().syncPill(options);
    slide = 260;
  }
  if (slide) setTimeout(leave, slide);
  else leave();
  setTimeout(reload, slide + 320);
}

function prefersReducedMotion() {
  return !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
}

/* ---------- 3.0 welcome (2.0 → 3.0) ----------
   A light-saber beam draws out from the centre and condenses into a lit glass capsule; inside it a dot-matrix "3.0"
   boots up left to right while the rim light runs once around counter-clockwise and comes to rest at its light source.
   Then the stage dissolves and the panels rise in one after another. Any click or key skips straight to the end. */
const WELCOME_MARK = [
  ".###.....###.",
  "#...#...#...#",
  "....#...#...#",
  "..##....#...#",
  "....#...#...#",
  "#...#...#...#",
  ".###..#..###.",
];

function welcomeMarkMarkup() {
  const cols = WELCOME_MARK[0].length + 2, rows = WELCOME_MARK.length + 2;
  const off = [], on = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const at = `x="${x + .11}" y="${y + .11}" width=".78" height=".78" rx=".22"`;
      // the dim display wakes up from the middle outwards
      const dist = Math.hypot(x - (cols - 1) / 2, (y - (rows - 1) / 2) * 1.4);
      off.push(`<rect class="w-off" ${at} style="--d:${Math.round(280 + dist * 26)}ms"/>`);
      if (WELCOME_MARK[y - 1]?.[x - 1] !== "#") continue;
      // lit dots sweep in left to right, each flying in from a little scatter and flashing white-hot as it lands
      const angle = Math.random() * Math.PI * 2, reach = 0.8 + Math.random() * 0.9;
      const delay = Math.round(560 + x * 40 + y * 8 + Math.random() * 40);
      on.push(`<rect class="w-on" ${at} style="--d:${delay}ms;--sx:${(Math.cos(angle) * reach).toFixed(2)}px;--sy:${(Math.sin(angle) * reach).toFixed(2)}px"/>`);
    }
  }
  return `<svg class="v3-welcome-mark" viewBox="0 0 ${cols} ${rows}" aria-hidden="true">${off.join("")}${on.join("")}</svg>`;
}

function playUiWelcome() {
  const root = document.documentElement;
  if (root?.dataset?.uiWelcome !== "1") return;
  try { globalThis.sessionStorage?.removeItem?.(UI_WELCOME_KEY); } catch { /* already gone */ }
  const L = lumen();
  const reduce = prefersReducedMotion();
  const overlay = document.createElement("div");
  overlay.className = "v3-welcome" + (reduce ? " is-reduced" : "");
  overlay.setAttribute("role", "status");
  overlay.innerHTML = `
    <span class="v3-welcome-ambient" aria-hidden="true"></span>
    <div class="v3-welcome-stage" aria-hidden="true">
      <div class="v3-welcome-core">
        <span class="v3-welcome-beam"></span>
        <div class="v3-welcome-badge lg-glass">${welcomeMarkMarkup()}</div>
      </div>
      <p class="v3-welcome-title">歡迎來到 <span>3.0</span></p>
      <p class="v3-welcome-sub">Lumen Glass · 光與玻璃</p>
    </div>
    <span class="visually-hidden">已切換到 3.0 介面</span>`;
  const badge = overlay.querySelector(".v3-welcome-badge");
  if (L?.layerSpans) badge.prepend(L.layerSpans());
  document.body.appendChild(overlay);
  if (L?.attachLens) L.attachLens(badge);

  const timers = [];
  let finished = false, spinFrame = 0;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  // the capsule forms out of the beam on the knob spring: flat and wide first, then it pops round with a small overshoot
  const pop = L?.createSpring?.(p => {
    badge.style.transform = `scale(${(.5 + .5 * p).toFixed(4)}, ${(.12 + .88 * p).toFixed(4)})`;
    badge.style.opacity = Math.min(1, p * 2.5).toFixed(3);
  }, 0.001, 300, 20);
  if (pop) { pop.jump(0); later(() => pop.to(1), reduce ? 0 : 360); }
  else badge.style.opacity = "1";

  // the rim light runs one full turn counter-clockwise and comes to rest where the theme's light comes from
  const rest = root.dataset.theme === "light" ? 20 : 200;
  const spinFrom = performance.now() + 440, spinFor = 1500;
  const spin = now => {
    const t = Math.min(1, Math.max(0, (now - spinFrom) / spinFor));
    const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    badge.style.setProperty("--lg-angle", `${(rest + 360 * (1 - eased)).toFixed(2)}deg`);
    spinFrame = t < 1 && !finished ? requestAnimationFrame(spin) : 0;
  };
  if (reduce) badge.style.setProperty("--lg-angle", `${rest}deg`);
  else spinFrame = requestAnimationFrame(spin);

  const shell = $("#app-shell");
  function finish(fast = false) {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    cancelAnimationFrame(spinFrame);
    globalThis.removeEventListener?.("keydown", skip, true);
    overlay.removeEventListener("pointerdown", skip);
    overlay.classList.add("is-leaving");
    if (fast) overlay.classList.add("is-fast");
    delete root.dataset.uiWelcome;
    shell?.classList.add("is-welcome-rise");
    setTimeout(() => {
      overlay.remove();
      pop?.stop?.();
      shell?.classList.remove("is-welcome-rise");
    }, fast ? 760 : 1100);
  }
  function skip(event) {
    if (event.type === "keydown" && ["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    event.preventDefault?.();
    finish(true);
  }
  globalThis.addEventListener?.("keydown", skip, true);
  overlay.addEventListener("pointerdown", skip);
  later(() => finish(), reduce ? 1300 : 2300);
}

/* ---------- 2.0 arrival (3.0 → 2.0 only) ----------
   An old CRT clicks on, a VHS "◀◀ REWIND" winds 3.0 back down to 2.0, then the penguin pops up flapping and laughs at
   whoever went back. The set switches off like an old TV to reveal 2.0. Any click or key skips to the end. */
function playUiOldie() {
  const root = document.documentElement;
  if (root?.dataset?.uiOldie !== "1") return;
  try { globalThis.sessionStorage?.removeItem?.(UI_OLDIE_KEY); } catch { /* already gone */ }
  const reduce = prefersReducedMotion();
  const overlay = document.createElement("div");
  overlay.className = "ui-oldie" + (reduce ? " is-reduced" : "");
  overlay.setAttribute("role", "status");
  overlay.innerHTML = `
    <div class="ui-oldie-screen" aria-hidden="true">
      <span class="ui-oldie-osd"><span class="ui-oldie-osd-icon">◀◀</span> <span class="ui-oldie-osd-label">REWIND</span></span>
      <span class="ui-oldie-stamp">1999 12 31&nbsp;&nbsp;PM 11:59</span>
      <div class="ui-oldie-body">
        <p class="ui-oldie-version"><span class="ui-oldie-digits">3.0</span></p>
        <figure class="ui-oldie-mascot">
          <img src="/assets/meme-arms.webp" alt="" width="152" height="152" decoding="async">
          <figcaption class="ui-oldie-bubble">你個過時老人，<br>還在用舊版，<span class="ui-oldie-haha"><span>哈</span><span>哈</span><span>！</span></span></figcaption>
        </figure>
      </div>
      <span class="ui-oldie-tracking"></span>
      <span class="ui-oldie-scanlines"></span>
    </div>
    <span class="visually-hidden">已切換回 2.0 介面。你個過時老人，還在用舊版，哈哈！</span>`;
  document.body.appendChild(overlay);

  const timers = [];
  let finished = false;
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const digits = overlay.querySelector(".ui-oldie-digits");
  const label = overlay.querySelector(".ui-oldie-osd-label");
  const icon = overlay.querySelector(".ui-oldie-osd-icon");
  const landed = () => {
    digits.textContent = "2.0";
    overlay.classList.add("is-landed");
    label.textContent = "PLAY";
    icon.textContent = "▶";
  };
  if (reduce) landed();
  else {
    // 3.0 → 2.9 → … → 2.0, fast at first and dragging at the end like a tape running out
    let at = 380;
    for (let step = 1; step <= 10; step++) {
      at += 30 + step * step * 1.6;
      const value = (30 - step) / 10;
      later(step === 10 ? landed : () => { digits.textContent = value.toFixed(1); }, at);
    }
  }

  const shell = $("#app-shell");
  function finish(fast = false) {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);
    globalThis.removeEventListener?.("keydown", skip, true);
    overlay.removeEventListener("pointerdown", skip);
    if (!overlay.classList.contains("is-landed")) landed();
    overlay.classList.add("is-leaving");
    if (fast) overlay.classList.add("is-fast");
    delete root.dataset.uiOldie;
    shell?.classList.add("is-oldie-reveal");
    setTimeout(() => {
      overlay.remove();
      shell?.classList.remove("is-oldie-reveal");
    }, fast ? 700 : 1000);
  }
  function skip(event) {
    if (event.type === "keydown" && ["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
    event.preventDefault?.();
    finish(true);
  }
  globalThis.addEventListener?.("keydown", skip, true);
  overlay.addEventListener("pointerdown", skip);
  later(() => finish(), reduce ? 2600 : 3900);
}

function setUiTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  writePreference(UI_THEME_KEY, next);
  const root = document.documentElement;
  const previous = root?.dataset?.theme;
  const apply = () => {
    if (root?.dataset) root.dataset.theme = next;
    syncUiControls();
  };
  // night ⇄ day crossfades the whole page from the old theme to the new one on easeOutExpo (styles-v3.css);
  // browsers without view transitions just switch
  const fade = previous && previous !== next && uiVersion() === "3" && !prefersReducedMotion()
    && typeof document.startViewTransition === "function";
  if (!fade) { apply(); return; }
  root.classList.add("is-theme-fading");
  const transition = document.startViewTransition(apply);
  transition.finished.finally(() => root.classList.remove("is-theme-fading"));
}

// first visit: 2.0 shows, and the intro invites a try of 3.0 until someone picks a version or ticks 不再顯示
function shouldShowUiIntro() {
  return uiVersion() === "2" && readPreference(UI_VERSION_KEY) === null && readPreference(UI_INTRO_KEY) !== "1";
}

function syncUiControls() {
  const version = uiVersion();
  $$("[data-ui-version]").forEach(button => {
    const active = button.dataset.uiVersion === version;
    button.classList?.toggle?.("is-active", active);
    button.setAttribute?.("aria-pressed", String(active));
  });
  const toggle = $("#ui-theme-toggle");
  if (toggle?.setAttribute) {
    const light = uiTheme() === "light";
    toggle.checked = light;
    toggle.setAttribute("aria-label", light ? "晝主題：開" : "晝主題：關");
    toggle._lgSwitch?.sync?.();
  }
  const meta = $('meta[name="theme-color"]');
  if (meta?.setAttribute && version === "3") meta.setAttribute("content", uiTheme() === "light" ? "#e8e6e1" : "#08090b");
}

// 3.0 dresses this page's own controls in Lumen Glass (lumen.js); app.js keeps driving the same elements
function enhanceLumen(root = document) {
  const L = lumen();
  if (!L || typeof root?.querySelectorAll !== "function") return;
  const find = selector => [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  // the play button is the one lit thing on screen; every other button is glass that lights on hover and press
  find("#play-toggle").forEach(button => L.button(button, { lit: true }));
  find(".button").forEach(button => L.button(button));
  find("#progress-range").forEach(input => L.range(input, { host: $("#progress-track"), className: "lg-range-progress" }));
  find("#volume-range").forEach(input => {
    const wrap = document.createElement("span");
    wrap.className = "lg-volume-host";
    input.parentNode.insertBefore(wrap, input);
    wrap.append(input);
    L.range(input, { host: wrap, className: "lg-range-volume" });
  });
  find("#ui-theme-toggle").forEach(input => {
    const icon = document.createElement("span");
    icon.className = "lg-theme-icon";
    icon.innerHTML = '<svg class="ui-theme-moon" data-px="moon" viewBox="0 0 24 24" aria-hidden="true"></svg><svg class="ui-theme-sun" data-px="sun" viewBox="0 0 24 24" aria-hidden="true"></svg>';
    L.switchify(input, { icon, className: "lg-theme-switch" });
    applyPixelIcons(icon);
  });
  find("input.switch").forEach(input => L.switchify(input));
  find(".search-field").forEach(box => L.field(box));
  find(".setting-control input[type='text'], .setting-control input[type='number'], #playlist-create-name, #queue-new-playlist-name").forEach(input => L.fieldAround(input));
  find("#main-nav").forEach(nav => L.pill(nav, { items: ".nav-item", active: ".nav-item.is-active", axis: () => (isCompactLayout() ? "x" : "y"), rim: () => (isCompactLayout() ? "dial" : "side"), bar: () => !isCompactLayout(), className: "lg-nav-pill" }));
  find(".ui-version-options").forEach(group => L.pill(group, { items: ".ui-version-option", active: ".ui-version-option.is-active", className: "lg-version-pill" }));
}

function closeUiIntro({ tryNew = false } = {}) {
  const dialog = $("#ui-intro");
  if ($("#ui-intro-dismiss")?.checked) writePreference(UI_INTRO_KEY, "1");
  dialog?.close?.();
  if (tryNew) setUiVersion("3");
}

function setupUiVersion() {
  $$("[data-ui-version]").forEach(button => button.addEventListener?.("click", () => setUiVersion(button.dataset.uiVersion)));
  $("#ui-theme-toggle")?.addEventListener?.("change", event => setUiTheme(event.target.checked ? "light" : "dark"));
  $("#ui-intro-try")?.addEventListener?.("click", () => closeUiIntro({ tryNew: true }));
  $("#ui-intro-stay")?.addEventListener?.("click", () => closeUiIntro());
  // Esc closes it like 先用 2.0, still honouring the checkbox
  $("#ui-intro")?.addEventListener?.("cancel", () => { if ($("#ui-intro-dismiss")?.checked) writePreference(UI_INTRO_KEY, "1"); });
  syncUiControls();
  if (uiVersion() === "3") {
    applyPixelIcons();
    enhanceLumen();
    playUiWelcome();
    // the sticky top bar only covers the page once it scrolls; at the top it sits under it so glows are not cut off
    const main = $("#main");
    main?.addEventListener?.("scroll", () => main.classList.toggle("is-scrolled", main.scrollTop > 1), { passive: true });
    // rows rebuilt later (queue, playlists, settings) carry data-px and controls too
    if (typeof MutationObserver === "function" && document.body) {
      new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
        if (node.nodeType !== 1) return;
        applyPixelIcons(node);
        enhanceLumen(node);
      }))).observe(document.body, { childList: true, subtree: true });
    }
  } else playUiOldie();
  if (shouldShowUiIntro()) {
    const dialog = $("#ui-intro");
    setTimeout(() => { if (!dialog?.open && shouldShowUiIntro()) dialog?.showModal?.(); }, 900);
  }
}

function switchPage(name) {
  const current = $(".page.is-active");
  const next = $(`[data-page-panel="${name}"]`);
  if (!next || current === next) return;
  if (isPublicMode() && next.hasAttribute?.("data-local-only")) return;
  current?.classList.add("is-leaving");
  current?.classList.remove("is-active");
  setTimeout(() => current?.classList.remove("is-leaving"), 150);
  next.classList.add("is-active");
  const shell = $("#app-shell");
  if (shell?.dataset) shell.dataset.page = name;
  $$(".nav-item").forEach(item => {
    const active = item.dataset.page === name;
    item.classList.toggle("is-active", active);
    if (active) item.setAttribute?.("aria-current", "page");
    else item.removeAttribute?.("aria-current");
  });
  globalThis.LumenLite?.syncPill?.($("#main-nav"));
  const main = $("#main");
  if (main && typeof main.scrollTo === "function") main.scrollTo({ top: 0 });
  const title = $("#page-title");
  if (title) title.textContent = pageTitles[name];
  replayAnimation(title, "is-swapping");
  if (name === "playlists") loadPlaylists();
  if (name === "settings") loadSettings();
  if (name === "logs") loadLogs();
  if (name === "permissions") loadPermissions();
}

function renderGuilds(guilds) {
  const select = $("#guild-select");
  const previous = String(state.guildId || "");
  select.replaceChildren(...guilds.map(guild => {
    const option = document.createElement("option");
    option.value = guild.id;
    option.textContent = guild.name;
    return option;
  }));
  if (!guilds.length) {
    const option = document.createElement("option");
    option.textContent = "尚未加入伺服器";
    option.value = "";
    select.append(option);
    state.guildId = null;
    return;
  }
  const candidate = guilds.some(g => String(g.id) === previous) ? previous : String(guilds[0].id);
  select.value = candidate;
  state.guildId = candidate;
}

// small cover slots (player bar, the queue's 正在播放 row) borrow the big cover's penguin stand-in
function setMiniArtwork(imageSelector, boxSelector, thumbnail, hasTrack) {
  const image = $(imageSelector);
  if (!image) return;
  const url = thumbnail || (hasTrack ? STAND_IN_ART : "");
  $(boxSelector)?.classList?.toggle?.("is-letterboxed", isLetterboxed(url));
  if (url) {
    let triedStandIn = url === STAND_IN_ART;
    image.onerror = () => {
      if (hasTrack && !triedStandIn) {
        triedStandIn = true;
        image.src = STAND_IN_ART;
        return;
      }
      image.hidden = true;
    };
    image.onload = () => { image.hidden = false; };
    image.hidden = true;
    image.src = url;
  } else {
    image.onload = null;
    image.onerror = null;
    image.removeAttribute?.("src");
    image.hidden = true;
  }
}

const STAND_IN_ART = "/assets/meme-dance.webp";

// each ambient light keeps two layers: the next cover fades in over the current one once it has loaded
function setBackdropImage(url) {
  const groups = $$(".ambient")
    .map(ambient => (typeof ambient?.querySelectorAll === "function" ? $$(".ambient-layer", ambient) : []))
    .filter(layers => layers.length >= 2);
  const activeLayer = layers => layers.find(layer => layer.classList.contains("is-active")) || layers[0];
  const pending = groups.filter(layers => (activeLayer(layers).dataset.image || STAND_IN_ART) !== url);
  if (!pending.length) return;
  state.backdropImage = url;
  const swap = () => {
    if (state.backdropImage !== url) return;
    pending.forEach(layers => {
      const active = activeLayer(layers);
      const next = layers.find(layer => layer !== active);
      next.dataset.image = url;
      next.style.backgroundImage = `url(${JSON.stringify(url)})`;
      active.classList.remove("is-active");
      next.classList.add("is-active");
    });
  };
  if (typeof Image !== "function") { swap(); return; }
  const probe = new Image();
  probe.onload = swap;
  probe.onerror = () => {
    if (state.backdropImage === url && url !== STAND_IN_ART) setBackdropImage(STAND_IN_ART);
  };
  probe.src = url;
}

// the signature moment: the cover leaves in the skip direction, then the next one springs in
// from the other side while the ambient light crossfades to it
function setArtwork(entry, changed) {
  const art = $("#album-art");
  const thumbnail = entry?.thumbnail || "";
  // polling re-renders every two seconds; only touch the artwork when it really changes
  const artworkKey = entry ? thumbnail || "stand-in" : "";
  if (!changed && state.artworkKey === artworkKey) return;
  state.artworkKey = artworkKey;
  const back = state.skipDirection < 0;
  const covers = [art, isPlayerOpen() ? $("#bar-art") : null].filter(cover => cover?.classList);
  if (changed) {
    covers.forEach(cover => {
      cover.classList.toggle("is-back", back);
      cover.classList.add("is-changing");
    });
  }
  setTimeout(() => {
    const image = $("#album-image");
    const fallback = $("#album-fallback");
    art.classList.toggle("is-letterboxed", isLetterboxed(thumbnail));
    if (thumbnail) {
      image.onerror = () => {
        image.hidden = true;
        image.removeAttribute("src");
        fallback.hidden = false;
      };
      image.onload = () => {
        image.hidden = false;
        fallback.hidden = true;
      };
      image.hidden = true;
      fallback.hidden = false;
      image.src = thumbnail;
      image.alt = `${entry.title} 封面`;
    } else {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      image.hidden = true;
      fallback.hidden = false;
    }
    setMiniArtwork("#bar-image", "#bar-art", thumbnail, Boolean(entry));
    setMiniArtwork("#queue-now-image", "#queue-now-thumb", thumbnail, Boolean(entry));
    setBackdropImage(thumbnail || STAND_IN_ART);
    covers.forEach(cover => {
      cover.classList.remove("is-changing", "is-back");
      if (changed && !prefersReducedMotion()) {
        cover.classList.remove("enter-next", "enter-prev");
        replayAnimation(cover, back ? "enter-prev" : "enter-next");
      }
    });
  }, changed ? 170 : 0);
}

function updateTrackTitleOverflow() {
  const viewport = $("#track-title-viewport");
  const title = $("#track-title");
  if (!viewport || !title) return;

  const overflow = Math.max(0, Math.ceil(title.scrollWidth - viewport.clientWidth));
  const isOverflowing = overflow > 2;
  viewport.classList.toggle("is-overflowing", isOverflowing);

  if (!isOverflowing) {
    viewport.style.removeProperty("--title-overflow");
    viewport.style.removeProperty("--title-marquee-duration");
    return;
  }

  const duration = Math.min(18, Math.max(8, 6 + overflow / 45));
  viewport.style.setProperty("--title-overflow", `${overflow}px`);
  viewport.style.setProperty("--title-marquee-duration", `${duration.toFixed(2)}s`);
}

function setTrackTitle(value) {
  const title = $("#track-title");
  const viewport = $("#track-title-viewport");
  if (!title || !viewport) return;

  const nextTitle = value || "尚未播放歌曲";
  if (title.textContent === nextTitle) return;

  const hadTitle = Boolean(title.textContent);
  title.textContent = nextTitle;
  if (hadTitle && !prefersReducedMotion()) replayAnimation($(".track-copy"), "is-entering");
  viewport.classList.remove("is-overflowing");
  requestAnimationFrame(updateTrackTitleOverflow);
}

function renderNowPlayingState(player) {
  const chip = $("#np-state");
  if (!chip?.classList) return;
  const status = !player?.current ? "idle" : player.state === "paused" ? "paused" : "playing";
  chip.hidden = status === "idle";
  chip.classList.toggle("is-playing", status === "playing");
  const label = $("#np-state-text");
  if (label) label.textContent = status === "paused" ? "已暫停" : "正在播放";
}

function renderBarTrack(player) {
  const current = player?.current;
  const title = $("#bar-title");
  if (title) {
    title.textContent = current?.title || "尚未播放歌曲";
    title.title = current?.title || "";
  }
  if (typeof document.title === "string") {
    state.baseTitle = state.baseTitle || document.title;
    document.title = current && player.state === "playing" ? `${current.title} · ${state.baseTitle}` : state.baseTitle;
  }
}

function renderQueueNow(player) {
  const section = $("#queue-now");
  if (!section) return;
  const current = player?.current;
  section.hidden = !current;
  section.classList?.toggle?.("is-playing", player?.state === "playing");
  const title = $("#queue-now-title");
  if (title) {
    title.textContent = current?.title || "";
    title.title = current?.title || "";
  }
}

function renderPlayer(player) {
  const previousUrl = state.currentUrl;
  const currentUrl = player?.current?.url || "";
  const changed = previousUrl && currentUrl !== previousUrl;
  state.player = player;
  state.currentUrl = currentUrl;
  state.lastSync = performance.now();

  const playing = player?.state === "playing";
  $("#art-stage").classList.toggle("is-playing", playing);
  $("#now-playing")?.classList?.toggle?.("is-playing", playing);
  $("#app-shell")?.classList?.toggle?.("is-playing", playing);
  $("#app-shell")?.classList?.toggle?.("has-track", Boolean(player?.current));
  setTrackTitle(player?.current?.title);
  $("#track-meta").textContent = player?.current ? (player.voice_channel?.name || "未連接語音頻道") : "加入一首歌，讓今晚有點聲音。";
  renderNowPlayingState(player);
  renderBarTrack(player);
  renderQueueNow(player);
  setArtwork(player?.current, changed);

  const total = player?.current?.duration || 0;
  const progress = Math.min(player?.progress || 0, total || Number.MAX_VALUE);
  const progressRange = $("#progress-range");
  progressRange.max = total || 100;
  progressRange.disabled = state.mutationBusy || !player?.current || total <= 0;
  $("#progress-track")?.classList?.toggle?.("is-disabled", progressRange.disabled);
  if (!state.scrubbing) {
    progressRange.value = progress;
    $("#time-current").textContent = formatTime(progress);
    setProgressVisual(progress, total);
  }
  $("#time-total").textContent = formatTime(total);

  const toggle = $("#play-toggle");
  const paused = player?.state === "paused";
  // after a stop nothing is loaded but the queue waits; play starts its first song
  const canStartQueue = !player?.current && (player?.queue || []).length > 0;
  toggle.dataset.action = paused ? "resume" : canStartQueue ? "play" : "pause";
  const showPlay = paused || !player?.current;
  toggle.classList.toggle("is-paused", showPlay);
  // CSS animates `d`; the attributes keep the right glyph where that is unsupported
  const glyphPaths = PLAY_PAUSE_PATHS[showPlay ? "play" : "pause"];
  [".pp-l", ".pp-r"].forEach((selector, index) => toggle.querySelector?.(selector)?.setAttribute?.("d", glyphPaths[index]));
  toggle.setAttribute("aria-label", paused || !player?.current ? "播放" : "暫停");
  toggle.title = paused || !player?.current ? "播放" : "暫停";
  toggle.disabled = state.mutationBusy || (!player?.current && !canStartQueue);

  const shuffle = $("#transport-shuffle");
  const shuffleEnabled = Boolean(player?.shuffle);
  shuffle.classList.toggle("is-active", shuffleEnabled);
  shuffle.setAttribute("aria-pressed", String(shuffleEnabled));
  shuffle.setAttribute("aria-label", shuffleEnabled ? "啟用隨機播放" : "關閉隨機播放");
  const shuffleDot = shuffle.querySelector?.(".transport-state-dot");
  if (shuffleDot) shuffleDot.hidden = !shuffleEnabled;
  shuffle.disabled = state.mutationBusy || (!player?.current && !(player?.queue || []).length);

  const previous = $("#transport-previous");
  previous.disabled = state.mutationBusy || !player?.can_previous;

  const next = $("#transport-next");
  next.disabled = state.mutationBusy || !player?.current;

  const repeat = $("#transport-repeat");
  const repeatMode = ["song", "all", "off"].includes(player?.repeat_mode)
    ? player.repeat_mode
    : player?.repeat_song
      ? "song"
      : player?.repeat_all
        ? "all"
        : "off";
  const repeatEnabled = repeatMode !== "off";
  const repeatLabel = REPEAT_LABELS[repeatMode];
  const nextAction = REPEAT_NEXT_ACTIONS[repeatMode];
  repeat.dataset.action = nextAction;
  repeat.classList.toggle("is-active", repeatEnabled);
  repeat.setAttribute("aria-pressed", String(repeatEnabled));
  repeat.setAttribute("aria-label", `${repeatLabel}，點擊切換循環模式`);
  repeat.title = repeatLabel;
  $("#repeat-state-dot").hidden = repeatMode !== "all";
  $("#repeat-one-badge").hidden = repeatMode !== "song";
  repeat.disabled = state.mutationBusy || !player?.current;

  $("#transport-stop").disabled = state.mutationBusy || !player?.current;

  const volume = Math.round((player?.volume ?? .25) * 100);
  $("#volume-range").value = volume;
  $("#volume-range").style?.setProperty?.("--range-fill", `${volume}%`);
  globalThis.LumenLite?.syncRange?.($("#volume-range"));
  $("#volume-output").value = `${volume}%`;
  syncLoudMeme(volume);
  setVolumeVisual(volume);
  renderQueue(player?.queue || []);
}

function selectedQueueSources(queue) {
  return [...state.selectedQueueIndexes]
    .sort((left, right) => left - right)
    .map(index => queue[index]?.url || "")
    .filter(Boolean);
}

function syncQueueSelectionControls(queue) {
  const validIndexes = new Set(queue.map((_entry, index) => index));
  state.selectedQueueIndexes.forEach(index => {
    if (!validIndexes.has(index)) state.selectedQueueIndexes.delete(index);
  });
  const selectedCount = state.selectedQueueIndexes.size;
  const selectAll = $("#queue-select-all");
  const selectedLabel = $("#queue-selected-count");
  const addButton = $("#queue-add-to-playlist");
  const selectAllLabel = $(".queue-select-all-label");
  if (selectAllLabel) selectAllLabel.hidden = queue.length === 0;
  if (selectAll) {
    selectAll.disabled = state.mutationBusy || queue.length === 0;
    selectAll.checked = queue.length > 0 && selectedCount === queue.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < queue.length;
  }
  const queueList = $("#queue-list");
  if (queueList?.querySelectorAll) {
    $$(".queue-select-input", queueList).forEach((checkbox, index) => {
      checkbox.checked = state.selectedQueueIndexes.has(index);
      checkbox.disabled = state.mutationBusy;
    });
  }
  queueList?.classList?.toggle?.("has-selection", selectedCount > 0);
  const bulk = $("#queue-bulk-actions");
  if (bulk) bulk.hidden = selectedCount === 0;
  if (selectedLabel) {
    selectedLabel.textContent = selectedCount ? `已選取 ${selectedCount} 首歌曲` : "未選取歌曲";
    selectedLabel.hidden = selectedCount === 0;
  }
  if (addButton) {
    addButton.disabled = state.mutationBusy || selectedCount === 0;
    addButton.hidden = selectedCount === 0;
  }
  $("#queue-playlist-dialog-count").textContent = `已選取 ${selectedCount} 首歌曲`;
}

function formatQueueTotal(queue) {
  const seconds = queue.reduce((sum, entry) => sum + (Number(entry.duration) || 0), 0);
  if (seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `約 ${minutes} 分鐘`;
  const rest = minutes % 60;
  return `約 ${Math.floor(minutes / 60)} 小時${rest ? ` ${rest} 分` : ""}`;
}

function clearQueueSelection() {
  state.selectedQueueIndexes.clear();
  syncQueueSelectionControls(state.player?.queue || []);
}

function renderQueue(queue) {
  const list = $("#queue-list");
  $("#queue-count").textContent = `${queue.length} 首`;
  const total = $("#queue-total");
  if (total) total.textContent = formatQueueTotal(queue);
  $("#queue-clear").disabled = state.mutationBusy || queue.length === 0;
  $("#queue-empty").hidden = queue.length > 0;
  list.hidden = queue.length === 0;
  syncQueueSelectionControls(queue);

  const renderKey = JSON.stringify(queue.map(entry => [
    entry.url || "",
    entry.title || "",
    Number(entry.duration) || 0,
  ]));
  if (renderKey === state.queueRenderKey) {
    syncQueueRowControls(queue);
    syncQueueSelectionControls(queue);
    return;
  }
  // a rebuild would pull the lifted row out from under the pointer; the drop renders it
  if (state.draggingIndex !== null) return;
  state.selectedQueueIndexes.clear();
  state.queueRenderKey = renderKey;
  state.renderedQueue = queue;

  const previousRects = captureRowRects(list);
  // rows are keyed by song, so a song that stays in the queue keeps its node: focus on its handle, its loaded
  // thumbnail and its running animations survive a reorder, and the FLIP below glides that same node
  const existing = new Map();
  (typeof list.querySelectorAll === "function" ? $$(".queue-item", list) : list.children || [])
    .forEach(row => { if (row?.dataset?.key) existing.set(row.dataset.key, row); });
  const keyCounts = {};
  const rows = queue.map((entry, index) => {
    const baseKey = `${entry.url || ""}\u0000${entry.title || ""}`;
    keyCounts[baseKey] = (keyCounts[baseKey] || 0) + 1;
    const key = `${baseKey}\u0000${keyCounts[baseKey]}`;
    let row = existing.get(key);
    existing.delete(key);
    if (row) {
      // dropped from a drag: the lift comes off before the glide is measured, without the row's own
      // transform transition (a transition would outrank the FLIP and start from the old slot)
      if (row.classList.contains?.("is-dragging") && row.style) {
        row.style.transition = "none";
        settleQueueRow(row);
        row.getBoundingClientRect?.();
        row.style.removeProperty?.("transition");
      } else settleQueueRow(row);
      // its entrance already played; re-inserting it (Safari) must not play it again
      row.classList.remove("is-new");
      row.classList.add("is-settled");
    } else {
      row = createQueueRow();
      row.dataset.key = key;
    }
    fillQueueRow(row, entry, index);
    return row;
  });
  placeQueueRows(list, rows, existing);
  animateQueueReflow(rows, previousRects);
  syncQueueRowControls(queue);
  syncQueueSelectionControls(queue);
}

// Same order in the DOM as on screen. moveBefore() moves a row without taking it out of the document, so a focused
// handle stays focused; browsers without it (Safari) fall back to re-inserting, which is what the whole list did before.
function placeQueueRows(list, rows, leftovers) {
  if (typeof list.moveBefore !== "function" || typeof list.insertBefore !== "function") {
    list.replaceChildren(...rows);
    return;
  }
  leftovers.forEach(row => row.remove());
  rows.forEach(row => {
    if (row.parentNode === list) list.moveBefore(row, null);
    else list.insertBefore(row, null);
  });
}

function createQueueRow() {
  const row = document.createElement("div");
  row.className = "queue-item";
  row.innerHTML = `<label class="queue-lead"><span class="queue-index"></span><input class="queue-select-input" type="checkbox"></label><span class="queue-thumb">${NOTE_ICON}${THUMB_PLAY_ICON}</span><button class="queue-copy queue-play-target" type="button"><strong><span class="queue-title-text"></span></strong><small class="queue-meta-time"></small></button><span class="queue-row-end"><span class="queue-duration"></span><span class="queue-row-actions"><button class="queue-remove icon-button danger" type="button" aria-label="從佇列移除" title="從佇列移除">${QUEUE_ACTION_ICONS.remove}</button><button class="queue-handle icon-button" type="button" title="按住拖曳排序">${QUEUE_ACTION_ICONS.grip}</button></span></span>`;
  // the row is reused across renders, so every handler reads the row's current slot instead of capturing one
  const slot = () => Number(row.dataset.index);
  const checkbox = $(".queue-select-input", row);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) state.selectedQueueIndexes.add(slot());
    else state.selectedQueueIndexes.delete(slot());
    syncQueueSelectionControls(state.renderedQueue || []);
  });
  $(".queue-play-target", row).addEventListener("click", () => playQueueItem(slot()));
  const handle = $(".queue-handle", row);
  handle.addEventListener("pointerdown", event => startQueueDrag(event, row, slot()));
  handle.addEventListener("keydown", event => nudgeQueueItem(event, slot(), (state.renderedQueue || []).length));
  $(".queue-remove", row).addEventListener("click", () => removeQueueItem(slot(), row));
  const isInteractiveTarget = target => Boolean(target?.closest?.("button, input, label, a, select"));
  row.addEventListener("click", event => {
    if (state.suppressQueueClick || state.mutationBusy || isInteractiveTarget(event.target)) return;
    playQueueItem(slot());
  });
  observeQueueTitle($("strong", row));
  return row;
}

function fillQueueRow(row, entry, index) {
  row.dataset.index = index;
  row.style?.setProperty?.("--i", String(index));
  const number = $(".queue-index", row);
  if (number) number.textContent = String(index + 1);
  const checkbox = $(".queue-select-input", row);
  // titles come from the media source, so they are set as text or attributes, never as markup
  checkbox.setAttribute?.("aria-label", `選取第 ${index + 1} 首歌曲`);
  checkbox.checked = state.selectedQueueIndexes.has(index);
  $(".queue-play-target", row).setAttribute?.("aria-label", `播放第 ${index + 1} 首：${entry.title}`);
  $(".queue-handle", row).setAttribute?.("aria-label", `排序第 ${index + 1} 首「${entry.title}」：按住拖曳，或用上下方向鍵移動`);
  const thumbnail = entry.thumbnail || "";
  if (row.dataset.thumbnail !== thumbnail) {
    row.dataset.thumbnail = thumbnail;
    const thumb = $(".queue-thumb", row);
    thumb?.querySelector?.("img")?.remove?.();
    thumb?.classList?.toggle?.("is-letterboxed", Boolean(thumbnail) && isLetterboxed(thumbnail));
    if (thumbnail) {
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.onerror = () => image.remove?.();
      image.src = thumbnail;
      thumb?.prepend?.(image);
    }
  }
  const title = $("strong", row);
  const text = $(".queue-title-text", row) || title;
  if (text.textContent !== entry.title) {
    text.textContent = entry.title;
    title.title = entry.title;
    checkQueueTitle(title);
  }
  $(".queue-meta-time", row).textContent = formatTime(entry.duration);
  $(".queue-duration", row).textContent = formatTime(entry.duration);
}

// Long titles are cut with an ellipsis; hovering the row or focusing it with the keyboard scrolls the rest into
// view (styles.css). Only titles that really overflow are flagged, so short ones never move.
const queueTitleObserver = typeof ResizeObserver === "function"
  ? new ResizeObserver(entries => entries.forEach(entry => checkQueueTitle(entry.target)))
  : null;

function observeQueueTitle(title) {
  if (title && queueTitleObserver) queueTitleObserver.observe(title);
}

function checkQueueTitle(title) {
  if (!title?.classList || typeof title.scrollWidth !== "number") return;
  const hidden = title.scrollWidth - title.clientWidth;
  title.classList.toggle("is-truncated", hidden > 1);
  if (hidden > 1) title.style?.setProperty?.("--scroll-width", String(Math.round(hidden)));
  else title.style?.removeProperty?.("--scroll-width");
}

// one polite message per action: the list itself is not a live region, or every moved row would be read out
let queueStatusToken = 0;
function announceQueue(message) {
  const status = $("#queue-status");
  if (!status || !("textContent" in status)) return;
  const token = ++queueStatusToken;
  status.textContent = "";
  // without moveBefore() the focused handle is re-inserted and re-announced, which would swallow a quick message;
  // only the latest message is spoken when several land close together
  const delay = typeof $("#queue-list")?.moveBefore === "function" ? 60 : 500;
  setTimeout(() => { if (token === queueStatusToken) status.textContent = message; }, delay);
}

function syncQueueRowControls(queue) {
  const queueList = $("#queue-list");
  if (!queueList?.querySelectorAll) return;
  $$(".queue-item", queueList).forEach(row => {
    const checkbox = $(".queue-select-input", row);
    if (checkbox) checkbox.disabled = state.mutationBusy;
    const handle = $(".queue-handle", row);
    if (handle) handle.disabled = state.mutationBusy;
    const remove = $(".queue-remove", row);
    if (remove) remove.disabled = state.mutationBusy;
    const playTarget = $(".queue-play-target", row);
    if (playTarget) playTarget.disabled = state.mutationBusy;
  });
}

function clearQueueDropIndicators() {
  const queueList = $("#queue-list");
  if (!queueList?.querySelectorAll) return;
  $$(".queue-item", queueList).forEach(row => row.classList.remove("is-drop-before", "is-drop-after"));
  queueDropLine(queueList, false)?.classList?.remove?.("is-visible");
}

// one pink line for the whole list, drawn above the lifted row so it never hides beneath it
function queueDropLine(list, create = true) {
  let line = typeof list.querySelector === "function" ? list.querySelector(".queue-drop-line") : null;
  if (!line && create && typeof document.createElement === "function") {
    line = document.createElement("div");
    line.className = "queue-drop-line";
    line.setAttribute?.("aria-hidden", "true");
    list.append(line);
  }
  return line;
}

function queueDropSlot(list, clientY) {
  const rows = $$(".queue-item", list);
  const slot = rows.findIndex(row => {
    const rect = row.getBoundingClientRect();
    // the lifted row rides the pointer, so it is measured where it sits in the list
    const top = row === queueDrag?.row ? rect.top - queueDrag.dy : rect.top;
    return clientY < top + rect.height / 2;
  });
  return slot < 0 ? rows.length : slot;
}

function showQueueDropIndicator(list, clientX, clientY) {
  const rect = list.getBoundingClientRect();
  const rows = $$(".queue-item", list);
  if (!rows.length || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
    clearQueueDropIndicators();
    return;
  }
  // redrawn every frame: only the marked row changes, the line keeps its fade and glides
  rows.forEach(row => row.classList.remove("is-drop-before", "is-drop-after"));
  const slot = queueDropSlot(list, clientY);
  const after = slot === rows.length;
  const row = rows[Math.min(slot, rows.length - 1)];
  row.classList.add(after ? "is-drop-after" : "is-drop-before");
  const line = queueDropLine(list);
  if (!line?.style) return;
  // measured where the row sits in the list, even when it is the one riding the pointer
  const rowRect = row.getBoundingClientRect();
  const top = rowRect.top - (row === queueDrag?.row ? queueDrag.dy : 0) - rect.top + list.scrollTop;
  line.style.transform = `translateY(${after ? top + rowRect.height + 1 : top - 1}px)`;
  line.classList.add("is-visible");
}

function queueEdgeSpeed(position, start, end) {
  if (position < start - QUEUE_SCROLL_EDGE || position > end + QUEUE_SCROLL_EDGE) return 0;
  if (position < start + QUEUE_SCROLL_EDGE) return -Math.min(22, Math.max(2, (start + QUEUE_SCROLL_EDGE - position) * .28));
  if (position > end - QUEUE_SCROLL_EDGE) return Math.min(22, Math.max(2, (position - end + QUEUE_SCROLL_EDGE) * .28));
  return 0;
}

function scrollQueueDragTarget(list, clientX, clientY, amount = null) {
  const rect = list.getBoundingClientRect();
  if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top - QUEUE_SCROLL_EDGE && clientY <= rect.bottom + QUEUE_SCROLL_EDGE) {
    const speed = amount ?? queueEdgeSpeed(clientY, rect.top, rect.bottom);
    const before = list.scrollTop;
    if (speed && list.scrollHeight > list.clientHeight) list.scrollTop += speed;
    if (list.scrollTop !== before) return true;
  }
  const workspace = $(".workspace");
  const page = workspace?.scrollHeight > workspace?.clientHeight + 1 ? workspace : document.scrollingElement;
  if (!page) return false;
  const speed = amount ?? queueEdgeSpeed(clientY, 0, window.innerHeight);
  const before = page.scrollTop;
  if (speed && page.scrollHeight > page.clientHeight) page.scrollTop += speed;
  return page.scrollTop !== before;
}

function isInQueueList(list, point) {
  const rect = list.getBoundingClientRect();
  return point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom;
}

// the lifted row follows the pointer, whatever scrolled underneath it since the grab
function followQueueDragPointer() {
  if (!queueDrag || !queueDragPoint) return;
  const top = queueDrag.row.getBoundingClientRect().top - queueDrag.dy;
  queueDrag.dy = queueDragPoint.y - queueDrag.grabOffset - top;
  queueDrag.row.style?.setProperty?.("--drag-y", `${queueDrag.dy}px`);
}

function animateQueueDragScroll() {
  queueDragFrame = null;
  if (state.draggingIndex === null || !queueDragPoint) return;
  const list = $("#queue-list");
  scrollQueueDragTarget(list, queueDragPoint.x, queueDragPoint.y);
  followQueueDragPointer();
  showQueueDropIndicator(list, queueDragPoint.x, queueDragPoint.y);
  queueDragFrame = requestAnimationFrame(animateQueueDragScroll);
}

function startQueueDrag(event, row, index) {
  if (state.mutationBusy || state.draggingIndex !== null || event.button > 0) return;
  // no text selection, no touch panning: this pointer now carries the row
  event.preventDefault();
  event.currentTarget?.setPointerCapture?.(event.pointerId);
  queueDrag = { pointerId: event.pointerId, row, grabOffset: event.clientY - row.getBoundingClientRect().top, dy: 0 };
  queueDragPoint = { x: event.clientX, y: event.clientY };
  state.draggingIndex = index;
  state.suppressQueueClick = true;
  document.body.classList.add("is-queue-dragging");
  row.classList.add("is-settled", "is-dragging");
  if (queueDragFrame === null) queueDragFrame = requestAnimationFrame(animateQueueDragScroll);
}

function moveQueueDrag(event) {
  if (!queueDrag || event.pointerId !== queueDrag.pointerId) return;
  queueDragPoint = { x: event.clientX, y: event.clientY };
  followQueueDragPointer();
  showQueueDropIndicator($("#queue-list"), event.clientX, event.clientY);
}

function settleQueueRow(row) {
  row.classList.remove("is-dragging");
  row.style?.removeProperty?.("--drag-y");
}

function finishQueueDrag(event, commit) {
  if (!queueDrag || (event && event.pointerId !== queueDrag.pointerId)) return;
  const { row } = queueDrag;
  const list = $("#queue-list");
  const source = state.draggingIndex;
  let target = source;
  const count = $$(".queue-item", list).length;
  if (commit && queueDragPoint && count && isInQueueList(list, queueDragPoint)) {
    const slot = queueDropSlot(list, queueDragPoint.y);
    target = Math.max(0, Math.min(count - 1, slot - (source < slot ? 1 : 0)));
  }
  queueDrag = null;
  queueDragPoint = null;
  state.draggingIndex = null;
  if (queueDragFrame !== null) cancelAnimationFrame(queueDragFrame);
  queueDragFrame = null;
  document.body.classList.remove("is-queue-dragging");
  clearQueueDropIndicators();
  setTimeout(() => { state.suppressQueueClick = false; }, 0);
  if (!event && !commit) announceQueue("已取消排序，歌曲留在原位");
  if (target === source || state.mutationBusy) {
    settleQueueRow(row);
    renderQueue(state.player?.queue || []);
    return;
  }
  // the row stays where it was dropped, so the rebuilt list glides from there
  void Promise.resolve(reorderQueue(source, target)).finally(() => settleQueueRow(row));
}

function nudgeQueueItem(event, index, count) {
  if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
  event.preventDefault();
  const target = index + (event.key === "ArrowUp" ? -1 : 1);
  if (state.mutationBusy || target < 0 || target >= count) return;
  void Promise.resolve(reorderQueue(index, target)).then(() => {
    $$(".queue-item", $("#queue-list"))[target]?.querySelector?.(".queue-handle")?.focus?.();
  });
}

function setupQueueDragScroll() {
  const list = $("#queue-list");
  document.addEventListener("pointermove", moveQueueDrag);
  document.addEventListener("pointerup", event => finishQueueDrag(event, true));
  document.addEventListener("pointercancel", event => finishQueueDrag(event, false));
  document.addEventListener("keydown", event => {
    if (queueDrag && event.key === "Escape") { event.preventDefault(); finishQueueDrag(null, false); }
  });
  document.addEventListener("wheel", event => {
    if (state.draggingIndex === null) return;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    if (scrollQueueDragTarget(list, event.clientX, event.clientY, event.deltaY * scale)) {
      event.preventDefault();
      followQueueDragPointer();
      showQueueDropIndicator(list, event.clientX, event.clientY);
    }
  }, { passive: false });
}

async function submitQueuePlaylistBatch(name) {
  const tracks = selectedQueueSources(state.player?.queue || []);
  if (!tracks.length) throw new Error("請先選取至少一首歌曲");
  const result = await api(`/api/playlists/${encodeURIComponent(name)}/tracks`, {
    method: "POST",
    body: { tracks },
  });
  clearQueueSelection();
  return result;
}

function updateQueuePlaylistDialogMode() {
  const target = $("#queue-playlist-target");
  const newField = $("#queue-new-playlist-field");
  const newInput = $("#queue-new-playlist-name");
  const isNew = target.value === "__new__";
  newField.hidden = !isNew;
  newInput.disabled = !isNew;
  if (isNew) newInput.focus();
}

async function openQueuePlaylistDialog() {
  if (!state.selectedQueueIndexes.size) {
    toast("請先選取至少一首歌曲", "error");
    return;
  }
  await loadPlaylists();
  const dialog = $("#queue-playlist-dialog");
  const target = $("#queue-playlist-target");
  target.replaceChildren(...state.playlists.map(playlist => {
    const option = document.createElement("option");
    option.value = playlist.name;
    option.textContent = `${playlist.name} · ${playlist.tracks.length} 首`;
    return option;
  }));
  const newOption = document.createElement("option");
  newOption.value = "__new__";
  newOption.textContent = "＋建立新清單";
  target.append(newOption);
  $("#queue-playlist-dialog-count").textContent = `已選取 ${state.selectedQueueIndexes.size} 首歌曲`;
  $("#queue-new-playlist-name").value = "";
  target.value = state.playlists.length ? state.playlists[0].name : "__new__";
  updateQueuePlaylistDialogMode();
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.hidden = false;
}

function closeQueuePlaylistDialog() {
  return closeDialog($("#queue-playlist-dialog"));
}

// ---------- dialogs ----------
// The exit plays from [data-closing] while the dialog is still in the top layer, and only then does it really
// close. Transitioning display/overlay would do the same natively, but only Chromium can animate that exit.
async function closeDialog(dialog, value) {
  if (!dialog) return;
  if (typeof dialog.close !== "function") { dialog.hidden = true; return; }
  if (!dialog.open || dialog.hasAttribute?.("data-closing")) return;
  if (!prefersReducedMotion() && typeof dialog.getAnimations === "function") {
    dialog.setAttribute("data-closing", "");
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length) await Promise.race([Promise.allSettled(animations.map(animation => animation.finished)), wait(400)]);
    if (!dialog.hasAttribute("data-closing")) return;
    dialog.removeAttribute("data-closing");
  }
  dialog.close(value);
}

// Esc and a click on the backdrop (closedby="any") close through closeDialog too, so they animate like the buttons.
// Safari has no closedby yet: there a click outside the dialog's box closes it by hand.
function setupDialogDismiss(dialog, value = "cancel") {
  if (!dialog?.addEventListener) return;
  dialog.addEventListener("cancel", event => {
    event.preventDefault();
    void closeDialog(dialog, value);
  });
  if (typeof HTMLDialogElement === "undefined" || "closedBy" in HTMLDialogElement.prototype) return;
  dialog.addEventListener("click", event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = rect.top <= event.clientY && event.clientY <= rect.bottom && rect.left <= event.clientX && event.clientX <= rect.right;
    if (!inside) void closeDialog(dialog, value);
  });
}

let confirmResolve = null;

// Replaces window.confirm: same question, but in the app's own dialog (and a penguin) instead of the browser's grey box
function confirmAction({ title, message, confirmLabel = "確定", cancelLabel = "先不要" }) {
  const dialog = $("#confirm-dialog");
  if (typeof dialog?.showModal !== "function") return Promise.resolve(window.confirm(message));
  if (dialog.open) return Promise.resolve(false);
  $("#confirm-dialog-title").textContent = title;
  $("#confirm-dialog-message").textContent = message;
  buttonLabel($("#confirm-dialog-accept")).textContent = confirmLabel;
  buttonLabel($("#confirm-dialog-cancel")).textContent = cancelLabel;
  dialog.returnValue = "";
  dialog.showModal();
  return new Promise(resolve => { confirmResolve = resolve; });
}

function setupConfirmDialog() {
  const dialog = $("#confirm-dialog");
  if (!dialog?.addEventListener) return;
  $("#confirm-dialog-form")?.addEventListener?.("submit", event => {
    event.preventDefault();
    void closeDialog(dialog, event.submitter?.value === "confirm" ? "confirm" : "cancel");
  });
  dialog.addEventListener("close", () => {
    const resolve = confirmResolve;
    confirmResolve = null;
    resolve?.(dialog.returnValue === "confirm");
  });
  setupDialogDismiss(dialog);
}

async function submitQueuePlaylistDialog(event) {
  event.preventDefault();
  const target = $("#queue-playlist-target");
  const name = target.value === "__new__" ? $("#queue-new-playlist-name").value.trim() : target.value;
  if (!name) {
    toast("請輸入新播放清單名稱", "error");
    return;
  }
  const button = $("#queue-playlist-submit");
  return runMutation(async () => {
    buttonLabel(button).textContent = "加入中";
    try {
      const result = await submitQueuePlaylistBatch(name);
      const existing = state.playlists.find(playlist => playlist.name === result.playlist.name);
      if (existing) Object.assign(existing, result.playlist);
      else state.playlists.push(result.playlist);
      state.playlistsLoaded = true;
      renderPlaylists();
      closeQueuePlaylistDialog();
      const skipped = result.skipped_count || 0;
      toast(skipped ? `已加入 ${result.added_count} 首，跳過 ${skipped} 首重複歌曲` : `已加入 ${result.added_count} 首歌曲`);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      buttonLabel(button).textContent = "加入播放清單";
    }
  });
}

async function playerAction(action, button) {
  if (!state.guildId) return;
  if (action === "play") return playQueueItem(0);
  if (action === "previous") state.skipDirection = -1;
  else if (action === "skip") state.skipDirection = 1;
  return runMutation(async () => {
    button?.classList.add("is-switching");
    try {
      const result = await api("/api/player/action", { method: "POST", body: { guild_id: state.guildId, action } });
      renderPlayer(result.player);
      if (action === "stop") toast("已停止播放，燈先走了", "info", "walk-away");
    } catch (error) { toast(error.message, "error"); }
    finally { setTimeout(() => button?.classList.remove("is-switching"), 220); }
  });
}

async function seekPlayer(position) {
  if (!state.guildId || !state.player?.current) return;
  if (state.mutationBusy) {
    state.scrubbing = false;
    renderPlayer(state.player);
    return;
  }
  const duration = Number(state.player.current.duration) || 0;
  const target = Math.min(Math.max(Number(position) || 0, 0), duration);
  return runMutation(async () => {
    try {
      const result = await api("/api/player/seek", {
        method: "POST",
        body: { guild_id: state.guildId, position: target },
      });
      if (result.player) result.player.progress = result.position;
      state.scrubbing = false;
      renderPlayer(result.player || state.player);
    } catch (error) {
      state.scrubbing = false;
      renderPlayer(state.player);
      toast(error.message, "error");
    }
  });
}

async function removeQueueItem(index, row) {
  return runMutation(async () => {
    row.classList.add("is-removing");
    try {
      const result = await api(`/api/queue/${index}?guild_id=${state.guildId}`, { method: "DELETE" });
      // let the row finish sliding out before the list closes the gap
      await wait(180);
      const removed = state.renderedQueue?.[index]?.title;
      const hadFocus = Boolean(document.activeElement && row.contains?.(document.activeElement));
      applyQueue(result.queue);
      if (removed) announceQueue(`已從佇列移除「${removed}」`);
      // the focused row is gone: keep the keyboard on the song that took its place instead of dropping to <body>
      if (hadFocus) {
        const rows = $$(".queue-item", $("#queue-list"));
        rows[Math.min(index, rows.length - 1)]?.querySelector?.(".queue-remove")?.focus?.();
      }
    } catch (error) {
      row.classList.remove("is-removing");
      toast(error.message, "error");
    }
  });
}

async function reorderQueue(source, target) {
  if (!state.guildId || source === target) return;
  return runMutation(async () => {
    try {
      const result = await api("/api/queue/reorder", { method: "POST", body: { guild_id: state.guildId, source_index: source, target_index: target } });
      applyQueue(result.queue);
      const moved = result.queue?.[target]?.title;
      if (moved) announceQueue(`已把「${moved}」移到第 ${target + 1} 首`);
    } catch (error) {
      renderQueue(state.player?.queue || []);
      toast(error.message, "error");
    }
  });
}

async function playQueueItem(index) {
  if (!state.guildId) return;
  state.skipDirection = 1;
  return runMutation(async () => {
    try {
      const result = await api("/api/queue/play", {
        method: "POST",
        body: { guild_id: state.guildId, index },
      });
      clearQueueSelection();
      renderPlayer(result.player);
      toast(`正在播放：${result.selected.title}`);
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

async function refreshSnapshot() {
  const version = state.playerVersion;
  try {
    const status = await api("/api/status");
    state.csrf = status.csrf_token;
    setConnected(status.ready && !status.network_outage, status.network_outage ? "網路中斷" : status.ready ? `${status.latency_ms} ms` : "啟動中");
    const guildData = await api("/api/guilds");
    renderGuilds(guildData.guilds);
    const guildId = state.guildId;
    let player = null;
    if (guildId) {
      // 404 means the bot has no player in this server yet, not that it is offline
      try { player = await api(`/api/player?guild_id=${guildId}`); }
      catch (error) { if (error.status !== 404) throw error; }
    }
    // a mutation or a server switch landed while this snapshot was in flight
    if (state.mutationBusy || version !== state.playerVersion || guildId !== state.guildId) return;
    renderPlayer(player);
  } catch (error) {
    setConnected(false, "連線中斷");
  }
}

// Usually left open in a second window beside Discord: a hidden tab stops polling instead of asking every 2 s,
// and catches up the moment it is shown again. One snapshot at a time, so a slow bot never stacks requests.
const SNAPSHOT_INTERVAL = 2000;
let snapshotInFlight = false;

async function pollSnapshot() {
  if (document.hidden || snapshotInFlight) return;
  snapshotInFlight = true;
  try { await refreshSnapshot(); }
  finally { snapshotInFlight = false; }
}

// shown again after a while in the background: catch up now instead of on the next tick
function resumeSnapshotPolling() {
  if (!document.hidden) void pollSnapshot();
}

function animateProgress() {
  if (!state.scrubbing && state.player?.state === "playing" && state.player.current?.duration) {
    const elapsed = (performance.now() - state.lastSync) / 1000;
    const progress = Math.min(state.player.progress + elapsed, state.player.current.duration);
    const range = $("#progress-range");
    range.value = progress;
    setProgressVisual(progress, state.player.current.duration);
    $("#time-current").textContent = formatTime(progress);
  }
  requestAnimationFrame(animateProgress);
}

function settingInput(option) {
  if (option.sensitive) {
    const span = document.createElement("span"); span.className = "sensitive-value"; span.textContent = "此值受保護，請手動編輯設定檔"; return span;
  }
  const input = document.createElement("input");
  if (option.type === "boolean") { input.type = "checkbox"; input.className = "switch"; input.checked = Boolean(option.value); }
  else { input.type = option.type === "number" || option.type === "integer" ? "number" : "text"; input.value = Array.isArray(option.value) ? option.value.join(", ") : option.value ?? ""; }
  input.disabled = !option.editable;
  return input;
}

function renderSettings(options) {
  state.settings = options;
  const query = $("#settings-search").value.trim().toLowerCase();
  const filtered = options.filter(item => !query || `${item.section} ${item.option} ${item.comment} ${item.display_section} ${item.display_option} ${item.display_comment}`.toLowerCase().includes(query));
  const groups = Map.groupBy ? Map.groupBy(filtered, item => item.section) : filtered.reduce((map, item) => (map.set(item.section, [...(map.get(item.section) || []), item]), map), new Map());
  const root = $("#settings-sections");
  root.replaceChildren(...[...groups.entries()].map(([section, items]) => {
    const group = document.createElement("section"); group.className = "settings-group"; group.innerHTML = `<h3></h3>`; $("h3", group).textContent = items[0]?.display_section || section;
    items.forEach(option => {
      const row = document.createElement("div"); row.className = "setting-row";
      row.innerHTML = `<div class="setting-copy"><strong></strong><p></p></div><div class="setting-control"></div>`;
      $("strong", row).textContent = option.display_option || option.option; $("p", row).textContent = option.display_comment || option.comment || "沒有額外說明";
      const control = $(".setting-control", row); const input = settingInput(option); control.append(input);
      if (option.editable && !option.sensitive) {
        const save = document.createElement("button"); save.className = "button secondary small"; save.type = "button"; save.textContent = "儲存";
        save.addEventListener("click", async () => {
          save.disabled = true; save.textContent = "儲存中";
          try {
            const value = input.type === "checkbox" ? input.checked : input.value;
            await api("/api/config", { method: "PATCH", body: { section: option.section, option: option.option, value } });
            row.classList.remove("is-saved"); void row.offsetWidth; row.classList.add("is-saved"); save.textContent = "已儲存";
            setTimeout(() => { save.textContent = "儲存"; save.disabled = false; }, 900);
          } catch (error) { save.textContent = "儲存"; save.disabled = false; toast(error.message, "error"); }
        });
        control.append(save);
      }
      group.append(row);
    });
    return group;
  }));
  $("#settings-count").textContent = `${filtered.length} 個選項`;
}

async function loadSettings(force = false) {
  if (state.settings.length && !force) { renderSettings(state.settings); return; }
  try { const result = await api("/api/config"); renderSettings(result.options); }
  catch (error) { toast(error.message, "error"); }
}

let logsLoading = false;
async function loadLogs({ silent = false } = {}) {
  if (logsLoading) return;
  logsLoading = true;
  try {
    const result = await api("/api/logs?limit=500");
    const lines = result.lines || [];
    const changed = lines.length !== state.logs.length || lines[lines.length - 1] !== state.logs[state.logs.length - 1];
    state.logs = lines;
    if (changed || !silent) renderLogs();
  } catch (error) { if (!silent) toast(error.message, "error"); }
  finally { logsLoading = false; }
}

function pollLogs() {
  if ($("#app-shell")?.dataset?.page !== "logs" || document.hidden) return;
  loadLogs({ silent: true });
}

function syncLogAutoScroll() {
  const view = $("#log-view"); const toggle = $("#log-auto-scroll");
  if (!view || !toggle || view.hidden) return;
  const atBottom = view.scrollHeight - view.scrollTop - view.clientHeight < 24;
  if (toggle.checked !== atBottom) toggle.checked = atBottom;
}

function renderLogs() {
  const level = $("#log-level").value; const query = $("#log-search").value.toLowerCase();
  const lines = state.logs.filter(line => (!level || line.includes(level)) && (!query || line.toLowerCase().includes(query)));
  const view = $("#log-view"); const previousTop = view.scrollTop;
  view.textContent = lines.join("\n");
  view.hidden = lines.length === 0;
  const empty = $("#log-empty");
  if (empty) empty.hidden = lines.length > 0;
  view.scrollTop = $("#log-auto-scroll").checked ? view.scrollHeight : previousTop;
}

function playlistTrackSource(track) {
  return typeof track === "string" ? track : (track?.source || "");
}

function playlistTrackTitle(track) {
  const source = playlistTrackSource(track);
  return typeof track === "string" ? source : (track?.title || source);
}

function playlistTitleLoadStates(name) {
  if (!state.playlistTitleLoads[name] || typeof state.playlistTitleLoads[name] !== "object") {
    state.playlistTitleLoads[name] = {};
  }
  return state.playlistTitleLoads[name];
}

function updatePlaylistTrackTitle(name, source) {
  if (state.currentPlaylist !== name) return;
  const playlist = state.playlists.find(item => item.name === name);
  const track = playlist?.tracks.find(item => playlistTrackSource(item) === source);
  if (!track) return;

  $$(".playlist-track", $("#playlist-tracks")).forEach(row => {
    if (row.dataset.source !== source) return;
    const title = $("strong", row);
    title.textContent = playlistTrackTitle(track);
    title.classList.remove("playlist-track-title-loading");
  });
}

const YOUTUBE_VIDEO_ID = /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function youtubeVideoId(source) {
  return String(source || "").match(YOUTUBE_VIDEO_ID)?.[1] || "";
}

// like the reference players: four different videos make a 2x2 mosaic, fewer show the first one
function playlistCoverIds(playlist) {
  const ids = [];
  for (const track of playlist?.tracks || []) {
    const id = youtubeVideoId(playlistTrackSource(track));
    if (id && !ids.includes(id)) ids.push(id);
    if (ids.length === 4) break;
  }
  return ids.length === 4 ? ids : ids.slice(0, 1);
}

function setCoverMosaic(box, playlist) {
  if (typeof box?.querySelector !== "function") return;
  const ids = playlistCoverIds(playlist);
  const key = ids.join(",");
  if (box.dataset?.mosaic === key) return;
  if (box.dataset) box.dataset.mosaic = key;
  box.querySelector(".cover-mosaic")?.remove?.();
  box.classList?.toggle?.("has-art", ids.length > 0);
  if (!ids.length) return;
  const mosaic = document.createElement("span");
  mosaic.className = `cover-mosaic${ids.length === 4 ? " is-grid" : ""}`;
  ids.forEach(id => {
    const image = document.createElement("img");
    image.alt = "";
    image.loading = "lazy";
    image.decoding = "async";
    image.onerror = () => image.classList?.add?.("is-missing");
    image.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
    mosaic.append?.(image);
  });
  box.append?.(mosaic);
}

function renderPlaylistEditor() {
  const playlist = state.playlists.find(item => item.name === state.currentPlaylist);
  const tracks = playlist?.tracks || [];
  $("#playlist-title").textContent = playlist?.name || "選擇播放清單";
  $("#playlist-count").textContent = `${tracks.length} 首`;
  const cover = $("#playlist-cover");
  cover?.style?.setProperty?.("--tile-hue", String(playlistHue(playlist?.name)));
  setCoverMosaic(cover, playlist);
  $("#playlist-empty").hidden = tracks.length > 0;
  $("#playlist-add-form").querySelectorAll("input, button").forEach(control => { control.disabled = state.mutationBusy || !playlist; });
  $("#playlist-queue-all").disabled = state.mutationBusy || !playlist || tracks.length === 0;
  $("#playlist-delete").hidden = !playlist || playlist.deletable !== true;
  $("#playlist-delete").disabled = state.mutationBusy || !playlist || playlist.deletable !== true;

  const root = $("#playlist-tracks");
  const visibleCount = playlist
    ? (state.playlistVisibleCounts[playlist.name] || PLAYLIST_BATCH_SIZE)
    : 0;
  const visibleTracks = tracks.slice(0, visibleCount);
  const rows = visibleTracks.map((track, index) => {
    const source = playlistTrackSource(track);
    const titleState = playlistTitleLoadStates(playlist.name)[source];
    const title = titleState === "loading" ? "歌名載入中…" : playlistTrackTitle(track);
    const row = document.createElement("div");
    row.className = "playlist-track";
    row.dataset.source = source;
    const disabled = state.mutationBusy ? " disabled" : "";
    row.innerHTML = `<span class="queue-index">${index + 1}</span><div class="playlist-track-copy"><strong></strong><small></small></div><div class="playlist-track-actions"><button class="playlist-queue icon-button" type="button" aria-label="加入佇列" title="加入佇列"${disabled}>${QUEUE_ACTION_ICONS.queue}</button><button class="playlist-remove icon-button danger" type="button" aria-label="從播放清單移除" title="從播放清單移除"${disabled}>${QUEUE_ACTION_ICONS.remove}</button></div>`;
    $("strong", row).textContent = title;
    $("strong", row).title = title;
    $("strong", row).classList.toggle("playlist-track-title-loading", titleState === "loading");
    $("small", row).textContent = source;
    const queueButton = $(".playlist-queue", row);
    queueButton.addEventListener("click", async () => {
      if (!state.guildId) {
        toast("請先選擇 Discord 伺服器", "error");
        return;
      }
      await runMutation(async () => {
        const dismiss = pendingToast("正在加入歌曲…");
        try {
          const result = await api("/api/queue/add", {
            method: "POST",
            body: { guild_id: state.guildId, query: source },
          });
          applyQueue(result.queue);
          dismiss();
          toast(`已加入 ${result.added_count} 首歌曲`, "info", "arms");
        } catch (error) {
          dismiss();
          toast(error.message, "error");
        }
      });
    });
    $(".playlist-remove", row).addEventListener("click", async () => {
      await runMutation(async () => {
        row.classList.add("is-removing");
        try {
          const result = await api(`/api/playlists/${encodeURIComponent(playlist.name)}/${index}`, { method: "DELETE" });
          const target = state.playlists.find(item => item.name === playlist.name);
          if (target) target.tracks = result.playlist.tracks;
          setTimeout(renderPlaylistEditor, 180);
        } catch (error) {
          row.classList.remove("is-removing");
          toast(error.message, "error");
        }
      });
    });
    return row;
  });

  if (playlist && visibleTracks.length < tracks.length) {
    const loadMore = document.createElement("button");
    loadMore.className = "button secondary playlist-load-more";
    loadMore.type = "button";
    loadMore.textContent = `顯示更多（剩餘 ${tracks.length - visibleTracks.length} 首）`;
    loadMore.addEventListener("click", () => {
      state.playlistVisibleCounts[playlist.name] = visibleCount + PLAYLIST_BATCH_SIZE;
      renderPlaylistEditor();
      void loadPlaylistTitles(playlist.name);
    });
    rows.push(loadMore);
  }

  root.replaceChildren(...rows);
}

function renderPlaylists() {
  if (!state.playlists.some(item => item.name === state.currentPlaylist)) {
    state.currentPlaylist = (
      state.playlists.find(item => item.tracks.length > 0)
      || state.playlists[0]
    )?.name || "";
  }
  const tabs = $("#playlist-tabs");
  tabs.replaceChildren(...state.playlists.map(playlist => {
    const button = document.createElement("button");
    const active = playlist.name === state.currentPlaylist;
    button.className = `playlist-tab${active ? " is-active" : ""}`;
    button.type = "button";
    button.innerHTML = '<span class="playlist-tab-art" aria-hidden="true"></span><span class="playlist-tab-name"></span><small class="playlist-tab-count"></small>';
    const art = $(".playlist-tab-art", button);
    if (art?.dataset) art.dataset.initial = Array.from(playlist.name.trim())[0] || "#";
    setCoverMosaic(art, playlist);
    button.style?.setProperty?.("--tile-hue", String(playlistHue(playlist.name)));
    button.setAttribute?.("aria-pressed", String(active));
    $(".playlist-tab-name", button).textContent = playlist.name;
    $(".playlist-tab-count", button).textContent = `${playlist.tracks.length} 首`;
    button.addEventListener("click", () => {
      state.currentPlaylist = playlist.name;
      renderPlaylists();
      void loadPlaylistTitles(playlist.name);
    });
    return button;
  }));
  renderPlaylistEditor();
}

async function loadPlaylistTitles(name) {
  if (!name) return;
  const playlist = state.playlists.find(item => item.name === name);
  if (!playlist) return;

  const loads = playlistTitleLoadStates(name);
  const visibleCount = state.playlistVisibleCounts[name] || PLAYLIST_BATCH_SIZE;
  const pending = [];
  playlist.tracks.slice(0, visibleCount).forEach((track, index) => {
    const source = playlistTrackSource(track);
    if (!source || loads[source]) return;
    if (playlistTrackTitle(track) !== source) {
      loads[source] = "loaded";
      return;
    }
    loads[source] = "loading";
    pending.push(loadPlaylistTrackTitle(name, index, source));
  });
  if (!pending.length) return;
  if (state.currentPlaylist === name) renderPlaylistEditor();

  const results = await Promise.all(pending);
  const failures = results.filter(result => !result).length;
  if (failures) toast(`${failures} 首歌曲的歌名載入失敗`, "error");
}

async function loadPlaylistTrackTitle(name, index, source) {
  try {
    const result = await api(`/api/playlists/${encodeURIComponent(name)}/titles/${index}`);
    const target = state.playlists.find(item => item.name === name);
    if (target && result.track) {
      target.tracks = target.tracks.map(track => (
        playlistTrackSource(track) === source ? result.track : track
      ));
    }
    playlistTitleLoadStates(name)[source] = "loaded";
    updatePlaylistTrackTitle(name, source);
    return true;
  } catch {
    playlistTitleLoadStates(name)[source] = "error";
    updatePlaylistTrackTitle(name, source);
    return false;
  }
}

async function loadPlaylists(force = false) {
  if (state.playlistsLoaded && !force) return;
  try {
    const result = await api("/api/playlists");
    state.playlists = result.playlists;
    state.playlistsLoaded = true;
    if (force) {
      state.playlistTitleLoads = {};
      state.playlistVisibleCounts = {};
    }
    renderPlaylists();
    void loadPlaylistTitles(state.currentPlaylist);
  } catch (error) {
    toast(error.message, "error");
  }
}

function setPlaylistCreateOpen(open) {
  state.playlistCreateOpen = open;
  const form = $("#playlist-create-form");
  const button = $("#new-playlist");
  form.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
  if (open) $("#playlist-create-name").focus();
}

async function createPlaylist(event) {
  event.preventDefault();
  const name = $("#playlist-create-name").value.trim();
  if (!name) return;
  return runMutation(async () => {
    try {
      const result = await api("/api/playlists", { method: "POST", body: { action: "create", name } });
      state.currentPlaylist = result.playlist.name;
      $("#playlist-create-name").value = "";
      setPlaylistCreateOpen(false);
      await loadPlaylists(true);
      toast(`已建立 ${result.playlist.name}`);
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

async function deletePlaylist() {
  const playlist = state.playlists.find(item => item.name === state.currentPlaylist);
  if (!playlist || playlist.deletable !== true) return;
  const confirmed = await confirmAction({
    title: "刪除這個播放清單？",
    message: `「${playlist.name}」和裡面的 ${playlist.tracks.length} 首歌會一起刪掉，刪了就救不回來。`,
    confirmLabel: "刪除",
  });
  if (!confirmed) return;

  return runMutation(async () => {
    try {
      await api(`/api/playlists/${encodeURIComponent(playlist.name)}`, { method: "DELETE" });
      state.playlists = state.playlists.filter(item => item.name !== playlist.name);
      delete state.playlistTitleLoads[playlist.name];
      delete state.playlistVisibleCounts[playlist.name];
      state.currentPlaylist = "";
      renderPlaylists();
      toast(`已刪除 ${playlist.name}`);
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

async function setPlayerVolume(volume) {
  if (!state.guildId || state.mutationBusy) return;
  const previous = state.player?.volume;
  // the snapshot follows the released slider, so the busy re-render keeps it in place
  if (state.player) state.player.volume = volume;
  return runMutation(async () => {
    try {
      const result = await api("/api/player/volume", { method: "POST", body: { guild_id: state.guildId, volume } });
      if (state.player && typeof result.volume === "number") state.player.volume = result.volume;
    } catch (error) {
      if (state.player && previous !== undefined) state.player.volume = previous;
      toast(error.message, "error");
    }
  });
}

async function addTrackToQueue(query) {
  if (!query || !state.guildId) return;
  return runMutation(async () => {
    try {
      const result = await api("/api/queue/add", { method: "POST", body: { guild_id: state.guildId, query } });
      $("#track-query").value = "";
      applyQueue(result.queue);
      flashAddButton($("#add-track-form"));
      toast(`已加入 ${result.entry.title}`, "info", "arms");
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

async function queuePlaylistTracks() {
  const playlist = state.playlists.find(item => item.name === state.currentPlaylist);
  if (!state.guildId) {
    toast("請先選擇 Discord 伺服器", "error");
    return;
  }
  if (!playlist || playlist.tracks.length === 0) return;
  return runMutation(async () => {
    const dismiss = pendingToast(`正在加入 ${playlist.tracks.length} 首歌曲…`);
    try {
      const result = await api(`/api/playlists/${encodeURIComponent(playlist.name)}/queue`, {
        method: "POST",
        body: { guild_id: state.guildId },
      });
      applyQueue(result.queue);
      dismiss();
      const skipped = result.skipped_count || 0;
      toast(skipped ? `已加入 ${result.added_count} 首歌曲，略過 ${skipped} 首無法播放的歌曲` : `已加入 ${result.added_count} 首歌曲`, "info", "arms");
    } catch (error) {
      dismiss();
      toast(error.message, "error");
    }
  });
}

async function addTrackToPlaylist(track) {
  if (!track || !state.currentPlaylist) return;
  return runMutation(async () => {
    try {
      const result = await api("/api/playlists", { method: "POST", body: { action: "add", name: state.currentPlaylist, track } });
      const target = state.playlists.find(item => item.name === state.currentPlaylist);
      if (target) target.tracks = result.playlist.tracks;
      $("#playlist-track").value = "";
      renderPlaylists();
      void loadPlaylistTitles(state.currentPlaylist);
      toast("已加入播放清單");
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function permissionControl(group, option, row) {
  const control = $(".setting-control", row);
  const input = settingInput(option);
  control.append(input);
  if (!option.editable || option.sensitive) return;

  const save = document.createElement("button");
  save.className = "button secondary small";
  save.type = "button";
  save.textContent = "儲存";
  save.addEventListener("click", async () => {
    save.disabled = true;
    save.textContent = "儲存中";
    try {
      const value = input.type === "checkbox" ? input.checked : input.value;
      await api("/api/permissions", { method: "PATCH", body: { group: group.name, option: option.option, value } });
      row.classList.remove("is-saved"); void row.offsetWidth; row.classList.add("is-saved");
      save.textContent = "已儲存";
      setTimeout(() => { save.textContent = "儲存"; save.disabled = false; }, 900);
    } catch (error) {
      save.textContent = "儲存";
      save.disabled = false;
      toast(error.message, "error");
    }
  });
  control.append(save);
}

async function permissionGroupAction(action, source = "", sourceLabel = source) {
  let name = "";
  if (action === "delete") {
    const confirmed = await confirmAction({
      title: "刪除權限群組？",
      message: `「${sourceLabel}」刪除後無法復原。`,
      confirmLabel: "刪除",
    });
    if (!confirmed) return;
  } else {
    const label = action === "create" ? "新群組名稱" : action === "clone" ? `複製「${sourceLabel}」為` : `將「${sourceLabel}」重新命名為`;
    name = window.prompt(label) || "";
    if (!name) return;
  }
  try {
    await api("/api/permissions/group", { method: "POST", body: { action, source, name: action === "delete" ? source : name } });
    await loadPermissions();
    toast("權限群組已更新");
  } catch (error) {
    toast(error.message, "error");
  }
}

async function loadPermissions() {
  try {
    const result = await api("/api/permissions");
    state.permissions = result.groups;
    const root = $("#permissions-root"); root.className = "settings-sections";
    root.replaceChildren(...result.groups.map(group => {
      const card = document.createElement("section");
      card.className = "settings-group";
      const heading = document.createElement("div");
      heading.className = "panel-heading";
      heading.innerHTML = `<h3></h3><div class="group-actions"></div>`;
      $("h3", heading).textContent = group.display_name || group.name;
      const actions = $(".group-actions", heading);
      const clone = document.createElement("button"); clone.className = "button secondary small"; clone.type = "button"; clone.textContent = "複製"; clone.addEventListener("click", () => permissionGroupAction("clone", group.name, group.display_name)); actions.append(clone);
      if (!["owner", "default"].includes(group.name.toLowerCase())) {
        const rename = document.createElement("button"); rename.className = "button secondary small"; rename.type = "button"; rename.textContent = "重新命名"; rename.addEventListener("click", () => permissionGroupAction("rename", group.name, group.display_name)); actions.append(rename);
        const remove = document.createElement("button"); remove.className = "button danger small"; remove.type = "button"; remove.textContent = "刪除"; remove.addEventListener("click", () => permissionGroupAction("delete", group.name, group.display_name)); actions.append(remove);
      }
      card.append(heading);
      group.options.forEach(option => {
        const row = document.createElement("div");
        row.className = "setting-row";
        row.innerHTML = `<div class="setting-copy"><strong></strong><p></p></div><div class="setting-control"></div>`;
        $("strong", row).textContent = option.display_option || option.option;
        $("p", row).textContent = option.display_comment || option.comment || "沒有額外說明";
        permissionControl(group, option, row);
        card.append(row);
      });
      return card;
    }));
  } catch (error) {
    $("#permissions-root").innerHTML = `<strong>無法讀取權限群組</strong><p></p>`;
    $("#permissions-root p").textContent = error.message;
  }
}

async function requestRestart(mode) {
  const label = mode === "soft" ? "軟重啟" : "完整重啟";
  const confirmed = await confirmAction({
    title: `要${label}嗎？`,
    message: "播放與 Discord 連線會暫時中斷，控制台會自動等 糖音機 回來。",
    confirmLabel: label,
  });
  if (!confirmed) return;
  const layer = $("#reconnect-layer");
  $("strong", layer).textContent = `正在執行${label}`;
  $("p", layer).textContent = "關閉連線後，控制台會自動等待 糖音機 回來。";
  layer.hidden = false;
  try {
    await api("/api/restart", { method: "POST", body: { mode } });
    state.connected = false;
  } catch (error) {
    layer.hidden = true;
    toast(error.message, "error");
  }
}

// keep in sync with the compact @media block in styles.css
const COMPACT_QUERY = "(max-width: 860px)";

function isCompactLayout() {
  return Boolean(window.matchMedia?.(COMPACT_QUERY)?.matches);
}

// ---------- Resizable panels: the sidebar and the queue widen or narrow from the gaps beside the main panel ----------
const PANEL_LAYOUT_KEY = "musicbot.panelWidths";
const SIDEBAR_RAIL_QUERY = "(max-width: 1099px)";
const SIDEBAR_RAIL_W = 72;
const SIDEBAR_DEFAULT_W = 232;
const PANEL_LIMITS = { sidebar: [200, 360], queue: [300, 560] };
const MAIN_MIN_W = 440;
const PANEL_KEY_STEP = 16;
// null keeps the built-in width for that panel; the sidebar's rail is stored as SIDEBAR_RAIL_W
const panelWidths = { sidebar: null, queue: null };

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

function snapSidebarWidth(value) {
  const [min, max] = PANEL_LIMITS.sidebar;
  // past the midpoint toward the rail, the sidebar folds into icons instead of squeezing its labels
  return value < (SIDEBAR_RAIL_W + min) / 2 ? SIDEBAR_RAIL_W : clampNumber(value, min, max);
}

function defaultPanelWidth(side) {
  if (side === "sidebar") return window.matchMedia?.(SIDEBAR_RAIL_QUERY)?.matches ? SIDEBAR_RAIL_W : SIDEBAR_DEFAULT_W;
  return Math.round(clampNumber((window.innerWidth || 0) * .22 + 80, 320, 400));
}

function loadPanelWidths() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_LAYOUT_KEY) || "{}");
    for (const side of ["sidebar", "queue"]) {
      if (Number.isFinite(saved?.[side])) panelWidths[side] = saved[side];
    }
  } catch { /* storage can be blocked; the built-in widths still apply */ }
}

function savePanelWidths() {
  try { localStorage.setItem(PANEL_LAYOUT_KEY, JSON.stringify(panelWidths)); } catch { /* per-viewer convenience only */ }
}

// anchor names the panel being resized, which then yields to the space left; otherwise the queue narrows first
function layoutPanels(anchor = null) {
  const shell = $("#app-shell");
  if (!shell?.style?.setProperty) return;
  if (isCompactLayout()) {
    shell.style.removeProperty("--sidebar-w");
    shell.style.removeProperty("--queue-w");
    shell.classList.remove("is-sidebar-rail");
    return;
  }
  const gutter = parseFloat(getComputedStyle(shell).getPropertyValue("--gutter")) || 8;
  const room = shell.clientWidth - gutter * 4 - MAIN_MIN_W;
  const [queueMin, queueMax] = PANEL_LIMITS.queue;
  let sidebar = snapSidebarWidth(panelWidths.sidebar ?? defaultPanelWidth("sidebar"));
  let queue = clampNumber(panelWidths.queue ?? defaultPanelWidth("queue"), queueMin, queueMax);
  if (sidebar + queue > room) {
    if (anchor === "sidebar") {
      const fit = room - queue;
      sidebar = sidebar === SIDEBAR_RAIL_W || fit < PANEL_LIMITS.sidebar[0] ? SIDEBAR_RAIL_W : Math.min(sidebar, fit);
    } else {
      queue = Math.max(queueMin, room - sidebar);
      if (anchor !== "queue" && sidebar + queue > room) sidebar = SIDEBAR_RAIL_W;
      queue = clampNumber(room - sidebar, queueMin, queue);
    }
  }
  if (anchor) panelWidths[anchor] = anchor === "sidebar" ? sidebar : queue;
  shell.style.setProperty("--sidebar-w", `${sidebar}px`);
  shell.style.setProperty("--queue-w", `${queue}px`);
  shell.classList.toggle("is-sidebar-rail", sidebar === SIDEBAR_RAIL_W);
  const now = { sidebar, queue };
  $$(".panel-resizer").forEach(handle => {
    const side = handle.dataset.resize;
    handle.setAttribute("aria-valuenow", String(Math.round(now[side])));
    handle.setAttribute("aria-valuemin", String(side === "sidebar" ? SIDEBAR_RAIL_W : queueMin));
    handle.setAttribute("aria-valuemax", String(PANEL_LIMITS[side][1]));
  });
  requestAnimationFrame(updateTrackTitleOverflow);
}

function currentPanelWidth(side) {
  return parseFloat($("#app-shell")?.style?.getPropertyValue(side === "sidebar" ? "--sidebar-w" : "--queue-w")) || defaultPanelWidth(side);
}

function resizePanel(side, width) {
  panelWidths[side] = side === "sidebar" ? snapSidebarWidth(width) : Math.round(width);
  layoutPanels(side);
}

function setupPanelResizers() {
  const shell = $("#app-shell");
  loadPanelWidths();
  $$(".panel-resizer").forEach(handle => {
    const side = handle.dataset.resize;
    // the queue sits right of its gap, so dragging left widens it
    const direction = side === "sidebar" ? 1 : -1;
    let drag = null;
    handle.addEventListener("pointerdown", event => {
      if (event.button > 0 || isCompactLayout()) return;
      event.preventDefault();
      handle.setPointerCapture?.(event.pointerId);
      drag = { id: event.pointerId, startX: event.clientX, start: currentPanelWidth(side) };
      shell.classList.add("is-resizing");
    });
    handle.addEventListener("pointermove", event => {
      if (!drag || event.pointerId !== drag.id) return;
      resizePanel(side, drag.start + (event.clientX - drag.startX) * direction);
    });
    const release = event => {
      if (!drag || event.pointerId !== drag.id) return;
      drag = null;
      shell.classList.remove("is-resizing");
      savePanelWidths();
    };
    handle.addEventListener("pointerup", release);
    handle.addEventListener("pointercancel", release);
    handle.addEventListener("lostpointercapture", release);
    handle.addEventListener("dblclick", () => {
      panelWidths[side] = null;
      layoutPanels();
      savePanelWidths();
    });
    handle.addEventListener("keydown", event => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const step = (event.key === "ArrowRight" ? 1 : -1) * direction;
      const width = currentPanelWidth(side);
      let next = width + step * PANEL_KEY_STEP;
      // arrow keys step across the fold instead of being held back by the snap
      if (side === "sidebar") {
        if (width === SIDEBAR_RAIL_W && step > 0) next = PANEL_LIMITS.sidebar[0];
        else if (width <= PANEL_LIMITS.sidebar[0] && step < 0) next = SIDEBAR_RAIL_W;
      }
      resizePanel(side, next);
      savePanelWidths();
    });
  });
  layoutPanels();
  window.addEventListener?.("resize", () => layoutPanels());
}

function isPlayerOpen() {
  const shell = $("#app-shell");
  return Boolean(shell?.classList?.contains?.("is-player-open") && !shell.classList.contains("is-player-closing"));
}

// the open sheet covers the page, so everything behind it leaves the tab order
const SHEET_BACKGROUND = [".sidebar", ".main", ".queue-panel"];

function setPlayerOpen(open, { fromHistory = false } = {}) {
  const shell = $("#app-shell");
  if (!shell?.classList || open === isPlayerOpen()) return;
  clearTimeout(state.sheetTimer);
  SHEET_BACKGROUND.forEach(selector => { const node = $(selector); if (node) node.inert = open; });
  const track = $("#bar-track");
  track?.setAttribute?.("aria-expanded", String(open));
  if (track) track.tabIndex = open ? -1 : 0;
  const bar = $("#player-bar");
  if (open) {
    bar?.setAttribute?.("role", "dialog");
    bar?.setAttribute?.("aria-modal", "true");
    bar?.setAttribute?.("aria-labelledby", "sheet-title");
  } else {
    ["role", "aria-modal", "aria-labelledby"].forEach(name => bar?.removeAttribute?.(name));
  }
  if (open) {
    shell.classList.remove("is-player-closing");
    shell.classList.add("is-player-open");
    if (!fromHistory) globalThis.history?.pushState?.({ playerSheet: true }, "");
    $("#player-collapse")?.focus?.();
    return;
  }
  const finish = () => {
    shell.classList.remove("is-player-open", "is-player-closing");
    $("#player-bar")?.style?.removeProperty?.("--sheet-drag");
    $("#bar-track")?.focus?.({ preventScroll: true });
  };
  if (!fromHistory && globalThis.history?.state?.playerSheet) globalThis.history.back();
  if (prefersReducedMotion()) { finish(); return; }
  shell.classList.add("is-player-closing");
  state.sheetTimer = setTimeout(finish, 250);
}

function setupPlayerSheet() {
  const bar = $("#player-bar");
  const track = $("#bar-track");
  if (typeof bar?.addEventListener !== "function" || typeof track?.addEventListener !== "function") return;
  const syncTrackRole = () => {
    if (isCompactLayout() && uiVersion() !== "3") {
      track.setAttribute?.("aria-controls", "player-bar");
      track.setAttribute?.("aria-expanded", String(isPlayerOpen()));
    } else {
      track.removeAttribute?.("aria-controls");
      track.removeAttribute?.("aria-expanded");
    }
  };
  syncTrackRole();
  // on a 2.0 phone the bar opens the full player; on desktop, and on 3.0 phones where the player is home, it goes to the stage
  track.addEventListener("click", () => {
    // the click that ends a drag gesture is not a tap
    if (performance.now() - (state.sheetDragEnd || 0) < 350) return;
    if (isPlayerOpen()) return;
    if (isCompactLayout() && uiVersion() !== "3") setPlayerOpen(true);
    else switchPage("dashboard");
  });
  $("#player-collapse")?.addEventListener?.("click", () => setPlayerOpen(false));
  // pull the sheet down from its header or cover to close it
  let drag = null;
  bar.addEventListener("pointerdown", event => {
    if (!isPlayerOpen() || event.button > 0) return;
    if (!event.target?.closest?.(".sheet-head, .bar-track") || event.target.closest(".sheet-collapse")) return;
    drag = { id: event.pointerId, startY: event.clientY, dy: 0 };
    bar.setPointerCapture?.(event.pointerId);
    bar.classList.add("is-dragging");
  });
  bar.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.dy = Math.max(0, event.clientY - drag.startY);
    bar.style.setProperty("--sheet-drag", `${drag.dy}px`);
  });
  const release = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { dy } = drag;
    drag = null;
    bar.classList.remove("is-dragging");
    state.sheetDragEnd = dy > 6 ? performance.now() : 0;
    if (dy > 110) { setPlayerOpen(false); return; }
    bar.style.removeProperty("--sheet-drag");
  };
  bar.addEventListener("pointerup", release);
  bar.addEventListener("pointercancel", release);
  window.addEventListener?.("popstate", () => { if (isPlayerOpen()) setPlayerOpen(false, { fromHistory: true }); });
  window.matchMedia?.(COMPACT_QUERY)?.addEventListener?.("change", event => {
    if (!event.matches && isPlayerOpen()) setPlayerOpen(false);
    syncTrackRole();
  });
}

// ---------- 3.0 phones: the player is home and the queue is a drawer pulled up from the bottom ----------
function isQueueDrawerMode() {
  return uiVersion() === "3" && isCompactLayout();
}

function isQueueOpen() {
  const shell = $("#app-shell");
  return Boolean(shell?.classList?.contains?.("is-queue-open") && !shell.classList.contains("is-queue-closing"));
}

// the open drawer covers the player, so everything behind it leaves the tab order
const DRAWER_BACKGROUND = [".sidebar", ".main", ".player-bar"];

// Sheet rules from Lumen Glass: one spring (320 / 24) carries the drawer between closed (only its heading peeks
// above the tab bar) and open. While held it follows the finger, rubber-banded past either end; on release,
// "position + speed x 0.12s" decides, with 30% of the travel as the line. The backdrop dims with how far it is open.
const drawer = { y: null, closedY: 0, spring: null };

function drawerClosedY() {
  const panel = $("#queue-panel");
  const shell = $("#app-shell");
  if (!panel?.getBoundingClientRect || !shell) return 0;
  const peek = parseFloat(getComputedStyle(shell).getPropertyValue("--peek-h")) || 64;
  const navTop = $("#main-nav")?.getBoundingClientRect?.().top ?? window.innerHeight;
  return Math.max(0, panel.offsetHeight - peek - Math.max(0, window.innerHeight - navTop));
}

function paintDrawer() {
  const panel = $("#queue-panel");
  const scrim = $("#queue-scrim");
  if (!panel?.style) return;
  if (drawer.y === null) {
    panel.style.removeProperty("transform");
    scrim?.style?.removeProperty?.("opacity");
    return;
  }
  panel.style.transform = `translateY(${drawer.y.toFixed(2)}px)`;
  if (scrim?.style) scrim.style.opacity = String(Math.max(0, Math.min(1, 1 - drawer.y / (drawer.closedY || 1))));
}

function drawerSpring() {
  const L = lumen();
  if (!L) return null;
  if (!drawer.spring) drawer.spring = L.createSpring(value => { drawer.y = value; paintDrawer(); }, 0.5);
  return drawer.spring;
}

function setQueueOpen(open, { fromHistory = false, velocity = 0 } = {}) {
  const shell = $("#app-shell");
  if (!shell?.classList || open === isQueueOpen()) return;
  if (open && !isQueueDrawerMode()) return;
  clearTimeout(state.drawerTimer);
  DRAWER_BACKGROUND.forEach(selector => { const node = $(selector); if (node) node.inert = open; });
  const panel = $("#queue-panel");
  const grabber = $("#queue-grabber");
  const scrim = $("#queue-scrim");
  const spring = drawerSpring();
  grabber?.setAttribute?.("aria-expanded", String(open));
  grabber?.setAttribute?.("aria-label", open ? "收起播放佇列" : "打開播放佇列");
  if (open) {
    panel?.setAttribute?.("role", "dialog");
    panel?.setAttribute?.("aria-modal", "true");
    if (scrim) scrim.hidden = false;
    shell.classList.remove("is-queue-closing");
    shell.classList.add("is-queue-open");
    if (!fromHistory) globalThis.history?.pushState?.({ queueDrawer: true }, "");
    grabber?.focus?.({ preventScroll: true });
    if (spring) {
      drawer.closedY = drawerClosedY();
      spring.jump(drawer.y ?? drawer.closedY);
      spring.to(0, null, velocity);
    }
    return;
  }
  ["role", "aria-modal"].forEach(name => panel?.removeAttribute?.(name));
  const finish = () => {
    shell.classList.remove("is-queue-open", "is-queue-closing");
    panel?.style?.removeProperty?.("--drawer-drag");
    if (scrim) scrim.hidden = true;
    if (spring) { drawer.y = null; paintDrawer(); }
  };
  if (!fromHistory && globalThis.history?.state?.queueDrawer) globalThis.history.back();
  if (spring) {
    shell.classList.add("is-queue-closing");
    drawer.closedY = drawerClosedY();
    spring.jump(drawer.y ?? 0);
    spring.to(drawer.closedY, finish, velocity);
    return;
  }
  if (prefersReducedMotion()) { finish(); return; }
  shell.classList.add("is-queue-closing");
  state.drawerTimer = setTimeout(finish, 250);
}

function setupQueueDrawer() {
  const panel = $("#queue-panel");
  const grabber = $("#queue-grabber");
  if (typeof panel?.addEventListener !== "function" || typeof grabber?.addEventListener !== "function") return;
  grabber.addEventListener("click", () => {
    if (performance.now() - (state.drawerDragEnd || 0) < 350) return;
    setQueueOpen(!isQueueOpen());
  });
  $("#queue-scrim")?.addEventListener?.("click", () => setQueueOpen(false));
  // while closed only the heading peeks above the tab bar; tapping it opens the drawer
  panel.addEventListener("click", event => {
    if (!isQueueDrawerMode() || isQueueOpen()) return;
    if (performance.now() - (state.drawerDragEnd || 0) < 350) return;
    if (event.target?.closest?.(".panel-heading") && !event.target.closest("button")) setQueueOpen(true);
  });
  // drag the drawer by its grabber or heading: down to close it, or up from the peek to open it
  let drag = null;
  panel.addEventListener("pointerdown", event => {
    if (!isQueueDrawerMode() || event.button > 0) return;
    if (!event.target?.closest?.(".queue-grabber, .panel-heading") || event.target.closest(".queue-clear")) return;
    const open = isQueueOpen();
    const spring = drawerSpring();
    if (!spring && !open) return;
    if (spring) {
      spring.stop();
      drawer.closedY = drawerClosedY();
      if (drawer.y === null) drawer.y = open ? 0 : drawer.closedY;
      if (!open) {
        $("#app-shell")?.classList?.add?.("is-queue-peeking");
        const scrim = $("#queue-scrim");
        if (scrim) scrim.hidden = false;
      }
    }
    drag = { id: event.pointerId, startY: event.clientY, origin: drawer.y ?? 0, dy: 0, v: 0, t: event.timeStamp, last: event.clientY, open };
    panel.setPointerCapture?.(event.pointerId);
    panel.classList.add("is-dragging");
  });
  panel.addEventListener("pointermove", event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dt = Math.max(1, event.timeStamp - drag.t);
    drag.v = drag.v + ((event.clientY - drag.last) / dt * 1000 - drag.v) * .5;
    drag.last = event.clientY;
    drag.t = event.timeStamp;
    drag.dy = event.clientY - drag.startY;
    if (drawer.spring) {
      // past either end the drawer resists at 0.3x, the Lumen rubber band
      let y = drag.origin + drag.dy;
      if (y < 0) y *= .3;
      else if (y > drawer.closedY) y = drawer.closedY + (y - drawer.closedY) * .3;
      drawer.y = y;
      paintDrawer();
      return;
    }
    panel.style.setProperty("--drawer-drag", `${Math.max(0, drag.dy)}px`);
  });
  const release = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const { dy, open } = drag;
    const v = event.timeStamp - drag.t > 80 ? 0 : drag.v;
    drag = null;
    panel.classList.remove("is-dragging");
    $("#app-shell")?.classList?.remove?.("is-queue-peeking");
    state.drawerDragEnd = Math.abs(dy) > 6 ? performance.now() : 0;
    const spring = drawer.spring;
    if (spring) {
      if (Math.abs(dy) <= 6) {
        // a tap: the click handlers decide
        if (!open) { drawer.y = null; paintDrawer(); const scrim = $("#queue-scrim"); if (scrim) scrim.hidden = true; }
        return;
      }
      const projected = drawer.y + v * .12;
      const line = drawer.closedY * (open ? .3 : .7);
      if (open) {
        if (projected > line) setQueueOpen(false, { velocity: v });
        else { spring.jump(drawer.y); spring.to(0, null, v); }
      } else if (projected < line) {
        setQueueOpen(true, { velocity: v });
      } else {
        spring.jump(drawer.y);
        spring.to(drawer.closedY, () => {
          drawer.y = null;
          paintDrawer();
          const scrim = $("#queue-scrim");
          if (scrim && !isQueueOpen()) scrim.hidden = true;
        }, v);
      }
      return;
    }
    if (dy > 110) { setQueueOpen(false); return; }
    panel.style.removeProperty("--drawer-drag");
  };
  panel.addEventListener("pointerup", release);
  panel.addEventListener("pointercancel", release);
  window.addEventListener?.("popstate", () => { if (isQueueOpen()) setQueueOpen(false, { fromHistory: true }); });
  window.matchMedia?.(COMPACT_QUERY)?.addEventListener?.("change", event => {
    if (!event.matches && isQueueOpen()) setQueueOpen(false);
    if (!event.matches) { drawer.spring?.stop?.(); drawer.y = null; paintDrawer(); }
  });
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

// Space toggles playback and "/" jumps to the add-song field, the way streaming players do
function handleShortcut(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if ($("#queue-playlist-dialog")?.open || $("#confirm-dialog")?.open) return;
  if (event.key === "Escape" && isPlayerOpen()) { setPlayerOpen(false); return; }
  if (event.key === "Escape" && isQueueOpen()) { setQueueOpen(false); return; }
  const target = event.target;
  if (isTypingTarget(target)) return;
  if (event.key === "/") {
    const input = $("#track-query");
    if (!input || input.disabled || input.offsetParent === null) return;
    event.preventDefault();
    input.focus();
    return;
  }
  if (event.code === "Space" && !target?.closest?.("button, a, [role='button']")) {
    const toggle = $("#play-toggle");
    if (!toggle || toggle.disabled) return;
    event.preventDefault();
    toggle.click();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchPage(button.dataset.page)));
  $$('[data-action]').forEach(button => button.addEventListener("click", () => {
    kickTransportGlyph(button);
    return playerAction(button.dataset.action, button);
  }));
  $("#guild-select").addEventListener("change", event => { state.guildId = event.target.value || null; refreshSnapshot(); });
  $("#progress-range").addEventListener("input", event => {
    state.scrubbing = true;
    $("#progress-track")?.classList?.add?.("is-scrubbing");
    $("#time-current").textContent = formatTime(event.target.value);
    setProgressVisual(Number(event.target.value), Number(event.target.max) || 0);
  });
  $("#progress-range").addEventListener("change", event => {
    $("#progress-track")?.classList?.remove?.("is-scrubbing");
    return seekPlayer(Number(event.target.value));
  });
  $("#progress-range").addEventListener("pointerup", () => $("#progress-track")?.classList?.remove?.("is-scrubbing"));
  $("#progress-range").addEventListener("pointercancel", () => {
    state.scrubbing = false;
    $("#progress-track")?.classList?.remove?.("is-scrubbing");
    renderPlayer(state.player);
  });
  $("#volume-range").addEventListener("input", event => {
    $("#volume-output").value = `${event.target.value}%`;
    syncLoudMeme(Number(event.target.value));
    event.target.style.setProperty("--range-fill", `${event.target.value}%`);
    setVolumeVisual(Number(event.target.value));
  });
  $("#volume-range").addEventListener("change", event => { void setPlayerVolume(Number(event.target.value) / 100); });
  $("#add-track-form").addEventListener("submit", event => {
    event.preventDefault();
    const query = $("#track-query").value.trim();
    if (!query) {
      if (!prefersReducedMotion()) replayAnimation($("#add-track-form"), "is-shaking");
      return;
    }
    void addTrackToQueue(query);
  });
  $("#new-playlist").addEventListener("click", () => setPlaylistCreateOpen(!state.playlistCreateOpen));
  $("#playlist-create-form").addEventListener("submit", createPlaylist);
  $("#queue-select-all").addEventListener("change", event => {
    const queue = state.player?.queue || [];
    if (event.currentTarget.checked) queue.forEach((_entry, index) => state.selectedQueueIndexes.add(index));
    else clearQueueSelection();
    syncQueueSelectionControls(queue);
    renderQueue(queue);
  });
  $("#queue-add-to-playlist").addEventListener("click", openQueuePlaylistDialog);
  $("#queue-playlist-target").addEventListener("change", updateQueuePlaylistDialogMode);
  $("#queue-playlist-cancel").addEventListener("click", closeQueuePlaylistDialog);
  setupDialogDismiss($("#queue-playlist-dialog"), "");
  setupConfirmDialog();
  $("#queue-playlist-form").addEventListener("submit", submitQueuePlaylistDialog);
  $("#playlist-delete").addEventListener("click", deletePlaylist);
  $("#playlist-queue-all").addEventListener("click", () => { void queuePlaylistTracks(); });
  $("#playlist-add-form").addEventListener("submit", event => {
    event.preventDefault();
    void addTrackToPlaylist($("#playlist-track").value.trim());
  });
  $("#settings-search").addEventListener("input", () => renderSettings(state.settings));
  $("#reload-config").addEventListener("click", async () => { try { await api("/api/config/reload", { method: "POST" }); await loadSettings(true); toast("設定已重新載入"); } catch (error) { toast(error.message, "error"); } });
  $("#restart-soft").addEventListener("click", () => requestRestart("soft"));
  $("#restart-full").addEventListener("click", () => requestRestart("full"));
  $("#permission-add-group").addEventListener("click", () => permissionGroupAction("create"));
  $("#refresh-logs").addEventListener("click", () => loadLogs()); $("#log-level").addEventListener("change", renderLogs); $("#log-search").addEventListener("input", renderLogs);
  $("#log-auto-scroll").addEventListener("change", event => { if (event.target.checked) { const view = $("#log-view"); view.scrollTop = view.scrollHeight; } });
  $("#log-view").addEventListener("scroll", syncLogAutoScroll, { passive: true });
  setupQueueDragScroll();
  setupPanelResizers();
  setupPlayerSheet();
  setupQueueDrawer();
  setupUiVersion();
  document.addEventListener("keydown", handleShortcut);
  window.addEventListener?.("resize", () => requestAnimationFrame(updateTrackTitleOverflow));
  requestAnimationFrame(updateTrackTitleOverflow);
  document.addEventListener("visibilitychange", resumeSnapshotPolling);
  pollSnapshot(); setInterval(pollSnapshot, SNAPSHOT_INTERVAL); setInterval(pollLogs, 3000); requestAnimationFrame(animateProgress);
});
