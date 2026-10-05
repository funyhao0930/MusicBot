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
  scrubbing: false,
  draggingIndex: null,
  suppressQueueClick: false,
  queueRenderKey: null,
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
const ADD_DONE_ICON = '<svg class="done-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const QUEUE_ACTION_ICONS = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  queue: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 12H3"/><path d="M16 6H3"/><path d="M16 18H3"/><path d="M18 9v6"/><path d="M21 12h-6"/></svg>',
  remove: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
};
const NOTE_ICON = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
const THUMB_PLAY_ICON = '<span class="thumb-play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 4.5v15l12.5-7.5z"/></svg></span>';
// YouTube's 4:3 thumbnails letterbox 16:9 videos; those get zoomed past the bars
const LETTERBOXED_THUMBNAIL = /\/(?:hq|sd)?default\.(?:jpg|webp)/;
const QUEUE_SCROLL_EDGE = 64;
let queueDragPoint = null;
let queueDragFrame = null;

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
}

function setVolumeVisual(volume) {
  const level = volume <= 0 ? 0 : volume <= 40 ? 1 : 2;
  const icon = $("#volume-icon");
  if (typeof icon?.classList?.add !== "function") return;
  icon.classList.remove("lv-0", "lv-1", "lv-2");
  icon.classList.add(`lv-${level}`);
}

