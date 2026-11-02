// Browser entry point: bundled by esbuild into web/zine-engine.js and
// exposed as window.ZineEngine. Runs the same layout engine + renderer
// used server-side, entirely in the person's browser -- no upload, no
// server, no time limit, nothing leaves their device.

import { PDFDocument } from "pdf-lib";
import { composeZine } from "../zine/composeZine.js";
import { renderPrintPDF, renderPreviewPDF } from "../render/pdfRenderer.js";

// photos: array of 1-8 JPEG byte arrays (already shrunk by the page).
// If fewer than 8 are given, they repeat in order so all 8 pages fill.
export async function buildZine({ photos, title, paperSize = "A4" }) {
  if (!photos || !photos.length) throw new Error("Pick at least one photo");

  async function make(renderer) {
    const doc = await PDFDocument.create();
    const images = [];
    for (const bytes of photos) images.push(await doc.embedJpg(bytes));
    const pages = [];
    for (let i = 0; i < 8; i++) {
      pages.push({
        primitive: "HERO_IMAGE",
        photos: [{ image: images[i % images.length] }],
        caption: i === 0 ? title || "We hung out" : i === 7 ? "we hung out" : "",
      });
    }
    return renderer(composeZine(pages), { paperSize, styleName: "DOCUMENTARY", pdfDoc: doc });
  }

  return { printBytes: await make(renderPrintPDF), previewBytes: await make(renderPreviewPDF) };
}
