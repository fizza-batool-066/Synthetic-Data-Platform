// POST /api/realism-check — AI reviews a 20-row sample for impossible/fake values.
// Falls back gracefully (no AI) to the automated rule-based check only.
import { NextResponse } from "next/server";
import { type Plan } from "@/lib/synthetic";
import { aiRealismReview, AiError } from "@/lib/ai";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const plan = body?.plan as Plan | undefined;
  const sampleRows = body?.sampleRows as Record<string, unknown>[] | undefined;
  if (!plan || !sampleRows) {
    return NextResponse.json({ error: "A plan and sample rows are required." }, { status: 400 });
  }

  try {
    const review = await aiRealismReview(plan, sampleRows);
    return NextResponse.json(review);
  } catch (e) {
    if (e instanceof AiError) {
      return NextResponse.json(
        { issues: [], note: e.message },
        { status: e.kind === "no_key" ? 400 : 500 },
      );
    }
    return NextResponse.json({ issues: [], note: "Realism review failed." }, { status: 500 });
  }
}
