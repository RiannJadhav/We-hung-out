# We hung out -- zine layout engine + AI selection pipeline

This is the first two slices of the "We hung out" product: the
deterministic layout engine described in the spec's "ZINE DESIGN SYSTEM"
section, and the Stage 1-4 AI photo selection pipeline described in "AI
PHOTO SELECTION". Together they take a folder of real photos and turn
them into:

1. **A print-ready single sheet PDF** -- one landscape page, correctly
   positioned and rotated into the classic "8-page zine from one sheet
   of paper, no staples" fold.
2. **A reading-order preview PDF** -- the same 8 pages, right-side up,
   in order, for looking at on a screen before you print anything.

Nothing here talks to a camera roll, a "roll" session, or Supabase yet --
see "What's stubbed" below. The AI pipeline runs for real (real
clustering, real editorial logic) but without an `ANTHROPIC_API_KEY` it
uses free image stats plus a deterministic heuristic instead of an actual
vision model call -- see "The AI pipeline" below.

## Beta V1: the browser-only flow (what is live now)

Everything happens **in the person's browser** -- no server, no database,
no API key, no function time limit. A fixed WHO logo (top left) restarts
the whole thing (it asks first if there is work in progress); "made by
Riann" sits at the bottom.

1. **Roll details** (name, day, start, end). Editable any time: Back from
   the roll screen, or the small "Edit" link next to the time window.
2. **Add photos.** Each is shrunk to 1600px in the browser and kept on the
   device in IndexedDB. Capture time is read from EXIF (file date as a
   fallback); only photos from the roll (plus up to 5 "final" photos from
   the 30 minutes after) are kept. "Add them anyway (testing)" exists for
   beta.
3. **Pick your 8** (tap in order; page 1 is the cover; paper A4 / Letter).
4. The five-stage **developing** animation always plays in full while the
   engine, font and photos load.
5. **Ready**: an on-screen preview of all 8 pages (painted by the same
   layout code the PDF uses), then **Download as is** or **Customize**.
6. **Customize**: per page -- photo or text page, fit (auto / fill / whole
   photo), zoom, move left-right and up-down, caption, swap photo; cover
   title and subtitle (text, size, 3x3 position, color, capitals); global
   font (5 choices), photo border, caption and text-page size.
7. **How to fold it**: six illustrated steps.

### Layout and fold
`src/zine/imposition.js` now matches a real Dirty Little Zine export:
bottom row = pages 8, 1, 2, 3; top row = 7, 6, 5, 4 printed upside down.
**An earlier version used a different arrangement taken from a blog post,
which would have put the cover in the wrong place after folding -- any
sheet printed before this change should be reprinted.** The look follows
that export too: photos run the full width of the panel and sit centered
with the caption in the gap, the cover is full-bleed with the title over
it, and any page can be a solid-color text page (default back page:
"Fin.").

`src/render/v1.js` holds `layoutPage`, ONE pure function that turns a page
spec into drawing operations. The PDF writer and the canvas preview in
`web/index.html` both run those same operations. `src/browser/entry.js` is
bundled by esbuild into `web/zine-engine.js` (`npm run build:web`) --
**re-run it whenever anything under `src/` changes**, or the live site
keeps the old engine. The page loads that 1.3 MB bundle lazily.

Fonts live in `web/fonts/` (Arvo, Bricolage Grotesque, Caveat, Playfair
Display Italic, Special Elite; all open-licensed Google Fonts). They are
embedded whole, without subsetting and with contextual letter features
off, because pdf-lib dropped or misplaced glyphs otherwise.

Unverified: the fold steps are written from the standard single-cut
method, matched to the dashed cut line on the sheet. Test one real
printout. Downloads were only tested in desktop Chrome, not on phones.

Parked, not deleted: the Supabase tables and `api/develop.js` (AI
selection + 3 style variants). Supabase's free tier pauses a project
after a stretch of inactivity, which broke the earlier connected version.

## Run it

```bash
npm install
npm run demo       # layout engine only, placeholder photos
npm run demo:ai    # full Stage 1-4 pipeline on a synthetic sample "roll"
```

`npm run demo` writes six PDFs to `output/`: a print sheet + preview for
a "documentary" style sample night, the same for a "scrapbook" style
sample, and one more print sheet on US Letter to confirm the paper-size
math holds up.

