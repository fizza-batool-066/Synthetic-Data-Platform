"use client";
// AI Settings modal. Lets the user choose the AI provider/model and paste an API
// key. The key is sent ONLY to the backend and is never read back — we only show
// whether a key is on file (hasKey). Shows friendly help for errors.
import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setAiStatus = useStore((s) => s.setAiStatus);
  const [provider, setProvider] = useState<"zai" | "groq">("groq");
  const [model, setModel] = useState("llama-3.3-70b-versatile");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Load current settings (provider/model/hasKey only — never the key itself).
  useEffect(() => {
    if (!open) return;
    let active = true;
    // Defer the loading flag so we don't trigger a synchronous re-render
    // inside the effect body (keeps the react-hooks linter happy).
    const run = async () => {
      setLoading(true);
      try {
        const d = await api<{ provider: string; model: string; hasKey: boolean }>("/api/settings");
        if (!active) return;
        setProvider((d.provider as "zai" | "groq") || "groq");
        setModel(d.model || "llama-3.3-70b-versatile");
        setHasKey(d.hasKey);
        setApiKey("");
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => {
      active = false;
    };
  }, [open]);

  function save() {
    setSaving(true);
    setMsg(null);
    // If the key field is empty we send undefined so the backend keeps the old one.
    const body: Record<string, unknown> = { provider, model };
    if (apiKey.trim() !== "") body.apiKey = apiKey.trim();
    api("/api/settings", { method: "PUT", body: JSON.stringify(body) })
      .then(() => {
        setAiStatus({ provider, model, hasKey: apiKey.trim() !== "" ? true : hasKey });
        setMsg("Saved. Your key is stored server-side only.");
        setApiKey("");
        setHasKey(apiKey.trim() !== "" ? true : hasKey);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Could not save."))
      .finally(() => setSaving(false));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-emerald-600" /> AI Provider Settings
          </DialogTitle>
          <DialogDescription>
            Choose how the prompt-based generator and realism check call the AI. Your API key is stored
            server-side only and never sent to the browser.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={(v) => { setProvider(v as "zai" | "groq"); setModel(v === "groq" ? "llama-3.3-70b-versatile" : "default"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="groq">Groq (your API key — recommended)</SelectItem>
                  <SelectItem value="zai">Built-in Z.ai (fallback)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="model name" />
            </div>

            <div className="space-y-1.5">
              <Label>API Key {hasKey && <span className="text-xs text-emerald-600">(a key is on file)</span>}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? "Leave blank to keep the existing key" : "Paste your Groq key (gsk_…)"}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="size-3" /> The key is used by the backend only — it is never logged or saved into generated files.
              </p>
            </div>

            {provider === "zai" && (
              <p className="text-xs text-muted-foreground rounded-md bg-muted p-2">
                The built-in AI works with no key. You can still add a Groq key if you prefer that provider.
              </p>
            )}

            {msg && <p className="text-sm text-emerald-700">{msg}</p>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
