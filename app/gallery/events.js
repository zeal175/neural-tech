// Completed events, newest first. Each one gets its own themed gallery page at
// /gallery/<slug>, and its photos live in public/gallery/<slug>/ — see photos.js.
// Blank fields are omitted by the UI, so leave a value empty until you know it.

import { themes } from "./themes";

export const events = [
  {
    slug: "tartarus",
    title: "TARTARUS",
    kicker: "Live AI competition",
    date: "", // "2026-09-13" renders as 13 SEP 2026
    mark: "/gallery/logos/tartarus.png", // falls back to the wordmark if missing
    markAlt: "The Tartarus pixel figure",
    blurb:
      "One day inside a hostile system. Teams talked past a sentry that hated the word “key,” named what the archive was hiding, and repaired four machines somebody broke on purpose. Core opened for the ones still standing.",
    tags: ["AI", "live competition", "eliminations"],
    stats: [
      // { label: "Teams", value: "24" },
      // { label: "Survived to Core", value: "06" },
    ],
    briefingHref: "/tartarus",
    theme: themes.crt,
  },
];

export function getEvent(slug) {
  return events.find((event) => event.slug === slug) || null;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function formatEventDate(value) {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value.trim().toUpperCase();
  const [, year, month, day] = match;
  const label = MONTHS[Number(month) - 1];
  if (!label) return value.trim().toUpperCase();
  return `${day} ${label} ${year}`;
}