`npm run demo:ai` generates a synthetic sample roll (28 photos: several
bursts of near-identical shots plus a few one-offs, standing in for a
real camera roll), runs it through the full analysis -> clustering ->
shortlisting -> editorial-selection pipeline, logs each stage as it
goes, and writes the resulting real zine to
`output/ai-pipeline-print-A4.pdf` / `-preview.pdf`. Set
`ANTHROPIC_API_KEY` in your environment before running it to use real
vision analysis + real editorial reasoning instead of the offline
fallback.

Open the two `*-print-*.pdf` files to see the actual 8-panel sheet;
open the `*-preview.pdf` files to read the zine normally.

To fold a real printout, follow the steps logged at the end of the demo
run (also exported as `FOLD_INSTRUCTIONS` from `src/zine/imposition.js`).

## How it's organized

```
src/
  render/geometry.js      Paper sizes + PanelContext (the coordinate
                           abstraction every layout primitive draws
                           against -- handles the 180° rotation and
                           image-crop clipping so primitives never have
                           to think about it)
  zine/imposition.js      The 8-panel sheet layout: which page number
                           goes in which physical position, and at what
                           rotation. This is the single source of truth
                           for the fold -- if the physical fold ever
                           needs to change, this is the only file that
                           should need to change.
  zine/styles.js           CINEMATIC / DOCUMENTARY / CHAOTIC / SCRAPBOOK
                           style knobs: margin, gutter, caption
                           typography and treatment. (CHAOTIC's own demo
                           page set hasn't been written yet -- only
                           DOCUMENTARY and SCRAPBOOK have sample zines
                           below.)
  zine/composeZine.js      Validates an 8-page spec and exports the
                           per-primitive minimum photo counts. This is
                           the seam between the AI pipeline and the
                           renderer.
  layout/primitives.js     The 9 layout primitives from the spec
                           (FULL_BLEED, HERO_IMAGE, TWO_UP, THREE_UP,
                           FOUR_GRID, CONTACT_SHEET, IMAGE_WITH_CAPTION,
                           ASYMMETRIC_PAIR, PORTRAIT_STACK).
  render/pdfRenderer.js    Renders a composed zine to the print sheet
                           PDF and the preview PDF.
  ai/imageStats.js         Free, local, no-API-call signals per photo:
                           a coarse block-average-color fingerprint (for
                           near-duplicate detection) and a Laplacian-
                           variance sharpness score.
  ai/analyze.js            Stage 1 -- Analysis. One provider call per
                           photo, merged with the free image stats.
  ai/cluster.js            Stage 2 -- Clustering. Groups near-duplicate
                           shots by fingerprint distance.
  ai/shortlist.js          Stage 3 -- Shortlisting. One representative
                           per cluster, ranked down to ~20 candidates.
  ai/visionProvider.js     Stage 1's per-photo call + Stage 4's editorial
                           reasoning call, behind one interface. Real
                           Anthropic API calls when ANTHROPIC_API_KEY is
                           set; otherwise a deterministic, capacity-aware
                           heuristic that still produces a full 8-page
                           selection.
  ai/pipeline.js           Orchestrates Stages 1-4 with progress
                           callbacks matching the spec's "Analyzing N
                           photographs.../Removing duplicates..." copy.
  ai/buildZinePages.js     Glue: turns the AI's photoId selection into
                           real pdf-lib embedded images, ready for
                           composeZine + the existing renderer.
demo/
  sampleZine.js            Two hand-authored 8-page nights (placeholder
                            photos) for the layout-engine-only demo.
  generate.js               Runs that demo end to end.
  samplePhotos.js           Generates a synthetic 28-photo "roll" (bursts
                            of near-duplicates + singles) for testing the
                            AI pipeline without real photos.
  runAIPipeline.js          Runs the full Stage 1-4 pipeline on the
                            synthetic roll and renders the result.
```

## Feeding it real photos

