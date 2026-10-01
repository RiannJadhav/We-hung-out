// Stage 2 -- Clustering. Groups visually similar photos (the classic "20
// nearly identical group selfies" case from the product spec) using the
// free perceptual hash from Stage 1, so Stage 3 only has to rank one
// representative per moment instead of every near-duplicate shot.
//
// O(n^2) hash comparisons, which is fine for a night's worth of photos
// (tens to low hundreds). If rolls start regularly running into the
// thousands, this is the first thing to optimize (e.g. bucket by
// timestamp window before comparing hashes).

import { hashDistance } from "./imageStats.js";

export function clusterPhotos(analyses, { hashThreshold = 0.12 } = {}) {
  const clusters = [];
  const assigned = new Set();

  for (const photo of analyses) {
    if (assigned.has(photo.id)) continue;
    const cluster = { members: [photo] };
    assigned.add(photo.id);
    for (const other of analyses) {
      if (assigned.has(other.id)) continue;
      if (hashDistance(photo.hash, other.hash) <= hashThreshold) {
        cluster.members.push(other);
        assigned.add(other.id);
      }
    }
    clusters.push(cluster);
  }

  // Representative = best combined score within the cluster (kept, not
  // just "sharpest", so a blurry-but-memorable candid can still win --
  // per the spec's editorial philosophy).
  for (const cluster of clusters) {
    cluster.representative = [...cluster.members].sort((a, b) => combinedScore(b) - combinedScore(a))[0];
    cluster.size = cluster.members.length;
  }

  return clusters;
}

function combinedScore(photo) {
  return (photo.technicalQualityScore || 0) * 0.35 + (photo.memorableScore || 0) * 0.65;
}
