import fs from "fs";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { generateSamplePhotos } from "./samplePhotos.js";
import { runSelectionPipeline } from "../src/ai/pipeline.js";
import { buildZinePages } from "../src/ai/buildZinePages.js";
import { composeZine } from "../src/zine/composeZine.js";
import { renderPrintPDF, renderPreviewPDF } from "../src/render/pdfRenderer.js";

const OUT_DIR = new URL("../output/", import.meta.url).pathname;

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log("Generating a synthetic sample roll...");
  const photoInputs = await generateSamplePhotos();
  console.log(`  ${photoInputs.length} photos generated (includes several near-duplicate bursts + one blurred one)\n`);

  // No ANTHROPIC_API_KEY set here on purpose, so this runs entirely on the
  // free image stats + heuristic fallback -- set process.env.ANTHROPIC_API_KEY
  // to see the same pipeline use real vision calls instead.
  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log(apiKey ? "Using real Anthropic vision calls.\n" : "No ANTHROPIC_API_KEY set -- running on the offline heuristic fallback.\n");

  const result = await runSelectionPipeline(photoInputs, {
    apiKey,
    styleName: "DOCUMENTARY",
    onStage: (message, detail) => {
      if (detail?.total) {
        if (detail.done === detail.total) console.log(`${message} (${detail.done}/${detail.total})`);
      } else {
        console.log(message);
      }
    },
  });

  console.log(`\nClustered ${result.analyses.length} photos into ${result.clusters.length} distinct moments:`);
  result.clusters
    .sort((a, b) => b.size - a.size)
    .forEach((c) => console.log(`  ${c.representative.id.padEnd(14)} stood in for ${c.size} similar shot(s)`));

  console.log(`\nShortlisted ${result.shortlist.length} candidates for editorial selection.`);
  console.log("\nFinal 8-page selection:");
  result.selection.forEach((p, i) =>
    console.log(`  Page ${i + 1}: ${p.primitive.padEnd(16)} <- [${p.photoIds.join(", ")}]  "${p.caption}"`)
  );

  // Each output PDF is its own PDFDocument, so photos are embedded fresh
  // into whichever doc will actually contain them (pdf-lib image refs
  // aren't portable across documents).
  const printDoc = await PDFDocument.create();
  const printPages = composeZine(await buildZinePages(result.selection, result.candidatesById, printDoc));
  const printBytes = await renderPrintPDF(printPages, { paperSize: "A4", styleName: "DOCUMENTARY", pdfDoc: printDoc });

  const previewDoc = await PDFDocument.create();
  const previewPages = composeZine(await buildZinePages(result.selection, result.candidatesById, previewDoc));
  const previewBytes = await renderPreviewPDF(previewPages, { paperSize: "A4", styleName: "DOCUMENTARY", pdfDoc: previewDoc });

  const printPath = path.join(OUT_DIR, "ai-pipeline-print-A4.pdf");
  const previewPath = path.join(OUT_DIR, "ai-pipeline-preview.pdf");
  fs.writeFileSync(printPath, printBytes);
  fs.writeFileSync(previewPath, previewBytes);

  console.log(`\nWrote:\n  ${printPath}\n  ${previewPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