A page spec's `photos` array currently holds placeholder slots
(`{ label, color, textColor }`). The AI pipeline already produces real
`{ image }` slots (pdf-lib embedded images) via `ai/buildZinePages.js`;
every primitive draws them identically, cropped to fill its slot
("cover" fit, never distorted) via the clipping built into
`PanelContext`. To point the pipeline at a real roll instead of the
synthetic sample, build a `photoInputs` array of
`{ id, filePath, timestamp }` (see `demo/samplePhotos.js` for the shape)
from wherever the session's uploaded/selected photos end up, and pass it
to `runSelectionPipeline` instead of `generateSamplePhotos()`'s output.

## The AI pipeline

- **Without `ANTHROPIC_API_KEY`**: Stage 1 (per-photo semantics) and
  Stage 4 (editorial selection + sequencing) both fall back to
  deterministic, clearly-labeled heuristics (`MockVisionProvider` /
  `heuristicEditorialSelect` in `ai/visionProvider.js`). Clustering
  (Stage 2) and shortlisting (Stage 3) are real either way -- they only
  depend on the free local image stats, not a model call.
- **With it set**: Stage 1 calls a cheap vision-capable model
  (`claude-haiku-4-5-20251001`) once per photo for real semantic
  analysis (people count, scene, mood, memorable-ness). Stage 4 makes
  one call to a stronger model (`claude-sonnet-5`) with the shortlist's
  metadata, asking it to pick and sequence the final 8 pages. Check
  Anthropic's current model list before deploying -- these are today's
  picks, not guaranteed to be current by the time this ships.
- Stage 1 is the expensive one at scale (one call per photo in the
  roll) -- Stage 3's shortlisting exists specifically to keep Stage 4's
  richer reasoning call down to one shot over ~20 photos, not the whole
  roll.
- The near-duplicate fingerprint in `imageStats.js` is a coarse
  block-average-color grid, not a texture/edge hash -- deliberately, so
  that two shots of the same moment a second apart (motion blur, someone
  blinking) still cluster together even though their fine detail
  differs, since what actually signals "same shot again" is color
  staying in the same places, not identical texture.

## The roll screens (what a person actually taps through)

`web/index.html` is the consumer-facing front end: Start a roll → Roll
active/closed (with the grace period) → Developing → Zine ready. It's a
single self-contained HTML file (vanilla JS, no build step, no
framework) so it's easy to open directly or deploy as-is.

- **Preview it locally**: just open `web/index.html` in a browser, or
  drag it into a new browser tab. Everything runs client-side right now
  (roll state is kept in `localStorage`, so refreshing the page doesn't
  lose your spot).
- **Deploy it to Vercel**: `vercel.json` points Vercel at the `web/`
  folder as a static site. Push this repo to Vercel (import the GitHub
  repo, no build command needed) and it'll serve `web/index.html`
  as-is.
- **What's real vs. a stand-in here**: the roll timer, the time-window
  gate, the grace-period counter, and the photo strip are all real and
  working. The "developing" sequence runs on a fast fake timer (a few
  seconds, not 30 minutes) just so you can see the full flow without
  waiting — and it doesn't call the AI pipeline yet. The final "your
  zine is ready" screen is a placeholder; it doesn't render an actual
  zine yet. Wiring the real backend (Supabase, the actual AI pipeline,
  real PDF generation, and a real ~30-minute async job) is the next
  piece of work, not this one.

## The backend (Supabase + /api/develop)

- **Database**: `rolls`, `roll_photos`, `zines` tables in Supabase
  (project `we-hung-out`, ref `orrxslxansacwqfuxqco`). RLS is **on but
  wide open** (`using (true)`) on all three, since there's no user
  accounts yet -- anyone with the anon key (which is public by design)
  can read/write any roll. Fine for a prototype with no real users;
  needs real policies once there's auth.
- **Storage**: two public buckets, `photos` (what people upload during a
  roll) and `zines` (the finished print/preview PDFs).
- **`web/index.html`** now writes real rows: starting a roll inserts
  into `rolls`; adding a photo uploads it to the `photos` bucket and
  inserts a `roll_photos` row (in the background -- the local photo
  strip updates instantly regardless of upload success, so a flaky
  upload doesn't block the UI, but also isn't surfaced clearly yet if
  it fails).
