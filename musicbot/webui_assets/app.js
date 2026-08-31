"use strict";

const state = {
  csrf: "",
  guildId: null,
  player: null,
  currentUrl: "",
  lastSync: 0,
  connected: false,
  scrubbing: false,
  draggingIndex: null,
  queueRenderKey: null,
  settings: [],
  playlists: [],
  playlistsLoaded: false,
  playlistTitleLoads: {},
  playlistVisibleCounts: {},
  currentPlaylist: "",
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
const CONTROL_ICONS = {
  play: "/assets/icon-play.svg",
  pause: "/assets/icon-pause.svg",
  repeat: "/assets/icon-repeat.svg",
  repeat_one: "/assets/icon-repeat-one.svg",
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const pageMeta = {
  dashboard: ["NOW PLAYING", "今晚播什麼？"],
  playlists: ["AUTOPLAY", "播放清單"],
  settings: ["設定管理", "機器人設定"],
  permissions: ["存取控制", "權限群組"],
  logs: ["RUNTIME", "執行日誌"],
};

function formatTime(value) {
  const seconds = Math.max(0, Math.floor(Number(value) || 0));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function toast(message, type = "info") {
  const node = document.createElement("div");
  node.className = `toast${type === "error" ? " is-error" : ""}`;
  node.textContent = message;
  $("#toast-region").append(node);
  setTimeout(() => {
    node.classList.add("is-leaving");
    node.addEventListener("animationend", () => node.remove(), { once: true });
  }, 2800);
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
  $("#reconnect-layer").hidden = connected;
}

function switchPage(name) {
  const current = $(".page.is-active");
  const next = $(`[data-page-panel="${name}"]`);
  if (!next || current === next) return;
  current?.classList.add("is-leaving");
  current?.classList.remove("is-active");
  setTimeout(() => current?.classList.remove("is-leaving"), 140);
  next.classList.add("is-active");
  $$(".nav-item").forEach(item => item.classList.toggle("is-active", item.dataset.page === name));
  $("#page-eyebrow").textContent = pageMeta[name][0];
  $("#page-title").textContent = pageMeta[name][1];
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

function setArtwork(entry, changed) {
  const art = $("#album-art");
  if (changed) art.classList.add("is-changing");
  setTimeout(() => {
    const image = $("#album-image");
    const fallback = $("#album-fallback");
    if (entry?.thumbnail) {
      image.onerror = () => {
        image.hidden = true;
        image.removeAttribute("src");
        fallback.hidden = false;
      };
      image.onload = () => {
        image.hidden = false;
        fallback.hidden = true;
      };
      image.src = entry.thumbnail;
      image.alt = `${entry.title} 封面`;
      image.hidden = true;
      fallback.hidden = false;
    } else {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
      image.hidden = true;
      fallback.hidden = false;
    }
    art.classList.remove("is-changing");
  }, changed ? 160 : 0);
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

  title.textContent = nextTitle;
  viewport.classList.remove("is-overflowing");
  requestAnimationFrame(updateTrackTitleOverflow);
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
  setTrackTitle(player?.current?.title);
  $("#track-meta").textContent = player?.current ? `由 ${player.current.requested_by} 加入 · ${player.voice_channel?.name || "未連接語音頻道"}` : "加入一首歌，讓今晚有點聲音。";
  setArtwork(player?.current, changed);

  const total = player?.current?.duration || 0;
  const progress = Math.min(player?.progress || 0, total || Number.MAX_VALUE);
  const progressRange = $("#progress-range");
  progressRange.max = total || 100;
  progressRange.disabled = !player?.current || total <= 0;
  const progressPercent = total > 0 ? Math.min(100, Math.max(0, progress / total * 100)) : 0;
  progressRange.style?.setProperty?.("--progress-fill", `${progressPercent}%`);
  if (!state.scrubbing) {
    progressRange.value = progress;
    $("#time-current").textContent = formatTime(progress);
  }
  $("#time-total").textContent = formatTime(total);

  const toggle = $("#play-toggle");
  const paused = player?.state === "paused";
  toggle.dataset.action = paused ? "resume" : "pause";
  $("#play-toggle-icon").src = paused || !player?.current ? CONTROL_ICONS.play : CONTROL_ICONS.pause;
  toggle.setAttribute("aria-label", paused || !player?.current ? "播放" : "暫停");
  toggle.title = paused || !player?.current ? "播放" : "暫停";
  toggle.disabled = !player?.current;

  const shuffle = $("#transport-shuffle");
  const shuffleEnabled = Boolean(player?.shuffle);
  shuffle.classList.toggle("is-active", shuffleEnabled);
  shuffle.setAttribute("aria-pressed", String(shuffleEnabled));
  shuffle.setAttribute("aria-label", shuffleEnabled ? "啟用隨機播放" : "關閉隨機播放");
  $(".transport-state-dot", shuffle).hidden = !shuffleEnabled;
  shuffle.disabled = !player?.current && !(player?.queue || []).length;

  const previous = $("#transport-previous");
  previous.disabled = !player?.can_previous;

  const next = $("#transport-next");
  next.disabled = !player?.current;

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
  $("#repeat-icon").src = repeatMode === "song" ? CONTROL_ICONS.repeat_one : CONTROL_ICONS.repeat;
  $("#repeat-state-dot").hidden = repeatMode !== "all";
  repeat.disabled = !player?.current;

  $("#transport-stop").disabled = !player?.current;

  const volume = Math.round((player?.volume ?? .25) * 100);
  $("#volume-range").value = volume;
  $("#volume-output").value = `${volume}%`;
  renderQueue(player?.queue || []);
}

function renderQueue(queue) {
  const list = $("#queue-list");
  $("#queue-count").textContent = `${queue.length} 首`;
  $("#queue-clear").disabled = queue.length === 0;
  $("#queue-empty").hidden = queue.length > 0;
  list.hidden = queue.length === 0;

  const renderKey = JSON.stringify(queue.map(entry => [
    entry.url || "",
    entry.title || "",
    Number(entry.duration) || 0,
    entry.requested_by || "",
  ]));
  if (renderKey === state.queueRenderKey) return;
  state.queueRenderKey = renderKey;

  list.replaceChildren(...queue.map((entry, index) => {
    const row = document.createElement("div");
    row.className = "queue-item";
    row.draggable = true;
    row.dataset.index = index;
    row.innerHTML = `<span class="queue-index">${String(index + 1).padStart(2, "0")}</span><div class="queue-copy"><strong></strong><small></small></div><button class="queue-remove" type="button" aria-label="從佇列移除">移除</button>`;
    $("strong", row).textContent = entry.title;
    $("small", row).textContent = `${formatTime(entry.duration)} · ${entry.requested_by}`;
    $(".queue-remove", row).addEventListener("click", () => removeQueueItem(index, row));
    row.addEventListener("dragstart", () => { state.draggingIndex = index; row.classList.add("is-dragging"); });
    row.addEventListener("dragend", () => { state.draggingIndex = null; row.classList.remove("is-dragging"); });
    row.addEventListener("dragover", event => event.preventDefault());
    row.addEventListener("drop", async event => {
      event.preventDefault();
      if (state.draggingIndex === null || state.draggingIndex === index) return;
      await reorderQueue(state.draggingIndex, index);
    });
    return row;
  }));
}

async function playerAction(action, button) {
  if (!state.guildId) return;
  button?.classList.add("is-switching");
  try {
    const result = await api("/api/player/action", { method: "POST", body: { guild_id: state.guildId, action } });
    renderPlayer(result.player);
  } catch (error) { toast(error.message, "error"); }
  finally { setTimeout(() => button?.classList.remove("is-switching"), 220); }
}

async function seekPlayer(position) {
  if (!state.guildId || !state.player?.current) return;
  const duration = Number(state.player.current.duration) || 0;
  const target = Math.min(Math.max(Number(position) || 0, 0), duration);
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
}

async function removeQueueItem(index, row) {
  row.classList.add("is-removing");
  try {
    const result = await api(`/api/queue/${index}?guild_id=${state.guildId}`, { method: "DELETE" });
    setTimeout(() => renderQueue(result.queue), 180);
  } catch (error) {
    row.classList.remove("is-removing");
    toast(error.message, "error");
  }
}

async function reorderQueue(source, target) {
  try {
    const result = await api("/api/queue/reorder", { method: "POST", body: { guild_id: state.guildId, source_index: source, target_index: target } });
    renderQueue(result.queue);
  } catch (error) {
    renderQueue(state.player?.queue || []);
    toast(error.message, "error");
  }
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
    $("#progress-range").value = progress;
    $("#time-current").textContent = formatTime(progress);
  }
  requestAnimationFrame(animateProgress);
}

function settingInput(option) {
  if (option.sensitive) {
    const span = document.createElement("span"); span.className = "sensitive-value"; span.textContent = "此值受保護，請手動編輯設定檔"; return span;
  }
  const input = document.createElement("input");
  if (option.type === "boolean") { input.type = "checkbox"; input.checked = Boolean(option.value); }
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
        const save = document.createElement("button"); save.className = "button ghost"; save.type = "button"; save.textContent = "儲存";
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

function renderPlaylistEditor() {
  const playlist = state.playlists.find(item => item.name === state.currentPlaylist);
  const tracks = playlist?.tracks || [];
  $("#playlist-title").textContent = playlist?.name || "選擇播放清單";
  $("#playlist-count").textContent = `${tracks.length} 首`;
  $("#playlist-empty").hidden = tracks.length > 0;
  $("#playlist-add-form").querySelectorAll("input, button").forEach(control => { control.disabled = !playlist; });
  $("#playlist-queue-all").disabled = !playlist || tracks.length === 0;
  $("#playlist-delete").hidden = !playlist || playlist.deletable !== true;
  $("#playlist-delete").disabled = !playlist || playlist.deletable !== true;

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
    row.innerHTML = `<span class="queue-index">${String(index + 1).padStart(2, "0")}</span><div class="playlist-track-copy"><strong></strong><small></small></div><div class="playlist-track-actions"><button class="button ghost playlist-queue" type="button">加入隊列</button><button class="queue-remove" type="button">移除</button></div>`;
    $("strong", row).textContent = title;
    $("strong", row).classList.toggle("playlist-track-title-loading", titleState === "loading");
    $("small", row).textContent = source;
    const queueButton = $(".playlist-queue", row);
    queueButton.addEventListener("click", async () => {
      if (!state.guildId) {
        toast("請先選擇 Discord 伺服器", "error");
        return;
      }
      queueButton.disabled = true;
      queueButton.textContent = "加入中";
      try {
        const result = await api("/api/queue/add", {
          method: "POST",
          body: { guild_id: state.guildId, query: source },
        });
        renderQueue(result.queue);
        toast(`已加入 ${result.entry.title}`);
      } catch (error) {
        toast(error.message, "error");
      } finally {
        queueButton.disabled = false;
        queueButton.textContent = "加入隊列";
      }
    });
    $(".queue-remove", row).addEventListener("click", async () => {
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
    return row;
  });

  if (playlist && visibleTracks.length < tracks.length) {
    const loadMore = document.createElement("button");
    loadMore.className = "button ghost playlist-load-more";
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
    button.className = `playlist-tab${playlist.name === state.currentPlaylist ? " is-active" : ""}`;
    button.type = "button";
    button.textContent = `${playlist.name} · ${playlist.tracks.length}`;
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

async function createPlaylist() {
  const name = window.prompt("新播放清單名稱");
  if (!name) return;
  try {
    const result = await api("/api/playlists", { method: "POST", body: { action: "create", name } });
    state.currentPlaylist = result.playlist.name;
    await loadPlaylists(true);
    toast(`已建立 ${result.playlist.name}`);
  } catch (error) {
    toast(error.message, "error");
  }
}

async function deletePlaylist() {
  const playlist = state.playlists.find(item => item.name === state.currentPlaylist);
  if (!playlist || playlist.deletable !== true) return;
  if (!window.confirm(`確定刪除播放清單「${playlist.name}」？這會移除 ${playlist.tracks.length} 首歌曲。`)) return;

  const button = $("#playlist-delete");
  button.disabled = true;
  button.textContent = "刪除中";
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
  } finally {
    button.disabled = false;
    button.textContent = "刪除清單";
  }
}

function permissionControl(group, option, row) {
  const control = $(".setting-control", row);
  const input = settingInput(option);
  control.append(input);
  if (!option.editable || option.sensitive) return;

  const save = document.createElement("button");
  save.className = "button ghost";
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
      const clone = document.createElement("button"); clone.className = "button ghost"; clone.textContent = "複製"; clone.addEventListener("click", () => permissionGroupAction("clone", group.name, group.display_name)); actions.append(clone);
      if (!["owner", "default"].includes(group.name.toLowerCase())) {
        const rename = document.createElement("button"); rename.className = "button ghost"; rename.textContent = "重新命名"; rename.addEventListener("click", () => permissionGroupAction("rename", group.name, group.display_name)); actions.append(rename);
        const remove = document.createElement("button"); remove.className = "button danger"; remove.textContent = "刪除"; remove.addEventListener("click", () => permissionGroupAction("delete", group.name, group.display_name)); actions.append(remove);
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

document.addEventListener("DOMContentLoaded", () => {
  $$(".nav-item").forEach(button => button.addEventListener("click", () => switchPage(button.dataset.page)));
  $$('[data-action]').forEach(button => button.addEventListener("click", () => playerAction(button.dataset.action, button)));
  $("#guild-select").addEventListener("change", event => { state.guildId = event.target.value || null; refreshSnapshot(); });
  $("#progress-range").addEventListener("input", event => {
    state.scrubbing = true;
    $("#time-current").textContent = formatTime(event.target.value);
  });
  $("#progress-range").addEventListener("change", event => seekPlayer(Number(event.target.value)));
  $("#progress-range").addEventListener("pointercancel", () => {
    state.scrubbing = false;
    renderPlayer(state.player);
  });
  $("#volume-range").addEventListener("input", event => { $("#volume-output").value = `${event.target.value}%`; });
  $("#volume-range").addEventListener("change", async event => {
    try { await api("/api/player/volume", { method: "POST", body: { guild_id: state.guildId, volume: Number(event.target.value) / 100 } }); }
    catch (error) { toast(error.message, "error"); }
  });
  $("#add-track-form").addEventListener("submit", async event => {
    event.preventDefault(); const input = $("#track-query"); const query = input.value.trim(); if (!query) return;
    const button = $("button", event.currentTarget); button.disabled = true; button.textContent = "處理中";
    try { const result = await api("/api/queue/add", { method: "POST", body: { guild_id: state.guildId, query } }); input.value = ""; renderQueue(result.queue); toast(`已加入 ${result.entry.title}`); }
    catch (error) { toast(error.message, "error"); }
    finally { button.disabled = false; button.textContent = "加入"; }
  });
  $("#new-playlist").addEventListener("click", createPlaylist);
  $("#playlist-delete").addEventListener("click", deletePlaylist);
  $("#playlist-queue-all").addEventListener("click", async event => {
    const playlist = state.playlists.find(item => item.name === state.currentPlaylist);
    if (!state.guildId) {
      toast("請先選擇 Discord 伺服器", "error");
      return;
    }
    if (!playlist || playlist.tracks.length === 0) return;

    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = `加入 ${playlist.tracks.length} 首中`;
    try {
      const result = await api(`/api/playlists/${encodeURIComponent(playlist.name)}/queue`, {
        method: "POST",
        body: { guild_id: state.guildId },
      });
      renderQueue(result.queue);
      toast(`已加入 ${result.added_count} 首歌曲`);
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "全部加入隊列";
    }
  });
  $("#playlist-add-form").addEventListener("submit", async event => {
    event.preventDefault();
    const input = $("#playlist-track");
    const track = input.value.trim();
    if (!track || !state.currentPlaylist) return;
    const button = $("button", event.currentTarget);
    button.disabled = true;
    button.textContent = "加入中";
    try {
      const result = await api("/api/playlists", { method: "POST", body: { action: "add", name: state.currentPlaylist, track } });
      const target = state.playlists.find(item => item.name === state.currentPlaylist);
      if (target) target.tracks = result.playlist.tracks;
      input.value = "";
      renderPlaylists();
      void loadPlaylistTitles(state.currentPlaylist);
      toast("已加入播放清單");
    } catch (error) {
      toast(error.message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "加入";
    }
  });
  $("#settings-search").addEventListener("input", () => renderSettings(state.settings));
  $("#reload-config").addEventListener("click", async () => { try { await api("/api/config/reload", { method: "POST" }); await loadSettings(true); toast("設定已重新載入"); } catch (error) { toast(error.message, "error"); } });
  $("#restart-soft").addEventListener("click", () => requestRestart("soft"));
  $("#restart-full").addEventListener("click", () => requestRestart("full"));
  $("#permission-add-group").addEventListener("click", () => permissionGroupAction("create"));
  $("#refresh-logs").addEventListener("click", loadLogs); $("#log-level").addEventListener("change", renderLogs); $("#log-search").addEventListener("input", renderLogs);
  window.addEventListener?.("resize", () => requestAnimationFrame(updateTrackTitleOverflow));
  requestAnimationFrame(updateTrackTitleOverflow);
  refreshSnapshot(); setInterval(refreshSnapshot, 2000); requestAnimationFrame(animateProgress);
});
