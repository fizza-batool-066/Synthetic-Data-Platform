"use client";
// Left pane: pick what to generate. Includes the five modes plus quick templates.
import { useStore, type Mode } from "@/store";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Table2, Network, FileText, Sparkles, Upload, BookOpen } from "lucide-react";

interface ModeOption {
  id: Mode;
  label: string;
  desc: string;
  icon: React.ElementType;
}

const MODES: ModeOption[] = [
  { id: "tabular", label: "Tabular data", desc: "One table (e.g. customers)", icon: Table2 },
  { id: "relational", label: "Relational data", desc: "Linked tables (customers→orders→items)", icon: Network },
  { id: "documents", label: "Documents", desc: "Invoices & bank statements (PDF)", icon: FileText },
  { id: "prompt", label: "Prompt mode", desc: "Describe it in plain words (AI)", icon: Sparkles },
  { id: "learn", label: "Learn from CSV", desc: "Upload a sample & clone its trends", icon: Upload },
];

export function DataTypePanel() {
  const { mode, setMode, reset } = useStore();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4 text-emerald-600" />
        <h2 className="text-sm font-semibold">Data type</h2>
      </div>
      <div className="space-y-1.5">
        {MODES.map((m) => {
          const Icon = m.icon;
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); reset(); }}
              className={cn(
                "w-full text-left rounded-lg border p-2.5 transition-colors flex items-start gap-2.5",
                active
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-border hover:bg-muted/50 bg-card",
              )}
            >
              <div className={cn("mt-0.5 rounded-md p-1.5", active ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground")}>
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium leading-tight">{m.label}</p>
                <p className="text-xs text-muted-foreground leading-tight mt-0.5">{m.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
