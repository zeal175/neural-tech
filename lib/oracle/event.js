// Single source of truth for the ORACLE page's facts. Change a value, push, and /oracle, its
// link preview and the /events entry follow.

// ─── EDIT HERE ───────────────────────────────────────────────────────────────────────────────
const SETTINGS = {
  // event day, "YYYY-MM-DD"
  eventDate: "2026-11-12",
  // start time, 24-hour India time, e.g. "09:30". "" hides it.
  startTime: "",
  venue: "CIIC Seminar Hall",
  fee: "₹100",
  prize: "₹2,000",
  // the poster's Register QR (forms.gle short link)
  registerUrl: "https://forms.gle/A8jzwKZSy7hoHcCB6",
  // false shows "Registrations are closed" instead of the Register button
  registrationOpen: true,
};
// ─────────────────────────────────────────────────────────────────────────────────────────────

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const [y, m, d] = SETTINGS.eventDate.split("-").map(Number);
const weekday = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
const time = /^(\d{1,2}):(\d{2})$/.exec(SETTINGS.startTime.trim());

export const ORACLE = {
  name: "ORACLE",
  title: "ORACLE: Ascension",
  tagline: "Find the exit",
  department: "Department of CSE",
  school: "School of Computer, Information and Mathematical Sciences",
  institution: "B.S. Abdur Rahman Crescent Institute of Science & Technology",
  club: "Neural Techgenix Club",
  partner: "Association for Computing Machinery",

  isoDate: SETTINGS.eventDate,
  // the poster's big date: "12.11.26"
  date: `${String(d).padStart(2, "0")}.${String(m).padStart(2, "0")}.${String(y).slice(2)}`,
  // "Thursday 12 November 2026"
  dateLong: `${weekday} ${d} ${MONTHS[m - 1]} ${y}`,
  timeLabel: time ? `${Number(time[1]) % 12 || 12}:${time[2]} ${Number(time[1]) < 12 ? "AM" : "PM"}` : "",
  venue: SETTINGS.venue,
  fee: SETTINGS.fee,
  prize: SETTINGS.prize,
  format: "Duo: two of you, one laptop is enough",

  registerUrl: SETTINGS.registerUrl,
  registrationOpen: SETTINGS.registrationOpen,
};

// The three levels, in order. `line` is the goal in one sentence; `more` is what the player
// actually does on screen, in plain words.
export const ROOMS = [
  {
    tag: "Level 1",
    name: "Infiltration",
    line: "Set up the rules that guide your character through five guarded corridors.",
    more: "Each corridor has junctions where four sensors read on or off: a guard, a camera, lasers and a door. You build a switchboard of rows. Each row says which sensors must be on, off, or don't matter, and which move to make: walk, hide, hack, crawl or loop. Press Run and the character follows the first row that matches at every junction. Clear the corridor without tripping the alarm. Fewer rows and faster clears earn more credits.",
    needs: "Logic and patience",
  },
  {
    tag: "Level 2",
    name: "Spot the Glitch",
    line: "Decide whether a record is genuine or fake by looking at the records closest to it.",
    more: "Each case shows a radar full of records already marked genuine or fake, plus one unknown record. Pick the records nearest to the unknown one, count how they're marked, and give the majority answer. Six cases, one at a time, each on its own clock. Later cases change the rules: how many neighbours count, axes measured on different scales, and records that can't be trusted.",
    needs: "A sharp eye",
  },
  {
    tag: "Level 3",
    name: "The Vault",
    line: "Pack the most valuable haul that fits in the bag.",
    more: "Each of the four rooms has items with a weight and a value, and your bag has a limit. Tap items to pack them; the meter shows how much room is left. Seal the room when you think you have the highest total value that fits. Later rooms add a size limit, items you must take, and items that only count as a pair. Partway through, ORACLE shrinks one room's limit and you have to re-pack.",
    needs: "Cool nerves",
  },
];
