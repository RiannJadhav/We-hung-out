// Browser entry point: bundled by esbuild into web/zine-engine.js and
// exposed as window.ZineEngine. Everything runs in the person's browser.

import { PDFDocument } from "pdf-lib";
import { renderZine, layoutPage, placePhoto, panelSize, PALETTE, FRAME_MARGIN } from "../render/v1.js";

export { layoutPage, placePhoto, panelSize, PALETTE, FRAME_MARGIN };

// photos: array of JPEG byte arrays. pages: 8 entries, each either
// { kind:"photo", photo:<index into photos>, fit, zoom, panX, panY, caption }
// or { kind:"text", text, bg }.
export async function buildZine({ photos, pages, design, paperSize = "A4", fontBytes = {} }) {
  const pdfDoc = await PDFDocument.create();
  const images = [];
  for (const bytes of photos) images.push(await pdfDoc.embedJpg(bytes));
  const specs = pages.map((p) =>
    p.kind === "text" ? { ...p } : { ...p, imgRef: p.photo, iw: images[p.photo].width, ih: images[p.photo].height }
  );
  const printBytes = await renderZine({ pdfDoc, specs, design, paperSize, images, fontBytes });
  return { printBytes };
}
