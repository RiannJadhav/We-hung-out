import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getLandscapeSheetSize, getPortraitPageSize, PanelContext } from "./geometry.js";
import { getImpositionLayout } from "../zine/imposition.js";
import { drawPage } from "../layout/primitives.js";
import { resolveStyle } from "../zine/styles.js";

async function embedFonts(pdfDoc) {
  return {
    helvetica: await pdfDoc.embedFont(StandardFonts.Helvetica),
    helveticaBold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    timesItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
    label: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

/**
 * Renders the single physical print sheet: one landscape page, 8 panels,
 * positioned and rotated per the fold-and-cut imposition in
 * zine/imposition.js. This is the file that actually goes to the printer.
 */
export async function renderPrintPDF(zinePages, { paperSize = "A4", styleName = "DOCUMENTARY", pdfDoc } = {}) {
  pdfDoc = pdfDoc || (await PDFDocument.create());
  const fonts = await embedFonts(pdfDoc);
  const style = resolveStyle(styleName);
  const embeddedStyle = { ...style, caption: fonts[style.fontKey], captionItalic: fonts.timesItalic };

  const sheet = getLandscapeSheetSize(paperSize);
  const page = pdfDoc.addPage([sheet.width, sheet.height]);
  const { panels } = getImpositionLayout(paperSize);

  for (const panel of panels) {
    const pageSpec = zinePages.find((p) => p.page === panel.page);
    if (!pageSpec) throw new Error(`Missing page spec for page ${panel.page}`);
    const ctx = new PanelContext(page, {
      x: panel.x,
      y: panel.y,
      width: panel.width,
      height: panel.height,
      rotationDeg: panel.rotationDeg,
    });
    drawPage(ctx, pageSpec, fonts, embeddedStyle);
  }

  pdfDoc.setTitle("We hung out -- print sheet");
  pdfDoc.setProducer("We hung out zine engine");
  return pdfDoc.save();
}

/**
 * Renders an 8-page, reading-order, right-side-up PDF for on-screen
 * preview / sharing before the person prints and folds anything. Each
 * page is sized to the panel's actual proportions (not blown up to a
 * full portrait sheet) so it matches what will physically print.
 */
export async function renderPreviewPDF(zinePages, { paperSize = "A4", styleName = "DOCUMENTARY", pdfDoc } = {}) {
  pdfDoc = pdfDoc || (await PDFDocument.create());
  const fonts = await embedFonts(pdfDoc);
  const style = resolveStyle(styleName);
  const embeddedStyle = { ...style, caption: fonts[style.fontKey], captionItalic: fonts.timesItalic };

  const { panelWidth, panelHeight } = getImpositionLayout(paperSize);

  const sorted = [...zinePages].sort((a, b) => a.page - b.page);
  for (const pageSpec of sorted) {
    const page = pdfDoc.addPage([panelWidth, panelHeight]);
    const ctx = new PanelContext(page, { x: 0, y: 0, width: panelWidth, height: panelHeight, rotationDeg: 0 });
    drawPage(ctx, pageSpec, fonts, embeddedStyle);
    page.drawText(String(pageSpec.page), {
      x: panelWidth - 14,
      y: 6,
      size: 7,
      font: fonts.helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  pdfDoc.setTitle("We hung out -- preview");
  pdfDoc.setProducer("We hung out zine engine");
  return pdfDoc.save();
}
