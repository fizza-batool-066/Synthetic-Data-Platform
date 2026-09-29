"use client";
// History modal: lists every dataset the user has generated in this browser.
// Stored in localStorage. Click an entry to reload it (re-generates from the
// saved plan, deterministically). Entries include a compact preview + summary.
import { useEffect, useState } from "react";
import { useStore } from "@/store";
import { loadHistory, deleteHistory, clearHistory, type HistoryEntry } from "@/lib/history";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Trash2, RotateCcw, History, Eraser } from "lucide-react";
import { toast } from "sonner";
import type { Plan } from "@/lib/synthetic/types";

export function HistoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { generate, setMode, setHistory } = useStore();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const run = async () => {
      // Defer so we don't trigger a synchronous re-render inside the effect body.
      await Promise.resolve();
      if (active) setEntries(loadHistory());
    };
    run();
    return () => {
      active = false;
    };
  }, [open]);

  function reload(entry: HistoryEntry) {
    setBusy(entry.id);
    // Switch to tabular mode and re-generate from the saved plan.
    setMode("tabular");
    generate(entry.plan as Plan).finally(() => setBusy(null));
    toast.success(`Reloaded: ${entry.title}`);
    onClose();
  }

  function remove(id: string) {
    const next = deleteHistory(id);
    setEntries(next);
    setHistory(next);
  }

  function clearAll() {
    clearHistory();
    setEntries([]);
    setHistory([]);
    toast.success("History cleared");
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4 text-emerald-600" /> Generation history
          </DialogTitle>
          <DialogDescription>
            Every dataset you generate is saved in this browser. Click one to reload it.
          </DialogDescription>
        </DialogHeader>

        {entries.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <History className="size-8 mx-auto mb-2 text-muted-foreground/40" />
            No history yet. Generate some data to see it here.
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-96 pr-2">
              <div className="space-y-2">
                {entries.map((e) => (
                  <div key={e.id} className="rounded-md border p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(e.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {e.mode}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <Badge className="bg-emerald-600 text-[10px]">{e.summary.realismScore}/100 realism</Badge>
                      <span className="text-[11px] text-muted-foreground">
                        {e.summary.rowCount.toLocaleString()} rows · {e.summary.tableCount} table(s)
                      </span>
                    </div>
                    {e.summary.facts.length > 0 && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                        {e.summary.facts[0]}
                      </p>
                    )}
                    <div className="flex gap-1.5 mt-2">
                      <Button size="sm" variant="outline" onClick={() => reload(e)} disabled={busy === e.id} className="h-7 text-xs">
                        {busy === e.id ? <Loader2 className="size-3 mr-1 animate-spin" /> : <RotateCcw className="size-3 mr-1" />}
                        Reload
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => remove(e.id)} className="h-7 text-xs">
                        <Trash2 className="size-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end pt-2 border-t">
              <Button size="sm" variant="ghost" onClick={clearAll} className="text-xs text-destructive">
                <Eraser className="size-3.5 mr-1.5" />
                Clear all
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
