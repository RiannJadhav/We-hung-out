// Layout primitives. Each one draws into a PanelContext (a normalized
// 0,0 -> width,height rectangle -- see render/geometry.js) using only
// local coordinates. The AI (or, for now, a hand-authored page spec)
// picks which primitive a page uses and which photos fill its slots;
// this file owns the actual pixel math so output stays consistent and
// print-safe no matter what the AI decides.
//
// Every primitive has the same shape:
//   (ctx, { photos, caption, meta, fonts, style }) => void
//
// `photos` is an array of photo slots (either { image } for a real
// embedded photo, or { color, label } for a placeholder/demo photo).
// `style` carries the per-style knobs from zine/styles.js (margin scale,
// caption treatment, etc).

function drawCaption(ctx, text, lx, ly, w, { fonts, style }) {
  if (!text) return;
  const size = style.captionSize;
  const font = style.useItalicCaption ? fonts.captionItalic : fonts.caption;
  ctx.drawText(text, lx, ly, { size, font, color: style.captionColor, maxWidth: w });
}

export function FULL_BLEED(ctx, { photos, caption, fonts, style }) {
  ctx.drawPhoto(photos[0], 0, 0, ctx.width, ctx.height, fonts);
  if (caption) {
    // small overlay caption bar at the very bottom
    const barH = style.captionSize + 8;
    ctx.drawRect(0, 0, ctx.width, barH, { color: style.captionBarColor, opacity: style.captionBarOpacity });
    drawCaption(ctx, caption, 8, 6, ctx.width - 16, { fonts, style });
  }
}

export function HERO_IMAGE(ctx, { photos, caption, fonts, style }) {
  const m = style.margin;
  const captionH = caption ? style.captionSize + 10 : 0;
  ctx.drawPhoto(photos[0], m, m + captionH, ctx.width - 2 * m, ctx.height - 2 * m - captionH, fonts);
  if (caption) drawCaption(ctx, caption, m, m + captionH / 2 - style.captionSize / 2, ctx.width - 2 * m, { fonts, style });
}

export function IMAGE_WITH_CAPTION(ctx, { photos, caption, fonts, style }) {
  // Like HERO_IMAGE but the caption is always present and given real room
  // -- meant for a single quiet/contemplative photo.
  const m = style.margin;
  const captionH = style.captionSize + 16;
  ctx.drawPhoto(photos[0], m, m + captionH, ctx.width - 2 * m, ctx.height - 2 * m - captionH, fonts);
  drawCaption(ctx, caption || "", m, m + captionH / 2 - style.captionSize / 2, ctx.width - 2 * m, { fonts, style });
}

function splitAlongLongAxis(ctx, count, gutter) {
  const portrait = ctx.height >= ctx.width;
  const slots = [];
  if (portrait) {
    const h = (ctx.height - gutter * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      slots.push({ x: 0, y: ctx.height - h * (i + 1) - gutter * i, w: ctx.width, h });
    }
  } else {
    const w = (ctx.width - gutter * (count - 1)) / count;
    for (let i = 0; i < count; i++) {
      slots.push({ x: w * i + gutter * i, y: 0, w, h: ctx.height });
    }
  }
  return slots;
}

export function TWO_UP(ctx, { photos, caption, fonts, style }) {
  const m = style.margin;
  const gutter = style.gutter;
  const slots = splitAlongLongAxis({ width: ctx.width - 2 * m, height: ctx.height - 2 * m }, 2, gutter);
  slots.forEach((s, i) => {
    ctx.drawPhoto(photos[i], m + s.x, m + s.y, s.w, s.h, fonts);
  });
  if (caption) drawCaption(ctx, caption, m, m / 2, ctx.width - 2 * m, { fonts, style });
}

export function THREE_UP(ctx, { photos, caption, fonts, style }) {
  const m = style.margin;
  const gutter = style.gutter;
  const slots = splitAlongLongAxis({ width: ctx.width - 2 * m, height: ctx.height - 2 * m }, 3, gutter);
  slots.forEach((s, i) => {
    ctx.drawPhoto(photos[i], m + s.x, m + s.y, s.w, s.h, fonts);
  });
  if (caption) drawCaption(ctx, caption, m, m / 2, ctx.width - 2 * m, { fonts, style });
}

