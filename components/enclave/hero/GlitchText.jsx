"use client";

import { useEffect, useRef, useState } from "react";

// Signal lock: entrance / re-lock, 12 frames (0.5s)
const LOCK = [
  { dx: -3, op: 0.8, red: [[70, 14, -10]] },
  { dx: 4, op: 0.9, cyan: [[20, 66, 10]], tear: [[22, 64, 8]] },
  { dx: -6, skew: 5, op: 0.65, red: [[0, 0, -10]], cyan: [[0, 0, 10]] },
  { dx: 0, op: 1 },
  { dx: 2, op: 0.75, red: [[30, 50, 16]], cyan: [[58, 20, -14]], tear: [[56, 26, -16]] },
  { dx: -4, op: 0.85, red: [[18, 62, -14]], cyan: [[55, 25, 12]] },
  { dx: 3, skew: -6, op: 0.7, red: [[40, 38, 18], [78, 8, -8]], cyan: [[8, 72, -10]], tear: [[44, 40, 14]] },
  { dx: 0, op: 1 },
  { dx: -2, op: 0.9, red: [[0, 0, -6]], cyan: [[0, 0, 6]] },
  { dx: 5, skew: 3, op: 0.8, red: [[62, 20, -16]], cyan: [[30, 52, 14], [85, 5, -6]], tear: [[64, 22, -12]] },
  { dx: -1, op: 1, red: [[46, 46, 6]] },
  { dx: 0, op: 1, cyan: [[78, 10, -5]] },
];

const DROP = [
  { dx: 4, op: 0.9, red: [[0, 0, -6]], cyan: [[0, 0, 6]] },
  { dx: -5, op: 0.85, tear: [[40, 34, 14]], red: [[60, 20, -12]] },
  { dx: 0, op: 1 },
  { dx: 6, skew: -4, op: 0.8, red: [[0, 0, -10]], cyan: [[0, 0, 10]], tear: [[20, 60, -18]] },
  { dx: -8, op: 0.7, tear: [[42, 30, 24], [74, 4, -12]], cyan: [[10, 70, 16]] },
  { dx: 2, op: 0.4, glow: 0.4 },
  { dx: -10, skew: 6, op: 0.75, red: [[0, 0, -14]], cyan: [[0, 0, 14]], tear: [[0, 62, -20], [44, 28, 30]] },
  { dx: 12, op: 0.6, tear: [[30, 46, -34]], red: [[56, 22, 22]], cyan: [[18, 66, -24]] },
  { dx: -6, op: 0.5, glow: 0.5, red: [[0, 0, -18]], cyan: [[0, 0, 18]], tear: [[50, 20, 40]] },
  { dx: 14, skew: -8, op: 0.45, tear: [[10, 70, -44], [62, 14, 36]], cyan: [[40, 40, 28]] },
  { dx: -4, op: 0.3, glow: 0.3, red: [[0, 0, -24]], cyan: [[0, 0, 24]] },
  { dx: 18, op: 0.22, glow: 0.2, tear: [[36, 40, -60]], red: [[44, 40, 40]] },
];

const BURST = [
  { dx: 6, op: 0.55, glow: 0.6, red: [[0, 0, -9]], cyan: [[0, 0, 9]] },
  { dx: -5, dy: 2, skew: -5, op: 0.85, red: [[22, 58, -20]], cyan: [[60, 18, 16]], tear: [[24, 60, -18]] },
  { dx: 2, op: 0.35, glow: 0.4 },
  { dx: -3, op: 0.9, red: [[70, 12, 12], [30, 60, -8]], cyan: [[0, 0, 5]] },
  { dx: 4, skew: 2, cyan: [[44, 40, -14]], tear: [[46, 42, 10]] },
  { dx: 0 },
  { dx: -7, dy: 1, op: 0.6, red: [[0, 0, 10]], cyan: [[0, 0, -10]], tear: [[66, 18, 20]] },
  { dx: 3, skew: -4, op: 0.8, red: [[10, 72, 14]], cyan: [[52, 30, -12]] },
  { dx: 0, op: 0.45, glow: 0.5 },
  { dx: -2, op: 0.95, red: [[80, 6, -9]], tear: [[34, 52, -10]] },
  { dx: 1, cyan: [[26, 62, 6]] },
];

