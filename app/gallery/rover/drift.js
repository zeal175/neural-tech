// The ENC-01 drift on the Enclave bar of /gallery: choreography, secondary motion and the camera fit.
// Pure (no three.js, no DOM) and stepped at a fixed rate, so a frozen frame (?rover=t:1.2) is the same
// frame the live animation shows, and the fit can replay the whole drift before it plays.
//
// World: metres, y up, the camera looks down -z at the bar. The rover faces -z at yaw 0, so yaw π/2
// drives left and π faces the camera. A path is cubic Hermite curves for x and z plus a yaw curve of
// its own: the gap between yaw and the direction of travel is the slip angle, which is what reads as a
// drift. Pitch, roll, head, antenna and tracks follow from the path's velocity and acceleration.

import { clamp, spring } from "@/components/enclave/hero/math";

const DEG = Math.PI / 180;
export const FOV = 18;
export const ELEV = 14 * DEG;
export const MARGIN = 6;
export const STEP = 1 / 120;

const LEFT = Math.PI / 2; // yaw while driving left
const RIGHT = -Math.PI / 2;
const PARK_YAW = Math.PI - 0.68; // three-quarter to camera, nose to the left
const HALF_TRACK = 0.218;
const EDGE = 0.26; // outer edge of a track: the body tips up about it
export const BODY_ROLL = 0.6; // share of the roll that tips the whole rover; the rest leans the hull
export const CHASSIS_ROLL = 0.4;
// fastest the tracks visibly roll (m/s): quicker, and the sprocket teeth and belt links step far enough
// each frame to strobe (wagon-wheel flicker), so past this they just read as a blur
const VIS_CAP = 0.7;

// local bounds before the model has loaded (the model's own replace it)
export const DEFAULT_BOX = { min: [-0.27, 0, -0.26], max: [0.27, 0.64, 0.25] };

/** keys: [t, value, slope?]. Missing slopes are monotone (no overshoot between keys); the ends
 * default to flat. Outside the keys the curve carries on along its end slope. */
