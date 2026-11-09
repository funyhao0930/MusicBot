/* 糖音機 3.0 · Lumen Glass, without React.
   The light, refraction and motion engines below are ported line for line from the Lumen Glass design system
   (components/bundle.js): the glass layer stack, the edge lens, the fingertip light, the knob spring (320 / 24),
   the slower rim spring (110 / 13), stretch and lift. The enhancers at the end dress this page's own controls
   (native buttons, range inputs, checkboxes, the nav) in those layers, so app.js keeps driving the same elements.
   Nothing here runs unless <html data-ui="3">. */
(function () {
  "use strict";

  /* ---------- helpers (bundle.js 8–25) ---------- */
  function clamp(v, a, b) { a = a == null ? 0 : a; b = b == null ? 1 : b; return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function motion(name, fallback) {
    try {
      var v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--" + name));
      return isNaN(v) ? fallback : v;
    } catch (err) { return fallback; }
  }
  var reduceMotion = function () {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  };
  function active() { return document.documentElement && document.documentElement.dataset.ui === "3"; }

  /* ---------- Liquid Glass: edge refraction (bundle.js 296–425) ---------- */
  var SVG_NS = "http://www.w3.org/2000/svg";
  var LENS_EXT = 24;
  var lensSupported = (function () {
    try {
      var ua = navigator.userAgentData;
      var chromium = !!(ua && ua.brands && ua.brands.some(function (b) { return /Chromium/i.test(b.brand); }));
      if (!chromium) return false;
      if (window.matchMedia && matchMedia("(prefers-reduced-transparency: reduce)").matches) return false;
      return CSS.supports("backdrop-filter", "url(#a)");
    } catch (err) { return false; }
  })();
  var lensDefs = null, lensSeq = 0;
  function lensDefsEl() {
    if (lensDefs && lensDefs.isConnected) return lensDefs;
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
    lensDefs = document.createElementNS(SVG_NS, "defs");
    svg.appendChild(lensDefs);
    document.body.appendChild(svg);
    return lensDefs;
  }
  function squircle(x) { return Math.pow(1 - Math.pow(1 - x, 4), 0.25); }
  var LENS_PROFILE = (function () {
    var N = 128, out = [], max = 0, i;
    for (i = 0; i <= N; i++) {
      var x = i / N, d = 0.001, x0 = Math.max(0, x - d), x1 = Math.min(1, x + d);
      var tilt = Math.atan((squircle(x1) - squircle(x0)) / (x1 - x0));
      var bent = Math.asin(Math.sin(tilt) / 1.5);
      var v = Math.tan(tilt - bent);
      out.push(v); if (v > max) max = v;
    }
    return out.map(function (v) { return v / max; });
  })();
  // maps of the same size and radius are identical, so a page full of equal buttons computes one
  var lensMapCache = {};
  function lensMap(w, h, r, bezel) {
    var key = w + "x" + h + "r" + r + "b" + bezel;
    if (lensMapCache[key]) return lensMapCache[key];
    var W = Math.round(w + 2 * LENS_EXT), H = Math.round(h + 2 * LENS_EXT);
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var ctx = c.getContext("2d"), img = ctx.createImageData(W, H), px = img.data;
    var hw = w / 2, hh = h / 2;
    r = Math.min(r, hw, hh);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var dx = x + 0.5 - W / 2, dy = y + 0.5 - H / 2;
      var qx = Math.abs(dx) - hw + r, qy = Math.abs(dy) - hh + r, dist, nx, ny;
      if (qx > 0 && qy > 0) { var L = Math.sqrt(qx * qx + qy * qy); dist = L - r; nx = qx / L; ny = qy / L; }
      else { dist = Math.max(qx, qy) - r; if (qx > qy) { nx = 1; ny = 0; } else { nx = 0; ny = 1; } }
      var depth = -dist, mag = 0;
      if (depth >= 0 && depth < bezel) mag = LENS_PROFILE[Math.min(128, Math.round(depth / bezel * 128))];
      var k = (y * W + x) * 4;
      px[k] = Math.round(128 - (dx < 0 ? -nx : nx) * mag * 127);
      px[k + 1] = Math.round(128 - (dy < 0 ? -ny : ny) * mag * 127);
      px[k + 2] = 128; px[k + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    lensMapCache[key] = { url: c.toDataURL(), W: W, H: H };
    return lensMapCache[key];
  }
  function svgEl(tag, attrs) {
    var e = document.createElementNS(SVG_NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  function attachLens(glass) {
    var lens = glass && glass.querySelector(":scope > .lg-lens");
    if (!lensSupported || !lens || glass._lgLens) return function () {};
    var id = "lg-lens-" + (++lensSeq), filters = [], lastKey = "", raf = 0, buildGen = 0, timers = [];
    function build() {
      raf = 0;
      var w = glass.offsetWidth, hgt = glass.offsetHeight;
      if (!w || !hgt) return;
      var r = parseFloat(getComputedStyle(glass).borderTopLeftRadius) || 0;
      var bezel = Math.min(clamp(r * 0.9 + 8, 12, 30), Math.min(w, hgt) / 2), disp = bezel * 0.75;
      var key = w + "x" + hgt + "r" + r;
      if (key === lastKey) return;
      lastKey = key;
      var map = lensMap(w, hgt, r, bezel);
      var gen = ++buildGen;
      // Chromium caches a filter compiled before its feImage decoded: decode first, then flip between twins
      var pre = new Image();
      pre.src = map.url;
      var ready = pre.decode ? pre.decode().catch(function () {}) : Promise.resolve();
      ready.then(function () {
        if (gen !== buildGen || !glass.isConnected) return;
        var made = ["a", "b"].map(function (suffix) { return lensFilter(id + suffix, map, disp); });
        filters.forEach(function (old) { old.remove(); });
        filters = made;
        made.forEach(function (f) { lensDefsEl().appendChild(f); });
        var flip = 0;
        var point = function () { lens.style.backdropFilter = "url(#" + id + (flip++ % 2 ? "b" : "a") + ")"; };
        point();
        glass.classList.add("lg-lens-on");
        requestAnimationFrame(function () { requestAnimationFrame(point); });
        [250, 900, 2500].forEach(function (ms) { timers.push(setTimeout(function () { if (gen === buildGen) point(); }, ms)); });
      });
    }
    var ro = new ResizeObserver(function () { if (!raf) raf = requestAnimationFrame(build); });
    ro.observe(glass);
    build();
    glass._lgLens = true;
    return function () {
      ro.disconnect(); cancelAnimationFrame(raf); buildGen++;
      timers.forEach(clearTimeout);
      filters.forEach(function (f) { f.remove(); });
      glass.classList.remove("lg-lens-on"); lens.style.backdropFilter = "";
      glass._lgLens = false;
    };
  }
  function lensFilter(fid, map, disp) {
    var f = svgEl("filter", { id: fid, x: 0, y: 0, width: map.W, height: map.H, filterUnits: "userSpaceOnUse", primitiveUnits: "userSpaceOnUse", "color-interpolation-filters": "sRGB" });
    f.appendChild(svgEl("feGaussianBlur", { "in": "SourceGraphic", stdDeviation: 1, result: "soft" }));
    var img = svgEl("feImage", { x: 0, y: 0, width: map.W, height: map.H, preserveAspectRatio: "none", result: "map" });
    img.setAttribute("href", map.url);
    f.appendChild(img);
    var CH = [["R", 1, "1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"],
              ["G", 0.92, "0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"],
              ["B", 0.84, "0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"]];
    CH.forEach(function (c) {
      f.appendChild(svgEl("feDisplacementMap", { "in": "soft", in2: "map", scale: (disp * 2 * c[1]).toFixed(1), xChannelSelector: "R", yChannelSelector: "G", result: "d" + c[0] }));
      f.appendChild(svgEl("feColorMatrix", { "in": "d" + c[0], type: "matrix", values: c[2], result: "c" + c[0] }));
    });
    f.appendChild(svgEl("feBlend", { "in": "cR", in2: "cG", mode: "screen", result: "cRG" }));
    f.appendChild(svgEl("feBlend", { "in": "cRG", in2: "cB", mode: "screen", result: "bent" }));
    f.appendChild(svgEl("feColorMatrix", { "in": "bent", type: "saturate", values: 1.4 }));
    return f;
  }

  /* ---------- Liquid Glass: fingertip light (bundle.js 430–471) ---------- */
  function createTouchLight(glass) {
    var face = glass && glass.querySelector(":scope > .lg-face");
    if (!face) return { start: function () {}, move: function () {}, end: function () {}, destroy: function () {} };
    var spot = document.createElement("span");
    spot.className = "lg-touch";
    face.appendChild(spot);
    var anim = null, on = false;
    function place(e) {
      var r = face.getBoundingClientRect();
      if (!r.width) return;
      spot.style.left = ((e.clientX - r.left) / r.width * 100) + "%";
      spot.style.top = ((e.clientY - r.top) / r.height * 100) + "%";
    }
    function size() {
      var w = face.offsetWidth, hh = face.offsetHeight;
      var s = Math.min(Math.max(w, hh) * 1.7, Math.min(w, hh) * 2.4);
      spot.style.width = spot.style.height = s + "px";
    }
    function play(frames, opts) {
      if (anim) anim.cancel();
      if (typeof spot.animate === "function") anim = spot.animate(frames, Object.assign({ fill: "forwards" }, opts));
    }
    return {
      start: function (e) {
        on = true; size(); place(e);
        glass.classList.add("is-touched");
        play([{ opacity: 0, transform: "translate(-50%,-50%) scale(.15)" }, { opacity: 1, transform: "translate(-50%,-50%) scale(1)" }],
          { duration: reduceMotion() ? 1 : motion("duration-touch-in", 420), easing: "cubic-bezier(.2,.8,.2,1)" });
      },
      move: function (e) { if (on) place(e); },
      end: function () {
        if (!on) return;
        on = false;
        glass.classList.remove("is-touched");
        var cur = getComputedStyle(spot);
        play([{ opacity: cur.opacity, transform: cur.transform }, { opacity: 0, transform: "translate(-50%,-50%) scale(2.2)" }],
          { duration: reduceMotion() ? 1 : motion("duration-touch-out", 520), easing: "cubic-bezier(.3,.6,.3,1)" });
      },
      destroy: function () { if (anim) anim.cancel(); spot.remove(); }
    };
  }
  // presses anywhere on host light up the glass under the finger
  function wireTouch(glass, host) {
    var light = createTouchLight(glass);
    host.addEventListener("pointerdown", function (e) { if (e.button === 0 && !host.disabled) light.start(e); });
    host.addEventListener("pointermove", function (e) { light.move(e); });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (type) { host.addEventListener(type, function () { light.end(); }); });
    return light;
  }

  /* ---------- the ten glass layers (bundle.js 501, 1744) ---------- */
  function layerSpans() {
    var frag = document.createDocumentFragment();
    function add(cls, ring) {
      var s = document.createElement("span"); s.className = cls; s.setAttribute("aria-hidden", "true");
      if (ring) { var r = document.createElement("span"); r.className = "lg-ring"; s.appendChild(r); }
      frag.appendChild(s);
    }
    ["lg-halo", "lg-glow lg-glow-wide", "lg-glow lg-glow-mid", "lg-glow", "lg-lens", "lg-face"].forEach(function (c) { add(c); });
    add("lg-saber lg-saber-haze", true); add("lg-saber lg-saber-bloom", true);
    add("lg-rim lg-rim-outer"); add("lg-rim lg-rim-inner");
    return frag;
  }
  function makeBead(extra) {
    var g = document.createElement("span");
    g.className = "lg-glass lg-bead" + (extra ? " " + extra : "");
    g.setAttribute("aria-hidden", "true");
    g.appendChild(layerSpans());
    return g;
  }

  /* ---------- springs (bundle.js 1447) and the glide engine (bundle.js 916–1036) ---------- */
  function createSpring(onFrame, eps, stiffness, damping) {
    var reduce = reduceMotion(), x = 0, v = 0, target = 0, raf = 0, prev = 0, done = null;
    var K = stiffness || motion("spring-knob-stiffness", 320), C = damping || motion("spring-knob-damping", 24);
    eps = eps || 0.001;
    function frame(now) {
      raf = 0;
      var dt = Math.min(0.032, (now - (prev || now)) / 1000); prev = now;
      if (reduce) { x = target; v = 0; }
      else {
        v += (-(x - target) * K - v * C) * dt;
        x += v * dt;
        if (Math.abs(x - target) < eps && Math.abs(v) < eps * 10) { x = target; v = 0; }
      }
      onFrame(x);
      if (x !== target || v !== 0) raf = requestAnimationFrame(frame);
      else if (done) { var d = done; done = null; d(); }
    }
    return {
      to: function (t, cb, vel) { target = t; done = cb || null; if (vel != null) v = vel; if (!raf) { prev = 0; raf = requestAnimationFrame(frame); } },
      jump: function (t) { cancelAnimationFrame(raf); raf = 0; x = target = t; v = 0; onFrame(x); },
      get: function () { return x; },
      vel: function () { return v; },
      target: function () { return target; },
      stop: function () { cancelAnimationFrame(raf); raf = 0; done = null; }
    };
  }

  /* One position x (px) drives the picture. While held, x chases the finger (rubber-banded past the ends); on release
     the knob spring carries it to where release() decides. Faster means longer glass; held means lifted.
     With rimEl, the light arc rides along counter-clockwise on its own softer spring, half a beat behind.
     Without a host the engine only animates (the nav pill, value-driven sliders); hold() sets the lift. */
  function createGlide(o) {
    var reduce = reduceMotion();
    var x = 0, v = 0, target = 0, travel = 1, finger = 0;
    var pressed = false, dragging = false, moved = false, canDrag = false;
    var startX = 0, startPos = 0, lastT = 0, lastPX = 0, dragV = 0, followV = 0, lastX = 0;
    var stretch = 0, lift = 0, raf = 0, prev = 0;
    var over = o.over == null ? motion("gesture-rubber-band", 0.3) : o.over;
    var K = motion("spring-knob-stiffness", 320), C = motion("spring-knob-damping", 24);
    var RK = motion("spring-rim-stiffness", 110), RC = motion("spring-rim-damping", 13);
    var FLING_PAUSE = motion("gesture-fling-pause", 80), STRETCH = motion("gesture-stretch-max", 0.17), STRETCH_V = motion("gesture-stretch-speed", 2600);
    var rim = o.rimEl ? { x0: 0, base: 200, a: 200, v: 0, last: null } : null;
    var axisOf = typeof o.axis === "function" ? o.axis : function () { return o.axis || "x"; };
    function rubber(p) { return p < 0 ? p * over : p > travel ? travel + (p - travel) * over : p; }
    function wake() { if (!raf) { prev = 0; raf = requestAnimationFrame(frame); } }
    function frame(now) {
      raf = 0;
      var dt = Math.min(0.032, (now - (prev || now)) / 1000); prev = now;
      if (dragging) {
        x += (finger - x) * (reduce ? 1 : 1 - Math.exp(-dt * 45));
      } else if (o.follow === true && pressed) {
        // value-driven (a native range under the finger): track it closely, like a drag
        x += (target - x) * (reduce ? 1 : 1 - Math.exp(-dt * 45));
        if (Math.abs(x - target) < 0.05) x = target;
      } else if (reduce) { x = target; v = 0; }
      else {
        v += (-(x - target) * K - v * C) * dt;
        x += v * dt;
        if (Math.abs(x - target) < 0.05 && Math.abs(v) < 1) { x = target; v = 0; }
      }
      if (dt > 0) followV = lerp(followV, (x - lastX) / dt, 0.5);
      lastX = x;
      var speed = dragging ? Math.abs(dragV) : o.follow === true && pressed ? Math.abs(followV) : Math.abs(v), want = pressed ? 1 : 0;
      stretch = reduce ? 0 : lerp(stretch, clamp(speed / STRETCH_V, 0, STRETCH), 0.25);
      if (stretch < 0.0005) stretch = 0;
      lift = reduce ? want : lerp(lift, want, 0.22);
      if (Math.abs(lift - want) < 0.002) lift = want;
      var rimBusy = rim ? spinRim(dt) : false;
      o.render(x, stretch, lift);
      var settling = o.follow === true && pressed ? x !== target : false;
      if (dragging || settling || x !== target || v !== 0 || stretch > 0 || lift !== want || rimBusy) raf = requestAnimationFrame(frame);
    }
    function spinRim(dt) {
      var unit = Math.max(1, o.rimUnit());
      if (o.rimAim) { rim.base = rim.a; rim.x0 = x; }
      else if (!dragging && !pressed && x === target && v === 0 && x !== rim.x0) {
        rim.base -= 180 * Math.round(Math.abs(x - rim.x0) / unit);
        rim.x0 = x;
        while (rim.base < -360) { rim.base += 360; rim.a += 360; }
      }
      var d = Math.abs(x - rim.x0) / unit, whole = Math.floor(d);
      var aim = o.rimAim ? o.rimAim(x, dragging ? dragV : v) : rim.base - 180 * (whole + easeInOut(d - whole));
      if (reduce) { rim.a = aim; rim.v = 0; }
      else {
        rim.v += ((aim - rim.a) * RK - rim.v * RC) * dt;
        rim.a += rim.v * dt;
        if (Math.abs(aim - rim.a) < 0.01 && Math.abs(rim.v) < 0.05) { rim.a = aim; rim.v = 0; }
      }
      if (rim.a !== rim.last) { o.rimEl.style.setProperty("--lg-angle", rim.a.toFixed(2) + "deg"); rim.last = rim.a; }
      return rim.a !== aim || rim.v !== 0;
    }
    function pos(e) { return axisOf() === "y" ? e.clientY : e.clientX; }
    function down(e) {
      if (e.button !== 0 || o.disabled()) return;
      try { o.host.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
      pressed = true; moved = false; dragging = false;
      startX = pos(e); lastT = e.timeStamp; lastPX = pos(e); dragV = 0;
      var g = o.grab ? o.grab(e) : null;
      canDrag = g != null; startPos = canDrag ? g : x; finger = startPos;
      if (o.press) o.press(e, canDrag);
      wake();
    }
    function move(e) {
      if (!pressed) return;
      if (o.followTouch) o.followTouch(e);
      var dx = pos(e) - startX;
      if (!moved && Math.abs(dx) > 3) {
        moved = true;
        if (canDrag) { dragging = true; o.host.classList.add("is-dragging"); }
      }
      if (!dragging) return;
      var dt = Math.max(1, e.timeStamp - lastT);
      dragV = lerp(dragV, (pos(e) - lastPX) / dt * 1000, 0.5);
      lastT = e.timeStamp; lastPX = pos(e);
      finger = rubber(startPos + dx);
      if (o.drag) o.drag(finger);
      wake();
    }
    function up(e) {
      if (!pressed) return;
      pressed = false;
      if (o.letGo) o.letGo();
      if (dragging) {
        dragging = false; o.host.classList.remove("is-dragging");
        if (e.timeStamp - lastT > FLING_PAUSE) dragV = 0;
        v = dragV;
        target = o.release(finger, dragV, true);
      } else if (e.type === "pointerup" && !moved) {
        var t = o.tap ? o.tap(e) : null;
        if (t != null) target = t;
      }
      wake();
    }
    if (o.host) {
      o.host.addEventListener("pointerdown", down);
      o.host.addEventListener("pointermove", move);
      o.host.addEventListener("pointerup", up);
      o.host.addEventListener("pointercancel", up);
    }
    return {
      set: function (t, animate) { target = t; if (animate === false || reduce) { x = t; v = 0; lastX = t; } wake(); },
      setTravel: function (t) { travel = Math.max(1, t); },
      rimReset: function (angle) {
        if (!rim) return;
        rim.base = rim.a = angle; rim.v = 0; rim.x0 = x; rim.last = null; wake();
      },
      hold: function (on) { pressed = !!on; wake(); },
      x: function () { return x; },
      target: function () { return target; },
      dragging: function () { return dragging; },
      moved: function () { return moved; }
    };
  }
  function scaleGlass(g, stretch, lift, liftBy, axis) {
    var k = 1 + liftBy * lift;
    var along = ((1 + stretch) * k).toFixed(4), across = ((1 - stretch * 0.45) * k).toFixed(4);
    g.style.transform = axis === "y" ? "scale(" + across + "," + along + ")" : "scale(" + along + "," + across + ")";
    g.style.setProperty("--lift", lift.toFixed(3));
  }
  function observeSize(el, fn) {
    if (typeof ResizeObserver === "function") new ResizeObserver(fn).observe(el);
    else window.addEventListener("resize", fn);
  }

  /* ---------- GlassButton: glass by default, lit for the one main action (bundle.js 516) ---------- */
  function button(el, opts) {
    if (!active() || !el || el.dataset.lg) return;
    opts = opts || {};
    el.dataset.lg = "button";
    el.classList.add("lg-glass", "lg-even", "lg-btn", opts.lit ? "lg-btn-lit" : "lg-btn-glass");
    if (el.classList.contains("small")) el.classList.add("lg-btn-sm");
    var label = document.createElement("span");
    label.className = "lg-btn-label";
    while (el.firstChild) label.appendChild(el.firstChild);
    el.appendChild(layerSpans());
    el.appendChild(label);
    wireTouch(el, el);
    // the lit button refracts from the start; the many glass ones build their lens the first time a pointer comes near
    if (opts.lit) attachLens(el);
    else el.addEventListener("pointerenter", function () { attachLens(el); }, { once: true });
  }

  /* ---------- GlassSlider look for a native range (bundle.js 1147) ----------
     The native input stays on top, transparent: it still owns dragging, clicking the track and the keyboard, and
     app.js keeps reading it. Underneath sit the sunken groove, the light-saber fill and the glass bead, which
     lifts 22% and lights its whole rim while held, stretches with speed, and springs to values that jump. */
  function range(input, opts) {
    if (!active() || !input || input.dataset.lg) return null;
    opts = opts || {};
    input.dataset.lg = "range";
    var host = opts.host || input.parentElement;
    var visual = document.createElement("span");
    visual.className = "lg-slider lg-range-visual" + (opts.className ? " " + opts.className : "");
    visual.setAttribute("aria-hidden", "true");
    var track = document.createElement("span"); track.className = "lg-slider-track";
    var fill = document.createElement("span"); fill.className = "lg-slider-fill";
    track.appendChild(fill);
    var thumb = document.createElement("span"); thumb.className = "lg-slider-thumb";
    var glass = makeBead("lg-even");
    thumb.appendChild(glass); visual.appendChild(track); visual.appendChild(thumb);
    host.insertBefore(visual, input);
    host.classList.add("lg-range-host");
    var travel = 1, tw = 0;
    function fraction() {
      var mn = +input.min || 0, mx = input.max === "" ? 100 : +input.max;
      return mx === mn ? 0 : clamp((+input.value - mn) / (mx - mn));
    }
    var glide = createGlide({
      follow: true,
      render: function (x, stretch, lift) {
        thumb.style.transform = "translateX(" + x.toFixed(2) + "px)";
        scaleGlass(glass, stretch, lift, 0.22);
        fill.style.width = (clamp(x, 0, travel) + tw / 2).toFixed(2) + "px";
      }
    });
    function measure() {
      tw = thumb.offsetWidth;
      travel = Math.max(1, visual.clientWidth - tw);
      glide.setTravel(travel);
      glide.set(fraction() * travel, false);
    }
    var light = createTouchLight(glass);
    input.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || input.disabled) return;
      glide.hold(true);
      requestAnimationFrame(function () { glide.set(fraction() * travel); light.start(e); });
    });
    input.addEventListener("pointermove", function (e) { light.move(e); });
    function release() { glide.hold(false); light.end(); }
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (t) { input.addEventListener(t, release); });
    input.addEventListener("input", function () { glide.set(fraction() * travel); });
    observeSize(visual, measure);
    measure();
    attachLens(glass);
    var api = {
      sync: function (animate) { glide.set(fraction() * travel, animate); },
      disabled: function (off) { visual.classList.toggle("is-disabled", !!off); }
    };
    input._lgRange = api;
    return api;
  }
  function syncRange(input) { if (input && input._lgRange) input._lgRange.sync(); }

  /* ---------- Switch around a native checkbox (bundle.js 1048) ----------
     The checkbox stays on top, transparent, as the accessible control and the value app.js reads. The bead can be
     held and dragged: past 3px it follows the finger, and on release "position + speed x 0.12s" picks the side. */
  function switchify(input, opts) {
    if (!active() || !input || input.dataset.lg) return null;
    opts = opts || {};
    input.dataset.lg = "switch";
    input.setAttribute("role", "switch");
    var host = document.createElement("span");
    host.className = "lg-switch lg-switch-host" + (opts.size === "sm" ? " lg-switch-sm" : "") + (opts.className ? " " + opts.className : "");
    var fill = document.createElement("span"); fill.className = "lg-switch-fill"; fill.setAttribute("aria-hidden", "true");
    var thumb = document.createElement("span"); thumb.className = "lg-switch-thumb"; thumb.setAttribute("aria-hidden", "true");
    var glass = makeBead();
    if (opts.icon) glass.querySelector(":scope > .lg-face").after(opts.icon);
    thumb.appendChild(glass); host.appendChild(fill); host.appendChild(thumb);
    input.parentNode.insertBefore(host, input);
    host.appendChild(input);
    var travel = 1, pending = null, settleTimer = 0;
    var touch = createTouchLight(glass);
    function isOn() { return opts.read ? opts.read() : input.checked; }
    function commit(next) {
      pending = null;
      if (opts.write) opts.write(next);
      else if (input.checked !== next) {
        input.checked = next;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }
      glide.set(isOn() ? travel : 0);
    }
    function decide(next) {
      // the click that follows the gesture commits it; a cancelled gesture commits on its own
      pending = next;
      clearTimeout(settleTimer);
      settleTimer = setTimeout(function () { if (pending !== null) commit(pending); }, 60);
      return next ? travel : 0;
    }
    var glide = createGlide({
      host: input, rimEl: glass, rimUnit: function () { return travel; },
      disabled: function () { return input.disabled; },
      grab: function () { return glide.x(); },
      tap: function () { return decide(!(glide.target() > 0)); },
      release: function (x, v) { return decide(x + v * 0.12 > travel / 2); },
      press: function (e) { touch.start(e); },
      followTouch: touch.move,
      letGo: touch.end,
      render: function (x, stretch, lift) {
        host.style.setProperty("--p", clamp(x / travel).toFixed(4));
        thumb.style.transform = "translateX(" + x.toFixed(2) + "px)";
        scaleGlass(glass, stretch, lift, 0.14);
      }
    });
    input.addEventListener("click", function (e) {
      e.preventDefault();
      var next = pending !== null ? pending : !isOn();   // keyboard (space) arrives here without a gesture
      clearTimeout(settleTimer);
      setTimeout(function () { commit(next); }, 0);
    });
    input.addEventListener("keydown", function (e) {
      var on = isOn();
      if ((e.key === "ArrowRight" && !on) || (e.key === "ArrowLeft" && on)) { e.preventDefault(); commit(!on); }
    });
    input.addEventListener("change", function () { if (!glide.dragging()) glide.set(isOn() ? travel : 0); });
    function measure() {
      travel = Math.max(1, host.clientWidth - 2 * thumb.offsetLeft - thumb.offsetWidth);
      glide.setTravel(travel);
      glide.set(isOn() ? travel : 0, false);
      glide.rimReset(isOn() ? 20 : 200);
    }
    observeSize(host, measure);
    measure();
    attachLens(glass);
    var api = { sync: function () { if (!glide.dragging()) glide.set(isOn() ? travel : 0); } };
    input._lgSwitch = api;
    return api;
  }

  /* ---------- a glass pill that glides between options (SegmentedControl / TabBar, bundle.js 1262–1370) ----------
     The pill is pure motion: the buttons keep their own clicks. Three or more options use the dial (leftmost
     bottom-left, rightmost top-right, the middle ones straight down); two options follow the switch rule. */
  /* Vertical options: the light rests on the left edge (270deg). While the glass slides it swings against the
     direction of travel, up to 40deg, on the rim spring, then settles back with a small overshoot. */
  var SIDE_ANGLE = 270, SIDE_SWING = 0.03, SIDE_MAX = 40;
  function sideAngle(vel) { return SIDE_ANGLE + clamp((vel || 0) * SIDE_SWING, -SIDE_MAX, SIDE_MAX); }
  function dialAngle(u, n) {
    if (u <= 1) return 200 - 20 * u;
    if (u >= n - 2) return 180 - 160 * (u - (n - 2));
    return 180;
  }
  function pill(container, opts) {
    if (!active() || !container || container.dataset.lg) return null;
    container.dataset.lg = "pill";
    container.classList.add("lg-pill-track");
    var axisOf = typeof opts.axis === "function" ? opts.axis : function () { return opts.axis || "x"; };
    var p = document.createElement("span");
    p.className = "lg-pill" + (opts.className ? " " + opts.className : "");
    p.setAttribute("aria-hidden", "true");
    var glass = makeBead(opts.even ? "lg-even" : "");
    p.appendChild(glass);
    container.insertBefore(p, container.firstChild);
    /* Vertical options carry their light as a bar beside the chosen one, | [option]: a short light-saber that follows
       the glass on the softer rim spring (110 / 13), so it trails half a beat, overshoots a little, and stretches
       with its speed. The glass itself stays quiet. */
    var bar = null, barSpring = null, barBase = 22;
    function barOn() { return typeof opts.bar === "function" ? opts.bar() : !!opts.bar; }
    if (opts.bar) {
      bar = document.createElement("span");
      bar.className = "lg-seg-bar";
      bar.setAttribute("aria-hidden", "true");
      container.insertBefore(bar, p);
      barSpring = createSpring(function (y) {
        var len = barBase * (1 + clamp(Math.abs(barSpring ? barSpring.vel() : 0) / 1800, 0, 0.9));
        bar.style.setProperty("--lg-bar-h", len.toFixed(2) + "px");
        bar.style.transform = "translateY(" + y.toFixed(2) + "px)";
      }, 0.05, motion("spring-rim-stiffness", 110), motion("spring-rim-damping", 13));
    }
    var unit = 1, index = 0, barTop = 0, barSpan = 0;
    function rimMode() { return typeof opts.rim === "function" ? opts.rim() : opts.rim; }
    function items() { return Array.prototype.filter.call(container.querySelectorAll(opts.items), function (n) { return n.offsetParent !== null || n === document.activeElement; }); }
    function activeIndex() { var list = items(); var i = list.findIndex(function (n) { return n.matches(opts.active); }); return Math.max(0, i); }
    function offsetOf(node) { return axisOf() === "y" ? node.offsetTop : node.offsetLeft; }
    var glide = createGlide({
      rimEl: opts.rim === false ? null : glass,
      rimUnit: function () { return unit; },
      rimAim: opts.rim === "dial" || opts.rim === "side" || typeof opts.rim === "function" ? function (x, vel) {
        if (rimMode() === "side") return sideAngle(vel);
        return dialAngle(x / unit, Math.max(1, items().length));
      } : null,
      render: function (x, stretch, lift) {
        var ax = axisOf();
        p.style.transform = ax === "y" ? "translateY(" + x.toFixed(2) + "px)" : "translateX(" + x.toFixed(2) + "px)";
        scaleGlass(glass, stretch, lift, opts.lift == null ? 0.05 : opts.lift, ax);
        if (bar && barOn() && ax === "y") barSpring.to(barTop + x + barSpan / 2);
      }
    });
    function place(animate) {
      var list = items();
      if (!list.length) { p.style.opacity = "0"; return; }
      p.style.opacity = "";
      var first = list[0], node = list[activeIndex()];
      unit = list.length > 1 ? Math.abs(offsetOf(list[1]) - offsetOf(first)) || 1 : 1;
      var ax = axisOf();
      p.style.left = (ax === "y" ? node.offsetLeft : first.offsetLeft) + "px";
      p.style.top = (ax === "y" ? first.offsetTop : node.offsetTop) + "px";
      p.style.width = node.offsetWidth + "px";
      p.style.height = node.offsetHeight + "px";
      glide.setTravel(unit * Math.max(1, list.length - 1));
      var to = offsetOf(node) - offsetOf(first);
      glide.set(to, animate);
      if (bar) {
        var showBar = barOn() && ax === "y";
        bar.hidden = !showBar;
        container.classList.toggle("has-seg-bar", showBar);
        if (showBar) {
          barTop = first.offsetTop; barSpan = node.offsetHeight;
          bar.style.left = node.offsetLeft + "px";
          if (animate === false) barSpring.jump(barTop + to + barSpan / 2);
          else barSpring.to(barTop + to + barSpan / 2);
        }
      }
      if (animate === false) {
        index = activeIndex();
        var n = list.length;
        var mode = rimMode();
        glide.rimReset(mode === "side" ? SIDE_ANGLE : mode === "dial" ? dialAngle(index, n) : index % 2 ? 20 : 200);
      }
    }
    // pressing the chosen option lifts the glass and lights it under the finger
    var touch = createTouchLight(glass);
    container.addEventListener("pointerdown", function (e) {
      if (e.button !== 0) return;
      var hit = e.target.closest && e.target.closest(opts.items);
      if (!hit) return;
      glide.hold(true);
      if (hit.matches(opts.active)) touch.start(e);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (t) { container.addEventListener(t, function () { glide.hold(false); touch.end(); }); });
    observeSize(container, function () { place(false); });
    place(false);
    attachLens(glass);
    var api = { sync: function () { place(true); } };
    container._lgPill = api;
    return api;
  }
  function syncPill(container) { if (container && container._lgPill) container._lgPill.sync(); }

  /* ---------- TextField light: the edge lights counter-clockwise from the light's corner on focus ---------- */
  function field(box) {
    if (!active() || !box || box.dataset.lg) return;
    box.dataset.lg = "field";
    box.classList.add("lg-glass", "lg-field-box");
    var frag = document.createDocumentFragment();
    var outer = document.createElement("span"); outer.className = "lg-rim lg-rim-outer"; outer.setAttribute("aria-hidden", "true");
    var bloom = document.createElement("span"); bloom.className = "lg-saber lg-saber-bloom"; bloom.setAttribute("aria-hidden", "true");
    var ring = document.createElement("span"); ring.className = "lg-ring"; bloom.appendChild(ring);
    frag.appendChild(outer); frag.appendChild(bloom);
    box.insertBefore(frag, box.firstChild);
  }
  // a bare input gets a box of its own to draw the light around
  function fieldAround(input) {
    if (!active() || !input || input.dataset.lg || !input.parentNode) return;
    input.dataset.lg = "input";
    var box = document.createElement("span");
    box.className = "lg-field-wrap";
    input.parentNode.insertBefore(box, input);
    box.appendChild(input);
    field(box);
  }

  /* ---------- Toast: a glass capsule blown up from a small pill (bundle.js 1730–1846) ----------
     opts: { error, meme, spinner, duration }. Returns dismiss(). */
  var toastHost = null, toastList = [];
  function restackToasts() {
    toastList.forEach(function (t, i) {
      var depth = toastList.length - 1 - i;
      t.slot.style.transform = "translateY(" + (depth * 10) + "px) scale(" + (1 - depth * 0.05) + ")";
      t.slot.style.opacity = depth > 2 ? "0" : String(1 - depth * 0.22);
      t.slot.style.zIndex = String(10 - depth);
      t.slot.style.pointerEvents = depth === 0 ? "auto" : "none";
    });
  }
  function toast(message, opts) {
    opts = opts || {};
    if (!toastHost || !toastHost.isConnected) {
      toastHost = document.createElement("div");
      toastHost.className = "lg-toast-host";
      toastHost.setAttribute("role", "status");
      toastHost.setAttribute("aria-live", "polite");
      document.body.appendChild(toastHost);
    }
    var slot = document.createElement("div"); slot.className = "lg-toast-slot";
    var glass = document.createElement("div"); glass.className = "lg-glass lg-even lg-float lg-toast" + (opts.error ? " is-error" : "");
    glass.appendChild(layerSpans());
    var body = document.createElement("div"); body.className = "lg-toast-body";
    if (opts.spinner) { var sp0 = document.createElement("span"); sp0.className = "toast-spinner"; sp0.setAttribute("aria-hidden", "true"); body.appendChild(sp0); }
    if (opts.meme) { var im = document.createElement("img"); im.className = "lg-toast-meme"; im.src = "/assets/meme-" + opts.meme + ".webp"; im.alt = ""; body.appendChild(im); }
    var text = document.createElement("span"); text.className = "lg-toast-text"; text.textContent = message; body.appendChild(text);
    glass.appendChild(body); slot.appendChild(glass); toastHost.appendChild(slot);
    var entry = { slot: slot, gone: false };
    var detachLens = attachLens(glass);
    entry.kill = function () { entry.gone = true; clearTimeout(timer); sp.stop(); dsp.stop(); detachLens(); slot.remove(); };
    var p = 0, dy = 0;
    function paint() {
      var sx = lerp(0.42, 1, p), sy = lerp(0.72, 1, p);
      glass.style.transform = "translateY(" + (lerp(-24, 0, p) + dy).toFixed(2) + "px) scale(" + sx.toFixed(4) + "," + sy.toFixed(4) + ")";
      glass.style.opacity = clamp(p * 2.5).toFixed(3);
      glass.style.setProperty("--lg-sheet-content", clamp((p - 0.45) / 0.45).toFixed(3));
    }
    var sp = createSpring(function (v) { p = v; paint(); });
    var dsp = createSpring(function (v) { dy = v; paint(); }, 0.05);
    var ms = opts.duration == null ? 4000 : opts.duration, timer = 0, left = ms, started = 0;
    function arm() { if (isFinite(left)) { started = Date.now(); timer = setTimeout(dismiss, left); } }
    function pause() { clearTimeout(timer); if (started) left -= Date.now() - started; started = 0; }
    function dismiss() {
      if (entry.gone) return;
      entry.gone = true; clearTimeout(timer);
      sp.to(0, function () {
        detachLens(); slot.remove();
        toastList = toastList.filter(function (t) { return t !== entry; });
        restackToasts();
      });
    }
    // swipe up to dismiss
    var drag = null;
    glass.addEventListener("pointerdown", function (e) {
      if (e.button !== 0 || (e.target.closest && e.target.closest("button"))) return;
      pause();
      drag = { y: e.clientY, t: e.timeStamp, v: 0, id: e.pointerId };
      try { glass.setPointerCapture(e.pointerId); } catch (err) { /* synthetic */ }
    });
    glass.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dt = Math.max(1, e.timeStamp - drag.t);
      drag.v = lerp(drag.v, (e.clientY - (drag.last || drag.y)) / dt * 1000, 0.5);
      drag.last = e.clientY; drag.t = e.timeStamp;
      var d = e.clientY - drag.y;
      dy = d > 0 ? d * motion("gesture-rubber-band", 0.3) : d;
      paint();
    });
    function up(e) {
      if (!drag) return;
      var v = e.timeStamp - drag.t > motion("gesture-fling-pause", 80) ? 0 : drag.v;
      drag = null;
      if (dy + v * 0.12 < -28) { dsp.to(-120, null, v); dismiss(); }
      else { dsp.to(0, null, v); arm(); }
    }
    glass.addEventListener("pointerup", up);
    glass.addEventListener("pointercancel", up);
    glass.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") pause(); });
    glass.addEventListener("pointerleave", function (e) { if (e.pointerType === "mouse" && !drag && !entry.gone) arm(); });
    toastList.push(entry);
    while (toastList.length > 4) toastList.shift().kill();
    restackToasts();
    paint();
    sp.to(1);
    arm();
    return dismiss;
  }

  /* ---------- a floating glass layer (the player bar, the phone tab bar and drawer): inner rim and shadow only ---------- */
  function float(el, opts) {
    if (!active() || !el || el.dataset.lgFloat) return;
    el.dataset.lgFloat = "1";
    el.classList.add("lg-glass", "lg-even", "lg-float");
    el.insertBefore(layerSpans(), el.firstChild);
    if (opts && opts.lens) attachLens(el);
  }

  window.LumenLite = {
    active: active,
    button: button,
    range: range,
    syncRange: syncRange,
    switchify: switchify,
    pill: pill,
    syncPill: syncPill,
    field: field,
    fieldAround: fieldAround,
    float: float,
    toast: toast,
    createSpring: createSpring,
    attachLens: attachLens,
    createTouchLight: createTouchLight,
    makeBead: makeBead,
    layerSpans: layerSpans,
    reduceMotion: reduceMotion
  };
})();
