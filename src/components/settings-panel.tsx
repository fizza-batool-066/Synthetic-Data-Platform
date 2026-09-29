"use client";
// Middle pane: the settings for the selected mode. Builds a Plan (where
// applicable) and asks the store to generate. Kept simple: sliders + selects.
import { useState } from "react";
import { useStore } from "@/store";
import { buildSettingsPlan, type SettingsConfig, TABULAR_TEMPLATES, TABULAR_LABELS, type TabularTemplate } from "@/lib/synthetic/settingsPlan";
import { TEMPLATE_NAMES, TEMPLATE_LABELS } from "@/lib/synthetic/templates";
import type { TemplateName } from "@/lib/synthetic/templates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Play } from "lucide-react";
import { CsvLearnPanel } from "./csv-learn-panel";
import { DocumentsPanel } from "./documents-panel";
import { LOCALES } from "@/lib/locales";
import { COUNTRY_OPTIONS } from "@/lib/synthetic/countries";
import { INDUSTRY_OPTIONS } from "@/lib/synthetic/industries";

// Shared controls used by tabular & relational modes.
function CommonControls({
  rowCount, setRowCount, seed, setSeed, missingPct, setMissingPct, outlierPct, setOutlierPct, locale, setLocale,
}: {
  rowCount: number; setRowCount: (n: number) => void;
  seed: number; setSeed: (n: number) => void;
  missingPct: number; setMissingPct: (n: number) => void;
  outlierPct: number; setOutlierPct: (n: number) => void;
  locale: string; setLocale: (s: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Rows (main table): {rowCount}</Label>
        <Slider value={[rowCount]} onValueChange={(v) => setRowCount(v[0])} min={5} max={5000} step={5} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Random seed</Label>
          <Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
        </div>
        <div className="space-y-1.5">
          <Label>Country / locale</Label>
          <Select value={locale} onValueChange={setLocale}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => <SelectItem key={l.value} value={l.value}>{l.flag} {l.label.split(" (")[0]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Missing values: {missingPct}%</Label>
        <Slider value={[missingPct]} onValueChange={(v) => setMissingPct(v[0])} min={0} max={20} step={1} />
      </div>
      <div className="space-y-1.5">
        <Label>Rare outliers: {outlierPct}%</Label>
        <Slider value={[outlierPct]} onValueChange={(v) => setOutlierPct(v[0])} min={0} max={10} step={1} />
      </div>
    </>
  );
}

export function SettingsPanel() {
  const { mode, generate, loading } = useStore();

  // tabular / relational shared state
  const [tabTemplate, setTabTemplate] = useState<TabularTemplate>("customers");
  const [relTemplate, setRelTemplate] = useState<TemplateName>("shop");
  const [rowCount, setRowCount] = useState(200);
  const [seed, setSeed] = useState(42);
  const [missingPct, setMissingPct] = useState(3);
  const [outlierPct, setOutlierPct] = useState(2);
  const [locale, setLocale] = useState("en_US");

  // prompt mode state
  const [prompt, setPrompt] = useState("");
  const [promptCountry, setPromptCountry] = useState<string>("");
  const [promptIndustry, setPromptIndustry] = useState<string>("");
  const [promptRows, setPromptRows] = useState(200);
  const { generatePrompt } = useStore();

  function runTabular() {
    const cfg: SettingsConfig = { template: tabTemplate, rowCount, seed, locale, missingPct, outlierPct };
    const plan = buildSettingsPlan(cfg);
    generate(plan);
  }
  function runRelational() {
    const cfg: SettingsConfig = { template: relTemplate, rowCount, seed, locale, missingPct, outlierPct };
    const plan = buildSettingsPlan(cfg);
    generate(plan);
  }
  function runPrompt() {
    if (!prompt.trim() && !promptCountry && !promptIndustry) return;
    generatePrompt(prompt.trim(), seed, locale, promptCountry || undefined, promptIndustry || undefined, promptRows);
  }

  if (mode === "learn") return <CsvLearnPanel />;
  if (mode === "documents") return <DocumentsPanel />;

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {mode === "tabular" && "Tabular data settings"}
          {mode === "relational" && "Relational data settings"}
          {mode === "prompt" && "Prompt-based generation"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mode === "tabular" && (
          <>
            <div className="space-y-1.5">
              <Label>Table template</Label>
              <Select value={tabTemplate} onValueChange={(v) => setTabTemplate(v as TabularTemplate)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TABULAR_TEMPLATES.map((t) => (
                    <SelectItem key={t} value={t}>{TABULAR_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <CommonControls rowCount={rowCount} setRowCount={setRowCount} seed={seed} setSeed={setSeed} missingPct={missingPct} setMissingPct={setMissingPct} outlierPct={outlierPct} setOutlierPct={setOutlierPct} locale={locale} setLocale={setLocale} />
            <Button onClick={runTabular} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
              Generate table
            </Button>
          </>
        )}

        {mode === "relational" && (
          <>
            <div className="space-y-1.5">
              <Label>Dataset template</Label>
              <Select value={relTemplate} onValueChange={(v) => setRelTemplate(v as TemplateName)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TEMPLATE_NAMES.map((t) => <SelectItem key={t} value={t}>{TEMPLATE_LABELS[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <CommonControls rowCount={rowCount} setRowCount={setRowCount} seed={seed} setSeed={setSeed} missingPct={missingPct} setMissingPct={setMissingPct} outlierPct={outlierPct} setOutlierPct={setOutlierPct} locale={locale} setLocale={setLocale} />
            <Button onClick={runRelational} disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Play className="size-4 mr-2" />}
              Generate related tables
            </Button>
          </>
        )}

        {mode === "prompt" && (
          <>
            <div className="space-y-1.5">
              <Label>Describe the dataset you want</Label>
              <textarea
                className="w-full min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Make a Pakistan hospital dataset with 500 patients, only 30% female."
              />
              <p className="text-[11px] text-muted-foreground">
                Tip: mention the country and industry in your prompt — it auto-detects them. The dropdowns below are a fallback.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Country</Label>
                <Select value={promptCountry} onValueChange={setPromptCountry}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.flag} {c.name} ({c.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select value={promptIndustry} onValueChange={setPromptIndustry}>
                  <SelectTrigger><SelectValue placeholder="Auto-detect" /></SelectTrigger>
                  <SelectContent>
                    {INDUSTRY_OPTIONS.map((i) => (
                      <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>Rows</Label>
                <Input type="number" value={promptRows} onChange={(e) => setPromptRows(Number(e.target.value) || 100)} />
              </div>
              <div className="space-y-1.5">
                <Label>Seed</Label>
                <Input type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
              </div>
            </div>
            <Button onClick={runPrompt} disabled={loading || (!prompt.trim() && !promptCountry && !promptIndustry)} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles />}
              <span className="ml-2">Generate dataset</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              Detects country, industry, language and special conditions from your text. Names, cities, phones, currency and date formats all match the detected country.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Sparkles() {
  return <span className="text-base leading-none">✨</span>;
}