const FL1 = [{ red: [[14, 78, -6]] }, { red: [[16, 76, 4]] }, {}, { red: [[60, 30, -5]] }];
const FL2 = [
  { red: [[38, 54, 6]], cyan: [[52, 40, -5]] },
  {},
  { red: [[40, 52, -7]], cyan: [[50, 42, 6]] },
  { cyan: [[12, 80, 4]] },
];
const FL3 = [{ cyan: [[64, 24, 7]] }, { cyan: [[66, 22, -6]], red: [[30, 60, 4]] }, { cyan: [[40, 50, 5]] }];
const FL4 = [{ red: [[80, 6, -8]] }, { red: [[76, 10, 6]], cyan: [[20, 70, -4]] }, { red: [[82, 4, -5]] }];
const FL5 = [{ cyan: [[20, 70, 6]] }, {}, { cyan: [[24, 66, -7]] }, { red: [[66, 22, 5]] }];

const IDLE_FLICKERS = [
  [0.5, FL1],
  [1.7, FL2],
  [3.5, FL3],
  [5.0, FL4],
];
const IDLE_JITTERS = [
  [1.15, 0.08, 5, 0],
  [2.3, 0.07, -4, 2],
  [4.4, 0.08, 0, -5],
];
const IDLE_BURST_AT = 2.9;
const IDLE_LOOP = 5.5;

const TEXT_COLOR = "#ff5524";
const BLOOM_COLOR = "#ff3a12";
const RED = "#FF3B2F";
const CYAN = "#7FD4FF";
const INK = "#070605";
const FONT = 'var(--font-pillar), var(--font-six-caps), "Six Caps", Impact, sans-serif';

const TEAR_POOL = 6;
const GHOST_POOL = 3;

function seq(frames, dt) {
  if (dt < 0) return null;
  const i = Math.floor(dt * 24);
  if (i >= frames.length) return null;
  return frames[i];
}

function apply(s, f) {
  if (!f) return s;
  s.dx += f.dx || 0;
  s.dy += f.dy || 0;
  s.skew = f.skew || 0;
  s.op *= f.op ?? 1;
  s.glow *= f.glow ?? 1;
  s.red = f.red ?? null;
  s.cyan = f.cyan ?? null;
  s.tear = f.tear ?? null;
  return s;
}

function cleanState() {
  return { dx: 0, dy: 0, skew: 0, op: 1, glow: 1, red: null, cyan: null, tear: null };
}

