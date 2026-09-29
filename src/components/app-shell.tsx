"use client";
// The authenticated app shell: top bar + responsive 3-pane layout + modals.
// Left = data type, middle = settings, right = live preview + downloads.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { DataTypePanel } from "./data-type-panel";
import { SettingsPanel } from "./settings-panel";
import { PreviewPanel } from "./preview-panel";
import { Toaster } from "sonner";
import { Database, Settings as SettingsIcon, Bookmark, LogOut, History } from "lucide-react";
import { loadHistory } from "@/lib/history";

const SettingsModal = dynamic(() => import("./settings-modal").then((module) => module.SettingsModal));
const RecipesModal = dynamic(() => import("./recipes-modal").then((module) => module.RecipesModal));
const HistoryModal = dynamic(() => import("./history-modal").then((module) => module.HistoryModal));

export function AppShell() {
  const { user, setUser, aiStatus, setAiStatus } = useStore();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [recipesOpen, setRecipesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  // Fetch the AI provider status once (provider/model/hasKey only) + load the
  // saved browser history from localStorage.
  const setHistory = useStore((s) => s.setHistory);
  useEffect(() => {
    api<{ provider: string; model: string; hasKey: boolean }>("/api/settings")
      .then(setAiStatus)
      .catch(() => {});
    setHistory(loadHistory());
  }, [setAiStatus, setHistory]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <Toaster position="top-center" richColors />
      {/* Top bar */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-2 px-4 h-14">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shrink-0">
              <Database className="size-4" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold leading-tight truncate">Synthetic Data Platform</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Realistic, privacy-safe fake data</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {aiStatus && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground mr-1">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                {aiStatus.provider === "groq" ? "Groq · ready" : "Built-in AI"}
              </span>
            )}
            <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)} title="History">
              <History className="size-4" />
              <span className="hidden sm:inline ml-1.5">History</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRecipesOpen(true)}>
              <Bookmark className="size-4" />
              <span className="hidden sm:inline ml-1.5">Recipes</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="size-4" />
              <span className="hidden sm:inline ml-1.5">Settings</span>
            </Button>
            <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l">
              <div className="text-right">
                <p className="text-xs font-medium leading-tight">{user?.name || user?.email}</p>
              </div>
              <Button size="icon" variant="ghost" onClick={logout} title="Log out">
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile logout row */}
      <div className="md:hidden flex items-center justify-between px-4 py-1.5 border-b bg-background">
        <span className="text-xs text-muted-foreground truncate">{user?.name || user?.email}</span>
        <Button size="sm" variant="ghost" onClick={logout}><LogOut className="size-3.5 mr-1" />Log out</Button>
      </div>

      {/* 3-pane layout */}
      <main className="flex-1 mx-auto w-full max-w-7xl p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.15fr)]">
          {/* Left: data type */}
          <section className="lg:sticky lg:top-[72px] lg:self-start">
            <DataTypePanel />
          </section>
          {/* Middle: settings */}
          <section>
            <SettingsPanel />
          </section>
          {/* Right: preview + summary */}
          <section>
            <PreviewPanel />
          </section>
        </div>
      </main>

      <footer className="border-t py-3 text-center text-xs text-muted-foreground">
        Synthetic Data Platform · Realistic distributions · Privacy-safe · Built for a hackathon
      </footer>

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <RecipesModal open={recipesOpen} onClose={() => setRecipesOpen(false)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
