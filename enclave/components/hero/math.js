export const DEG = Math.PI / 180;

export const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Frame-rate independent exponential approach (lambda ~ 1/time-constant). */
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Damped spring step (semi-implicit Euler). state = { x, v } */
export function spring(state, target, stiffness, damping, dt) {
  const a = -stiffness * (state.x - target) - damping * state.v;
  state.v += a * dt;
  state.x += state.v * dt;
  return state.x;
}

/** Cheap smooth 1D noise from a few incommensurate sines (for idle motion). */
export const wobble = (t, seed = 0) =>
  Math.sin(t * 0.31 + seed) * 0.55 + Math.sin(t * 0.173 + seed * 2.1) * 0.3 + Math.sin(t * 0.71 + seed * 0.7) * 0.15;
