const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const appSource = fs.readFileSync(path.join(__dirname, "../musicbot/webui_assets/app.js"), "utf8");

function makeHarness() {
  const listeners = new Map();
  const listListeners = new Map();
  const frames = new Map();
  const classes = () => {
    const names = new Set();
    return {
      add: name => names.add(name),
      remove: (...removed) => removed.forEach(name => names.delete(name)),
      contains: name => names.has(name),
    };
  };
  let nextFrame = 0;
  let listTop = 0;
  let pageTop = 0;
  const rows = Array.from({ length: 10 }, (_unused, index) => ({
    classList: classes(),
    getBoundingClientRect: () => ({ top: 100 + index * 40 - listTop, height: 40 }),
  }));
  const list = {
    clientHeight: 200,
    scrollHeight: 400,
    get scrollTop() { return listTop; },
    set scrollTop(value) { listTop = Math.max(0, Math.min(200, value)); },
    getBoundingClientRect: () => ({ left: 100, right: 400, top: 100, bottom: 300 }),
    querySelectorAll: () => rows,
    addEventListener: (type, callback) => listListeners.set(type, callback),
  };
  const page = {
    clientHeight: 600,
    scrollHeight: 1000,
    get scrollTop() { return pageTop; },
    set scrollTop(value) { pageTop = Math.max(0, Math.min(400, value)); },
  };
  const document = {
    body: { classList: classes() },
    scrollingElement: page,
    querySelector: selector => selector === "#queue-list" ? list : null,
    addEventListener: (type, callback) => listeners.set(type, callback),
  };
  const context = vm.createContext({
    document,
    window: { innerHeight: 600 },
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  vm.runInContext(appSource, context);
  vm.runInContext("state.draggingIndex = 0; setupQueueDragScroll(); reorderQueue = (source, target) => { globalThis.move = [source, target]; }", context);
  return {
    context, list, page, rows, listeners, listListeners,
    frame() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(); },
  };
}

test("holding a dragged song at the queue edge scrolls and updates the drop slot", () => {
  const h = makeHarness();
  const before = vm.runInContext("queueDropSlot(document.querySelector('#queue-list'), 290)", h.context);
  h.listListeners.get("dragover")({ clientX: 200, clientY: 290, preventDefault() {}, dataTransfer: {} });
  h.listeners.get("dragover")({ clientX: 200, clientY: 290 });
  for (let count = 0; count < 5; count++) h.frame();
  const after = vm.runInContext("queueDropSlot(document.querySelector('#queue-list'), 290)", h.context);
  assert.ok(h.list.scrollTop > 0);
  assert.ok(after > before);
  assert.ok(h.rows.some(row => row.classList.contains("is-drop-before") || row.classList.contains("is-drop-after")));
  h.listListeners.get("drop")({ clientY: 290, preventDefault() {} });
  assert.deepEqual(Array.from(h.context.move), [0, after - 1]);
});

test("wheel scroll works during drag and falls back to page scrolling", () => {
  const h = makeHarness();
  let prevented = false;
  h.listeners.get("wheel")({ clientX: 200, clientY: 200, deltaY: 3, deltaMode: 1, preventDefault() { prevented = true; } });
  assert.equal(h.list.scrollTop, 48);
  assert.equal(prevented, true);
  h.listeners.get("dragover")({ clientX: 200, clientY: 590 });
  h.frame();
  assert.ok(h.page.scrollTop > 0);
  assert.equal(h.rows.some(row => row.classList.contains("is-drop-before") || row.classList.contains("is-drop-after")), false);
});

test("ordinary wheel scrolling is left to the browser outside a drag", () => {
  const h = makeHarness();
  vm.runInContext("state.draggingIndex = null", h.context);
  h.listeners.get("wheel")({ clientX: 200, clientY: 200, deltaY: 80, deltaMode: 0, preventDefault() { throw Error("unexpected prevention"); } });
  assert.equal(h.list.scrollTop, 0);
});