export function FOUR_GRID(ctx, { photos, caption, fonts, style }) {
  const m = style.margin;
  const g = style.gutter;
  const cellW = (ctx.width - 2 * m - g) / 2;
  const cellH = (ctx.height - 2 * m - g) / 2;
  const positions = [
    { x: m, y: m + cellH + g },
    { x: m + cellW + g, y: m + cellH + g },
    { x: m, y: m },
    { x: m + cellW + g, y: m },
  ];
  positions.forEach((p, i) => ctx.drawPhoto(photos[i], p.x, p.y, cellW, cellH, fonts));
  if (caption) drawCaption(ctx, caption, m, 2, ctx.width - 2 * m, { fonts, style });
}

export function CONTACT_SHEET(ctx, { photos, caption, fonts, style }) {
  // A dense grid of small thumbnails -- the "roll" made visible.
  const m = style.margin * 0.6;
  const cols = 3;
  const rows = Math.ceil(photos.length / cols) || 3;
  const g = style.gutter * 0.5;
  const cellW = (ctx.width - 2 * m - g * (cols - 1)) / cols;
  const cellH = (ctx.height - 2 * m - g * (rows - 1)) / rows;
  photos.slice(0, cols * rows).forEach((photo, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = m + col * (cellW + g);
    const y = ctx.height - m - (row + 1) * cellH - row * g;
    ctx.drawPhoto(photo, x, y, cellW, cellH, fonts);
  });
  if (caption) drawCaption(ctx, caption, m, m * 0.3, ctx.width - 2 * m, { fonts, style });
}

export function ASYMMETRIC_PAIR(ctx, { photos, caption, fonts, style }) {
  const m = style.margin;
  const g = style.gutter;
  const bigW = (ctx.width - 2 * m - g) * 0.62;
  const smallW = ctx.width - 2 * m - g - bigW;
  const smallH = (ctx.height - 2 * m) * 0.55;
  ctx.drawPhoto(photos[0], m, m, bigW, ctx.height - 2 * m, fonts);
  ctx.drawPhoto(photos[1], m + bigW + g, m, smallW, smallH, fonts);
  if (caption) {
    // caption sits in the whitespace left above the small photo
    drawCaption(ctx, caption, m + bigW + g, m + smallH + 8, smallW, { fonts, style });
  }
}

export function PORTRAIT_STACK(ctx, { photos, caption, fonts, style }) {
  const m = style.margin;
  const g = style.gutter;
  const count = Math.min(photos.length, 3);
  const weights = count === 3 ? [0.45, 0.3, 0.25] : count === 2 ? [0.6, 0.4] : [1];
  const availH = ctx.height - 2 * m - g * (count - 1);
  let y = ctx.height - m;
  for (let i = 0; i < count; i++) {
    const h = availH * weights[i];
    y -= h;
    ctx.drawPhoto(photos[i], m, y, ctx.width - 2 * m, h, fonts);
    y -= g;
  }
  if (caption) drawCaption(ctx, caption, m, m / 2, ctx.width - 2 * m, { fonts, style });
}

export const PRIMITIVES = {
  FULL_BLEED,
  HERO_IMAGE,
  TWO_UP,
  THREE_UP,
  FOUR_GRID,
  CONTACT_SHEET,
  IMAGE_WITH_CAPTION,
  ASYMMETRIC_PAIR,
  PORTRAIT_STACK,
};

export function drawPage(ctx, pageSpec, fonts, style) {
  const fn = PRIMITIVES[pageSpec.primitive];
  if (!fn) throw new Error(`Unknown layout primitive "${pageSpec.primitive}"`);
  fn(ctx, { photos: pageSpec.photos, caption: pageSpec.caption, meta: pageSpec.meta, fonts, style });
}
