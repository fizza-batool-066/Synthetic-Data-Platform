// POST /api/generate/chat — change an existing dataset with one sentence.
// Uses the AI to turn the sentence into rule weight overrides, then regenerates.
import { NextResponse } from "next/server";
import { generateFromPlan, type Plan } from "@/lib/synthetic";
import { aiChatEdit, AiError } from "@/lib/ai";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const plan = body?.plan as Plan | undefined;
  const sentence = body?.sentence?.toString().trim();
  if (!plan || !sentence) {
    return NextResponse.json({ error: "Both a plan and a sentence are required." }, { status: 400 });
  }

  try {
    const { plan: newPlan, changes } = await aiChatEdit(plan, sentence);
    const result = generateFromPlan(newPlan);
    return NextResponse.json({ plan: newPlan, result, changes });
  } catch (e) {
    if (e instanceof AiError) {
      return NextResponse.json({ error: e.message }, { status: e.kind === "no_key" ? 400 : 500 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chat edit failed." },
      { status: 500 },
    );
  }
}
