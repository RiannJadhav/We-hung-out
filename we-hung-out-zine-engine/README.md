# We hung out -- zine layout engine

This is the first slice of the "We hung out" product: the deterministic
layout engine + print-ready PDF renderer described in the product spec's
"ZINE DESIGN SYSTEM" section. It takes an 8-page editorial spec (which
photos go where, in which layout, with which caption) and turns it into:

1. **A print-ready single sheet PDF** -- one landscape page, correctly
   positioned and rotated into the classic "8-page zine from one sheet
   of paper, no staples" fold.
2. **A reading-order preview PDF** -- the same 8 pages, right-side up,
   in order, for looking at on a screen before you print anything.

Nothing here talks to a camera roll, Supabase, or an AI model yet -- see
"What's stubbed" below. Photos are placeholder colored rects with labels
so you can see the grid, rotation, and layouts working correctly on their
own, independent of any real photos.

## Run it

```bash
npm install
npm run demo
```

This writes six PDFs to `output/`: a print sheet + preview for a
"documentary" style sample night, the same for a "scrapbook" style
sample, and one more print sheet on US Letter to confirm the paper-size
math holds up. Open the two `*-print-*.pdf` files to see the actual
8-panel sheet; open the `*-preview.pdf` files to read the zine normally.

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
  zine/composeZine.js      Validates an 8-page spec. This is the seam
                           where the AI selection/sequencing pipeline
                           (spec Stages 1-4) plugs in later -- it just
                           needs to hand this function the same shape
                           of object the demo hand-authors today.
  layout/primitives.js     The 9 layout primitives from the spec
                           (FULL_BLEED, HERO_IMAGE, TWO_UP, THREE_UP,
                           FOUR_GRID, CONTACT_SHEET, IMAGE_WITH_CAPTION,
                           ASYMMETRIC_PAIR, PORTRAIT_STACK).
  render/pdfRenderer.js    Renders a composed zine to the print sheet
                           PDF and the preview PDF.
demo/
  sampleZine.js            Two hand-authored 8-page nights (placeholder
                            photos) -- stand-ins for what the AI pipeline
                            will eventually produce.
  generate.js               Runs the demo end to end.
```

## Feeding it real photos

A page spec's `photos` array currently holds placeholder slots
(`{ label, color, textColor }`). Swap in `{ image }` where `image` is a
pdf-lib embedded image (`pdfDoc.embedJpg(...)` / `embedPng(...)`) and
every primitive draws it identically, cropped to fill its slot
("cover" fit, never distorted) via the clipping already built into
`PanelContext`. No primitive code needs to change.

## What's stubbed / not built yet

Per your call to stub the backend first, none of this exists yet:

- The "roll" session UI (start/active/closed states, grace period)
- Camera-roll / upload ingestion tied to a session's time window
- The Stage 1-4 AI pipeline (per-photo analysis -> clustering ->
  shortlisting -> editorial selection into an 8-page spec)
- AI photo editing (crop/exposure/contrast correction)
- Supabase storage/auth, the "developing..." async job, sharing/download UX

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
