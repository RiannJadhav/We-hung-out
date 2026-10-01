// Stage 1 -- Analysis (per product spec's AI PHOTO SELECTION pipeline).
//
// For every photo, extract the free stuff locally (hash, sharpness,
// brightness) and get semantic stuff from the vision provider (people
// count, scene description, mood, memorable-ness). Runs one provider
// call per photo, so keep an eye on cost here -- Stage 3 (shortlist)
// exists partly to make sure Stage 4's more expensive reasoning call
// only ever sees ~15-20 photos, not the whole roll.

import fs from "fs/promises";
import path from "path";
import { computeImageStats } from "./imageStats.js";

const MIME_BY_EXT = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };

export async function analyzePhotos(photoInputs, provider, { onProgress } = {}) {
  const results = [];
  for (let i = 0; i < photoInputs.length; i++) {
    const input = photoInputs[i];
    const buffer = await fs.readFile(input.filePath);
    const stats = await computeImageStats(buffer);
    const mimeType = MIME_BY_EXT[path.extname(input.filePath).toLowerCase()] || "image/jpeg";

    const semantics = await provider.analyzePhoto(buffer, mimeType, {
      id: input.id,
      technicalQualityScore: sharpnessToScore(stats.sharpness),
    });

    results.push({
      id: input.id,
      filePath: input.filePath,
      timestamp: input.timestamp,
      ...stats,
      ...semantics,
    });

    if (onProgress) onProgress(i + 1, photoInputs.length);
  }
  return results;
}

// Maps the raw Laplacian-variance sharpness number onto a rough 0-10
// scale. The exact thresholds are a starting point, not calibrated
// against real photos yet -- worth revisiting once real photos flow
// through this.
function sharpnessToScore(variance) {
  const score = Math.log10(variance + 1) * 2.2;
  return Math.max(0, Math.min(10, Math.round(score * 10) / 10));
}
