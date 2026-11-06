// Beta V1 page layout. ONE pure function (layoutPage) turns a page spec +
// design settings into a list of drawing operations in panel-local
// coordinates (origin bottom-left, y up). Two executors run those same
// operations: the PDF writer below, and a canvas painter in web/index.html
// for the on-screen preview -- so the preview matches the printout.
//
// Look modelled on a real Dirty Little Zine export: photos run the full
// width of the panel and sit vertically centered with the caption in the
// gap below; the cover is full-bleed with the title over it; any page can
// instead be a solid-color text page (e.g. a "Fin." back cover).

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { getImpositionLayout } from "../zine/imposition.js";
import { PanelContext } from "./geometry.js";

export const PALETTE = {
  ink: [26, 26, 26],
  white: [255, 255, 255],
  yellow: [255, 217, 59],
  blue: [43, 59, 255],
  blush: [255, 143, 177],
};
export const FRAME_MARGIN = { none: 0, thin: 10, wide: 22 };

export function panelSize(paperSize) {
  const { panelWidth, panelHeight } = getImpositionLayout(paperSize);
  return { w: panelWidth, h: panelHeight };
}

// fit: "cover" fills the box (crops), "contain" shows the whole photo.
// zoom >= 1 enlarges; panX/panY in [-1,1] slide the photo within the
// room it has (positive = right / up).
export function placePhoto(iw, ih, bw, bh, fit, zoom, panX, panY) {
  const base = fit === "cover" ? Math.max(bw / iw, bh / ih) : Math.min(bw / iw, bh / ih);
  const sc = base * Math.max(0.5, zoom || 1);
  const dw = iw * sc;
  const dh = ih * sc;
  const rx = Math.abs(bw - dw) / 2;
  const ry = Math.abs(bh - dh) / 2;
  return { dx: (bw - dw) / 2 + (panX || 0) * rx, dy: (bh - dh) / 2 + (panY || 0) * ry, dw, dh };
}

function wrap(text, size, maxW, measure) {
  const out = [];
  String(text || "").split("\n").forEach((para) => {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(""); return; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = line + " " + words[i];
      if (measure(next, size) <= maxW) line = next;
      else { out.push(line); line = words[i]; }
    }
    out.push(line);
  });
  return out;
}

const onDark = (key) => key === "ink" || key === "blue";

export function layoutPage(spec, design, W, H, measure, isCover) {
  const ops = [];
  if (spec.kind === "text") {
    const bgKey = spec.bg || design.textBg || "ink";
    ops.push({ t: "rect", x: 0, y: 0, w: W, h: H, c: PALETTE[bgKey] || PALETTE.ink });
    const size = design.textSize || 44;
    const lines = wrap(spec.text, size, W - 48, measure);
    const lh = size * 1.12;
    const top = H / 2 + (lines.length * lh) / 2;
    const col = PALETTE[onDark(bgKey) ? "white" : "ink"];
    lines.forEach((s, i) => ops.push({ t: "text", s, x: W / 2, y: top - size * 0.85 - i * lh, size, c: col, align: "center" }));
    return { ops, coversPage: true };
  }

  const m = FRAME_MARGIN[design.frame] || 0;
  const cap = !isCover && spec.caption && spec.caption.trim() ? spec.caption.trim() : "";
  const capSize = design.capSize || 10;
  const R = cap ? capSize * 2.6 : 0;
  const box = { x: m, y: m + R, w: W - 2 * m, h: H - 2 * m - 2 * R };

  let fit = spec.fit || "auto";
  if (fit === "auto") {
    if (isCover) {
      const ia = spec.iw / spec.ih;
      const ba = box.w / box.h;
      fit = Math.abs(ia - ba) / ba < 0.3 ? "cover" : "contain";
    } else fit = "contain";
  }
  const pl = placePhoto(spec.iw, spec.ih, box.w, box.h, fit, spec.zoom, spec.panX, spec.panY);
  const img = { t: "img", ref: spec.imgRef, x: box.x + pl.dx, y: box.y + pl.dy, w: pl.dw, h: pl.dh, clip: box };
  ops.push(img);
  const coversPage = box.x <= 0.5 && box.y <= 0.5 && box.w >= W - 1 && box.h >= H - 1 &&
    img.x <= 0.5 && img.y <= 0.5 && img.x + img.w >= W - 0.5 && img.y + img.h >= H - 0.5;

  if (cap) {
    const lines = wrap(cap, capSize, W - 32, measure).slice(0, 2);
    const lh = capSize * 1.15;
    const top = m + R / 2 + (lines.length * lh) / 2;
    lines.forEach((s, i) => ops.push({ t: "text", s, x: W / 2, y: top - capSize * 0.85 - i * lh, size: capSize, c: PALETTE.ink, align: "center" }));
  }

  const T = design.title || {};
  if (isCover && T.show !== false && ((T.text && T.text.trim()) || (T.sub && T.sub.trim()))) {
    const size = T.size || 26;
    const subSize = T.subSize || 12;
    const inset = 22 + m;
    const maxW = W - 2 * inset;
    const titleText = T.upper === false ? T.text : String(T.text || "").toUpperCase();
    const tl = T.text && T.text.trim() ? wrap(titleText, size, maxW, measure) : [];
    const sl = T.sub && T.sub.trim() ? wrap(T.sub, subSize, maxW, measure) : [];
    const gap = tl.length && sl.length ? size * 0.35 : 0;
    const blockH = tl.length * size * 1.12 + gap + sl.length * subSize * 1.15;
    const pos = T.pos || "bc";
    const v = pos[0];
    const h = pos[1];
    const top = v === "t" ? H - inset : v === "m" ? H / 2 + blockH / 2 : inset + blockH;
    const align = h === "l" ? "left" : h === "r" ? "right" : "center";
    const ax = h === "l" ? inset : h === "r" ? W - inset : W / 2;
    const colKey = T.color && T.color !== "auto" ? T.color : coversPage ? "white" : "ink";
    const col = PALETTE[colKey] || PALETTE.white;
    tl.forEach((s, i) => ops.push({ t: "text", s, x: ax, y: top - size * 0.85 - i * size * 1.12, size, c: col, align }));
    const subTop = top - tl.length * size * 1.12 - gap;
    sl.forEach((s, j) => ops.push({ t: "text", s, x: ax, y: subTop - subSize * 0.85 - j * subSize * 1.15, size: subSize, c: col, align }));
  }
  return { ops, coversPage };
}

