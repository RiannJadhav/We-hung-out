import fs from "fs/promises";
import os from "os";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { getSupabaseAdmin } from "./_lib/supabaseClient.js";
import { runAnalysisStages, runEditorialSelection } from "../src/ai/pipeline.js";
import { buildZinePages } from "../src/ai/buildZinePages.js";
import { composeZine } from "../src/zine/composeZine.js";
import { renderPrintPDF, renderPreviewPDF } from "../src/render/pdfRenderer.js";
import { stylesForVibe } from "../src/zine/vibes.js";

// Generates 3 zine variants per roll. Stage 1-3 (the expensive,
// per-photo analysis) runs ONCE; only Stage 4 (editorial selection --
// cheap, one call over the shortlist) repeats per style. Still one
// synchronous request for all 3 -- see the README's note on timeout
// risk, which applies 3x as much here as it did for a single zine.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }
  const { rollId, vibe } = req.body || {};
  if (!rollId) {
    res.status(400).json({ error: "Missing rollId" });
    return;
  }

  const supabase = getSupabaseAdmin();
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "wehungout-"));
  const styles = stylesForVibe(vibe);

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

    if (vibe) await supabase.from("rolls").update({ vibe }).eq("id", rollId);
    await Promise.all(
      styles.map((style) =>
        supabase.from("zines").upsert(
          { roll_id: rollId, style, status: "developing", updated_at: new Date().toISOString() },
          { onConflict: "roll_id,style" }
        )
      )
    );

    // Download each photo once, shared across all 3 variants.
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
    const { provider, shortlist, candidatesById } = await runAnalysisStages(photoInputs, { apiKey });

    const results = [];
    for (const style of styles) {
      const selection = await runEditorialSelection(shortlist, provider, { styleName: style });

      const printDoc = await PDFDocument.create();
      const printPages = composeZine(await buildZinePages(selection, candidatesById, printDoc));
      const printBytes = await renderPrintPDF(printPages, { paperSize: "A4", styleName: style, pdfDoc: printDoc });

      const previewDoc = await PDFDocument.create();
      const previewPages = composeZine(await buildZinePages(selection, candidatesById, previewDoc));
      const previewBytes = await renderPreviewPDF(previewPages, { paperSize: "A4", styleName: style, pdfDoc: previewDoc });

      const printPath = `${rollId}/${style}/print-A4.pdf`;
      const previewPath = `${rollId}/${style}/preview.pdf`;
      await supabase.storage.from("zines").upload(printPath, printBytes, { contentType: "application/pdf", upsert: true });
      await supabase.storage.from("zines").upload(previewPath, previewBytes, { contentType: "application/pdf", upsert: true });

      await supabase
        .from("zines")
        .update({
          status: "ready",
          selection,
          print_pdf_path: printPath,
          preview_pdf_path: previewPath,
          updated_at: new Date().toISOString(),
        })
        .eq("roll_id", rollId)
        .eq("style", style);

      const { data: printUrl } = supabase.storage.from("zines").getPublicUrl(printPath);
      const { data: previewUrl } = supabase.storage.from("zines").getPublicUrl(previewPath);
      results.push({ style, printUrl: printUrl.publicUrl, previewUrl: previewUrl.publicUrl });
    }

    res.status(200).json({ status: "ready", zines: results, usedRealAI: Boolean(apiKey) });
  } catch (err) {
    console.error(err);
    await Promise.all(
      styles.map((style) =>
        supabase
          .from("zines")
          .upsert({ roll_id: rollId, style, status: "failed", error: String(err.message || err), updated_at: new Date().toISOString() }, { onConflict: "roll_id,style" })
      )
    );
    res.status(500).json({ error: String(err.message || err) });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
