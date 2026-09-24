// The "no staples" single-sheet 8-page zine fold.
//
// One landscape sheet, printed on ONE side only, divided into a 4-column x
// 2-row grid of 8 panels. After printing you fold it in half (hamburger),
// fold in half again, unfold, cut a slit along the center crease spanning
// the two middle panels, then accordion-fold it into a little book. No
// glue or staples.
//
// The panel <-> page-number mapping below is the standard layout used
// across zine-making guides for this fold (e.g. the widely-reproduced
// grid-template-areas version: top row = pages 5,4,3,2 upside down; bottom
// row = pages 6,7,8,1 right-side up, with page 1 as the front cover and
// page 8 as the back cover). Getting this mapping right is the whole point
// of this module -- if you change it, refold a test print before trusting it.
//
// Grid (as it looks printed on the sheet, before folding):
//
//   col:        1        2        3        4
//   row 1:   page 5   page 4   page 3   page 2      <- each rotated 180°
//   row 2:   page 6   page 7   page 8   page 1      <- right-side up

import { getLandscapeSheetSize, PanelContext } from "../render/geometry.js";

const GRID = [
  // row 1 (top), rotated 180
  { page: 5, col: 0, row: 1, rotationDeg: 180 },
  { page: 4, col: 1, row: 1, rotationDeg: 180 },
  { page: 3, col: 2, row: 1, rotationDeg: 180 },
  { page: 2, col: 3, row: 1, rotationDeg: 180 },
  // row 2 (bottom), upright
  { page: 6, col: 0, row: 0, rotationDeg: 0 },
  { page: 7, col: 1, row: 0, rotationDeg: 0 },
  { page: 8, col: 2, row: 0, rotationDeg: 0 },
  { page: 1, col: 3, row: 0, rotationDeg: 0 },
];

/**
 * Returns the 8 panels for a given paper size, each with the physical
 * sheet position + rotation for its page number, plus panel width/height
 * (all in points).
 */
export function getImpositionLayout(paperSize = "A4") {
  const sheet = getLandscapeSheetSize(paperSize);
  const panelWidth = sheet.width / 4;
  const panelHeight = sheet.height / 2;

  const panels = GRID.map(({ page, col, row, rotationDeg }) => ({
    page,
    x: col * panelWidth,
    y: row * panelHeight,
    width: panelWidth,
    height: panelHeight,
    rotationDeg,
  }));

  return { sheet, panelWidth, panelHeight, panels };
}

/**
 * Creates a PanelContext for a given page number (1-8) on the given
 * pdf-lib page, using the imposition layout for the chosen paper size.
 */
export function getPanelContextForPage(page, pdfPage, paperSize = "A4") {
  const { panels } = getImpositionLayout(paperSize);
  const panel = panels.find((p) => p.page === page);
  if (!panel) throw new Error(`No panel found for page ${page}`);
  return new PanelContext(pdfPage, {
    x: panel.x,
    y: panel.y,
    width: panel.width,
    height: panel.height,
    rotationDeg: panel.rotationDeg,
  });
}

// Fold instructions surfaced to the end user alongside the download.
export const FOLD_INSTRUCTIONS = [
  "Print single-sided, landscape, no \"fit to page\" scaling.",
  "Fold the sheet in half top-to-bottom, then unfold.",
  "Fold it in half left-to-right, then unfold.",
  "Fold each short edge in to meet the center crease, then unfold -- you now have 8 panels.",
  "With the printed side out, fold the sheet in half top-to-bottom (this fold stays).",
  "Cut a slit along the center of that fold, through both layers, spanning only the two middle panels.",
  "Fold the sheet in half left-to-right, then push the two ends inward so the slit opens into a plus-shape.",
  "Fold all the panels together in the same direction -- you'll land on an 8-page booklet with page 1 on top.",
];
