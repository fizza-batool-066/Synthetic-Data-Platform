"use client";
// "How this data was made" summary box. Shows facts computed from the REAL data,
// the rules used, the realism score, and integrity checks. Includes a button to
// download the summary as a text file.
import { useStore } from "@/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertTriangle, FileDown, Sparkles } from "lucide-react";

export function SummaryBox() {
  const { result, plan, realismIssues } = useStore();
  if (!result) return null;
  const s = result.summary;

  function downloadSummary() {
    const lines = [
      "SYNTHETIC DATA — HOW THIS DATA WAS MADE",
      "========================================",
      "",
      `Rows: ${s.rowCount.toLocaleString()}`,
      `Tables: ${s.tableCount}`,
      `Realism score: ${s.realismScore}/100`,
      `Missing values: ${s.missingPct.toFixed(1)}%`,
      "",
      "KEY FACTS:",
      ...s.facts.map((f) => `  - ${f}`),
      "",
      "RULES USED:",
      ...(s.rulesUsed.length ? s.rulesUsed : ["(default rules)"]).map((r) => `  - ${r}`),
      "",
      "INTEGRITY CHECKS (passed):",
      ...(s.integrity.length ? s.integrity : ["(none applicable)"]).map((r) => `  - ${r}`),
      "",
      "REALISM NOTES:",
      ...(s.realismNotes.length ? s.realismNotes : ["All automated checks passed."]).map((r) => `  - ${r}`),
      "",
      "AI REALISM REVIEW:",
      ...(realismIssues.length ? realismIssues : ["No issues found."]).map((r) => `  - ${r}`),
      "",
      plan?.description ? `Description: ${plan.description}` : "",
    ].filter(Boolean);
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data-summary.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-emerald-200 bg-emerald-50/40">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-600" />
            How this data was made
          </CardTitle>
          <Button size="sm" variant="outline" onClick={downloadSummary}>
            <FileDown className="size-3.5 mr-1.5" />
            Summary
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Realism score badge */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={
              s.realismScore >= 85
                ? "bg-emerald-600"
                : s.realismScore >= 60
                  ? "bg-amber-500"
                  : "bg-red-500"
            }
          >
            Realism score: {s.realismScore}/100
          </Badge>
          <span className="text-xs text-muted-foreground">{s.rowCount.toLocaleString()} rows · {s.tableCount} table(s)</span>
        </div>

        <ScrollArea className="max-h-44 pr-3">
          <ul className="space-y-1.5 text-sm">
            {s.facts.map((f, i) => (
              <li key={i} className="text-foreground/90">• {f}</li>
            ))}
          </ul>
        </ScrollArea>

        {s.integrity.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Integrity checks</p>
            <ul className="space-y-1">
              {s.integrity.map((c, i) => (
                <li key={i} className="text-xs flex items-start gap-1.5 text-emerald-700">
                  <CheckCircle2 className="size-3.5 mt-0.5 shrink-0" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.realismNotes.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Automated notes</p>
            <ul className="space-y-1">
              {s.realismNotes.map((n, i) => (
                <li key={i} className="text-xs flex items-start gap-1.5 text-amber-700">
                  <AlertTriangle className="size-3.5 mt-0.5 shrink-0" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}

        {realismIssues.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-200 bg-amber-50 p-2">
            <p className="text-xs font-medium text-amber-800">AI realism review</p>
            <ul className="space-y-1">
              {realismIssues.map((n, i) => (
                <li key={i} className="text-xs text-amber-800">• {n}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
