// POST /api/generate — generate a dataset from a Plan (settings/template/csv modes).
// The plan fully describes the data; the same plan+seed always produces the
// same rows, so downloads can be regenerated deterministically.
import { NextResponse } from "next/server";
import { generateFromPlan, type Plan } from "@/lib/synthetic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !body.plan) {
    return NextResponse.json({ error: "A plan is required." }, { status: 400 });
  }
  try {
    const result = generateFromPlan(body.plan as Plan);
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed." },
      { status: 500 },
    );
  }
}
