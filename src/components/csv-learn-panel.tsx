"use client";
// CSV "learn from a sample" panel.
// Upload a small CSV -> detect types + trends + mask private columns -> let the
// user edit the trend weights -> generate a bigger dataset that follows the same
// trends (no copied rows) -> show similarity score + copied-rows proof.
import { useRef, useState } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import type { Plan, ColumnDef } from "@/lib/synthetic/types";
import type { AnalysisResult, ColumnStats } from "@/lib/csv";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, UploadCloud, Play, ShieldCheck, CheckCircle2, GitCompare } from "lucide-react";
import { toast } from "sonner";

export function CsvLearnPanel() {
  const { analysis, sampleId, setAnalysis, setSampleId, learnGenerate, loading, similarity, copied } = useStore();
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [rowCount, setRowCount] = useState(1000);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("locale", "en_US");
      form.append("seed", "1");
      const res = await fetch("/api/upload/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Analysis failed.");
      setAnalysis(data.analysis as AnalysisResult);
      setSampleId(data.sampleId as string);
      setEditPlan(structuredClone(data.analysis.plan) as Plan);
      setRowCount(Math.min(50000, Math.max(50, data.analysis.rowCount * 10)));
      toast.success(`Analyzed ${data.analysis.rowCount} rows · ${data.analysis.privateColumns.length} private column(s) masked`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function runGenerate() {
    if (!editPlan) return;
    const plan = structuredClone(editPlan);
    plan.tables[0].rowCount = rowCount;
    learnGenerate(plan);
  }

  // Update a category weight in the editable plan.
  function setWeight(tableIdx: number, colName: string, idx: number, value: number) {
    if (!editPlan) return;
    const plan = structuredClone(editPlan);
    const col = plan.tables[tableIdx].columns.find((c) => c.name === colName);
    if (col && col.weights) {
      col.weights[idx] = value;
      const sum = col.weights.reduce((a, b) => a + b, 0);
      col.weights = col.weights.map((w) => (sum > 0 ? w / sum : w));
      setEditPlan(plan);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Learn from a CSV sample</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload dropzone */}
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-border p-6 text-center hover:bg-muted/50 transition-colors"
        >
          {uploading ? (
            <Loader2 className="size-6 mx-auto animate-spin text-muted-foreground" />
          ) : (
            <UploadCloud className="size-6 mx-auto text-muted-foreground" />
          )}
          <p className="mt-2 text-sm font-medium">{uploading ? "Analyzing…" : "Click to upload a CSV (20–500 rows)"}</p>
          <p className="text-xs text-muted-foreground mt-1">Private columns are masked automatically</p>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />

        {analysis && editPlan && (
          <>
            {/* Trend facts */}
            <div className="rounded-md bg-muted/50 p-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-1">Detected trends</p>
              <ScrollArea className="max-h-32 pr-2">
                <ul className="space-y-1">
                  {analysis.facts.map((f, i) => (
                    <li key={i} className="text-xs text-foreground/90">• {f}</li>
                  ))}
                </ul>
              </ScrollArea>
            </div>

            {/* Private columns badge */}
            {analysis.privateColumns.length > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-2">
                <ShieldCheck className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-xs text-emerald-800">
                  Masked private columns: {analysis.privateColumns.join(", ")}
                </p>
              </div>
            )}

            {/* Per-column trend editing */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">Edit trends (weights are normalized)</p>
              <ScrollArea className="max-h-64 pr-2">
                <div className="space-y-3">
                  {analysis.columns.map((c) => (
                    <ColumnEditor key={c.name} stat={c} plan={editPlan} setWeight={(idx, v) => setWeight(0, c.name, idx, v)} />
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Row count for the bigger dataset */}
            <div className="space-y-1.5">
              <Label>Generate rows: {rowCount.toLocaleString()}</Label>
              <Slider value={[rowCount]} onValueChange={(v) => setRowCount(v[0])} min={50} max={20000} step={50} />
              <p className="text-xs text-muted-foreground">No row will be copied from the sample.</p>
            </div>

            <Button onClick={runGenerate} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
              Generate bigger dataset
            </Button>

            {/* Similarity + copied-rows proof */}
            {similarity !== null && copied && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <GitCompare className="size-4 text-emerald-600" />
                  <span className="text-sm font-medium">Sample vs generated</span>
                  <Badge className={similarity >= 75 ? "bg-emerald-600" : similarity >= 50 ? "bg-amber-500" : "bg-red-500"}>
                    {similarity}% similar
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  {copied.copied === 0
                    ? `Verified: 0 of ${copied.checked.toLocaleString()} rows copied from the sample.`
                    : `${copied.copied} copied row(s) detected.`}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// Editor for one column's trend. Shows a bar per category with a weight slider.
function ColumnEditor({ stat, plan, setWeight }: { stat: ColumnStats; plan: Plan; setWeight: (idx: number, v: number) => void }) {
  const col = plan.tables[0].columns.find((c) => c.name === stat.name) as ColumnDef | undefined;
  if (!col || !col.categories) {
    // Numeric / date column: show a compact summary (read-only).
    return (
      <div className="rounded-md border p-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">{stat.name}</span>
          <Badge variant="outline" className="text-[10px]">{stat.detectedType}{stat.isPrivate ? " · masked" : ""}</Badge>
        </div>
        {stat.detectedType === "number" && stat.mean !== undefined && (
          <p className="text-[11px] text-muted-foreground mt-1">
            mean {Math.round(stat.mean * 10) / 10} · range {Math.round(stat.min! * 10) / 10}–{Math.round(stat.max! * 10) / 10}
          </p>
        )}
        {stat.detectedType === "date" && (
          <p className="text-[11px] text-muted-foreground mt-1">{stat.minDate} → {stat.maxDate}</p>
        )}
      </div>
    );
  }
  // Category column: editable weights with mini bars.
  return (
    <div className="rounded-md border p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium">{stat.name}</span>
        <Badge variant="outline" className="text-[10px]">{stat.isPrivate ? "regenerated" : stat.detectedType}</Badge>
      </div>
      <div className="space-y-1.5">
        {col.categories.map((cat, i) => {
          const w = col.weights?.[i] ?? 0;
          return (
            <div key={cat} className="flex items-center gap-2">
              <span className="text-[11px] w-24 truncate text-muted-foreground">{cat}</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.round(w * 100)}%` }} />
              </div>
              <span className="text-[11px] w-9 text-right tabular-nums">{Math.round(w * 100)}%</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={w}
                onChange={(e) => setWeight(i, Number(e.target.value))}
                className="w-16 accent-emerald-600"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
