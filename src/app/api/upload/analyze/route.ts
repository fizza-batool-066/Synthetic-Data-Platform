// POST /api/upload/analyze — learn trends from an uploaded CSV sample.
// Detects column types, masks private columns, builds a Plan, and caches the
// raw rows server-side (under a sampleId) so a later "learn/generate" call can
// compute a similarity score and a "no copied rows" proof without re-upload.
import { NextResponse } from "next/server";
import { parseCsvRows, analyzeRows } from "@/lib/csv";
import { cacheSample } from "@/lib/sample-cache";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    const locale = (form.get("locale") as string) || "en_US";
    const seed = Number(form.get("seed")) || 1;
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Please upload a CSV file." }, { status: 400 });
    }
    const text = await file.text();
    const { fields, rows } = parseCsvRows(text);
    const analysis = analyzeRows(rows, fields, locale, seed);
    // Cache the raw rows (server-side only) for the later comparison step.
    const sampleId = cacheSample(rows, analysis.privateColumns);
    return NextResponse.json({ analysis, sampleId });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not analyze the file." },
      { status: 500 },
    );
  }
}
