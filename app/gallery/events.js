// Completed events, newest first. Each one with photos gets a gallery at
// /gallery/<slug>. Blank fields are omitted by the UI.

import { themes } from "./themes";

export const events = [
  {
    slug: "tartarus",
    title: "TARTARUS",
    kicker: "Live AI competition",
    date: "",
    time: "",
    venue: "BSAR Crescent, Vandalur",
    mark: "/gallery/logos/tartarus.png",
    markAlt: "The Tartarus pixel figure",
    featured: true,
    short: "Tartarus",
    cover: "/gallery/tartarus/DSC01597.jpg",
    coverWidth: 3376,
    coverHeight: 6000,
    blurb:
      "Not a hackathon, not a workshop. One day inside a hostile system. Teams descend through four layers while Talos watches. You play in pairs: one person sees what the other can’t.\n\nMistakes cost you. Signal Traps lock players until OPS clears them. Points are earned under pressure, on a shared clock, in the room — not on a take-home brief.",
    beats: [
      "Crack the Archive and talk your way past the gate.",
      "Solve vault riddles under Eyes/Hands handicap.",
      "Judge GLIA’s outputs as Witness and Analyst.",
      "Finish in the Core, where Signal and Impulse synthesize everything that came before.",
    ],
    tags: ["AI", "live competition", "penalties"],
    stats: [],
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