function hash01(n, salt = 0) {
  let x = Math.imul(n ^ 0x9e3779b9 ^ Math.imul(salt, 0x85ebca6b), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function easeOutCubic(t) {
  const u = Math.min(1, Math.max(0, t));
  return 1 - (1 - u) ** 3;
}

function glowShadow(F, g) {
  const a = (c, m) => `rgba(${c},${Math.max(0, Math.min(1, m * g))})`;
  return [
    `0 0 ${0.003 * F}px ${a("255,120,70", 0.9)}`,
    `0 0 ${0.01 * F}px ${a("255,90,44", 0.9)}`,
    `0 0 ${0.028 * F}px ${a("255,58,22", 0.8)}`,
    `0 0 ${0.07 * F}px ${a("255,40,10", 0.7)}`,
    `0 0 ${0.16 * F}px ${a("235,28,6", 0.45)}`,
    `0 0 ${0.32 * F}px ${a("200,24,4", 0.2)}`,
  ].join(", ");
}

function tearBands(tear) {
  if (!tear?.length) return [{ top: 0, bottom: 100, dx: 0 }];
  const intervals = tear
    .map(([a, b, dx]) => ({ top: a, bottom: 100 - b, dx }))
    .filter((b) => b.bottom > b.top)
    .sort((p, q) => p.top - q.top);
  const out = [];
  let cursor = 0;
  for (const band of intervals) {
    if (band.top > cursor) out.push({ top: cursor, bottom: band.top, dx: 0 });
    out.push(band);
    cursor = Math.max(cursor, band.bottom);
  }
  if (cursor < 100) out.push({ top: cursor, bottom: 100, dx: 0 });
  return out.length ? out : [{ top: 0, bottom: 100, dx: 0 }];
}

function clipFor(top, bottom) {
  return `inset(${top}% -14% ${100 - bottom}% -14%)`;
}

function computeState(mode, elapsed, relockAt, cutIn) {
  const s = cleanState();
  let flash = 0;
  let scale = 1;

  if (cutIn) {
    const t = Math.min(1, elapsed / 0.45);
    const k = 1 - easeOutCubic(t);
    scale = 1 + 0.12 * k;
    s.glow *= 1 + 0.9 * k;
    const frame = Math.floor(elapsed * 24);
    if (frame < 5) {
      s.dx += (hash01(frame, 1) * 2 - 1) * 22 * k;
      s.dy += (hash01(frame, 2) * 2 - 1) * 9 * k;
      s.red = [[0, 0, -20 * k]];
      s.cyan = [[0, 0, 20 * k]];
    }
    flash = frame < 2 ? 0.32 : 0.2 * k * k;
  }

  if (mode === "drop") {
    const f = seq(DROP, elapsed);
    if (f) apply(s, f);
    else {
      s.op = 0;
      s.glow = 0;
    }
    return { s, flash, scale };
  }

  if (mode === "lock") {
    const f = seq(LOCK, elapsed);
    if (f) apply(s, f);
    return { s, flash, scale };
  }

  const lockDur = LOCK.length / 24;
  let locked = false;
  if (elapsed < lockDur) {
    apply(s, seq(LOCK, elapsed));
    locked = true;
  } else if (relockAt?.length) {
    for (const t of relockAt) {
      const f = seq(LOCK, elapsed - t);
      if (f) {
        apply(s, f);
        locked = true;
        break;
      }
    }
  }

  if (!locked && elapsed >= lockDur) {
    const loopT = (elapsed - lockDur) % IDLE_LOOP;
    let hit = false;
    const bf = seq(BURST, loopT - IDLE_BURST_AT);
    if (bf) {
      apply(s, bf);
      hit = true;
    }
    if (!hit) {
      for (const [t, frames] of IDLE_FLICKERS) {
        const f = seq(frames, loopT - t);
        if (f) {
          apply(s, f);
          hit = true;
          break;
        }
      }
    }
    for (const [t, dur, jx, jy] of IDLE_JITTERS) {
      if (loopT >= t && loopT < t + dur) {
        s.dx += jx;
        s.dy += jy;
      }
    }
  }

  return { s, flash, scale };
}

/** True while any lock / flicker / burst / jitter window is open (incl. empty `{}` frames). */
function idleBusy(elapsed, relockAt, cutIn) {
  if (cutIn && elapsed < 0.45) return true;
  const lockDur = LOCK.length / 24;
  if (elapsed < lockDur) return true;
  if (relockAt?.length) {
    for (const t of relockAt) {
      if (seq(LOCK, elapsed - t)) return true;
    }
  }
  if (elapsed < lockDur) return false;
  const loopT = (elapsed - lockDur) % IDLE_LOOP;
  if (seq(BURST, loopT - IDLE_BURST_AT)) return true;
  for (const [t, frames] of IDLE_FLICKERS) {
    if (seq(frames, loopT - t)) return true;
  }
  for (const [t, dur] of IDLE_JITTERS) {
    if (loopT >= t && loopT < t + dur) return true;
  }
  return false;
}

function mkLayer(text, color, { shadow = true, stroke = true, blend, blur, opacity = 1, z = 0, mesh = false } = {}) {
  const el = document.createElement("span");
  el.setAttribute("aria-hidden", "true");
  el.textContent = text;
  el.style.cssText = [
    "position:absolute",
    "left:50%",
    "top:50%",
    "margin:0",
    `font-family:${FONT}`,
    "font-weight:400",
    "line-height:1",
    "letter-spacing:0.04em",
    "text-transform:uppercase",
    "text-align:center",
    "white-space:nowrap",
    "pointer-events:none",
    `color:${color}`,
    `opacity:${opacity}`,
    `z-index:${z}`,
    blend ? `mix-blend-mode:${blend}` : "",
    blur ? `filter:blur(${blur}px)` : "",
    stroke ? "" : "-webkit-text-stroke:0",
    shadow ? "" : "text-shadow:none",
  ]
    .filter(Boolean)
    .join(";");
  el._shadow = shadow;
  el._stroke = stroke;
  el._mesh = mesh;
  el._color = color;
  return el;
}

function paintLayer(el, F, g, dx, dy, skew, clip) {
  const u = F / 560;
  el.style.fontSize = `${F}px`;
  el.style.transform = `translate(calc(-50% + ${dx * u}px), calc(-50% + ${dy * u}px)) skewX(${skew}deg)`;
  el.style.clipPath = clip || "none";
  if (el._stroke) el.style.webkitTextStroke = `${0.003 * F}px rgba(255,190,140,0.28)`;
  if (el._shadow) el.style.textShadow = glowShadow(F, g);
  // CRT mesh inside the glyphs (matches the :3001 phosphor look)
  if (el._mesh) {
    const c = el._color || TEXT_COLOR;
    el.style.backgroundImage = [
      `repeating-linear-gradient(0deg, ${c} 0 1px, rgba(160,32,8,0.5) 1px 2px)`,
      `repeating-linear-gradient(90deg, transparent 0 2px, rgba(0,0,0,0.14) 2px 3px)`,
    ].join(",");
    el.style.webkitBackgroundClip = "text";
    el.style.backgroundClip = "text";
    el.style.color = "transparent";
    el.style.webkitTextFillColor = "transparent";
  }
}

/**
 * Enclave signal-glitch wordmark. 24fps stepped tables; paints via DOM (no React re-renders).
 */
export default function GlitchText({
  text = "ENCLAVE",
  mode = "idle",
  relockAt,
  cutIn = false,
  size = 0.55,
  texture = false,
  play = true,
  className = "",
  as: Tag = "div",
  style,
}) {
  const wrapRef = useRef(null);
  const stageRef = useRef(null);
  const apiRef = useRef(null);
  const [F, setF] = useState(120);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const w = el.clientWidth || 320;
        setF((prev) => {
          const next = Math.max(24, Math.round(w * size));
          return next === prev ? prev : next;
        });
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [size]);

  // Build / rebuild the layer pool when text changes
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    stage.replaceChildren();

    const bloom = mkLayer(text, BLOOM_COLOR, { shadow: false, stroke: false, opacity: 0.6, z: 0 });
    const tears = Array.from({ length: TEAR_POOL }, () => mkLayer(text, TEXT_COLOR, { z: 1, mesh: true }));
    const reds = Array.from({ length: GHOST_POOL }, () =>
      mkLayer(text, RED, { stroke: false, blend: "screen", opacity: 0.7, z: 2 }),
    );
    const cyans = Array.from({ length: GHOST_POOL }, () =>
      mkLayer(text, CYAN, { stroke: false, blend: "screen", opacity: 0.45, z: 3 }),
    );
    const flashEl = document.createElement("span");
    flashEl.setAttribute("aria-hidden", "true");
    flashEl.style.cssText =
      "position:absolute;inset:-20%;pointer-events:none;z-index:4;mix-blend-mode:screen;opacity:0;display:none";

    stage.append(bloom, ...tears, ...reds, ...cyans, flashEl);

    let grainEl = null;
    if (texture) {
      const scan = document.createElement("span");
      scan.setAttribute("aria-hidden", "true");
      scan.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:5;background-image:repeating-linear-gradient(0deg,rgba(0,0,0,.34) 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,transparent 1px 4px),radial-gradient(ellipse at center,transparent 42%,#000 100%);background-position:0 0,16% 0,center`;
      grainEl = document.createElement("span");
      grainEl.setAttribute("aria-hidden", "true");
      grainEl.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:6;opacity:0.07;background-image:url("data:image/svg+xml;utf8,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`,
      )}");background-size:180px 180px`;
      stage.append(scan, grainEl);
    }

    apiRef.current = { stage, bloom, tears, reds, cyans, flashEl, grainEl };
    return () => {
      apiRef.current = null;
      stage.replaceChildren();
    };
  }, [text, texture]);

  // Paint loop — DOM only, paused off-screen / hidden / reduced
  useEffect(() => {
    const wrap = wrapRef.current;
    const stage = stageRef.current;
    if (!wrap || !stage) return undefined;

    if (reduced || !play) {
      stage.style.display = "none";
      return undefined;
    }
    stage.style.display = "block";

    let raf = 0;
    let lastStep = -1;
    let t0 = performance.now();
    let visible = true;
    let pausedClean = false;
    let wakeTimer = 0;
    let lastSig = "";

    const paint = (Fpx, s, flash, scale, step) => {
      const api = apiRef.current;
      if (!api) return;
      const g = s.glow;
      const bands = tearBands(s.tear);

      // room for the outer glow / bloom (0.32F shadow + ~0.09F blur) so tops aren’t clipped
      const pad = Math.ceil(Fpx * 0.28);
      api.stage.style.height = `${Fpx + pad * 2}px`;
      api.stage.style.padding = `${pad}px 0`;
      api.stage.style.boxSizing = "border-box";
      api.stage.style.opacity = String(s.op);
      api.stage.style.transform = `scale(${scale})`;
      api.stage.style.overflow = "visible";

      api.bloom.style.display = "block";
      api.bloom.style.opacity = String(0.6 * g);
      api.bloom.style.filter = `blur(${0.09 * Fpx}px)`;
      paintLayer(api.bloom, Fpx, g, s.dx, s.dy, s.skew, null);

      for (let i = 0; i < TEAR_POOL; i++) {
        const el = api.tears[i];
        const b = bands[i];
        if (!b) {
          el.style.display = "none";
          continue;
        }
        el.style.display = "block";
        paintLayer(el, Fpx, g, s.dx + b.dx, s.dy, s.skew, s.tear ? clipFor(b.top, b.bottom) : null);
      }

      for (let i = 0; i < GHOST_POOL; i++) {
        const slice = s.red?.[i];
        const el = api.reds[i];
        if (!slice) {
          el.style.display = "none";
          continue;
        }
        const [a, b, sdx] = slice;
        el.style.display = "block";
        paintLayer(el, Fpx, 0.35, s.dx + sdx, s.dy, s.skew, clipFor(a, 100 - b));
      }

      for (let i = 0; i < GHOST_POOL; i++) {
        const slice = s.cyan?.[i];
        const el = api.cyans[i];
        if (!slice) {
          el.style.display = "none";
          continue;
        }
        const [a, b, sdx] = slice;
        el.style.display = "block";
        paintLayer(el, Fpx, 0.35, s.dx + sdx, s.dy, s.skew, clipFor(a, 100 - b));
      }

      if (flash > 0) {
        api.flashEl.style.display = "block";
        api.flashEl.style.opacity = "1";
        api.flashEl.style.background = `radial-gradient(ellipse at center, rgba(255,120,60,${flash}) 0%, transparent 62%)`;
      } else {
        api.flashEl.style.display = "none";
      }

      if (api.grainEl) {
        const gx = Math.floor(hash01(step, 7) * 100);
        const gy = Math.floor(hash01(step, 11) * 100);
        api.grainEl.style.backgroundPosition = `${gx}% ${gy}%`;
      }
    };

    const stopRaf = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const scheduleWake = (ms) => {
      window.clearTimeout(wakeTimer);
      wakeTimer = window.setTimeout(() => {
        pausedClean = false;
        startRaf();
      }, Math.max(16, ms));
    };

    const nextIdleEventMs = (elapsed) => {
      const lockDur = LOCK.length / 24;
      if (elapsed < lockDur) return (lockDur - elapsed) * 1000;
      if (relockAt?.length) {
        for (const t of relockAt) {
          const end = t + LOCK.length / 24;
          if (elapsed < end) return Math.max(0, (elapsed < t ? t : end) - elapsed) * 1000;
        }
      }
      const loopT = (elapsed - lockDur) % IDLE_LOOP;
      const marks = [
        ...IDLE_FLICKERS.map(([t]) => t),
        ...IDLE_JITTERS.map(([t]) => t),
        IDLE_BURST_AT,
        IDLE_LOOP,
      ].sort((a, b) => a - b);
      for (const m of marks) {
        if (m > loopT + 0.001) return (m - loopT) * 1000;
      }
      return (IDLE_LOOP - loopT) * 1000;
    };

    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (!visible || document.hidden) return;
      const elapsed = (now - t0) / 1000;
      const step = Math.floor(elapsed * 24);
      if (step === lastStep) return;
      lastStep = step;

      const Fpx = Math.max(24, Math.round((wrap.clientWidth || 320) * size));
      const { s, flash, scale } = computeState(mode, elapsed, relockAt, cutIn);
      const sig = `${s.dx}|${s.dy}|${s.skew}|${s.op}|${s.glow}|${flash}|${scale}|${s.red}|${s.cyan}|${s.tear}|${Fpx}`;
      if (sig !== lastSig) {
        lastSig = sig;
        paint(Fpx, s, flash, scale, step);
      }

      // Idle holds: sleep until the next scheduled glitch instead of spinning at 24fps
      if (mode === "idle" && !idleBusy(elapsed, relockAt, cutIn)) {
        stopRaf();
        pausedClean = true;
        scheduleWake(nextIdleEventMs(elapsed));
      }
    };

    const startRaf = () => {
      if (raf || !visible || document.hidden || pausedClean) return;
      raf = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          pausedClean = false;
          startRaf();
        } else {
          stopRaf();
          window.clearTimeout(wakeTimer);
        }
      },
      { threshold: 0.05 },
    );
    io.observe(wrap);

    const onVis = () => {
      if (document.hidden) {
        stopRaf();
        window.clearTimeout(wakeTimer);
      } else if (visible) {
        pausedClean = false;
        startRaf();
      }
    };
    document.addEventListener("visibilitychange", onVis);

    // first paint
    {
      const Fpx = Math.max(24, Math.round((wrap.clientWidth || 320) * size));
      paint(Fpx, cleanState(), 0, 1, 0);
    }
    startRaf();

    return () => {
      stopRaf();
      window.clearTimeout(wakeTimer);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [mode, relockAt, cutIn, play, reduced, text, size, texture]);

  return (
    <Tag
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        display: "block",
        width: "100%",
        maxWidth: "100%",
        margin: 0,
        color: TEXT_COLOR,
        background: texture ? INK : "transparent",
        overflow: "visible",
        ...style,
      }}
    >
      <span className="sr-only">{text}</span>
      {reduced ? (
        <span
          aria-hidden="true"
          style={{
            margin: 0,
            display: "block",
            width: "100%",
            padding: `${Math.ceil(F * 0.28)}px 0`,
            boxSizing: "border-box",
            fontFamily: FONT,
            fontWeight: 400,
            fontSize: F,
            lineHeight: 1,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            textAlign: "center",
            color: TEXT_COLOR,
            WebkitTextStroke: `${0.003 * F}px rgba(255,190,140,0.28)`,
            textShadow: glowShadow(F, 1),
          }}
        >
          {text}
        </span>
      ) : (
        <span
          ref={stageRef}
          aria-hidden="true"
          style={{
            position: "relative",
            display: play ? "block" : "none",
            width: "100%",
            height: `${F + Math.ceil(F * 0.28) * 2}px`,
            padding: `${Math.ceil(F * 0.28)}px 0`,
            boxSizing: "border-box",
            overflow: "visible",
            transformOrigin: "center center",
            willChange: "transform, opacity",
          }}
        />
      )}
    </Tag>
  );
}

export { LOCK, DROP, BURST, FL1, FL2, FL3, FL4, FL5 };