function flashAddButton(form) {
  const button = form?.querySelector?.('button[type="submit"]');
  if (!button || typeof button.classList?.add !== "function") return;
  clearTimeout(button.doneTimer);
  if (!button.dataset.label) button.dataset.label = button.textContent;
  button.classList.add("is-done");
  button.innerHTML = `${ADD_DONE_ICON}已加入`;
  button.doneTimer = setTimeout(() => {
    button.classList.remove("is-done");
    button.textContent = button.dataset.label;
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

function toast(message, type = "info", meme = type === "error" ? "gugugaga" : "") {
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
  setTimeout(() => {
    node.classList.add("is-leaving");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }, 2800);
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
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
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
    setMutationBusy(false);
  }
}

function isPublicMode() {
  return document.documentElement?.dataset?.mode === "public";
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
  const meta = $("#bar-meta");
  if (meta) meta.textContent = current ? `由 ${current.requested_by} 加入` : "";
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
  const meta = $("#queue-now-meta");
  if (meta) meta.textContent = current ? `由 ${current.requested_by} 加入` : "";
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
  $("#track-meta").textContent = player?.current ? `由 ${player.current.requested_by} 加入 · ${player.voice_channel?.name || "未連接語音頻道"}` : "加入一首歌，讓今晚有點聲音。";
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
  toggle.dataset.action = paused ? "resume" : "pause";
  const showPlay = paused || !player?.current;
  toggle.classList.toggle("is-paused", showPlay);
  // CSS animates `d`; the attributes keep the right glyph where that is unsupported
  const glyphPaths = PLAY_PAUSE_PATHS[showPlay ? "play" : "pause"];
  [".pp-l", ".pp-r"].forEach((selector, index) => toggle.querySelector?.(selector)?.setAttribute?.("d", glyphPaths[index]));
  toggle.setAttribute("aria-label", paused || !player?.current ? "播放" : "暫停");
  toggle.title = paused || !player?.current ? "播放" : "暫停";
  toggle.disabled = state.mutationBusy || !player?.current;

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
    entry.requested_by || "",
  ]));
  if (renderKey === state.queueRenderKey) {
    syncQueueRowControls(queue);
    syncQueueSelectionControls(queue);
    return;
  }
  state.selectedQueueIndexes.clear();
  state.queueRenderKey = renderKey;

  const previousRects = captureRowRects(list);
  const keyCounts = {};
  const rows = queue.map((entry, index) => {
    const row = document.createElement("div");
    row.className = "queue-item";
    row.draggable = !state.mutationBusy;
    row.dataset.index = index;
    const baseKey = `${entry.url || ""}\u0000${entry.title || ""}`;
    keyCounts[baseKey] = (keyCounts[baseKey] || 0) + 1;
    row.dataset.key = `${baseKey}\u0000${keyCounts[baseKey]}`;
    row.style?.setProperty?.("--i", String(index));
    const disabled = state.mutationBusy ? " disabled" : "";
    row.innerHTML = `<span class="queue-lead"><span class="queue-index">${index + 1}</span><input class="queue-select-input" type="checkbox"${disabled}></span><span class="queue-thumb">${NOTE_ICON}${THUMB_PLAY_ICON}</span><button class="queue-copy queue-play-target" type="button"${disabled}><strong></strong><small><span class="queue-meta-time"></span><span class="queue-requester"></span></small></button><span class="queue-row-end"><span class="queue-duration"></span><span class="queue-row-actions"><button class="queue-move-up icon-button" type="button" aria-label="向上移動" title="向上移動"${state.mutationBusy || index === 0 ? " disabled" : ""}>${QUEUE_ACTION_ICONS.up}</button><button class="queue-move-down icon-button" type="button" aria-label="向下移動" title="向下移動"${state.mutationBusy || index === queue.length - 1 ? " disabled" : ""}>${QUEUE_ACTION_ICONS.down}</button><button class="queue-remove icon-button danger" type="button" aria-label="從佇列移除" title="從佇列移除"${disabled}>${QUEUE_ACTION_ICONS.remove}</button></span></span>`;
    const checkbox = $(".queue-select-input", row);
    // titles come from the media source, so they are set as text or attributes, never as markup
    checkbox.setAttribute?.("aria-label", `選取第 ${index + 1} 首歌曲`);
    $(".queue-play-target", row).setAttribute?.("aria-label", `播放第 ${index + 1} 首：${entry.title}`);
    checkbox.checked = state.selectedQueueIndexes.has(index);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedQueueIndexes.add(index);
      else state.selectedQueueIndexes.delete(index);
      syncQueueSelectionControls(queue);
    });
    if (entry.thumbnail) {
      const thumb = $(".queue-thumb", row);
      const image = document.createElement("img");
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.onerror = () => image.remove?.();
      image.src = entry.thumbnail;
      thumb?.classList?.toggle?.("is-letterboxed", isLetterboxed(entry.thumbnail));
      thumb?.prepend?.(image);
    }
    const title = $("strong", row);
    title.textContent = entry.title;
    title.title = entry.title;
    $(".queue-requester", row).textContent = `由 ${entry.requested_by} 加入`;
    $(".queue-meta-time", row).textContent = `${formatTime(entry.duration)} · `;
    $(".queue-duration", row).textContent = formatTime(entry.duration);
    $(".queue-play-target", row).addEventListener("click", () => playQueueItem(index));
    $(".queue-move-up", row).addEventListener("click", () => reorderQueue(index, index - 1));
    $(".queue-move-down", row).addEventListener("click", () => reorderQueue(index, index + 1));
    $(".queue-remove", row).addEventListener("click", () => removeQueueItem(index, row));
    const isInteractiveTarget = target => Boolean(target?.closest?.("button, input, label, a, select"));
    const playFromRow = event => {
      if (state.suppressQueueClick || state.mutationBusy || isInteractiveTarget(event.target)) return;
      playQueueItem(index);
    };
    row.addEventListener("click", playFromRow);
    row.addEventListener("dragstart", event => {
      if (state.mutationBusy) { event.preventDefault(); return; }
      state.draggingIndex = index;
      state.suppressQueueClick = true;
      document.body.classList.add("is-queue-dragging");
      event.dataTransfer?.setData("text/plain", String(index));
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      row.classList.add("is-dragging");
    });
    row.addEventListener("dragend", () => {
      state.draggingIndex = null;
      queueDragPoint = null;
      if (queueDragFrame !== null) cancelAnimationFrame(queueDragFrame);
      queueDragFrame = null;
      document.body.classList.remove("is-queue-dragging");
      row.classList.remove("is-dragging");
      clearQueueDropIndicators();
      setTimeout(() => { state.suppressQueueClick = false; }, 0);
    });
    return row;
  });
  list.replaceChildren(...rows);
  animateQueueReflow(rows, previousRects);
  syncQueueRowControls(queue);
  syncQueueSelectionControls(queue);
}

