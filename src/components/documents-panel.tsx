"use client";
// Documents panel: generate invoices or bank statements as a PDF with correct
// totals and running balances. The PDF is built server-side and downloaded.
// Names, cities and phones match the chosen country/locale via Faker.
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, FileDown } from "lucide-react";
import { toast } from "sonner";
import { LOCALES } from "@/lib/locales";

export function DocumentsPanel() {
  const [kind, setKind] = useState<"invoices" | "statements">("invoices");
  const [count, setCount] = useState(3);
  const [taxRate, setTaxRate] = useState(8);
  const [txns, setTxns] = useState(15);
  const [seed, setSeed] = useState(7);
  const [locale, setLocale] = useState("en_US");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    try {
      const body =
        kind === "invoices"
          ? { kind, count, taxRate: taxRate / 100, seed, locale }
          : { kind, statementsCount: count, txnsPerStatement: txns, seed, locale };
      const res = await fetch("/api/generate/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || "PDF generation failed.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = kind === "invoices" ? "invoices.pdf" : "bank_statements.pdf";
      a.click();
      URL.revokeObjectURL(url);
      toast.success(kind === "invoices" ? "Invoices PDF downloaded" : "Bank statements PDF downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Document settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Document type</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as "invoices" | "statements")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="invoices">Invoices</SelectItem>
              <SelectItem value="statements">Bank statements</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{kind === "invoices" ? "Number of invoices" : "Number of statements"}: {count}</Label>
          <Slider value={[count]} onValueChange={(v) => setCount(v[0])} min={1} max={kind === "invoices" ? 20 : 10} step={1} />
        </div>

        {kind === "invoices" ? (
          <div className="space-y-1.5">
            <Label>Tax rate: {taxRate}%</Label>
            <Slider value={[taxRate]} onValueChange={(v) => setTaxRate(v[0])} min={0} max={25} step={1} />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Transactions per statement: {txns}</Label>
            <Slider value={[txns]} onValueChange={(v) => setTxns(v[0])} min={5} max={40} step={1} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Seed</Label>
            <Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1.5">
            <Label>Country / locale</Label>
            <Select value={locale} onValueChange={setLocale}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.flag} {l.label.split(" (")[0]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={generate} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
          {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <FileDown className="size-4 mr-2" />}
          Generate & download PDF
        </Button>
        <p className="text-xs text-muted-foreground">
          Totals and running balances are computed exactly — invoices add up, and statement balances form a correct cumulative chain.
          Names, cities and phones match the chosen country.
        </p>
      </CardContent>
    </Card>
  );
}
