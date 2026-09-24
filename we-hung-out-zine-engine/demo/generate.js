import fs from "fs";
import path from "path";
import { composeZine } from "../src/zine/composeZine.js";
import { renderPrintPDF, renderPreviewPDF } from "../src/render/pdfRenderer.js";
import { FOLD_INSTRUCTIONS } from "../src/zine/imposition.js";
import { DOCUMENTARY_ZINE, SCRAPBOOK_ZINE } from "./sampleZine.js";

const OUT_DIR = new URL("../output/", import.meta.url).pathname;
fs.mkdirSync(OUT_DIR, { recursive: true });

async function build(name, pages, styleName, paperSize) {
  const zine = composeZine(pages);
  const printBytes = await renderPrintPDF(zine, { paperSize, styleName });
  const previewBytes = await renderPreviewPDF(zine, { paperSize, styleName });

  const printPath = path.join(OUT_DIR, `${name}-print-${paperSize}.pdf`);
  const previewPath = path.join(OUT_DIR, `${name}-preview.pdf`);
  fs.writeFileSync(printPath, printBytes);
  fs.writeFileSync(previewPath, previewBytes);

  console.log(`✔ ${name} (${styleName}, ${paperSize})`);
  console.log(`  print sheet:  ${printPath}`);
  console.log(`  preview:      ${previewPath}`);
}

async function main() {
  await build("documentary", DOCUMENTARY_ZINE, "DOCUMENTARY", "A4");
  await build("scrapbook", SCRAPBOOK_ZINE, "SCRAPBOOK", "A4");
  await build("documentary-letter", DOCUMENTARY_ZINE, "DOCUMENTARY", "LETTER");

  console.log("\nFold instructions (for the print-sheet PDFs):");
  FOLD_INSTRUCTIONS.forEach((step, i) => console.log(`  ${i + 1}. ${step}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