function syncQueueRowControls(queue) {
  const queueList = $("#queue-list");
  if (!queueList?.querySelectorAll) return;
  $$(".queue-item", queueList).forEach((row, index) => {
    row.draggable = !state.mutationBusy;
    const checkbox = $(".queue-select-input", row);
    if (checkbox) checkbox.disabled = state.mutationBusy;
    const moveUp = $(".queue-move-up", row);
    if (moveUp) moveUp.disabled = state.mutationBusy || index === 0;
    const moveDown = $(".queue-move-down", row);
    if (moveDown) moveDown.disabled = state.mutationBusy || index === queue.length - 1;
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
}

function queueDropSlot(list, clientY) {
  const rows = $$(".queue-item", list);
  const slot = rows.findIndex(row => {
    const rect = row.getBoundingClientRect();
    return clientY < rect.top + rect.height / 2;
  });
  return slot < 0 ? rows.length : slot;
}

function showQueueDropIndicator(list, clientX, clientY) {
  clearQueueDropIndicators();
  const rect = list.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return;
  const rows = $$(".queue-item", list);
  if (!rows.length) return;
  const slot = queueDropSlot(list, clientY);
  const row = rows[Math.min(slot, rows.length - 1)];
  row.classList.add(slot === rows.length ? "is-drop-after" : "is-drop-before");
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

function animateQueueDragScroll() {
  queueDragFrame = null;
  if (state.draggingIndex === null || !queueDragPoint) return;
  const list = $("#queue-list");
  if (scrollQueueDragTarget(list, queueDragPoint.x, queueDragPoint.y)) {
    showQueueDropIndicator(list, queueDragPoint.x, queueDragPoint.y);
  }
  queueDragFrame = requestAnimationFrame(animateQueueDragScroll);
}

function setupQueueDragScroll() {
  const list = $("#queue-list");
  document.addEventListener("dragover", event => {
    if (state.draggingIndex === null) return;
    queueDragPoint = { x: event.clientX, y: event.clientY };
    showQueueDropIndicator(list, event.clientX, event.clientY);
    if (queueDragFrame === null) queueDragFrame = requestAnimationFrame(animateQueueDragScroll);
  });
  list.addEventListener("dragover", event => {
    if (state.draggingIndex === null || state.mutationBusy) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    showQueueDropIndicator(list, event.clientX, event.clientY);
  });
  list.addEventListener("drop", event => {
    if (state.draggingIndex === null) return;
    event.preventDefault();
    const source = state.draggingIndex;
    const count = $$(".queue-item", list).length;
    const slot = queueDropSlot(list, event.clientY);
    clearQueueDropIndicators();
    if (state.mutationBusy || !count) return;
    const target = Math.max(0, Math.min(count - 1, slot - (source < slot ? 1 : 0)));
    if (source !== target) void reorderQueue(source, target);
  });
  document.addEventListener("drop", event => {
    if (state.draggingIndex !== null) event.preventDefault();
  });
  document.addEventListener("wheel", event => {
    if (state.draggingIndex === null) return;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    if (scrollQueueDragTarget(list, event.clientX, event.clientY, event.deltaY * scale)) {
      event.preventDefault();
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
  const dialog = $("#queue-playlist-dialog");
  if (typeof dialog.close === "function") dialog.close();
  else dialog.hidden = true;
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
    button.textContent = "加入中";
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
      button.textContent = "加入播放清單";
    }
  });
}

async function playerAction(action, button) {
  if (!state.guildId) return;
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
      setTimeout(() => renderQueue(result.queue), 180);
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
      renderQueue(result.queue);
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
  try {
    const status = await api("/api/status");
    state.csrf = status.csrf_token;
    setConnected(status.ready && !status.network_outage, status.network_outage ? "網路中斷" : status.ready ? `${status.latency_ms} ms` : "啟動中");
    const guildData = await api("/api/guilds");
    renderGuilds(guildData.guilds);
    if (state.guildId) {
      try { renderPlayer(await api(`/api/player?guild_id=${state.guildId}`)); }
      catch (error) { if (!String(error.message).includes("No active player")) throw error; renderPlayer(null); }
    } else renderPlayer(null);
  } catch (error) {
    setConnected(false, "連線中斷");
  }
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

async function loadLogs() {
  try { const result = await api("/api/logs?limit=500"); state.logs = result.lines; renderLogs(); }
  catch (error) { toast(error.message, "error"); }
}

function renderLogs() {
  const level = $("#log-level").value; const query = $("#log-search").value.toLowerCase();
  const lines = state.logs.filter(line => (!level || line.includes(level)) && (!query || line.toLowerCase().includes(query)));
  const view = $("#log-view"); view.textContent = lines.join("\n");
  view.hidden = lines.length === 0;
  const empty = $("#log-empty");
  if (empty) empty.hidden = lines.length > 0;
  if ($("#log-auto-scroll").checked) view.scrollTop = view.scrollHeight;
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
        try {
          const result = await api("/api/queue/add", {
            method: "POST",
            body: { guild_id: state.guildId, query: source },
          });
          renderQueue(result.queue);
          toast(`已加入 ${result.added_count} 首歌曲`, "info", "arms");
        } catch (error) {
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
  if (!window.confirm(`確定刪除播放清單「${playlist.name}」？這會移除 ${playlist.tracks.length} 首歌曲。`)) return;

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
  if (!state.guildId) return;
  return runMutation(async () => {
    try {
      await api("/api/player/volume", { method: "POST", body: { guild_id: state.guildId, volume } });
    } catch (error) {
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
      renderQueue(result.queue);
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
    try {
      const result = await api(`/api/playlists/${encodeURIComponent(playlist.name)}/queue`, {
        method: "POST",
        body: { guild_id: state.guildId },
      });
      renderQueue(result.queue);
      toast(`已加入 ${result.added_count} 首歌曲`, "info", "arms");
    } catch (error) {
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
    if (!window.confirm(`確定刪除權限群組「${sourceLabel}」？`)) return;
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
  if (!window.confirm(`確定執行${label}？播放與 Discord 連線會暫時中斷。`)) return;
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

function isCompactLayout() {
  return Boolean(window.matchMedia?.("(max-width: 860px)")?.matches);
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
    if (isCompactLayout()) {
      track.setAttribute?.("aria-controls", "player-bar");
      track.setAttribute?.("aria-expanded", String(isPlayerOpen()));
    } else {
      track.removeAttribute?.("aria-controls");
      track.removeAttribute?.("aria-expanded");
    }
  };
  syncTrackRole();
  // on a phone the bar opens the full player; on desktop it shows the now-playing stage
  track.addEventListener("click", () => {
    // the click that ends a drag gesture is not a tap
    if (performance.now() - (state.sheetDragEnd || 0) < 350) return;
    if (isPlayerOpen()) return;
    if (isCompactLayout()) setPlayerOpen(true);
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
  window.matchMedia?.("(max-width: 860px)")?.addEventListener?.("change", event => {
    if (!event.matches && isPlayerOpen()) setPlayerOpen(false);
    syncTrackRole();
  });
}

function isTypingTarget(target) {
  return Boolean(target?.closest?.("input, textarea, select, [contenteditable='true']"));
}

// Space toggles playback and "/" jumps to the add-song field, the way streaming players do
function handleShortcut(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
  if ($("#queue-playlist-dialog")?.open) return;
  if (event.key === "Escape" && isPlayerOpen()) { setPlayerOpen(false); return; }
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
  $("#refresh-logs").addEventListener("click", loadLogs); $("#log-level").addEventListener("change", renderLogs); $("#log-search").addEventListener("input", renderLogs);
  setupQueueDragScroll();
  setupPlayerSheet();
  document.addEventListener("keydown", handleShortcut);
  window.addEventListener?.("resize", () => requestAnimationFrame(updateTrackTitleOverflow));
  requestAnimationFrame(updateTrackTitleOverflow);
  refreshSnapshot(); setInterval(refreshSnapshot, 2000); requestAnimationFrame(animateProgress);
});
