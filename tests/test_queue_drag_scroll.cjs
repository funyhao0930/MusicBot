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
      add: (...added) => added.forEach(name => names.add(name)),
      remove: (...removed) => removed.forEach(name => names.delete(name)),
      contains: name => names.has(name),
    };
  };
  let nextFrame = 0;
  let listTop = 0;
  let pageTop = 0;
  const rows = Array.from({ length: 10 }, (_unused, index) => {
    const style = new Map();
    const row = {
      classList: classes(),
      style: { setProperty: (name, value) => style.set(name, value), removeProperty: name => style.delete(name), get: name => style.get(name) },
      getBoundingClientRect: () => ({ top: 100 + index * 40 - listTop + (parseFloat(style.get("--drag-y")) || 0), height: 40 }),
    };
    return row;
  });
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
    setTimeout,
    window: { innerHeight: 600 },
    requestAnimationFrame(callback) { const id = ++nextFrame; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  vm.runInContext(appSource, context);
  vm.runInContext("setupQueueDragScroll(); reorderQueue = (source, target) => { globalThis.move = [source, target]; }; renderQueue = () => {};", context);
  return {
    context, list, page, rows, listeners, listListeners,
    frame() { const [id, callback] = frames.entries().next().value; frames.delete(id); callback(); },
    grab(index = 0, clientY = 120) {
      context.grabbed = { button: 0, pointerId: 7, clientX: 200, clientY, preventDefault() {}, currentTarget: { setPointerCapture() {} } };
      context.grabbedRow = rows[index];
      vm.runInContext(`startQueueDrag(grabbed, grabbedRow, ${index})`, context);
    },
    move(clientY, clientX = 200) { listeners.get("pointermove")({ pointerId: 7, clientX, clientY }); },
    release() { listeners.get("pointerup")({ pointerId: 7 }); },
  };
}

test("holding a dragged song at the queue edge scrolls and updates the drop slot", () => {
  const h = makeHarness();
  const before = vm.runInContext("queueDropSlot(document.querySelector('#queue-list'), 290)", h.context);
  h.grab();
  h.move(290);
  for (let count = 0; count < 5; count++) h.frame();
  const after = vm.runInContext("queueDropSlot(document.querySelector('#queue-list'), 290)", h.context);
  assert.ok(h.list.scrollTop > 0);
  assert.ok(after > before);
  assert.ok(h.rows.some(row => row.classList.contains("is-drop-before") || row.classList.contains("is-drop-after")));
  h.release();
  assert.deepEqual(Array.from(h.context.move), [0, after - 1]);
  assert.equal(vm.runInContext("state.draggingIndex", h.context), null);
});

test("the lifted row follows the pointer by where it was grabbed", () => {
  const h = makeHarness();
  h.grab(0, 110);
  h.move(190);
  assert.equal(h.rows[0].style.get("--drag-y"), "80px");
  assert.ok(h.rows[0].classList.contains("is-dragging"));
  // the lifted row is measured at its own slot, not under the pointer it follows
  h.release();
  assert.deepEqual(Array.from(h.context.move), [0, 1]);
});

test("escape or a drop outside the queue leaves the order alone", () => {
  const h = makeHarness();
  h.grab();
  // the landing line stays visible even over the lifted row's own slot
  h.move(125);
  assert.ok(h.rows[1].classList.contains("is-drop-before"));
  h.move(200);
  h.listeners.get("keydown")({ key: "Escape", preventDefault() {} });
  assert.equal(h.context.move, undefined);
  assert.equal(h.rows[0].classList.contains("is-dragging"), false);
  h.grab();
  h.move(200, 40);
  h.release();
  assert.equal(h.context.move, undefined);
});

test("wheel scroll works during drag and falls back to page scrolling", () => {
  const h = makeHarness();
  h.grab();
  let prevented = false;
  h.listeners.get("wheel")({ clientX: 200, clientY: 200, deltaY: 3, deltaMode: 1, preventDefault() { prevented = true; } });
  assert.equal(h.list.scrollTop, 48);
  assert.equal(prevented, true);
  h.move(590);
  h.frame();
  assert.ok(h.page.scrollTop > 0);
  assert.equal(h.rows.some(row => row.classList.contains("is-drop-before") || row.classList.contains("is-drop-after")), false);
});

test("ordinary wheel scrolling is left to the browser outside a drag", () => {
  const h = makeHarness();
  h.listeners.get("wheel")({ clientX: 200, clientY: 200, deltaY: 80, deltaMode: 0, preventDefault() { throw Error("unexpected prevention"); } });
  assert.equal(h.list.scrollTop, 0);
});
