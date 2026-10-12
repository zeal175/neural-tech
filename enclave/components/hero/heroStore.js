import { create } from "zustand";

// Flip on to restore the 3D bust, its scroll-through and the full hero HUD.
export const SHOW_FIGURE = false;

// Discrete UI state (React subscribes to this).
export const useHero = create((set) => ({
  ready: false, // model + textures loaded, shaders compiled, first frames drawn
  introDone: false,
  webgl: true,
  reducedMotion: false,
  tier: "high", // "high" | "mid" | "low"
  tierLocked: false, // ?tier= override: PerformanceMonitor leaves it alone
  bustHover: false,
  ctaHover: false,
  progress: 0, // asset loading 0..100, reported from inside the (lazy) 3D chunk
  panel: null, // null | "form" | "pass"  (registration panel)
  // once registered (also in localStorage): { entry, teamName, passes: [theirs, teammate's], returning }
  pass: null,
  toast: null, // { text, at }
  set: (patch) => set(patch),
}));

// Per-frame channel shared by the DOM and the WebGL scene. Plain mutable object so that
// pointer moves / GSAP tweens / typing never trigger React renders.
export const live = {
  pointer: { x: 0, y: 0, inside: false, lastMove: -1e9, fine: true },
  cta: { x: 0.55, y: -0.62 }, // CTA centre in stage NDC
  gaze: { x: 0, y: 0, active: false }, // hovered/focused [data-gaze] element
  clicks: [], // { x, y } NDC, consumed by the scene
  glance: { x: 0, y: 0, until: -1 },
  scroll: 0, // hero scroll-through progress 0..1
  orbit: 0, // camera orbit angle (radians) shared with the light rig
  intro: { scan: 0, rim: 0, ignite: 0, ui: 0 },
  flash: 0, // click flash (bloom / aberration spike), decays in the scene
  // press-and-hold on the figure: active while held, `release` set once on let-go
  charge: { active: false, x: 0, y: 0, release: false },
  chargeLevel: 0, // 0..1, written by the scene (cursor progress arc reads it)
  assetsRequested: false, // 3D model / maps requested (Hero after the first paint, or the 3D chunk)
  // registration panel -> the figure reacts to the form
  form: {
    open: false,
    caret: null, // { x, y } NDC of the text caret in the focused field
    privacy: false, // a sensitive field (phone) is focused: look away politely
    progress: 0, // share of valid fields 0..1
    keyTick: 0, // 1 on each keystroke, decays
  },
  tilt: { x: 0, y: 0, active: false }, // phone orientation, -1..1
  // silhouette mask (SilhouetteMask.jsx): antialiased coverage of the bust, used for the rim
  silhouette: { texture: null },
  // ember sparks (Embers.jsx): sparks to burst out, 0..1 gather strength, head position (world)
  embers: { pending: 0, gather: 0, origin: { x: 0, y: 0.08, z: 0 } },
  events: [], // one-shot gestures: { type: "nod" | "shake" | "burst" | "ignite" | "scanloop" | "scanstop" }
  lenis: null, // smooth-scroll instance (set by Hero) so other components can scroll
};

// Shader warm-up behind the loader: the figure (Bust.jsx) and the post-processing chain
// (HeroCanvas.jsx) compile in parallel; the intro starts once both are ready.
const warm = { bust: false, post: false, released: false };

/** Mark one warm-up part done ("bust" | "post"); `force` releases the loader regardless. */
export function warmDone(part, force = false) {
  if (part) warm[part] = true;
  if (warm.released || !(force || (warm.bust && warm.post))) return;
  warm.released = true;
  requestAnimationFrame(() => requestAnimationFrame(() => useHero.getState().set({ ready: true })));
}

/** Queue a one-shot gesture for the scene (nod, shake, burst, ignite, scanloop, scanstop). */
export function emit(type, data = {}) {
  live.events.push({ type, ...data });
}
