// Maps a user-facing "what's the vibe" answer to the set of zine styles
// to generate. The person always gets 3 options: the style that best
// matches what they picked, plus two others for contrast/comparison --
// never just 3 shades of the same thing.

const STYLE_ORDER = ["DOCUMENTARY", "CINEMATIC", "CHAOTIC", "SCRAPBOOK"];

export const VIBES = {
  clean: { label: "Clean & chronological", primaryStyle: "DOCUMENTARY" },
  cinematic: { label: "Big & cinematic", primaryStyle: "CINEMATIC" },
  chaotic: { label: "Messy & energetic", primaryStyle: "CHAOTIC" },
  scrapbook: { label: "Personal & scrapbook-y", primaryStyle: "SCRAPBOOK" },
};

export function stylesForVibe(vibeKey) {
  const vibe = VIBES[vibeKey] || VIBES.clean;
  const rest = STYLE_ORDER.filter((s) => s !== vibe.primaryStyle);
  return [vibe.primaryStyle, ...rest].slice(0, 3);
}
