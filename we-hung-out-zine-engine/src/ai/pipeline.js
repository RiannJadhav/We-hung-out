// Runs the Stage 1-4 pipeline from the product spec:
//   1. Analysis        -- analyze.js
//   2. Clustering       -- cluster.js
//   3. Shortlisting     -- shortlist.js
//   4. Editorial select -- visionProvider.js (real AI or heuristic fallback)
//
// Split into two entry points because Stage 1 (one provider call per
// photo) is the expensive, slow part, while Stage 4 (one call over the
// already-shortlisted ~20 candidates) is cheap and fast. Generating
// several style variants of the same roll should only ever re-run Stage
// 4, not Stages 1-3 -- see runEditorialSelection below.
//
// onStage fires at each transition with a message ready to show the
// user, matching the spec's "Analyzing N photographs.../Removing
// duplicates..." development-sequence copy.

import { analyzePhotos } from "./analyze.js";
import { clusterPhotos } from "./cluster.js";
import { shortlistCandidates } from "./shortlist.js";
import { createVisionProvider } from "./visionProvider.js";
import { MIN_PHOTOS_PER_PRIMITIVE } from "../zine/composeZine.js";

// Stages 1-3: analyze every photo once, dedupe, shortlist. Do this once
// per roll, however many style variants get generated from it.
export async function runAnalysisStages(photoInputs, { apiKey, onStage } = {}) {
  const provider = createVisionProvider({ apiKey });
  const emit = (message, detail) => onStage && onStage(message, detail);

  emit(`Analyzing ${photoInputs.length} photographs...`);
  const analyses = await analyzePhotos(photoInputs, provider, {
    onProgress: (done, total) => emit(`Analyzing ${photoInputs.length} photographs...`, { done, total }),
  });

  emit("Removing duplicates...");
  const clusters = clusterPhotos(analyses);

  emit("Finding the best moments...");
  const shortlist = shortlistCandidates(clusters);
  const candidatesById = new Map(shortlist.map((c) => [c.id, c]));

  return { provider, analyses, clusters, shortlist, candidatesById };
}

// Stage 4 only: pick and sequence 8 pages from an already-built
// shortlist, for one style/vibe. Safe to call multiple times (once per
// style variant) against the same shortlist + provider from
// runAnalysisStages -- it never re-touches the photos themselves.
export async function runEditorialSelection(shortlist, provider, { styleName = "DOCUMENTARY", onStage } = {}) {
  if (onStage) onStage(`Building your story (${styleName.toLowerCase()})...`);
  return provider.selectEditorial(shortlist.map(stripHeavyFields), { styleName, primitiveCatalog: MIN_PHOTOS_PER_PRIMITIVE });
}

// Convenience wrapper for the single-style case (CLI demo, tests) --
// equivalent to the old all-in-one runSelectionPipeline.
export async function runSelectionPipeline(photoInputs, { apiKey, styleName = "DOCUMENTARY", onStage } = {}) {
  const { provider, analyses, clusters, shortlist, candidatesById } = await runAnalysisStages(photoInputs, { apiKey, onStage });
  const selection = await runEditorialSelection(shortlist, provider, { styleName, onStage });
  return { analyses, clusters, shortlist, selection, candidatesById };
}

// The AI (real or mock) only needs the metadata, not the hash/pixel
// stats -- keeps the prompt/mock payload small and readable.
function stripHeavyFields({ hash, width, height, brightness, ...rest }) {
  return rest;
}
