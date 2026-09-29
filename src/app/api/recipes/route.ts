// /api/recipes — save and list "recipes" (a plan/rules object as JSON).
// Requires login so recipes are private per user.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

// GET: list the current user's saved recipes. With ?full=1 the recipe JSON is
// included so a recipe can be reloaded into the generator.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const full = searchParams.get("full") === "1";
  const recipes = await db.recipe.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, createdAt: true, ...(full ? { recipe: true } : {}) },
  });
  return NextResponse.json({ recipes });
}

const SaveSchema = z.object({
  name: z.string().min(1).max(80),
  recipe: z.unknown(), // the full plan object
});

// POST: save a new recipe.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = SaveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid recipe." }, { status: 400 });
  const recipe = await db.recipe.create({
    data: {
      userId: user.id,
      name: parsed.data.name,
      recipe: JSON.stringify(parsed.data.recipe),
    },
  });
  return NextResponse.json({ id: recipe.id, name: recipe.name });
}

// DELETE: remove a recipe by id.
export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Recipe id required." }, { status: 400 });
  await db.recipe.deleteMany({ where: { id, userId: user.id } });
  return NextResponse.json({ ok: true });
}
