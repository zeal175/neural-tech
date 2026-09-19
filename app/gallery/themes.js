// Event themes. Every surface in the gallery (wall, tiles, lightbox, tray, buttons)
// is drawn from these tokens, so a new event restyles the whole page without touching
// any CSS. `chrome` switches on the extras that only suit some events.
//
// To add an event: copy a block below, change the values, and point the event's
// `theme` at it in events.js. `font` is a key from fonts.js — leave it null to use the
// club's own faces (Poppins + FK Screamer), which the root layout already provides.

export const themes = {
  // Tartarus: hostile terminal. Values match the --t-* set in app/tartarus/tartarus.css
  // so the event page and its briefing look like the same machine.
  crt: {
    name: "crt",
    font: "vt323",
    chrome: { scanlines: true, glitch: true, sweep: true },
    tokens: {
      "--ev-bg": "#030303",
      "--ev-surface": "#0a0a0c",
      "--ev-line": "#2a3a1a",
      "--ev-ink": "#e4e4e7",
      "--ev-dim": "#71717a",
      "--ev-accent": "#b8ff3d",
      "--ev-accent-dim": "#6b8f2e",
      "--ev-accent-ink": "#000000",
      "--ev-warn": "#ffb020",
      "--ev-radius": "0px",
      "--ev-display": "var(--font-vt323), ui-monospace, monospace",
      "--ev-display-weight": "400",
      "--ev-ui": "var(--font-vt323), ui-monospace, monospace",
      "--ev-tracking": "0.04em",
    },
  },

  // Template for a warmer, softer event — paper background, rounded frames, no glitch.
  // Also useful for checking that the gallery really is theme-driven: point Tartarus at
  // this for a moment and the entire page, lightbox included, should restyle.
  warm: {
    name: "warm",
    font: null,
    chrome: { scanlines: false, glitch: false, sweep: false },
    tokens: {
      "--ev-bg": "#f5ebdd",
      "--ev-surface": "#ffffff",
      "--ev-line": "rgba(65, 51, 51, 0.16)",
      "--ev-ink": "#413333",
      "--ev-dim": "rgba(65, 51, 51, 0.6)",
      "--ev-accent": "#f2765e",
      "--ev-accent-dim": "#315b8c",
      "--ev-accent-ink": "#ffffff",
      "--ev-warn": "#315b8c",
      "--ev-radius": "14px",
      "--ev-display": "var(--font-screamer), ui-sans-serif, sans-serif",
      "--ev-display-weight": "700",
      "--ev-ui": "var(--font-poppins), ui-sans-serif, sans-serif",
      "--ev-tracking": "0.02em",
    },
  },
};

export function getTheme(name) {
  return themes[name] || themes.warm;
}
