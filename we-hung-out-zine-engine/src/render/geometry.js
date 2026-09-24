// Geometry primitives shared by the imposition layout and the page renderers.
//
// Everything in the layout engine works in PDF points (1/72 inch), because
// that's the native unit pdf-lib expects and it avoids repeated unit
// conversion bugs.

export const MM_TO_PT = 72 / 25.4;
export const IN_TO_PT = 72;

// Landscape sheet dimensions for the two paper sizes the product promises.
// (portrait mm/in dims are the well-known standard sizes; we flip w/h for
// landscape since the zine imposition sheet is always landscape.)
export const PAPER_SIZES = {
  A4: { portraitWidth: 210 * MM_TO_PT, portraitHeight: 297 * MM_TO_PT },
  LETTER: { portraitWidth: 8.5 * IN_TO_PT, portraitHeight: 11 * IN_TO_PT },
};

export function getLandscapeSheetSize(paperSize) {
  const size = PAPER_SIZES[paperSize];
  if (!size) {
    throw new Error(
      `Unknown paper size "${paperSize}". Supported: ${Object.keys(PAPER_SIZES).join(", ")}`
    );
  }
  return { width: size.portraitHeight, height: size.portraitWidth };
}

export function getPortraitPageSize(paperSize) {
  const size = PAPER_SIZES[paperSize];
  if (!size) {
    throw new Error(
      `Unknown paper size "${paperSize}". Supported: ${Object.keys(PAPER_SIZES).join(", ")}`
    );
  }
  // A single zine page, read on its own (preview PDF), is one panel's
  // worth of a landscape sheet folded into a 4x2 grid: quarter width,
  // half height of the full sheet -- scaled up isn't correct, so instead
  // the preview just uses the panel's actual proportions at full sheet
  // scale (see previewRenderer.js for the exact size used).
  return { width: size.portraitWidth, height: size.portraitHeight };
}

/**
 * A PanelContext lets a layout primitive draw as if it owned a simple
 * axis-aligned rectangle from (0,0) to (width,height), y-up, without
 * knowing or caring whether that rectangle is physically rotated 180
 * degrees on the printed sheet (top row of the imposition grid always is --
 * see imposition.js). All the fold-order bookkeeping lives here, once.
 */
export class PanelContext {
  constructor(page, { x, y, width, height, rotationDeg = 0 }) {
    this.page = page;
    this.panelX = x;
    this.panelY = y;
    this.width = width;
    this.height = height;
    this.rotationDeg = rotationDeg;
  }

  // Transforms a local axis-aligned rect (lx, ly = bottom-left corner in
  // panel space) into the physical bottom-left corner on the sheet.
  // Local width/height are preserved -- a 180 rotation just mirrors the
  // anchor point, since the rect stays axis-aligned either way.
  _transformRect(lx, ly, w, h) {
    if (this.rotationDeg === 0) {
      return { x: this.panelX + lx, y: this.panelY + ly, w, h };
    }
    if (this.rotationDeg === 180) {
      return {
        x: this.panelX + (this.width - lx - w),
        y: this.panelY + (this.height - ly - h),
        w,
        h,
      };
    }
    throw new Error("PanelContext only supports 0 or 180 degree panels");
  }

  _transformPoint(lx, ly) {
    if (this.rotationDeg === 0) {
      return { x: this.panelX + lx, y: this.panelY + ly };
    }
    return { x: this.panelX + (this.width - lx), y: this.panelY + (this.height - ly) };
  }

  // Clips subsequent draws to a local rect. Caller MUST call endClip().
  beginClip(lx, ly, w, h) {
    const r = this._transformRect(lx, ly, w, h);
    const { pushGraphicsState, moveTo, lineTo, closePath, clip, endPath } = pdfLibOps();
    this.page.pushOperators(
      pushGraphicsState(),
      moveTo(r.x, r.y),
      lineTo(r.x + r.w, r.y),
      lineTo(r.x + r.w, r.y + r.h),
      lineTo(r.x, r.y + r.h),
      closePath(),
      clip(),
      endPath()
    );
  }

  endClip() {
    const { popGraphicsState } = pdfLibOps();
    this.page.pushOperators(popGraphicsState());
  }

  drawRect(lx, ly, w, h, opts = {}) {
    const r = this._transformRect(lx, ly, w, h);
    this.page.drawRectangle({ x: r.x, y: r.y, width: r.w, height: r.h, ...opts });
  }

  drawLine(lx1, ly1, lx2, ly2, opts = {}) {
    const p1 = this._transformPoint(lx1, ly1);
    const p2 = this._transformPoint(lx2, ly2);
    this.page.drawLine({ start: p1, end: p2, ...opts });
  }

  // text anchor (lx, ly) is the baseline start point in local space.
  drawText(text, lx, ly, opts = {}) {
    const p = this._transformPoint(lx, ly);
    const degrees = degreesHelper();
    this.page.drawText(text, {
      x: p.x,
      y: p.y,
      rotate: this.rotationDeg ? degrees(this.rotationDeg) : undefined,
      ...opts,
    });
  }

  // Draws an embedded pdf-lib image "cover-fit" into a local rect, cropping
  // (via clip) rather than distorting the aspect ratio.
  drawImageCover(image, lx, ly, w, h) {
    const imgW = image.width;
    const imgH = image.height;
    const scale = Math.max(w / imgW, h / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;
    const offsetX = (w - drawW) / 2;
    const offsetY = (h - drawH) / 2;

    this.beginClip(lx, ly, w, h);
    const r = this._transformRect(lx + offsetX, ly + offsetY, drawW, drawH);
    this.page.drawImage(image, { x: r.x, y: r.y, width: r.w, height: r.h });
    this.endClip();
  }

  // Draws a placeholder "photo" (colored rect + label) for demo/stub use,
  // in place of a real embedded photo. Same signature shape as
  // drawImageCover so primitives don't need to branch.
  drawPlaceholderCover(slot, lx, ly, w, h, fonts) {
    this.drawRect(lx, ly, w, h, { color: slot.color });
    if (slot.label) {
      const font = fonts.label;
      const size = Math.max(6, Math.min(w, h) * 0.09);
      const textWidth = font.widthOfTextAtSize(slot.label, size);
      this.drawText(slot.label, lx + (w - textWidth) / 2, ly + h / 2 - size / 2, {
        size,
        font,
        color: slot.textColor || rgbHelper()(1, 1, 1),
      });
    }
  }

  drawPhoto(slot, lx, ly, w, h, fonts) {
    if (slot && slot.image) {
      this.drawImageCover(slot.image, lx, ly, w, h);
    } else {
      this.drawPlaceholderCover(slot || { color: rgbHelper()(0.85, 0.85, 0.85) }, lx, ly, w, h, fonts);
    }
  }
}

// Small indirection so this file has no top-level import cycle issues and
// stays easy to copy/paste; pulled in lazily from pdf-lib.
import { pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath, degrees, rgb } from "pdf-lib";
function pdfLibOps() {
  return { pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath };
}
function degreesHelper() {
  return degrees;
}
function rgbHelper() {
  return rgb;
}
