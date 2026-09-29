"use client";
// Right pane: live preview table + download buttons (CSV/JSON/PDF) + the summary
// box + chat box + realism check + a simple data-cleaning report.
//
// Layout note: the preview table lives inside a plain `overflow-auto` container
// with a bounded max-height so it NEVER overlaps the cards below it. (We avoid
// Radix ScrollArea here because its nested-overflow behaviour caused the table
// to bleed over the summary/realism/chat cards.)
import { useState } from "react";
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileSpreadsheet, FileJson, FileText, ShieldCheck, Sparkles, Wand2, Database } from "lucide-react";
import { SummaryBox } from "./summary-box";
import { ChatBox } from "./chat-box";
import { toast } from "sonner";

const ROW_PREVIEW = 50; // how many rows to render in the live preview

export function PreviewPanel() {
  const { result, plan, loading, error, runRealismCheck, generate, realismIssues } = useStore();
  const [activeTable, setActiveTable] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  if (loading && !result) {
    return (
      <Card className="flex items-center justify-center min-h-64">
        <div className="text-center text-muted-foreground">
          <Loader2 className="size-6 mx-auto animate-spin mb-2" />
          Generating…
        </div>
      </Card>
    );
  }
  if (error) {
    return (
      <Card className="min-h-64">
        <CardContent className="pt-6 text-center text-destructive text-sm">{error}</CardContent>
      </Card>
    );
  }
  if (!result) {
    return (
      <Card className="min-h-64">
        <CardContent className="pt-6 flex flex-col items-center justify-center text-center text-muted-foreground gap-2">
          <Database className="size-8 text-muted-foreground/40" />
          <p className="text-sm">Your generated data will appear here.</p>
          <p className="text-xs">Pick a data type on the left and configure it in the middle.</p>
        </CardContent>
      </Card>
    );
  }

  const tables = result.tables;
  const tableIdx = Math.min(activeTable, tables.length - 1);
  const table = tables[tableIdx];

  // Download via the server (re-generates deterministically from the plan).
  async function download(format: "csv" | "json" | "pdf") {
    if (!plan) return;
    setDownloading(format);
    try {
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, format, tableIndex: tableIdx }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "Download failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "csv" ? `${table.name}.csv` : format === "json" ? "dataset.json" : "dataset.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  // Simple data cleaning: re-generate without missing values / outliers.
  function cleanData() {
    if (!plan) return;
    setCleaning(true);
    const clean = structuredClone(plan);
    for (const t of clean.tables) {
      for (const c of t.columns) {
        c.missingPct = 0;
        c.outlierPct = 0;
        c.typoPct = 0;
      }
    }
    clean.description = "Cleaned: missing values, outliers and typos removed.";
    generate(clean).finally(() => setCleaning(false));
    toast.success("Regenerated a cleaned version (no missing/outliers).");
  }

  const totalMissing = result.summary.missingPct;
  const previewRows = table.rows.slice(0, ROW_PREVIEW);

  return (
    <div className="space-y-4">
      {/* ---- Preview table card (self-contained, never overlaps below) ---- */}
      <Card>
        <CardHeader className="pb-3 gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Preview</CardTitle>
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => download("csv")} disabled={!!downloading}>
                {downloading === "csv" ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <FileSpreadsheet className="size-3.5 mr-1.5" />}
                CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => download("json")} disabled={!!downloading}>
                {downloading === "json" ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <FileJson className="size-3.5 mr-1.5" />}
                JSON
              </Button>
              <Button size="sm" variant="outline" onClick={() => download("pdf")} disabled={!!downloading}>
                {downloading === "pdf" ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <FileText className="size-3.5 mr-1.5" />}
                PDF
              </Button>
            </div>
          </div>
          {tables.length > 1 && (
            <Tabs value={String(tableIdx)} onValueChange={(v) => setActiveTable(Number(v))}>
              <TabsList className="h-8 flex-wrap">
                {tables.map((t, i) => (
                  <TabsTrigger key={t.name} value={String(i)} className="text-xs">
                    {t.name} <span className="text-muted-foreground ml-1">({t.rows.length})</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          )}
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {/* Bounded scroll container: the table cannot escape this box, so the
              cards below it never overlap. */}
          <div className="overflow-auto max-h-[380px] rounded-md border bg-background">
            <table className="min-w-full text-xs border-separate border-spacing-0">
              <thead className="sticky top-0 z-10">
                <tr>
                  <th className="text-left font-semibold px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border-b w-10 text-slate-500">#</th>
                  {table.columns.map((c) => (
                    <th key={c} className="text-left font-semibold px-2.5 py-2 bg-slate-100 dark:bg-slate-800 border-b whitespace-nowrap text-slate-700 dark:text-slate-200">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, i) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-background hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20" : "bg-muted/30 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"}>
                    <td className="px-2.5 py-1.5 border-b text-muted-foreground tabular-nums text-[11px]">{i + 1}</td>
                    {table.columns.map((c) => {
                      const v = row[c];
                      const empty = v === "" || v === null || v === undefined;
                      const isNumeric = typeof v === "number" || (typeof v === "string" && /^-?\$?[\d.,]+$/.test(v));
                      return (
                        <td
                          key={c}
                          className={`px-2.5 py-1.5 border-b whitespace-nowrap max-w-[220px] truncate ${empty ? "text-muted-foreground/40 italic" : isNumeric ? "tabular-nums text-right" : "text-foreground/90"}`}
                          title={empty ? "" : String(v)}
                        >
                          {empty ? "—" : String(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Showing {previewRows.length} of {table.rows.length.toLocaleString()} rows · {table.columns.length} columns
          </p>
        </CardContent>
      </Card>

      {/* ---- Summary box (clearly separated, no overlap) ---- */}
      <SummaryBox />

      {/* ---- Realism + cleaning grid ---- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-600" />
              <span className="text-sm font-medium">AI realism review</span>
            </div>
            <p className="text-xs text-muted-foreground">Reviews a 20-row sample for impossible values (e.g. age 12 with a PhD).</p>
            <Button size="sm" variant="outline" onClick={runRealismCheck} disabled={loading} className="w-full">
              {loading ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <ShieldCheck className="size-3.5 mr-1.5" />}
              Run realism check
            </Button>
            {realismIssues.length > 0 && (
              <ul className="text-xs text-amber-700 space-y-0.5 pt-1">
                {realismIssues.slice(0, 5).map((i, k) => <li key={k}>• {i}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Wand2 className="size-4 text-emerald-600" />
              <span className="text-sm font-medium">Data cleaning</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {totalMissing > 0 ? `${totalMissing.toFixed(1)}% cells are empty by design.` : "No missing values detected."}
            </p>
            <Button size="sm" variant="outline" onClick={cleanData} disabled={cleaning || loading} className="w-full">
              {cleaning ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Wand2 className="size-3.5 mr-1.5" />}
              Clean & regenerate
            </Button>
            <p className="text-xs text-muted-foreground">Removes missing values, outliers and typos.</p>
          </CardContent>
        </Card>
      </div>

      {/* ---- Chat-to-edit ---- */}
      <ChatBox />
    </div>
  );
}
