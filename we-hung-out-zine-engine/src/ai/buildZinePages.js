// Not one of the spec's four AI stages -- this is the glue between what
// the AI pipeline decides (which photo IDs go on which page, with which
// primitive) and what the existing render pipeline expects (real pdf-lib
// embedded images). Keeping this separate means primitives.js and
// pdfRenderer.js never had to change to support real photos.

import fs from "fs/promises";
import path from "path";

export async function buildZinePages(selection, candidatesById, pdfDoc) {
  const embeddedByPath = new Map();

  async function embed(filePath) {
    if (embeddedByPath.has(filePath)) return embeddedByPath.get(filePath);
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const image = ext === ".png" ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
    embeddedByPath.set(filePath, image);
    return image;
  }

  const pages = [];
  for (const pageSpec of selection) {
    const photos = [];
    for (const photoId of pageSpec.photoIds) {
      const candidate = candidatesById.get(photoId);
      if (!candidate) throw new Error(`Editorial selection referenced unknown photo id "${photoId}"`);
      const image = await embed(candidate.filePath);
      photos.push({ image });
    }
    pages.push({ primitive: pageSpec.primitive, photos, caption: pageSpec.caption });
  }
  return pages;
}
