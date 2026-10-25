// Events, newest first. Each one with photos gets a gallery at /gallery/<slug>.
// Blank fields are omitted by the UI.

import { themes } from "./themes";

// Same-origin path. Ignore leftover localhost:3001 (or any local URL) from old env/builds.
const rawEnclaveUrl = (process.env.NEXT_PUBLIC_ENCLAVE_URL || "/enclave").trim();
export const ENCLAVE_URL = /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?/i.test(rawEnclaveUrl)
  ? "/enclave"
  : rawEnclaveUrl || "/enclave";

export const events = [
  {
    slug: "enclave",
    title: "ENCLAVE",
    kicker: "Live day · photos",
    date: "2026-10-22",
    time: "",
    venue: "Web Technology Lab",
    mark: "/gallery/enclave/image.jpeg",
    markAlt: "ENCLAVE cover logo",
    featured: true,
    upcoming: false,
    short: "Enclave",
    cover: "/gallery/enclave/DSC00025.JPG",
    coverWidth: 6192,
    coverHeight: 4128,
    coverRatio: "6192 / 4128",
    blurb:
      "Find the exit. A maze, a rat, and instructions in plain English. You don’t need to know how to code — only how to think in steps. Solo or duo — register individually; teams are formed on the day. ₹50. 60 seats.",
    beats: [
      "Drag ten English blocks. Press Run. Watch the rat.",
      "Round 1 scramble. Round 2 debug. Round 3, your own maze.",
      "Start with 100 credits. Score and money.",
      "What you spend them on is up to you.",
    ],
    tags: ["live day", "photos"],
    stats: [],
    briefingHref: ENCLAVE_URL,
    theme: themes.ember,
  },
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
