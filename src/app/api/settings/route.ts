// /api/settings — GET returns provider/model (NEVER the API key).
// PUT saves the user's AI provider/model/key. The key is only ever stored
// server-side and used by the backend to call the AI model.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET: return the current provider/model. The API key is intentionally omitted.
// Default provider is Groq (uses the GROQ_API_KEY from .env) per user request.
export async function GET() {
  const defaultModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ provider: "groq", model: defaultModel, hasKey: true });

  const s = await db.settings.findUnique({ where: { userId: user.id } });
  return NextResponse.json({
    provider: s?.provider ?? "groq",
    model: s?.model ?? defaultModel,
    hasKey: Boolean(s?.apiKey) || true, // env key is always available
  });
}

const PutSchema = z.object({
  provider: z.enum(["zai", "groq"]),
  model: z.string().max(80).optional(),
  apiKey: z.string().max(400).optional().nullable(),
});

// PUT: save provider/model/key. If apiKey is undefined we keep the existing one;
// if it's an empty string we clear it.
export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid settings." }, { status: 400 });
  }
  const { provider, model, apiKey } = parsed.data;

  // Build the update data. Don't overwrite an existing key with undefined.
  const defaultModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
  const data: { provider: string; model?: string; apiKey?: string | null } = {
    provider,
    model: model || defaultModel,
  };
  if (apiKey !== undefined) data.apiKey = apiKey || null;

  await db.settings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, provider, model: model || defaultModel, apiKey: apiKey || null },
    update: data,
  });

  return NextResponse.json({ ok: true });
}