export function curve(keys) {
  const n = keys.length;
  const t = keys.map((k) => k[0]);
  const v = keys.map((k) => k[1]);
  const d = keys.map((k, i) => {
    if (k[2] != null) return k[2];
    if (i === 0 || i === n - 1) return 0;
    const a = (v[i] - v[i - 1]) / (t[i] - t[i - 1]);
    const b = (v[i + 1] - v[i]) / (t[i + 1] - t[i]);
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  return (time, out = {}) => {
    if (time <= t[0] || time >= t[n - 1]) {
      const i = time <= t[0] ? 0 : n - 1;
      out.p = v[i] + d[i] * (time - t[i]);
      out.v = d[i];
      out.a = 0;
      return out;
    }
    let i = 0;
    while (time > t[i + 1]) i++;
    const T = t[i + 1] - t[i];
    const s = (time - t[i]) / T;
    const s2 = s * s;
    const s3 = s2 * s;
    const p0 = v[i];
    const p1 = v[i + 1];
    const m0 = d[i] * T;
    const m1 = d[i + 1] * T;
    out.p = (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (3 * s2 - 2 * s3) * p1 + (s3 - s2) * m1;
    out.v = ((6 * s2 - 6 * s) * p0 + (3 * s2 - 4 * s + 1) * m0 + (6 * s - 6 * s2) * p1 + (3 * s2 - 2 * s) * m1) / T;
    out.a = ((12 * s - 6) * p0 + (6 * s - 4) * m0 + (6 - 12 * s) * p1 + (6 * s - 2) * m1) / (T * T);
    return out;
  };
}

const wrap = (a) => a - Math.round(a / (2 * Math.PI)) * 2 * Math.PI;

/** `to` (or a whole turn from it) nearest `from`; a near half-turn goes round through facing the camera. */
export function turnTo(from, to) {
  let d = wrap(to - from);
  if (Math.abs(d) > 0.75 * Math.PI && Math.cos(from + d / 2) > 0) d -= Math.sign(d) * 2 * Math.PI;
  return from + d;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── paths ─────────────────────────────────────────────────────────────────────────────────────────
// G (from layoutBar): xPark, zPark, yawPark, xEdgeR (the bar's right edge at the park line), xStart and
// xOff (fully off the right edge). Beats are path times at which something happens once.

/** Entry, ~1.9 s: headlight streak, burst in from the right, counter-steer flick, broadside slide,
 * stop with a rock, settle three-quarter to camera, double blink and an eye glint. */
export function buildEntry(G) {
  const P = G.xPark;
  const Z = G.zPark;
  const S = clamp(0.36 * Math.max(0.5, G.xEdgeR - P), 0.26, 1.05); // the slide
  const vs = (2 * S) / 0.55; // into the slide, braking to a stop by 1.25 s
  // the burst: a steady speed from just off the right edge, and never a crawl on a short bar
  const vb = Math.max(3.2, (G.xStart - P - S - 0.075 * vs) / 0.525);
  const F = (0.15 * (vb + vs)) / 2; // the flick
  const xs = P + S + F + 0.45 * vb;
  return {
    kind: "enter",
    dur: 1.95,
    x: curve([[0.1, xs, -vb], [0.55, P + S + F, -vb], [0.7, P + S, -vs], [1.25, P - 0.035, 0], [1.45, P, 0]]),
    z: curve([[0.1, Z - 0.3, 0], [0.55, Z - 0.3, -0.2], [0.7, Z - 0.33, 0.45], [1.25, Z + 0.03, 0], [1.45, Z, 0]]),
    yaw: curve([
      [0.1, LEFT, 0],
      [0.5, LEFT],
      [0.63, LEFT - 0.3, 0], // flick: nose right to go left
      [0.73, LEFT + 0.32],
      [0.9, LEFT + 1.2],
      [1.12, LEFT + 1.36, 0], // broadside
      [1.3, LEFT + 1.3],
      [1.6, G.yawPark - 0.06, 0], // pivots round to three-quarter, past it a touch
      [1.8, G.yawPark, 0],
    ]),
    spin: curve([[0.1, 1.4, 0], [0.45, 0.5], [0.62, 0.2], [0.76, 2.4], [1.08, 1.6], [1.26, 0, 0]]),
    squat: curve([[0.1, 1, 0], [0.42, 0.8], [0.56, 0, 0]]), // powering in
    beats: { streak: 0, burst: 0.74, brake: [1.12], sparks: 1.2, snap: 1.45, blinks: [1.55, 1.71], flare: 1.8, glint: 1.82 },
  };
}

/** Exit, ~0.9 s from wherever it is: brake if moving, squat with wheelspin, pivot on the spot to face
 * right (tracks counter-rotating), launch off the right edge. */
export function buildExit(G, p) {
  const sp = Math.hypot(p.vx, p.vz);
  const b = sp > 0.3 ? clamp(sp * 0.07, 0.12, 0.3) : 0;
  const x1 = p.x + p.vx * b * 0.5;
  const z1 = p.z + p.vz * b * 0.5;
  const y1 = p.yaw + p.yr * b * 0.35;
  const face = turnTo(y1, RIGHT);
  const tl = b + 0.34;
  const end = tl + 0.52;
  const xo = Math.max(G.xOff, x1 + 1.5);
  return {
    kind: "exit",
    dur: end + 0.05,
    x: curve([[0, p.x, p.vx], [Math.max(b, 0.02), x1, 0], [tl, x1, 0], [end, xo, (2.2 * (xo - x1)) / 0.52]]),
    z: curve([[0, p.z, p.vz], [Math.max(b, 0.02), z1, 0]]),
    yaw: curve([[0, p.yaw, p.yr], [b + 0.08, y1, 0], [b + 0.4, face + 0.06 * Math.sign(face - y1), 0], [tl + 0.12, face, 0]]),
    spin: curve([[b, 0, 0], [tl - 0.14, 0.4], [tl - 0.02, 3.2], [tl + 0.3, 1.2], [end, 0, 0]]),
    squat: curve([[b, 0, 0], [b + 0.14, 1, 0], [tl - 0.02, 1, 0], [tl + 0.16, 0, 0]]),
    beats: { brake: b ? [0] : [], burst: tl },
  };
}

/** Hovered again mid-exit: brake, pivot back and re-park (or a fresh entry if it's already gone). */
export function buildRepark(G, p) {
  if (p.x > G.xEdgeR + 0.3) return buildEntry(G);
  const sp = Math.hypot(p.vx, p.vz);
  const b = sp > 0.3 ? clamp(sp * 0.08, 0.14, 0.32) : 0.06;
  const x1 = p.x + p.vx * b * 0.5;
  const z1 = p.z + p.vz * b * 0.5;
  const y1 = p.yaw + p.yr * b * 0.35;
  const dx = G.xPark - x1;
  const dz = G.zPark - z1;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.12) {
    const park = turnTo(y1, G.yawPark);
    const end = b + 0.5;
    return {
      kind: "repark",
      dur: end + 0.35,
      x: curve([[0, p.x, p.vx], [b, x1, 0], [end, G.xPark, 0]]),
      z: curve([[0, p.z, p.vz], [b, z1, 0], [end, G.zPark, 0]]),
      yaw: curve([[0, p.yaw, p.yr], [b + 0.04, y1, 0], [end - 0.08, park + 0.05 * Math.sign(park - y1), 0], [end + 0.12, park, 0]]),
      beats: { brake: [0], snap: end - 0.1, blinks: [end + 0.08] },
    };
  }
  const head = turnTo(y1, Math.atan2(-dx, -dz));
  const tp = b + 0.26;
  const ta = tp + clamp(dist / 2.6, 0.3, 0.85);
  const park = turnTo(head, G.yawPark);
  const ux = dx / dist;
  const uz = dz / dist;
  return {
    kind: "repark",
    dur: ta + 0.62,
    x: curve([[0, p.x, p.vx], [b, x1, 0], [tp - 0.06, x1, 0], [ta, G.xPark + ux * 0.03, 0], [ta + 0.16, G.xPark, 0]]),
    z: curve([[0, p.z, p.vz], [b, z1, 0], [tp - 0.06, z1, 0], [ta, G.zPark + uz * 0.03, 0], [ta + 0.16, G.zPark, 0]]),
    yaw: curve([[0, p.yaw, p.yr], [b + 0.04, y1, 0], [tp, head, 0], [ta - 0.04, head, 0], [ta + 0.3, park - 0.05 * Math.sign(park - head), 0], [ta + 0.45, park, 0]]),
    spin: curve([[tp - 0.06, 0, 0], [tp + 0.04, 1.6], [tp + 0.2, 0, 0]]),
    beats: { brake: [0, ta - 0.08], snap: ta + 0.2, blinks: [ta + 0.36] },
  };
}

// ── simulation ────────────────────────────────────────────────────────────────────────────────────

export function createSim(seed = 7) {
  return {
    t: 0,
    mode: "off", // off | enter | idle | exit | repark
    path: null,
    pt: 0,
    modeT: 0, // time in the current mode
    x: 0,
    z: 0,
    yaw: LEFT,
    vx: 0,
    vz: 0,
    ax: 0,
    az: 0,
    yr: 0,
    speed: 0,
    vf: 0,
    slip: 0,
    spin: 0,
    squat: 0,
    pitch: { x: 0, v: 0 },
    roll: { x: 0, v: 0 },
    headW: { x: LEFT, v: 0 },
    headP: { x: 0, v: 0 },
    headZ: { x: 0, v: 0 },
    headYaw: 0,
    antX: { x: 0, v: 0 },
    antZ: { x: 0, v: 0 },
    look: 0, // 0: eyes on the road, 1: on the camera (or the pointer)
    snapT: -9,
    rollL: 0, // track travel as drawn (capped speed), metres
    rollR: 0,
    trackSpeed: 0,
    blur: 0,
    blinks: [],
    blinkAt: 0,
    lid: 0,
    flareAt: -9,
    flare: 0,
    glintAt: -9,
    glint: 0,
    pupil: 1,
    lidar: 0,
    lidarV: 1.4,
    brake: 0,
    bob: 0,
    streakAt: -9,
    streak: -1,
    // the follow-spot on the floor: where it points, how wide it is, how bright (0..1)
    spotX: { x: 0, v: 0 },
    spotZ: { x: 0, v: 0 },
    spotSize: { x: 1, v: 0 },
    spotOn: 0,
    events: [],
    rng: mulberry32(seed),
  };
}

const cx = {};
const cz = {};
const cy = {};

function start(S, path, G) {
  S.path = path;
  S.pt = 0;
  S.mode = path.kind;
  S.modeT = 0;
  if (path.kind === "enter") {
    S.headW.x = LEFT;
    S.headW.v = 0;
    S.look = 0;
    // a dark stage: the spot waits in the wings, at the right edge where the rover will burst in
    if (S.spotOn < 0.05) {
      S.spotX.x = G.xEdgeR - 0.15;
      S.spotZ.x = G.zPark - 0.3;
      S.spotX.v = S.spotZ.v = 0;
      S.spotSize.x = 1.25;
      S.spotSize.v = 0;
    }
  }
  if (path.kind === "exit") S.look = 0;
}

/** Parks it at once (reduced motion, or a resize while parked). */
export function parkNow(S, G) {
  S.path = null;
  if (S.mode !== "idle") S.modeT = 0;
  S.mode = "idle";
  S.x = G.xPark;
  S.z = G.zPark;
  S.yaw = turnTo(S.yaw, G.yawPark);
  S.vx = S.vz = S.ax = S.az = S.yr = 0;
  S.look = 1;
  // settled: head on the camera, springs at rest
  S.headW.x = turnTo(S.yaw, Math.PI);
  for (const k of ["headW", "headP", "headZ", "pitch", "roll", "antX", "antZ"]) S[k].v = 0;
  S.headP.x = 0.1;
  S.headZ.x = S.pitch.x = S.roll.x = S.antX.x = S.antZ.x = 0;
  S.pupil = 1.22;
  S.spotX.x = S.x;
  S.spotZ.x = S.z;
  S.spotSize.x = 1;
  S.spotX.v = S.spotZ.v = S.spotSize.v = 0;
  S.spotOn = 1;
}

const crossed = (a, b, at) => at != null && at > a && at <= b;

/**
 * One fixed step. input: { want: "in" | "out", pointer: world x the head should follow, or null,
 * still: true to skip idle life (reduced motion) }.
 */
export function step(S, G, input, h) {
  S.t += h;
  S.modeT += h;
  S.events.length = 0;

  if (input.want === "in") {
    if (S.mode === "off") start(S, buildEntry(G), G);
    else if (S.mode === "exit") start(S, buildRepark(G, S), G);
  } else if (S.mode === "enter" || S.mode === "repark" || S.mode === "idle") {
    start(S, buildExit(G, S), G);
  }

  const P = S.path;
  if (P) {
    const a = S.pt;
    S.pt += h;
    const b = S.pt;
    P.x(b, cx);
    P.z(b, cz);
    P.yaw(b, cy);
    S.x = cx.p;
    S.z = cz.p;
    S.yaw = cy.p;
    S.vx = cx.v;
    S.vz = cz.v;
    S.ax = cx.a;
    S.az = cz.a;
    S.yr = cy.v;
    const B = P.beats;
    if (crossed(a, b, B.streak)) S.streakAt = S.t;
    if (crossed(a, b, B.burst)) S.events.push("burst");
    if (crossed(a, b, B.sparks)) S.events.push("sparks");
    if (crossed(a, b, B.snap)) {
      S.look = 1;
      S.snapT = S.t;
    }
    if (crossed(a, b, B.flare)) S.flareAt = S.t;
    if (crossed(a, b, B.glint)) S.glintAt = S.t;
    for (const at of B.brake || []) if (crossed(a, b, at) || (at === 0 && a === 0)) S.brake = 1;
    for (const at of B.blinks || []) if (crossed(a, b, at)) S.blinks.push(S.t);
    S.spin = P.spin ? Math.max(0, P.spin(b, cx).p) : 0;
    S.squat = P.squat ? clamp(P.squat(b, cx).p, 0, 1) : 0;
    if (b >= P.dur) {
      S.path = null;
      S.mode = P.kind === "exit" ? "off" : "idle";
      S.modeT = 0;
      S.vx = S.vz = S.ax = S.az = S.yr = 0;
      if (S.mode === "idle") {
        S.look = 1;
        S.blinkAt = S.t + 1.6 + S.rng() * 2;
      } else S.events.push("gone");
    }
  } else {
    S.spin = 0;
    S.squat = 0;
    if (S.mode === "idle") {
      // parked; eases over if the bar was refitted under it
      const k = 1 - Math.exp(-8 * h);
      S.x += (G.xPark - S.x) * k;
      S.z += (G.zPark - S.z) * k;
      S.yaw += (turnTo(S.yaw, G.yawPark) - S.yaw) * k;
      S.vx = S.vz = S.ax = S.az = S.yr = 0;
    }
  }

  // body frame: forward f, right r
  const sy = Math.sin(S.yaw);
  const cyw = Math.cos(S.yaw);
  const vf = -S.vx * sy - S.vz * cyw;
  const vl = S.vx * cyw - S.vz * sy;
  const af = -S.ax * sy - S.az * cyw;
  const al = S.ax * cyw - S.az * sy;
  S.speed = Math.hypot(S.vx, S.vz);
  S.vf = vf;
  S.slip = S.speed > 0.3 ? Math.atan2(Math.abs(vl), Math.abs(vf)) * Math.min(1, (S.speed - 0.3) / 0.6) : 0;

  // squat when launching, dive when braking; lean out of the turn, overshoot when it stops
  spring(S.pitch, clamp(0.011 * af, -0.13, 0.13) + 0.06 * S.squat, 180, 12, h);
  spring(S.roll, clamp(0.013 * al, -0.16, 0.16), 180, 12, h);

  // head: world yaw on a spring, so it lags the body's turns; snaps round to the camera on its beat
  let local = 0;
  if (S.look) {
    const tx = input.pointer;
    const want = tx == null ? Math.PI : Math.atan2(-(tx - S.x), -(G.camZ - S.z));
    local = clamp(wrap(want - S.yaw), -1.6, 1.6);
  }
  const snapping = S.t - S.snapT < 0.35;
  spring(S.headW, S.yaw + local, snapping ? 260 : S.look ? 120 : 110, snapping ? 17 : S.look ? 13 : 12, h);
  S.headYaw = clamp(S.headW.x - S.yaw, -1.75, 1.75);
  spring(S.headP, clamp(0.01 * af, -0.22, 0.22) + (S.look ? 0.1 : 0), 140, 10, h);
  spring(S.headZ, clamp(0.008 * al, -0.15, 0.15) + (S.look && S.t - S.glintAt < 1.2 ? 0.08 : 0), 120, 10, h);

  // antenna whip (Robot.jsx's spring, kicked by the body's acceleration)
  S.antX.v += (-S.antX.x * 70 - S.antX.v * 4.5 + 1.8 * af - 2.5 * S.headP.v) * h;
  S.antX.x = clamp(S.antX.x + S.antX.v * h, -0.7, 0.7);
  S.antZ.v += (-S.antZ.x * 70 - S.antZ.v * 4.5 + 1.8 * al) * h;
  S.antZ.x = clamp(S.antZ.x + S.antZ.v * h, -0.7, 0.7);

  // tracks: forward speed ± yaw rate × half-track, plus wheelspin
  const vL = vf - S.yr * HALF_TRACK + S.spin;
  const vR = vf + S.yr * HALF_TRACK + S.spin;
  S.rollL += clamp(vL, -VIS_CAP, VIS_CAP) * h;
  S.rollR += clamp(vR, -VIS_CAP, VIS_CAP) * h;
  S.trackSpeed = (Math.abs(vL) + Math.abs(vR)) / 2;
  S.blur = clamp(S.trackSpeed / 4 - 0.2, 0, 1);

  // eyes: blinks (scripted, then now and then while idle), the flare and the glint
  const still = input.still;
  if (S.mode === "idle" && !still && S.t > S.blinkAt) {
    S.blinks.push(S.t);
    if (S.rng() < 0.25) S.blinks.push(S.t + 0.2);
    S.blinkAt = S.t + 2.5 + S.rng() * 3.5;
  }
  let lid = 0;
  for (let i = S.blinks.length - 1; i >= 0; i--) {
    const k = (S.t - S.blinks[i]) / 0.13;
    if (k > 1) S.blinks.splice(i, 1);
    else if (k >= 0) lid = Math.max(lid, Math.sin(k * Math.PI));
  }
  S.lid = lid;
  const fk = S.t - S.flareAt;
  S.flare = fk < 0 ? 0 : fk < 0.06 ? fk / 0.06 : Math.exp(-(fk - 0.06) * 5);
  const gk = (S.t - S.glintAt) / 0.42;
  S.glint = gk >= 0 && gk <= 1 ? gk : -1;
  S.pupil += ((S.look ? 1.22 : 1) - 0.35 * S.flare - S.pupil) * (1 - Math.exp(-9 * h));

  S.lidarV += ((still ? 0 : S.speed > 0.4 ? 7 : 1.4) - S.lidarV) * (1 - Math.exp(-3 * h));
  S.lidar += S.lidarV * h;
  S.brake = Math.max(0, S.brake - h * 1.6);
  S.bob = S.mode === "idle" && !still ? Math.sin(S.t * 2.2) * 0.004 : 0;
  const sk = (S.t - S.streakAt) / 0.34;
  S.streak = sk >= 0 && sk <= 1 ? sk : -1;

  // the follow-spot, worked like a stage operator's: it waits in the wings, whips after the rover
  // on a spring (lagging the burst, swinging past the stop and settling back), opens up while the
  // rover is fast and irises in a touch on the ka-chow. It never leaves the stage: past the right
  // edge it holds there and goes dark as the rover escapes.
  const wing = G.xEdgeR - 0.15;
  spring(S.spotX, Math.min(S.x, wing), 130, 11, h);
  spring(S.spotZ, S.z, 130, 11, h);
  const iris = S.t >= S.glintAt && S.t - S.glintAt < 0.45 ? 0.14 : 0;
  spring(S.spotSize, 1 + 0.3 * Math.min(1, S.speed / 4) - iris, 150, 10, h);
  const onTarget = S.mode === "off" ? 0 : S.mode === "enter" ? clamp((S.pt - 0.06) / 0.34, 0, 1) : S.mode === "exit" ? (S.pt < 0.32 ? 1 : 0) : 1;
  S.spotOn += (onTarget - S.spotOn) * (1 - Math.exp(-(S.mode === "enter" ? 30 : S.mode === "exit" ? 3.5 : 6) * h));
}

// ── poses for the fit ────────────────────────────────────────────────────────────────────────────

/** World points of the rover's local box at a pose (the same tilts Rover.jsx applies), plus its shadow. */
export function posePoints(box, pose, out) {
  const [x0, y0, z0] = box.min;
  const [x1, y1, z1] = box.max;
  const r = pose.roll * BODY_ROLL;
  const px = -Math.sign(r) * EDGE;
  const cr = Math.cos(r);
  const sr = Math.sin(r);
  const p = pose.pitch;
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const lr = pose.roll * CHASSIS_ROLL;
  const cl = Math.cos(lr);
  const sl = Math.sin(lr);
  const cyw = Math.cos(pose.yaw);
  const syw = Math.sin(pose.yaw);
  const HZ = 0.17;
  for (let i = 0; i < 8; i++) {
    let x = i & 1 ? x1 : x0;
    let y = i & 2 ? y1 : y0;
    let z = i & 4 ? z1 : z0;
    // hull pitch and lean about its centre (applied to the whole box: on the safe side)
    let yy = y - HZ;
    let t = yy * cp - z * sp;
    z = yy * sp + z * cp;
    yy = t;
    t = x * cl - yy * sl;
    yy = x * sl + yy * cl;
    x = t;
    y = yy + HZ - 0.018 * (pose.squat || 0);
    // body tip about the low track edge
    t = (x - px) * cr - y * sr + px;
    y = (x - px) * sr + y * cr;
    x = t;
    out.push(pose.x + x * cyw + z * syw, y, pose.z - x * syw + z * cyw);
  }
  // the blob shadow's visible core (it stretches along x, which doesn't change the fit)
  out.push(pose.x, 0, pose.z - 0.3, pose.x, 0, pose.z + 0.3);
  return out;
}

/** Plays a full entry and a full exit and returns the visited points as [x, y, z, …]. */
export function sweep(G, box) {
  const S = createSim();
  const input = { want: "in", pointer: null };
  const pts = [];
  let i = 0;
  const take = () => posePoints(box, { x: S.x, z: S.z, yaw: S.yaw, pitch: S.pitch.x, roll: S.roll.x, squat: S.squat, speed: S.speed }, pts);
  for (; i < 2.1 / STEP; i++) {
    step(S, G, input, STEP);
    if (i % 3 === 0) take();
  }
  input.want = "out";
  for (let j = 0; j < 1.1 / STEP; j++, i++) {
    step(S, G, input, STEP);
    if (i % 3 === 0) take();
  }
  return pts;
}

// ── camera fit ───────────────────────────────────────────────────────────────────────────────────
// The camera only pitches (ELEV, looking down at (0, ty, 0) from `dist`), so how high a point sits on
// screen depends on its y and z alone: the fit works on the convex hull of the (z, y) points.

function hull(pts) {
  const p = [];
  for (let i = 0; i < pts.length; i += 3) p.push([pts[i + 2], pts[i + 1]]);
  p.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

const SE = Math.sin(ELEV);
const CE = Math.cos(ELEV);
const TV = Math.tan((FOV * DEG) / 2);

/** depth along the view axis and NDC height of (y, z) for a camera at `dist` looking at (0, ty, 0) */
function depthOf(rig, y, z) {
  return rig.dist - (y - rig.ty) * SE - z * CE;
}
function ndcY(dist, ty, y, z) {
  const Y = y - ty;
  return (Y * CE - z * SE) / ((dist - Y * SE - z * CE) * TV);
}

/** The closest camera that keeps every point `margin` px inside an H px tall canvas, centred. */
export function fitRig(W, H, pts, margin = MARGIN) {
  const hp = hull(pts);
  const range = (d, ty) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const [z, y] of hp) {
      const n = ndcY(d, ty, y, z);
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    }
    return [lo, hi];
  };
  const centre = (d) => {
    let a = -4;
    let b = 4;
    for (let i = 0; i < 40; i++) {
      const m = (a + b) / 2;
      const [lo, hi] = range(d, m);
      if (lo + hi > 0) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const limit = Math.max(0.2, 1 - (2 * margin) / H);
  let a = 0.4;
  let b = 80;
  for (let i = 0; i < 40; i++) {
    const d = (a + b) / 2;
    const [lo, hi] = range(d, centre(d));
    if (hi - lo > 2 * limit) a = d;
    else b = d;
  }
  return { W, H, dist: b, ty: centre(b), aspect: W / H };
}

export function cameraPose(rig) {
  return { position: [0, rig.ty + rig.dist * SE, rig.dist * CE], target: [0, rig.ty, 0], fov: FOV };
}

/** World x per unit of NDC x at a point's depth. */
export function spanX(rig, y, z) {
  return depthOf(rig, y, z) * TV * rig.aspect;
}

/** CSS px (from the canvas' top left) of a world point. */
export function toScreen(rig, x, y, z) {
  const depth = depthOf(rig, y, z);
  const ny = ((y - rig.ty) * CE - z * SE) / (depth * TV);
  const nx = x / (depth * TV * rig.aspect);
  return [((nx + 1) / 2) * rig.W, ((1 - ny) / 2) * rig.H];
}

/**
 * Where it parks and where it comes from, for a fitted rig. spot (CSS px across the canvas):
 * { lo, hi } the free gap it should park in, or { right: true } to park at the right end.
 */
export function layoutBar(rig, box, spot) {
  const zPark = 0;
  const yawPark = PARK_YAW;
  const pts = posePoints(box, { x: 0, z: zPark, yaw: yawPark, pitch: 0, roll: 0 }, []);
  const corners = [];
  for (let i = 0; i < 24; i += 3) corners.push([pts[i], spanX(rig, pts[i + 1], pts[i + 2])]);
  // NDC x of the parked rover's left and right extent when it parks at x
  const extent = (x) => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const [cx0, k] of corners) {
      const n = (x + cx0) / k;
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    }
    return [lo, hi];
  };
  const ndc = (px) => (px / rig.W) * 2 - 1;
  const k0 = spanX(rig, 0.3, zPark);
  let xPark;
  if (spot.right) {
    const edge = ndc(rig.W - 8);
    xPark = Math.min(...corners.map(([cx0, k]) => edge * k - cx0));
  } else {
    const target = ndc((spot.lo + spot.hi) / 2);
    xPark = target * k0;
    for (let i = 0; i < 4; i++) {
      const [lo, hi] = extent(xPark);
      xPark += (target - (lo + hi) / 2) * k0;
    }
    // clear of the arrow if the gap allows, and never over the text
    const right = ndc(spot.hi - 8);
    const left = ndc(spot.lo + 8);
    const hi = extent(xPark)[1];
    if (hi > right) xPark -= (hi - right) * k0;
    const lo = extent(xPark)[0];
    if (lo < left) xPark += (left - lo) * k0;
  }
  // fully off the right edge: the rover's nearest x is ~0.27 in from its centre, and its farthest
  // point (lowest, furthest back) is the last to leave the frame
  return {
    xPark,
    zPark,
    yawPark,
    xEdgeR: spanX(rig, 0.3, zPark),
    xStart: spanX(rig, 0, zPark - 0.6) + 0.3,
    xOff: spanX(rig, 0, zPark - 0.3) + 0.8,
    camZ: rig.dist * CE,
    k: k0,
  };
}

const NOMINAL = { xPark: 0, zPark: 0, yawPark: PARK_YAW, xEdgeR: 2.4, xStart: 3.6, xOff: 3.7, camZ: 2.6, k: 2.4 };

/**
 * Fits the camera to the worst pose of the whole drift, then lays the drift out for that camera.
 * The canvas (H px tall) is taller than the bar and centred on it: `band` is the bar's height, and
 * the drift stays MARGIN px inside that. `memo` keeps the swept outline between calls, so a height
 * change (the row grows on hover) only refits; a new width, model or parking gap replays the drift.
 */
export function solveBar(W, H, band, box, spot, memo = {}) {
  const margin = (H - Math.min(band, H)) / 2 + MARGIN;
  const key = [Math.round(W / 8), box.min, box.max, spot.right ? "r" : [Math.round(spot.lo / 8), Math.round(spot.hi / 8)]].join("|");
  if (memo.key !== key) {
    const first = fitRig(W, H, sweep(NOMINAL, box), margin);
    const outline = hull(sweep(layoutBar(first, box, spot), box));
    memo.pts = outline.flatMap(([z, y]) => [0, y, z]);
    memo.key = key;
  }
  const rig = fitRig(W, H, memo.pts, margin);
  return { rig, G: layoutBar(rig, box, spot) };
}
