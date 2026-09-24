// This module is intentionally thin right now. Today it just validates
// a hand-authored 8-page editorial spec (see demo/sampleZine.js). Once
// the Stage 1-4 AI pipeline (analysis -> clustering -> shortlisting ->
// editorial selection, per the product spec) exists, THIS is the seam it
// plugs into: the AI's job is to produce exactly the same shape of object
// this function validates -- an array of 8 { primitive, photos, caption }
// page specs -- and everything downstream (imposition + rendering) stays
// unchanged.

import { PRIMITIVES } from "../layout/primitives.js";

const MIN_PHOTOS_PER_PRIMITIVE = {
  FULL_BLEED: 1,
  HERO_IMAGE: 1,
  IMAGE_WITH_CAPTION: 1,
  TWO_UP: 2,
  THREE_UP: 3,
  FOUR_GRID: 4,
  ASYMMETRIC_PAIR: 2,
  PORTRAIT_STACK: 2,
  CONTACT_SHEET: 4,
};

export function composeZine(pageSpecs) {
  if (!Array.isArray(pageSpecs) || pageSpecs.length !== 8) {
    throw new Error(`A zine needs exactly 8 page specs, got ${pageSpecs?.length}`);
  }

  pageSpecs.forEach((spec, i) => {
    const pageNum = i + 1;
    if (!PRIMITIVES[spec.primitive]) {
      throw new Error(`Page ${pageNum}: unknown primitive "${spec.primitive}"`);
    }
    const min = MIN_PHOTOS_PER_PRIMITIVE[spec.primitive] || 1;
    if (!spec.photos || spec.photos.length < min) {
      throw new Error(
        `Page ${pageNum} uses ${spec.primitive}, which needs at least ${min} photo(s), got ${spec.photos?.length || 0}`
      );
    }
  });

  return pageSpecs.map((spec, i) => ({ page: i + 1, ...spec }));
}
