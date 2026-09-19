// Fonts an event theme can ask for by key. Declared once here so the hub (which
// swaps type faces on hover) and the event pages share the same instances.

import { VT323 } from "next/font/google";

export const vt323 = VT323({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-vt323",
});

const FONTS = { vt323 };

/** Class that defines the theme font's CSS variable. Themes with no font use the club's. */
export function themeFontClass(key) {
  return (key && FONTS[key]?.variable) || "";
}

export const allFontClasses = Object.values(FONTS)
  .map((font) => font.variable)
  .join(" ");
