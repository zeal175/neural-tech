# ENCLAVE — event site with an interactive 3D hero

> Lives in the [neural-tech](https://github.com/zeal175/neural-tech) repo as `enclave/`.
> The live game app is separate (`NTC-event-2` / `EVENT_app`).


Next.js 15 · React 19 · Tailwind 4 · React Three Fiber · GSAP · Lenis.
The hero figure is a rigged satin-matte black bust (the poster's reference figure) built in
Blender from a CC0 base mesh, with baked 4K textures and a thin red backlit rim.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

## Editing content

| What | Where |
| --- | --- |
| **Date, start time, venue, Google Form link, open/close registrations, the form's Department / Section choices** | `lib/event.js`, the "EDIT HERE" block at the top |
| Event name, department, institution, club | `lib/event.js` |
| The details section below the hero | `app/page.jsx` (reads `lib/event.js`) |
| Colours / fonts | `app/globals.css` (`@theme`), `app/layout.jsx` |
| Logos | `public/brand/` |
| Link preview image | `app/opengraph-image.jsx` (built from `lib/event.js`) |

While `eventDate` is `""` the site says **SOON** / "Date to be announced" and hides the countdown;
an empty `venue` reads "Venue to be announced". Set them (`eventDate: "2026-10-16"`,
`venue: "Main Auditorium"`), push, and Vercel redeploys in about a minute: the hero, countdown,
details, passes and link previews all update. Passes are drawn from the current settings, so anyone
who registered earlier gets the new date by opening "View your pass" again.

## Registrations & check-in (free Google Sheets)

Every "Register" button opens the on-site form (`components/register/`). Entries are **solo or a
team of two**: the form starts on Solo; "Team of 2" adds a team name and a "Your teammate" block.
One person fills in both. For each person it collects name, RRN, department, section, year and
phone.

**Every person gets their own ENCLAVE pass**: a 1080×1350 image with their name, "SOLO ENTRY" or
"TEAM · <name>", and a QR code that holds only the pass ID (e.g. `ENC-7F3KQ`). Whoever registers a
team sees both passes (switch between them) and can send their teammate theirs. They can save,
download or share it.

Registering an RRN that is already in returns that person's entry ("Welcome back"), with their
teammate's pass too. So a lost pass is recovered by registering again, and a teammate gets their
own pass by registering with their own RRN. A teammate whose RRN is already registered (solo or in
another team) is refused: each person enters once. The entry is remembered on the visitor's
device.

In both sheets each person is one row. The team columns come last: `entry` (Solo / Team),
`team_name`, `teammate` and `team_id` (the same for both members). A sheet made before teams
existed gets those columns added automatically.

On event day, organizers open **`/checkin`** on their phones (e.g. `https://your-site/checkin`),
enter the PIN, and scan passes. Each scan adds the person to a separate **ENCLAVE Attendance**
Google Sheet with the same details plus the check-in time:
- **Green "Checked in":** shows their name, department, year and section. For a team member it
  also shows the team name and whether their teammate is in yet. It clears itself after about
  2–3 s, so the line keeps moving.
- **Amber "Already checked in at 09:42":** the same pass a second time. Don't let it in twice.
- **Red "Not registered":** not a pass from this site. Search their RRN instead.
- **Search:** finds someone by pass ID or RRN if their phone died or they lost the pass. For a
  team, **Check in both** checks in the pair together.
- **No pass:** checks in Google Form registrants and walk-ins by typing their details (with an
  optional team name). They are recorded with pass ID `WALK-IN`; if the RRN turns out to be
  registered, their pass is used.

Each teammate is scanned separately, so attendance shows exactly who came.

Several phones can scan at once (the script handles one request at a time, so nobody is written
twice). The header shows "checked in / registered" live. To get Excel files: in each Google Sheet,
File → Download → Microsoft Excel (.xlsx).

Where rows go:

- **Local dev** (no setup): `data/registrations.csv` and `data/attendance.csv` (gitignored, they
  hold personal data). Put `CHECKIN_PIN=1234` in `.env.local` to try `/checkin` locally.
- **Production**: Google Sheets, through one Apps Script:
  1. Create a Google Sheet (registrations) → Extensions → Apps Script. Paste
     `scripts/google-sheet-webhook.gs` and save.
  2. In the toolbar's function menu pick **setup** → Run, and approve the permissions. It creates
     the "ENCLAVE Attendance" sheet in your Drive; its link is in the execution log (also in
     Drive). To use a sheet you already have, paste its ID into `ATTENDANCE_SHEET_ID` instead.
  3. Deploy → New deployment → type **Web app** → Execute as **Me**, Who has access
     **Anyone** → Deploy, and copy the web app URL. Opening it in a browser should show
     `{"ok":true,"service":"ENCLAVE registrations",...}`.
  4. In Vercel → Project → Settings → Environment Variables, add
     `REGISTRATIONS_WEBHOOK_URL` = that URL and `CHECKIN_PIN` = a PIN for the door team, then
     redeploy.
  5. Test: register a team on the site, then scan one pass on `/checkin`. Two rows should appear
     in Registrations and one in Attendance.

  Changing the script later: Deploy → Manage deployments → ✏️ → Version: **New version** → Deploy.
  That keeps the same URL (a *new deployment* would get a new URL to put in Vercel).

If the Sheet isn't connected in production, the form says so and offers `googleFormUrl` as a
fallback (when set). Set `registrationOpen: false` to close registrations.

## What visitors can do (`components/hero/`)

- **Intro**: the bust is scanned into existence, the red rim strikes like neon, and the title rises
  letter by letter (shortened on repeat visits).
- **Gaze**: the figure looks at the cursor. Eyes move first, then neck and head. It also looks at
  anything hovered or focused that has `data-gaze` (nav button, countdown, form buttons), and goes
  back to the poster pose when the visitor is idle.
- **Backlight**: the red rim leans toward the cursor; when idle it traces the whole silhouette.
- **Scan** (hover the figure): a heat spot with scanlines follows the cursor.
- **Click / tap**: a shockwave ring runs over the surface and the head recoils.
  **Press and hold**: the head lowers, the eyes ignite and sparks gather. Release fires a big
  shockwave and an ember burst (with a short vibration on Android).
- **Registration**: the figure turns to the form and its eyes follow your text caret as you type.
  It politely looks away while you enter your phone number, shakes its head at mistakes, runs a scan
  line while submitting, and on success nods, ignites its eyes and bursts into sparks.
- **Countdown** to the event in the corner; every second sends a faint pulse through the rim.
- **Easter egg**: type `enclave` anywhere on the page.
- **Scroll**: the camera orbits to the poster's framing (behind-right, profile) while ENCLAVE splits.
- Phones: tilt to steer the gaze (iOS asks permission on the first tap), drag to look around, tap or
  hold to pulse. `prefers-reduced-motion` gets a calm version; browsers without WebGL get a still
  captured from the live scene (`public/hero/`).

Debug flags: `?tier=high|mid|low` forces a quality tier, `?nowebgl` shows the fallback.
Quality otherwise adapts automatically (DPR, MSAA, bloom, shadows); the 4K normal map streams in
after the intro on capable desktops.

## Deploy (free)

Push the folder to GitHub and import it on [Vercel](https://vercel.com) (Hobby plan), or run
`npx vercel`. Set `REGISTRATIONS_WEBHOOK_URL` and `CHECKIN_PIN` (above) and optionally `NEXT_PUBLIC_SITE_URL`.

Performance checks (Lighthouse etc.) only mean something on the production build:
`npm run build` then `npm start`. `npm run dev` ships unminified, development-mode React and
three.js. Use Lighthouse's mobile run in an incognito window (extensions add their own work).
Keep the load path free of main-thread stalls:
- **Title:** it is sized in CSS (`.hero-title`), not JS. The CSS is inlined into the HTML
  (`experimental.inlineCss`), so no stylesheet request blocks the first paint.
- **Hero text:** it is painted under the loader from the first frame (that is the LCP).
- **3D assets:** the model and maps are requested only after that first frame has painted
  (`Hero.jsx`), so they never compete with it. Don't preload them in `<head>`.
- **Decoding:** the maps are decoded off-thread (`ImageBitmap`) and uploaded one per task; the
  model's geometry is decoded in a worker (meshoptimizer's decoder).
- **Shaders:** the 3D shaders, the post-processing chain, the environment bake and its PMREM
  shader are pre-compiled in parallel behind the loader (`warmDone` in `heroStore.js`); each
  program's uniform tables are then fetched one per task (`warmPrograms.js`).
- **Code:** post-processing is its own chunk (its start-up is a separate task); drei's
  `<Environment>` is replaced by `StudioEnvironment` (`Lighting.jsx`) to keep its HDR/EXR
  loaders out of the bundle.
- **4K textures:** they are decoded off-thread and uploaded in idle time.

## 3D asset pipeline (`blender/`)

Source mesh: Blender Studio **Human Base Meshes v1.4.1** (CC0, no attribution required), unzipped
into `blender/source/` (gitignored; re-download from blender.org → Demo Files → Asset Bundles).
Every step is a script run in headless Blender 5.2 (`blender/run.ps1` holds the Blender path):

```powershell
.\blender\run.ps1 01_bust.py                                     # cut the bust, cap it, fit the eyes -> enclave_bust.blend
.\blender\run.ps1 02_uv.py   -Blend blender\enclave_bust.blend   # one UV atlas, extra texels on the face
.\blender\run.ps1 03_bake.py -Blend blender\enclave_bust.blend -ScriptArgs 4096   # normal/AO/roughness/curvature/thickness/cavity
.\blender\run.ps1 04_rig.py  -Blend blender\enclave_bust.blend   # armature, skin weights, raycast proxy, pose tests
.\blender\run.ps1 05_export.py -Blend blender\enclave_bust.blend # GLB -> blender/export/
npm run model      # meshopt compression -> public/models/enclave-bust.glb
npm run textures   # WebP maps -> public/textures/
```

Then bump `ASSET_V` in `lib/assets.js` (the files are cached as immutable).
`06_render.py` makes 2160×2700 transparent Cycles renders (`blender/renders/`) under the same
"sculpture studio" light as the site (`-ScriptArgs 64,pass` for a quick single-shot preview).
`npm run pass-art` then adds the red silhouette rim from the alpha contour and writes the pass art
(`public/pass/bust.webp`) and the finished social stills (`blender/renders/social/`).
Previews and QA renders land in `blender/previews/`. Baking uses CUDA; OptiX needs a newer
NVIDIA driver than the one installed.

## Credits

- Base mesh: Blender Studio, Human Base Meshes (CC0).
- **Pillar** (the ENCLAVE wordmark, `app/fonts/Pillar.otf`) by Pian45 Studio, from 1001fonts.com.
  The free version is licensed **personal use only, no commercial use**. Buy a licence at
  https://pian45.gumroad.com before the public launch if the event counts as commercial use.
- FK Screamer font (other display text): copied from the Neural Tech Club site; make sure the
  club's licence covers this site too.
- three.js, React Three Fiber, drei, Next.js, Lenis, qrcode (MIT) · postprocessing (Zlib) · GSAP (free
  standard licence).
