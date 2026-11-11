# ORACLE: Ascension

**NULL VOID · Find the exit.**

ORACLE is a live contest staged like a show, run by the Neural Techgenix Club and the Department of
CSE (School of Computer, Information and Mathematical Sciences), B.S. Abdur Rahman Crescent Institute
of Science & Technology, with the Association for Computing Machinery.

| | |
| --- | --- |
| When | Thursday 12 November 2026 (12.11.26) |
| Where | CIIC Seminar Hall, Crescent |
| Entry | ₹100 per person |
| Prize pool | ₹2,000 |
| How you play | Solo, on your own laptop |
| Register | [forms.gle/A8jzwKZSy7hoHcCB6](https://forms.gle/A8jzwKZSy7hoHcCB6) |
| Page | [neuraltech.club/oracle](https://www.neuraltech.club/oracle) (the standee's "Details" QR) |

## Three levels. One exit.

You join from your laptop, but others are walking the same halls tonight. Three levels stand between
you and the exit.

| | Level | What you do |
| --- | --- | --- |
| Level 1 | **Infiltration** | Each corridor has junctions where four sensors (guard, camera, lasers, door) read on or off. Build a switchboard of rows: each row says which sensors must be on, off or don't matter, and which move to make (walk, hide, hack, crawl, loop). Press Run; at every junction the character follows the first row that matches. Clear five corridors without tripping the alarm; fewer rows and faster clears earn more. |
| Level 2 | **Spot the Glitch** | Each case shows a radar of records marked genuine or fake, plus one unknown record. Pick the records nearest to it, count how they're marked, and give the majority answer. Six cases, one at a time, each on its own clock; later cases change how many neighbours count, use axes on different scales, and include records that can't be trusted. |
| Level 3 | **The Vault** | Each of four rooms has items with a weight and a value, and the bag has a limit. Tap items to pack them and seal the room with the highest total value that fits. Later rooms add a size limit, must-take items and pairs; partway through, ORACLE shrinks one room's limit and you re-pack. |

Every level opens with a free training tape. Credits are your score and your money. After each
level, the bottom fifth faces the System Purge.

The page explains what you do in each level, in plain words, without giving away the answers.

## How to register

1. Fill in the [registration form](https://forms.gle/A8jzwKZSy7hoHcCB6), one per person.
2. Pay the ₹100 entry the form asks for.

## The look

The poster's VHS world: a near-black void with a faint spiral, film grain, and the ORACLE logo's
red/cyan chroma split and soft bloom.

| Token | Hex | Used for |
| --- | --- | --- |
| Void | `#050506` | page |
| Cream | `#fff6dc` | type, the cassette label |
| Sunset | `#f7b25a` | the Register button, highlights |
| Teal | `#5fb7c2` | level numbers, focus rings |
| Lilac | `#8b78d6` | label stripe |
| Signal red | `#ff4f6d` | chroma split, label stripe |

Type: Archivo at its widest cut for display, VT323 for the VCR on-screen text, and Yellowtail for the
handwriting on the cassette label.

## The page (`/oracle`)

From top to bottom:

1. **Hero:** the ORACLE logo and a Register button, under the club's nav bar.
2. **Three levels. One exit.:** what each level asks of you.
3. **The cassette label:** every fact on one tape sticker, next to the registration steps.
4. **Footer:** the closing line and the organisers.

| What | Where |
| --- | --- |
| Date, time, venue, fee, prize, the form link, open or close registrations | `lib/oracle/event.js`, the **EDIT HERE** block |
| The levels' words | `lib/oracle/event.js`, `ROOMS` |
| Page | `app/oracle/page.jsx` |
| Styles (all colour tokens at the top) | `app/oracle/oracle.css` |
| Fonts, title, link preview | `app/oracle/layout.jsx` |
| Images | `public/oracle/`: `logo.png` (hero), `og.jpg` (link preview, from the Main Gate LED banner), `cover.jpg` and `mark.jpg` (the `/events` and gallery listings, from the standee) |
| The `/events` entry | `app/gallery/events.js` (`slug: "oracle"`, theme `vhs` in `app/gallery/themes.js`) |

Setting `registrationOpen: false` swaps the Register button for "Registrations are closed". After the
day, set `upcoming: false` in `app/gallery/events.js` and add photos under `public/gallery/oracle/`
(see `public/gallery/HOW-TO-ADD-PHOTOS.md`); `/gallery/oracle` appears once there are photos.

The game itself (player screens, host console, projector) is a separate app, not part of this site.
