// Runs the full Stage 1-4 pipeline from the product spec:
//   1. Analysis        -- analyze.js
//   2. Clustering       -- cluster.js
//   3. Shortlisting     -- shortlist.js
//   4. Editorial select -- visionProvider.js (real AI or heuristic fallback)
//
// This is what the "Analyzing N photographs... / Removing duplicates...
// / Finding the best moments... / Building your story..." development
// sequence in the product spec should be driven by -- onStage below
// fires at each transition with a message ready to show the user.

import { analyzePhotos } from "./analyze.js";
import { clusterPhotos } from "./cluster.js";
import { shortlistCandidates } from "./shortlist.js";
import { createVisionProvider } from "./visionProvider.js";
import { MIN_PHOTOS_PER_PRIMITIVE } from "../zine/composeZine.js";

export async function runSelectionPipeline(photoInputs, { apiKey, styleName = "DOCUMENTARY", onStage } = {}) {
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

  emit("Building your story...");
  const selection = await provider.selectEditorial(
    shortlist.map(stripHeavyFields),
    { styleName, primitiveCatalog: MIN_PHOTOS_PER_PRIMITIVE }
  );

  const candidatesById = new Map(shortlist.map((c) => [c.id, c]));

  return { analyses, clusters, shortlist, selection, candidatesById };
}

// The AI (real or mock) only needs the metadata, not the hash/pixel
// stats -- keeps the prompt/mock payload small and readable.
function stripHeavyFields({ hash, width, height, brightness, ...rest }) {
  return rest;
}
