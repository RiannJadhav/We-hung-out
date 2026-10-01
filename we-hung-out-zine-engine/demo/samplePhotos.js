import fs from "fs/promises";
import path from "path";
import { Jimp } from "jimp";

const OUT_DIR = new URL("./photos/", import.meta.url).pathname;

// A handful of distinct "scenes" (base color = stand-in for a real
// distinct moment/location), each shot as a small burst of near-identical
// frames -- simulating "took basically the same photo a few times in a
// row" -- plus a few one-off singles. One burst is deliberately blurred
// throughout to make sure Stage 3 doesn't just pick the sharpest thing.
// Frame-to-frame variation within a burst is a small moving highlight
// (stand-in for e.g. someone shifting slightly between shots) -- enough
// to make each file's bytes different, not enough to change which
// "moment" it's a photo of.
const BURSTS = [
  { id: "street", color: [0x3a, 0x47, 0x50], shots: 3 },
  { id: "table", color: [0x8d, 0x9a, 0x9c], shots: 2 },
  { id: "toast", color: [0xbd, 0x4f, 0x6c], shots: 5, blurAll: true },
  { id: "spill", color: [0xe8, 0xc5, 0x47], shots: 4 },
  { id: "outside", color: [0x5c, 0x80, 0x01], shots: 2 },
  { id: "group", color: [0x25, 0xa1, 0x8e], shots: 6 },
  { id: "walk", color: [0x0b, 0x13, 0x2b], shots: 2 },
];
const SINGLES = [
  { id: "riya", color: [0xa4, 0x24, 0x3b] },
  { id: "dev", color: [0xd8, 0x97, 0x3c] },
  { id: "menu", color: [0x5c, 0x6b, 0x73] },
  { id: "streetlight", color: [0x26, 0x46, 0x53] },
];

function toColorInt([r, g, b]) {
  return ((r << 24) | (g << 16) | (b << 8) | 0xff) >>> 0;
}

// Draws a small lighter "highlight" circle at a per-frame position so
// consecutive burst frames aren't byte-identical, without meaningfully
// changing the image's overall color signature.
function paintFrameJitter(img, frameIndex) {
  const cx = 80 + ((frameIndex * 53) % 320);
  const cy = 80 + ((frameIndex * 97) % 480);
  const r = 40;
  img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
    if ((x - cx) ** 2 + (y - cy) ** 2 < r * r) {
      this.bitmap.data[idx] = Math.min(255, this.bitmap.data[idx] + 40);
      this.bitmap.data[idx + 1] = Math.min(255, this.bitmap.data[idx + 1] + 40);
      this.bitmap.data[idx + 2] = Math.min(255, this.bitmap.data[idx + 2] + 40);
    }
  });
}

export async function generateSamplePhotos() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const inputs = [];
  let clock = new Date("2026-09-20T19:00:00");

  const advance = (mins) => {
    clock = new Date(clock.getTime() + mins * 60000);
    return new Date(clock);
  };

  for (const burst of BURSTS) {
    for (let i = 0; i < burst.shots; i++) {
      const img = new Jimp({ width: 480, height: 640, color: toColorInt(burst.color) });
      paintFrameJitter(img, i);
      if (burst.blurAll) img.blur(6);
      const filePath = path.join(OUT_DIR, `${burst.id}-${i}.png`);
      await img.write(filePath);
      inputs.push({ id: `${burst.id}-${i}`, filePath, timestamp: advance(0.5) });
    }
    advance(8 + Math.random() * 15);
  }

  for (const single of SINGLES) {
    const img = new Jimp({ width: 480, height: 640, color: toColorInt(single.color) });
    paintFrameJitter(img, 0);
    const filePath = path.join(OUT_DIR, `${single.id}.png`);
    await img.write(filePath);
    inputs.push({ id: single.id, filePath, timestamp: advance(5 + Math.random() * 20) });
  }

  return inputs.sort((a, b) => a.timestamp - b.timestamp);
}
