import fs from "fs/promises";
import os from "os";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { getSupabaseAdmin } from "./_lib/supabaseClient.js";
import { runSelectionPipeline } from "../src/ai/pipeline.js";
import { buildZinePages } from "../src/ai/buildZinePages.js";
import { composeZine } from "../src/zine/composeZine.js";
import { renderPrintPDF, renderPreviewPDF } from "../src/render/pdfRenderer.js";

// This runs the whole pipeline synchronously inside one request. Fine for
// a roll with a normal number of photos; a roll with hundreds of photos
// and a real (non-mock) vision call per photo could run long enough to
// hit Vercel's function time limit -- check your current plan's limit if
// that happens. The real fix at that scale is a queue/background job
// instead of one long request; out of scope for this slice.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }
  const { rollId } = req.body || {};
  if (!rollId) {
    res.status(400).json({ error: "Missing rollId" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wehungout-"));

  try {
    const { data: roll, error: rollErr } = await supabase.from("rolls").select("*").eq("id", rollId).single();
    if (rollErr || !roll) throw new Error("Roll not found");

    const { data: photoRows, error: photosErr } = await supabase
      .from("roll_photos")
      .select("*")
      .eq("roll_id", rollId)
      .order("taken_at", { ascending: true });
    if (photosErr) throw photosErr;
    if (!photoRows || !photoRows.length) throw new Error("This roll has no photos yet");

    await supabase.from("zines").upsert(
      { roll_id: rollId, status: "developing", style: roll.style, updated_at: new Date().toISOString() },
      { onConflict: "roll_id" }
    );

    // Download each photo from storage to a local temp file -- the
    // existing pipeline (built for the CLI demo) reads photos by file
    // path, so this keeps that code unchanged rather than forking it
    // into a buffer-based version just for the serverless path.
    const photoInputs = [];
    for (const row of photoRows) {
      const { data: blob, error: dlErr } = await supabase.storage.from("photos").download(row.storage_path);
      if (dlErr) throw new Error(`Couldn't download ${row.storage_path}: ${dlErr.message}`);
      const buffer = Buffer.from(await blob.arrayBuffer());
      const ext = path.extname(row.storage_path) || ".jpg";
      const filePath = path.join(tmpDir, `${row.id}${ext}`);
      await fs.writeFile(filePath, buffer);
      photoInputs.push({ id: row.id, filePath, timestamp: new Date(row.taken_at) });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY; // optional -- falls back to the offline heuristic if unset
    const result = await runSelectionPipeline(photoInputs, { apiKey, styleName: roll.style || "DOCUMENTARY" });

    const printDoc = await PDFDocument.create();
    const printPages = composeZine(await buildZinePages(result.selection, result.candidatesById, printDoc));
    const printBytes = await renderPrintPDF(printPages, { paperSize: "A4", styleName: roll.style || "DOCUMENTARY", pdfDoc: printDoc });

    const previewDoc = await PDFDocument.create();
    const previewPages = composeZine(await buildZinePages(result.selection, result.candidatesById, previewDoc));
    const previewBytes = await renderPreviewPDF(previewPages, { paperSize: "A4", styleName: roll.style || "DOCUMENTARY", pdfDoc: previewDoc });

    const printPath = `${rollId}/print-A4.pdf`;
    const previewPath = `${rollId}/preview.pdf`;
    await supabase.storage.from("zines").upload(printPath, printBytes, { contentType: "application/pdf", upsert: true });
    await supabase.storage.from("zines").upload(previewPath, previewBytes, { contentType: "application/pdf", upsert: true });

    await supabase
      .from("zines")
      .update({
        status: "ready",
        selection: result.selection,
        print_pdf_path: printPath,
        preview_pdf_path: previewPath,
        updated_at: new Date().toISOString(),
      })
      .eq("roll_id", rollId);

    const { data: printUrl } = supabase.storage.from("zines").getPublicUrl(printPath);
    const { data: previewUrl } = supabase.storage.from("zines").getPublicUrl(previewPath);

    res.status(200).json({
      status: "ready",
      printUrl: printUrl.publicUrl,
      previewUrl: previewUrl.publicUrl,
      usedRealAI: Boolean(apiKey),
    });
  } catch (err) {
    console.error(err);
    await supabase
      .from("zines")
      .upsert({ roll_id: rollId, status: "failed", error: String(err.message || err), updated_at: new Date().toISOString() }, { onConflict: "roll_id" });
    res.status(500).json({ error: String(err.message || err) });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
