// Stage 3 -- Shortlisting. Takes one representative per cluster and keeps
// the strongest ~15-20, per the product spec, so Stage 4's more expensive
// editorial reasoning (a real AI call, once wired up) only ever sees a
// manageable, already-deduped pool -- while still tagging each candidate
// with how many similar shots it stood in for, since "20 near-identical
// selfies became one cluster" is itself useful editorial context.

export function shortlistCandidates(clusters, { targetCount = 20, minTechnicalQuality = 1.5 } = {}) {
  const viable = clusters.filter((c) => (c.representative.technicalQualityScore || 0) >= minTechnicalQuality);
  const pool = viable.length ? viable : clusters; // never return an empty shortlist

  const ranked = [...pool].sort((a, b) => combinedScore(b.representative) - combinedScore(a.representative));
  const chosen = ranked.slice(0, targetCount);

  return chosen.map((c) => ({ ...c.representative, clusterSize: c.size }));
}

function combinedScore(photo) {
  return (photo.technicalQualityScore || 0) * 0.35 + (photo.memorableScore || 0) * 0.65;
}
