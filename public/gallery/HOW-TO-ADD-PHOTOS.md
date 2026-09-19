# The event archive

`/gallery` is the hub that lists every completed event. Each event gets its own page at
`/gallery/<slug>`, wearing that event's own theme — Tartarus is phosphor-green CRT; the next
event can look like anything.

## Adding photos to an existing event

1. Drop the image files into that event's folder: `public/gallery/tartarus/`.
   Accepted: `.jpg` `.jpeg` `.png` `.webp` `.avif` `.gif`. No naming rules — files are sorted
   the way a human would sort them, so `photo2.jpg` comes before `photo10.jpg`.
2. That's it. The wall picks them up, reads each image's real dimensions, and lays them out.

The folder is read when the site is built, so a deployed site needs a rebuild/redeploy to
show new photos. The dev server (`npm run dev`) picks them up on refresh.

## Captions (optional)

Add `captions.json` next to the photos:

```json
{
  "photo1.jpg": "Team 4 arguing with the sentry",
  "photo2.jpg": { "caption": "Triage, 40 minutes in", "alt": "Two students at a laptop" }
}
```

A plain string is used as both the caption and the alt text. Use the object form when the
screen-reader description should differ from the visible caption. Files with no entry get a
generic alt and no caption — they still display fine.

## Adding a new event

1. Create `public/gallery/<slug>/` and put its photos in.
2. Optionally add a logo at `public/gallery/logos/<slug>.png` — square works best. Without
   one, the hub row shows the event's name in its own display font instead.
3. Add an entry to `app/gallery/events.js` with the same `slug`: `title`, `kicker`, `date`
   (`YYYY-MM-DD`), `blurb`, optional `stats`, optional `briefingHref`, and a `theme`.
   Empty fields are simply omitted by the page.

## Giving an event its own look

Themes live in `app/gallery/themes.js`. Copy a block, change the values, and point the
event's `theme` at it. Every surface — the wall, tiles, captions, buttons, the lightbox, the
download tray — is drawn from these tokens, so nothing else needs editing:

- `--ev-bg` `--ev-surface` `--ev-line` — page, frames, borders
- `--ev-ink` `--ev-dim` — text and secondary text
- `--ev-accent` `--ev-accent-dim` `--ev-accent-ink` — highlights, and the text colour that
  sits *on* the accent
- `--ev-warn` — the one alarm colour
- `--ev-radius` — `0px` for a hard-edged look, `14px` for soft
- `--ev-display` / `--ev-display-weight` / `--ev-ui` / `--ev-tracking` — type

`chrome` switches on extras that only suit some events: `scanlines`, `glitch` (text that
decays and re-forms), `sweep` (a light sweep as each photo arrives).

`font` names a face from `app/gallery/fonts.js` — add new ones there (they're loaded with
`next/font`). Leave it `null` to use the club's own faces.

The `warm` theme in `themes.js` is a ready-made template. To see the system work, point
Tartarus at it for a moment: the whole page, lightbox included, restyles with no CSS edits.
