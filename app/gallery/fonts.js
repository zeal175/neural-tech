// Fonts an event theme can ask for by key. Declared once here so the hub (which
// swaps type faces on hover) and the event pages share the same instances.

import { Press_Start_2P, VT323 } from "next/font/google";

export const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

// The Enclave spiral's HUD face (the briefing site's pixel type). Kept out of FONTS so the hub,
// which applies every theme font, doesn't load it.
export const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  preload: false,
});

const FONTS = { vt323 };

/** Class that defines the theme font's CSS variable. Themes with no font use the club's. */
export function themeFontClass(key) {
  return (key && FONTS[key]?.variable) || "";
}

export const allFontClasses = Object.values(FONTS)
  .map((font) => font.variable)
  .join(" ");