// Contextual letter swaps (calt/liga) make pdf-lib misplace glyphs in some
// fonts -- the handwritten one came out as "OU R NIGH T". Plain glyphs only.
const NO_FANCY_FEATURES = { liga: false, clig: false, calt: false, rlig: false, dlig: false, ccmp: false, locl: false, mark: false, mkmk: false };

const toRgb = (c) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);

function runOps(ctx, ops, font, images) {
  for (const op of ops) {
    if (op.t === "rect") ctx.drawRect(op.x, op.y, op.w, op.h, { color: toRgb(op.c) });
    else if (op.t === "img") {
      ctx.beginClip(op.clip.x, op.clip.y, op.clip.w, op.clip.h);
      ctx.drawImageAt(images[op.ref], op.x, op.y, op.w, op.h);
      ctx.endClip();
    } else if (op.t === "text") {
      const w = font.widthOfTextAtSize(op.s, op.size);
      const x = op.align === "center" ? op.x - w / 2 : op.align === "right" ? op.x - w : op.x;
      ctx.drawText(op.s, x, op.y, { size: op.size, font, color: toRgb(op.c) });
    }
  }
}

// specs: 8 page specs (index 0 = page 1). images: embedded pdf-lib images
// keyed by spec.imgRef. fontBytes: { slab, bold, hand, serif, type } TTFs.
export async function renderZine({ pdfDoc, specs, design, paperSize = "A4", images, fontBytes = {}, cutGuide = true }) {
  pdfDoc.registerFontkit(fontkit);
  const bytes = fontBytes[design.font];
  const font = bytes ? await pdfDoc.embedFont(bytes, { subset: false, features: NO_FANCY_FEATURES }) : await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const measure = (s, size) => font.widthOfTextAtSize(s, size);
  const { sheet, panels, panelWidth } = getImpositionLayout(paperSize);

  const page = pdfDoc.addPage([sheet.width, sheet.height]);
  for (const panel of panels) {
    const ctx = new PanelContext(page, { x: panel.x, y: panel.y, width: panel.width, height: panel.height, rotationDeg: panel.rotationDeg });
    const { ops } = layoutPage(specs[panel.page - 1], design, panel.width, panel.height, measure, panel.page === 1);
    runOps(ctx, ops, font, images);
  }
  if (cutGuide) {
    const y = sheet.height / 2;
    page.drawLine({ start: { x: panelWidth, y }, end: { x: panelWidth * 3, y }, thickness: 0.6, color: rgb(0.55, 0.55, 0.55), dashArray: [4, 3] });
    page.drawText("cut here", { x: panelWidth + 3, y: y + 2, size: 5, font: helv, color: rgb(0.55, 0.55, 0.55) });
  }
  pdfDoc.setTitle("We hung out");
  pdfDoc.setProducer("We hung out zine engine");
  return pdfDoc.save();
}