- **`api/develop.js`** is a real Vercel serverless function, and now
  generates **3 zine variants per roll**, not 1. The flow: after a roll
  closes, the person picks a "vibe" (`web/index.html`'s new vibe-picker
  screen, mapped to styles in `src/zine/vibes.js`); the function runs
  Stage 1-3 (the expensive, per-photo analysis) **once**, then runs
  Stage 4 (editorial selection -- cheap, one call over the ~20-photo
  shortlist) **three times**, once per style, via the new
  `runAnalysisStages`/`runEditorialSelection` split in
  `src/ai/pipeline.js`. Each variant gets its own print + preview PDF,
  uploaded to the `zines` bucket under `${rollId}/${style}/...`. The
  "Develop my roll" button waits for all 3 before showing results --
  the staged "Removing duplicates.../Building your story..." copy just
  cycles on a timer while that request is in flight, it isn't wired to
  real per-photo progress.
- **`zines` table** now holds one row per `(roll_id, style)` instead of
  one per roll (migration: `support_multiple_zine_styles`). `rolls`
  also gained a `vibe` column recording what the person picked.
- **No environment variables needed yet.** The Supabase URL + anon key
  are hardcoded in both `web/index.html` and `api/_lib/supabaseClient.js`
  (safe to do -- that's what the anon key is for). The only env var that
  matters is optional: set `ANTHROPIC_API_KEY` in Vercel's Environment
  Variables to get real vision analysis instead of the offline
  heuristic fallback.
- **Timeout risk, flagged honestly -- worse now than before**:
  `api/develop.js` runs Stage 1-3 once but Stage 4 + rendering 3 times,
  all synchronously in one request (`maxDuration: 60`). Fine for a
  normal-sized roll; a roll with a lot of photos, especially with a
  real `ANTHROPIC_API_KEY` doing one vision call per photo during
  Stage 1, could run long enough to hit Vercel's function time limit
  for your plan -- check Vercel's current limits if that happens. The
  real fix at that scale is a queue/background job instead of one long
  request, which is out of scope for this slice.

## What's stubbed / not built yet

- AI photo editing (crop/exposure/contrast correction)
- Any clear UI feedback when a background photo upload fails
- A real async "developing" job with genuine progress (today it's one
  synchronous request with a fake staged timer on top, per the timeout
  note above)
- Real EXIF timestamp extraction (photos are timestamped by the
  browser's `file.lastModified`, which is "when this file was saved to
  disk," not necessarily "when the photo was taken" -- close enough for
  now, not the same thing)
- User accounts / auth (RLS is wide open, as noted above)
- Native camera-roll access: a website can never automatically pull
  photos from a phone's camera roll by time window -- that needs a
  native iOS/Android app. The web version always needs the person to
  pick files by hand (what `web/index.html` does today).

## Known rough edges in this slice

- **Caption contrast on `FULL_BLEED` + `SCRAPBOOK`**: the scrapbook
  style draws captions in a warm brown with no background bar, which
  reads fine on light photos but is low-contrast on a dark placeholder
  (see `output/scrapbook-print-A4.pdf`, page 1 and 8). Worth deciding
  later whether captions get an auto-contrast color or a subtle
  scrim on every style, not just CINEMATIC.
- **CHAOTIC style** has margin/gutter/font knobs defined in
  `styles.js` but no demo page set exercising it yet.
- Text captions aren't wrapped/measured against overflow -- long
  captions on narrow panels (e.g. `PORTRAIT_STACK`, `CONTACT_SHEET`)
  can run past the panel edge. Fine for short captions like the demo's;
  will need real wrapping once captions come from an AI and aren't
  hand-picked to fit.
- `analyze.js`'s sharpness-to-0-10-score mapping is a rough starting
  curve, not calibrated against real photos -- worth revisiting once
  real photos flow through it.
- Clustering (`cluster.js`) is O(n²) hash comparisons -- fine for a
  night's worth of photos, would need bucketing by timestamp first if
  rolls start running into the thousands.
- `MockVisionProvider`'s semantics (people count, mood tags) are
  deterministic pseudo-random values seeded from the photo's id, not
  real content analysis -- clearly commented as such in the code. Don't
  mistake the mock-mode demo output for a preview of real quality; it's
  there to prove the pipeline's plumbing (clustering, capacity-aware
  page allocation, embedding) works, not to judge editorial quality.
