"use client";
// Recipes modal: save the current plan as a reusable "recipe" (JSON), list saved
// recipes, load one back (which regenerates the data), and delete.
import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import type { Plan } from "@/lib/synthetic/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Trash2, Upload } from "lucide-react";

interface RecipeMeta {
  id: string;
  name: string;
  createdAt: string;
}

export function RecipesModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { plan, generate, setMode } = useStore();
  const [recipes, setRecipes] = useState<RecipeMeta[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api<{ recipes: RecipeMeta[] }>("/api/recipes")
      .then((d) => setRecipes(d.recipes))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  async function save() {
    if (!plan || !name.trim()) return;
    setBusy("save");
    try {
      await api("/api/recipes", { method: "POST", body: JSON.stringify({ name: name.trim(), recipe: plan }) });
      setName("");
      load();
    } finally {
      setBusy(null);
    }
  }

  async function loadRecipe(id: string) {
    setBusy(id);
    try {
      // Fetch the full recipe (includes the plan JSON) — reuse the list endpoint
      // then find; for simplicity we re-fetch and pick. (Backend returns meta only,
      // so we load by id via a dedicated fetch is not available; instead we stored
      // recipe in the row — fetch full list including recipe.)
      const all = await api<{ recipes: (RecipeMeta & { recipe?: string })[] }>("/api/recipes?full=1");
      const r = all.recipes.find((x) => x.id === id);
      if (r?.recipe) {
        const loadedPlan = JSON.parse(r.recipe) as Plan;
        setMode("tabular");
        await generate(loadedPlan);
        onClose();
      }
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy("del-" + id);
    try {
      await api(`/api/recipes?id=${id}`, { method: "DELETE" });
      load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Saved recipes</DialogTitle>
          <DialogDescription>
            Save the current rules/trends as a recipe and reload it later. Recipes are private to your account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {plan && (
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Recipe name…" />
              <Button onClick={save} disabled={!name.trim() || busy === "save"} className="bg-emerald-600 hover:bg-emerald-700">
                {busy === "save" ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              </Button>
            </div>
          )}

          <div className="max-h-72 overflow-y-auto space-y-2">
            {loading ? (
              <div className="flex justify-center py-4"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
            ) : recipes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No saved recipes yet.</p>
            ) : (
              recipes.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => loadRecipe(r.id)} disabled={busy === r.id}>
                      {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)} disabled={busy === "del-" + r.id}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
