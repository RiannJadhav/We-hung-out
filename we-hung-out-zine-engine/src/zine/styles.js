import { rgb } from "pdf-lib";

// Each style is a set of knobs the layout primitives read (margin, gutter,
// caption treatment) plus which StandardFont to use for captions. Real
// custom fonts can be embedded later (pdf-lib + fontkit) without changing
// this shape -- just swap what `caption`/`captionItalic` resolve to in
// render/pdfRenderer.js's font loading step.
//
// Per the product spec, a style is supposed to change more than color: it
// should shift image density, sequencing, layout choice, typography,
// whitespace, cropping and caption treatment. That's why style lives here
// as layout knobs, not a palette -- and why sampleZine.js picks different
// primitives per style rather than reusing one page list.

export const STYLES = {
  CINEMATIC: {
    label: "Cinematic",
    margin: 0, // full-bleed heavy, dramatic
    gutter: 4,
    captionSize: 9,
    captionColor: rgb(1, 1, 1),
    captionBarColor: rgb(0, 0, 0),
    captionBarOpacity: 0.55,
    fontKey: "helvetica",
    captionItalic: false,
  },
  DOCUMENTARY: {
    label: "Documentary",
    margin: 14,
    gutter: 6,
    captionSize: 8,
    captionColor: rgb(0.15, 0.15, 0.15),
    captionBarColor: rgb(1, 1, 1),
    captionBarOpacity: 0,
    fontKey: "helvetica",
    captionItalic: false,
  },
  CHAOTIC: {
    label: "Chaotic",
    margin: 6,
    gutter: 3,
    captionSize: 8,
    captionColor: rgb(0.1, 0.1, 0.1),
    captionBarColor: rgb(1, 1, 1),
    captionBarOpacity: 0,
    fontKey: "helveticaBold",
    captionItalic: false,
  },
  SCRAPBOOK: {
    label: "Scrapbook",
    margin: 10,
    gutter: 10,
    captionSize: 9,
    captionColor: rgb(0.25, 0.15, 0.1),
    captionBarColor: rgb(1, 1, 1),
    captionBarOpacity: 0,
    fontKey: "timesItalic",
    captionItalic: true,
  },
};

export function resolveStyle(styleName) {
  const preset = STYLES[styleName];
  if (!preset) {
    throw new Error(`Unknown style "${styleName}". Supported: ${Object.keys(STYLES).join(", ")}`);
  }
  // `useItalicCaption` (boolean) tells primitives.js which of the shared
  // embedded fonts to grab for captions; `fontKey` picks the body font.
  return { ...preset, useItalicCaption: preset.captionItalic };
}
