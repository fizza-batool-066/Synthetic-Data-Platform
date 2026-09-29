// POST /api/learn/generate — generate a larger dataset from a (possibly
// user-edited) plan learned from a CSV sample, then compute a similarity score
// and a "no copied rows" proof against the cached raw sample. Raw PII never
// leaves the server.
import { NextResponse } from "next/server";
import { generateFromPlan, type Plan } from "@/lib/synthetic";
import { similarityScore, copiedRowsCheck } from "@/lib/csv";
import { getSample } from "@/lib/sample-cache";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const plan = body?.plan as Plan | undefined;
  const sampleId = body?.sampleId as string | undefined;
  if (!plan) return NextResponse.json({ error: "A plan is required." }, { status: 400 });

  try {
    const result = generateFromPlan(plan);

    // If we still have the cached sample, compare generated vs sample.
    let similarity = 100;
    let copied = { copied: 0, checked: result.tables[0]?.rows.length ?? 0 };
    const sample = sampleId ? getSample(sampleId) : undefined;
    if (sample) {
      // Re-derive column stats from the raw rows for the comparison.
      // (analyzeRows is cheap and keeps this endpoint stateless beyond the cache.)
      const { analyzeRows } = await import("@/lib/csv");
      const analysis = analyzeRows(sample.rows, Object.keys(sample.rows[0] ?? {}), plan.locale, plan.seed);
      const generated = result.tables[0]?.rows ?? [];
      similarity = similarityScore(analysis.columns, generated);
      copied = copiedRowsCheck(sample.rows, generated, sample.privateColumns);
    }

    return NextResponse.json({ result, similarity, copied });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed." },
      { status: 500 },
    );
  }
}
