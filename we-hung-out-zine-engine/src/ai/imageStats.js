// Cheap, deterministic, free-to-run signals about a photo -- no AI call
// needed for these. They power Stage 2 (clustering near-duplicates) and
// feed into Stage 3/4 scoring alongside whatever the vision model says.
//
// Everything here is pure JS (Jimp), so it runs anywhere Node runs --
// no native image libraries, consistent with the rest of this codebase.

import { Jimp } from "jimp";

// Coarse block-average-color fingerprint used for near-duplicate
// detection. Deliberately not a texture-sensitive hash (like aHash on
// greyscale): two shots of the same moment a second apart can differ a
// lot in fine detail (motion blur, someone blinking) but barely at all
// in *where the color is* across the frame, which is what actually
// signals "this is the same shot again" for a burst of photos. A GRIDxGRID
// grid quantized to LEVELS per channel keeps the fingerprint small and
// keeps comparisons cheap.
const HASH_GRID = 6;
const HASH_LEVELS = 6;

/**
 * Loads an image and returns its near-duplicate fingerprint, a
 * Laplacian-variance sharpness score, average brightness (0-255), and
 * dimensions.
 */
export async function computeImageStats(filePathOrBuffer) {
  const img = await Jimp.read(filePathOrBuffer);
  const hash = computeColorGridHash(img);
  const sharpness = computeSharpness(img);
  const brightness = computeBrightness(img);
  return { hash, sharpness, brightness, width: img.bitmap.width, height: img.bitmap.height };
}

function computeColorGridHash(img) {
  const cell = 8; // px per grid cell after downscale
  const small = img.clone().resize({ w: HASH_GRID * cell, h: HASH_GRID * cell });
  const sums = Array.from({ length: HASH_GRID * HASH_GRID }, () => [0, 0, 0, 0]);
  small.scan(0, 0, small.bitmap.width, small.bitmap.height, function (x, y, idx) {
    const bx = Math.min(HASH_GRID - 1, Math.floor(x / cell));
    const by = Math.min(HASH_GRID - 1, Math.floor(y / cell));
    const bucket = sums[by * HASH_GRID + bx];
    bucket[0] += this.bitmap.data[idx];
    bucket[1] += this.bitmap.data[idx + 1];
    bucket[2] += this.bitmap.data[idx + 2];
    bucket[3] += 1;
  });
  // Flat array of quantized [r,g,b] levels, one triplet per grid cell.
  return sums.flatMap(([r, g, b, n]) => [
    Math.round(((r / n) / 255) * (HASH_LEVELS - 1)),
    Math.round(((g / n) / 255) * (HASH_LEVELS - 1)),
    Math.round(((b / n) / 255) * (HASH_LEVELS - 1)),
  ]);
}

/**
 * Laplacian-variance blur metric: high variance = lots of fine detail
 * (sharp), near-zero variance = flat/blurry. Works on a small greyscale
 * copy so it stays fast even on big source photos.
 */
export function computeSharpness(img) {
  const g = img.clone();
  g.resize({ w: Math.min(256, g.bitmap.width) });
  g.greyscale();
  g.convolute([
    [0, 1, 0],
    [1, -4, 1],
    [0, 1, 0],
  ]);
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  g.scan(0, 0, g.bitmap.width, g.bitmap.height, function (x, y, idx) {
    const v = this.bitmap.data[idx];
    sum += v;
    sumSq += v * v;
    n += 1;
  });
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function computeBrightness(img) {
  const g = img.clone();
  g.resize({ w: Math.min(64, g.bitmap.width) });
  g.greyscale();
  let sum = 0;
  let n = 0;
  g.scan(0, 0, g.bitmap.width, g.bitmap.height, function (x, y, idx) {
    sum += this.bitmap.data[idx];
    n += 1;
  });
  return sum / n;
}

/**
 * Normalized distance between two color-grid fingerprints: 0 = identical/
 * near-identical, 1 = maximally different. Used to cluster near-duplicate
 * bursts (see the note above on why this is a color fingerprint rather
 * than a texture/edge-based hash).
 */
export function hashDistance(hashA, hashB) {
  let diff = 0;
  const maxPerEntry = HASH_LEVELS - 1;
  for (let i = 0; i < hashA.length; i++) diff += Math.abs(hashA[i] - hashB[i]);
  return diff / (hashA.length * maxPerEntry);
}
