// Wraps the two AI calls the pipeline needs behind one interface, so
// nothing downstream cares whether a real model or the offline fallback
// answered:
//
//   analyzePhoto(photoBuffer, mimeType, hints)   -- Stage 1, one per photo
//   selectEditorial(candidates, opts)            -- Stage 4, one call total
//
// Pass an ANTHROPIC_API_KEY to get real vision analysis + real editorial
// reasoning. Without one, MockVisionProvider gives you a fully-working
// pipeline end to end using only the free image stats from imageStats.js
// plus clearly-labeled fake semantics, so you can build/test the rest of
// the product before paying for a single API call.

const ANTHROPIC_VERSION = "2023-06-01";
// Cheap model for the high-volume, one-call-per-photo Stage 1 pass.
const ANALYSIS_MODEL = "claude-haiku-4-5-20251001";
// Stronger model for the single Stage 4 editorial-reasoning call.
const EDITORIAL_MODEL = "claude-sonnet-5";

export function createVisionProvider({ apiKey } = {}) {
  return apiKey ? new AnthropicVisionProvider(apiKey) : new MockVisionProvider();
}

class AnthropicVisionProvider {
  constructor(apiKey) {
    this.apiKey = apiKey;
  }

  async _call(model, messages, maxTokens = 1024) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({ model, max_tokens: maxTokens, messages }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Anthropic API error ${res.status}: ${text}`);
    }
    const data = await res.json();
    const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return text;
  }

  async analyzePhoto(photoBuffer, mimeType) {
    const base64 = photoBuffer.toString("base64");
    const prompt = [
      "You are an editorial photo assistant analyzing one photo from a night out.",
      "Respond ONLY with JSON, no prose, no markdown fences, matching exactly:",
      '{"peopleCount": number, "sceneDescription": string, "moodTags": string[], ',
      '"memorableScore": number (0-10, how much this captures a memorable/emotional/funny moment, NOT technical quality), ',
      '"technicalQualityScore": number (0-10, sharpness/exposure/framing), ',
      '"composition": string}',
    ].join(" ");

    const raw = await this._call(ANALYSIS_MODEL, [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mimeType, data: base64 } },
          { type: "text", text: prompt },
        ],
      },
    ]);
    return parseJsonLoose(raw);
  }

  async selectEditorial(candidates, { styleName, primitiveCatalog }) {
    const prompt = buildEditorialPrompt(candidates, styleName, primitiveCatalog);
    const raw = await this._call(EDITORIAL_MODEL, [{ role: "user", content: prompt }], 2048);
    return parseJsonLoose(raw);
  }
}

/**
 * No API key configured: still analyzes every photo and still produces a
 * full 8-page editorial selection, using only the free stats from
 * imageStats.js (sharpness, brightness, hash) plus deterministic,
 * clearly-fake semantics seeded from the photo's id. This is scaffolding
 * for building/testing the pipeline, not a claim about the photo's real
 * content -- swap in an ANTHROPIC_API_KEY to get real analysis.
 */
class MockVisionProvider {
  async analyzePhoto(photoBuffer, mimeType, hints = {}) {
    const seed = hashString(hints.id || "");
    const moodPool = ["candid", "posed", "energetic", "quiet", "funny", "chaotic"];
    return {
      peopleCount: seed % 5,
      sceneDescription: `(mock) photo ${hints.id || ""}`,
      moodTags: [moodPool[seed % moodPool.length]],
      memorableScore: 3 + (seed % 8), // 3-10, deterministic per photo
      technicalQualityScore: hints.technicalQualityScore ?? 5,
      composition: "(mock, not analyzed)",
    };
  }

  async selectEditorial(candidates, { primitiveCatalog }) {
    return heuristicEditorialSelect(candidates, primitiveCatalog);
  }
}

function hashString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function parseJsonLoose(text) {
  const cleaned = text.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

function buildEditorialPrompt(candidates, styleName, primitiveCatalog) {
  return [
    "You are an editorial zine-maker. Below is metadata for a shortlist of candidate photos",
    "from one night. Pick exactly 8 pages telling the strongest, most varied story of the",
    "night -- not just the 8 highest-scoring photos. Consider chronology, variety of people",
    "and scenes, portrait vs wide, candid vs posed, quiet vs energetic, and memorable",
    "imperfections. The chosen style is: " + styleName + ".",
    "",
    "Available layout primitives and how many photos each needs: " + JSON.stringify(primitiveCatalog),
    "",
    "Candidates: " + JSON.stringify(candidates),
    "",
    'Respond ONLY with JSON: an array of exactly 8 objects, in final page order, each',
    '{"primitive": string, "photoIds": string[], "caption": string}.',
    "Each photoId must come from the candidates list. Do not reuse a photoId across pages.",
  ].join("\n");
}

// Rule-based Stage 4 fallback, used when there's no API key. It picks 8
// narrative "beats" spread across the night rather than just ranking by
// score -- the same principle the AI prompt above is asked to follow.
//
// Two passes, so it never runs out of photos partway through: Pass 1
// guarantees every beat gets exactly one anchor photo (8 photos used,
// tops). Pass 2 spends whatever's left over upgrading specific beats
// (establishing shots, the funny moment, the group photo) to richer
// multi-photo primitives, stopping the moment the pool runs dry. If the
// shortlist has fewer than 8 candidates at all, the last resort in
// `take` reuses the best remaining photo rather than leaving a page
// empty -- a duplicate photo beats a broken PDF.
function heuristicEditorialSelect(candidates, primitiveCatalog) {
  const byTime = [...candidates].sort((a, b) => a.timestamp - b.timestamp);
  const combinedScore = (c) => (c.technicalQualityScore || 0) * 0.35 + (c.memorableScore || 0) * 0.65;
  const early = byTime.slice(0, Math.ceil(byTime.length / 3));
  const mid = byTime.slice(Math.ceil(byTime.length / 3), Math.ceil((2 * byTime.length) / 3));
  const late = byTime.slice(Math.ceil((2 * byTime.length) / 3));

  const used = new Set();
  // Pass 1 takes are "reserved" (won't be reused); pass 2 takes only pull
  // from what's genuinely unused, and simply add nothing if the pool is dry.
  const takeUnused = (predicate, pool) => {
    const available = pool.filter((c) => !used.has(c.id));
    const hit = available.find(predicate) || available[0];
    if (hit) used.add(hit.id);
    return hit;
  };
  const bestOverallUnused = () => {
    const available = byTime.filter((c) => !used.has(c.id));
    return [...available].sort((a, b) => combinedScore(b) - combinedScore(a))[0];
  };
  // Last resort so a too-small shortlist still produces 8 valid pages:
  // reuse the strongest candidate rather than leave a page photo-less.
  const takeOrReuse = (predicate, pool) => takeUnused(predicate, pool) || bestOverallUnused() || byTime[0];

  // -- Pass 1: one anchor photo per beat, in narrative order --
  const cover = takeOrReuse((c) => combinedScore(c) >= 6, early);
  const establishingAnchor = takeOrReuse((c) => (c.peopleCount || 0) <= 1, early.concat(mid));
  const portraitAnchor = takeOrReuse((c) => (c.peopleCount || 0) >= 1, mid);
  const hero = takeOrReuse((c) => (c.memorableScore || 0) >= 7, mid.concat(late));
  const funnyAnchor = takeOrReuse((c) => (c.moodTags || []).includes("funny") || (c.moodTags || []).includes("chaotic"), mid.concat(late));
  const quiet = takeOrReuse((c) => (c.moodTags || []).includes("quiet"), mid.concat(late));
  const groupAnchor = takeOrReuse((c) => (c.peopleCount || 0) >= 2, mid.concat(late));
  const closing = takeOrReuse(() => true, late.length ? late : byTime);

  // -- Pass 2: spend any genuinely unused leftovers upgrading beats that
  // benefit most from extra photos, richest primitive first. --
  const establishing = [establishingAnchor, ...collectMore(2, (c) => (c.peopleCount || 0) <= 1, early.concat(mid), used)];
  const group = [groupAnchor, ...collectMore(3, (c) => (c.peopleCount || 0) >= 2, mid.concat(late), used)];
  const funny = [funnyAnchor, ...collectMore(1, () => true, mid.concat(late), used)];
  const portraits = [portraitAnchor, ...collectMore(1, (c) => (c.peopleCount || 0) >= 1, mid, used)];

  const groupPrimitive = group.length >= 4 ? "FOUR_GRID" : group.length >= 3 ? "THREE_UP" : group.length >= 2 ? "TWO_UP" : "IMAGE_WITH_CAPTION";
  const funnyPrimitive = funny.length >= 2 ? "ASYMMETRIC_PAIR" : "IMAGE_WITH_CAPTION";
  const establishingPrimitive = establishing.length >= 3 ? "THREE_UP" : establishing.length >= 2 ? "TWO_UP" : "IMAGE_WITH_CAPTION";
  const portraitsPrimitive = portraits.length >= 2 ? "TWO_UP" : "IMAGE_WITH_CAPTION";

  return [
    { primitive: "HERO_IMAGE", photoIds: idsOf([cover]), caption: captionFor(cover, "the start of the night") },
    { primitive: establishingPrimitive, photoIds: idsOf(clip(establishing, establishingPrimitive, primitiveCatalog)), caption: "getting there" },
    { primitive: portraitsPrimitive, photoIds: idsOf(clip(portraits, portraitsPrimitive, primitiveCatalog)), caption: "who was there" },
    { primitive: "HERO_IMAGE", photoIds: idsOf([hero]), caption: captionFor(hero, "the moment") },
    { primitive: funnyPrimitive, photoIds: idsOf(clip(funny, funnyPrimitive, primitiveCatalog)), caption: "it happened fast" },
    { primitive: "IMAGE_WITH_CAPTION", photoIds: idsOf([quiet]), caption: "a quieter moment" },
    { primitive: groupPrimitive, photoIds: idsOf(clip(group, groupPrimitive, primitiveCatalog)), caption: "before we split up" },
    { primitive: "IMAGE_WITH_CAPTION", photoIds: idsOf([closing]), caption: captionFor(closing, "the walk home") },
  ];
}

// Pulls up to `n` more *currently unused* candidates matching predicate,
// marking them used as it goes. Never reuses a photo already claimed by
// another beat, and simply returns fewer than `n` if the pool runs out.
function collectMore(n, predicate, pool, used) {
  const out = [];
  for (const c of pool) {
    if (out.length >= n) break;
    if (used.has(c.id)) continue;
    if (!predicate(c)) continue;
    used.add(c.id);
    out.push(c);
  }
  return out;
}

// Trims a photo list down to exactly what the chosen primitive needs
// (a primitive picked as e.g. TWO_UP because 2 photos were available
// should never be handed 3).
function clip(list, primitive, primitiveCatalog) {
  const need = primitiveCatalog[primitive] || 1;
  return list.slice(0, need);
}

function idsOf(list) {
  return list.filter(Boolean).map((c) => c.id);
}

function captionFor(candidate, fallback) {
  if (!candidate) return fallback;
  const t = new Date(candidate.timestamp);
  const time = t.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${time}`;
}

export { heuristicEditorialSelect };
