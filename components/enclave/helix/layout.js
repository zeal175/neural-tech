// Spiral geometry for the Enclave 3D gallery. Pure functions, no three.js.
//
// The cards sit on a helix around the Y axis, facing outward, seen from outside: the front strand
// faces the camera, and the back half of each turn shows through the gaps between turns, smaller
// and dimmer and sloping the other way (the Osmo reference). Card i+1 sits to the right of and
// below card i; scrolling rotates the helix and lifts it so the focused card stays front-centre.

export const CARD_H = 1;
const MIN_ASPECT = 0.74;
const MAX_ASPECT = 1.42;
const GAP = 0.16; // along the spiral, between neighbours
const PER_TURN = 9; // roughly how many cards make one full turn
const PITCH = 2.35; // height of one turn, in card heights (leaves room for the back strand)

export function cardWidth(photo) {
  const aspect = photo.width && photo.height ? photo.width / photo.height : 1.33;
  return CARD_H * Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, aspect));
}

/** Angles and heights for every card. Arc length decides the angle, so wide cards take more room. */
export function buildHelix(photos) {
  const widths = photos.map(cardWidth);
  const mean = widths.length ? widths.reduce((a, b) => a + b, 0) / widths.length : CARD_H;
  const radius = ((mean + GAP) * PER_TURN) / (Math.PI * 2);
  const theta = new Float64Array(widths.length);
  for (let i = 1; i < widths.length; i++) {
    theta[i] = theta[i - 1] + (widths[i - 1] / 2 + GAP + widths[i] / 2) / radius;
  }
  const lift = (PITCH * CARD_H) / (Math.PI * 2); // metres of drop per radian
  const y = Array.from(theta, (t) => -t * lift);
  return { count: widths.length, widths, theta, y, radius, lift };
}

/** Angle and height at a fractional index (between two cards while scrolling). */
export function sampleHelix(helix, f) {
  const n = helix.count;
  if (!n) return { theta: 0, y: 0 };
  const c = Math.min(n - 1, Math.max(0, f));
  const i = Math.floor(c);
  const j = Math.min(n - 1, i + 1);
  const k = c - i;
  const theta = helix.theta[i] + (helix.theta[j] - helix.theta[i]) * k;
  return { theta, y: -theta * helix.lift };
}

/**
 * Camera for a viewport. On desktop the front card fills roughly half the stage height (sides of
 * the helix can crop); on a phone the front card fills most of the width.
 */
export function viewFor(width, height, radius) {
  const aspect = width / Math.max(1, height);
  const portrait = aspect < 0.85;
  const fov = portrait ? 56 : 46;
  const tan = Math.tan(((fov / 2) * Math.PI) / 180);
  // distance to the front card: by height (span = card heights in view) and by width (a
  // landscape card takes at most this share of the width)
  const byHeight = ((portrait ? 3.6 : 2.15) * CARD_H) / (2 * tan);
  const byWidth = (MAX_ASPECT * CARD_H) / (portrait ? 0.82 : 0.58) / (2 * tan * aspect);
  let distance = Math.max(byHeight, byWidth) + radius;
  // desktop: keep most of the near helix in frame, but don't pull back far enough to shrink the
  // focused card — the sides can vignette off
  if (!portrait) distance = Math.max(distance, (radius * 0.55 + CARD_H * 0.35) / (tan * aspect));
  return { fov, distance, portrait };
}
