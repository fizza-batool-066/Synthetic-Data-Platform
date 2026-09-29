"use client";
// Global app state + the async actions that talk to the backend.
// Every successful generation is also saved to browser localStorage so the user
// can revisit previous datasets from the History panel.
import { create } from "zustand";
import type { Plan, GenerationResult } from "@/lib/synthetic/types";
import type { AnalysisResult } from "@/lib/csv";
import { api } from "@/lib/api";
import { saveToHistory, buildEntry, type HistoryEntry } from "@/lib/history";

export type Mode = "tabular" | "relational" | "documents" | "prompt" | "learn";

export interface User {
  id: string;
  email: string;
  name?: string | null;
}

interface AppState {
  user: User | null;
  mode: Mode;
  plan: Plan | null;
  result: GenerationResult | null;
  loading: boolean;
  error: string | null;
  analysis: AnalysisResult | null;
  aiStatus: { provider: string; model: string; hasKey: boolean } | null;
  realismIssues: string[];
  chatChanges: string[];
  // CSV-learn comparison results
  sampleId: string | null;
  similarity: number | null;
  copied: { copied: number; checked: number } | null;
  // browser history (loaded from localStorage)
  history: HistoryEntry[];

  // setters
  setUser: (u: User | null) => void;
  setMode: (m: Mode) => void;
  setPlan: (p: Plan | null) => void;
  setResult: (r: GenerationResult | null) => void;
  setLoading: (b: boolean) => void;
  setError: (e: string | null) => void;
  setAnalysis: (a: AnalysisResult | null) => void;
  setAiStatus: (s: AppState["aiStatus"]) => void;
  setRealismIssues: (i: string[]) => void;
  setChatChanges: (c: string[]) => void;
  setSampleId: (id: string | null) => void;
  setSimilarity: (n: number | null) => void;
  setCopied: (c: AppState["copied"]) => void;
  setHistory: (h: HistoryEntry[]) => void;
  reset: () => void;

  // async actions
  generate: (plan: Plan) => Promise<void>;
  generatePrompt: (prompt: string, seed: number, locale: string, country?: string, industry?: string, rowCount?: number) => Promise<void>;
  generateChat: (sentence: string) => Promise<void>;
  learnGenerate: (plan: Plan) => Promise<void>;
  runRealismCheck: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  mode: "tabular",
  plan: null,
  result: null,
  loading: false,
  error: null,
  analysis: null,
  aiStatus: null,
  realismIssues: [],
  chatChanges: [],
  sampleId: null,
  similarity: null,
  copied: null,
  history: [],

  setUser: (user) => set({ user }),
  setMode: (mode) => set({ mode, error: null }),
  setPlan: (plan) => set({ plan }),
  setResult: (result) => set({ result }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setAnalysis: (analysis) => set({ analysis }),
  setAiStatus: (aiStatus) => set({ aiStatus }),
  setRealismIssues: (realismIssues) => set({ realismIssues }),
  setChatChanges: (chatChanges) => set({ chatChanges }),
  setSampleId: (sampleId) => set({ sampleId }),
  setSimilarity: (similarity) => set({ similarity }),
  setCopied: (copied) => set({ copied }),
  setHistory: (history) => set({ history }),
  reset: () => set({ plan: null, result: null, error: null, analysis: null, realismIssues: [], chatChanges: [], similarity: null, copied: null }),

  // Generate from an already-built plan (settings / template / CSV-learned modes).
  generate: async (plan) => {
    set({ loading: true, error: null });
    try {
      const data = await api<{ result: GenerationResult }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({ plan }),
      });
      set({ plan, result: data.result, loading: false });
      // Save to browser history.
      const entry = buildEntry(get().mode, plan, data.result);
      set({ history: saveToHistory(entry) });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Generation failed." });
    }
  },

  // Generate from a natural-language prompt (context-aware AI mode).
  // Country/Industry dropdowns are passed through; the prompt overrides them.
  generatePrompt: async (prompt, seed, locale, country, industry, rowCount) => {
    set({ loading: true, error: null });
    try {
      const data = await api<{ plan: Plan; result: GenerationResult }>("/api/generate/prompt", {
        method: "POST",
        body: JSON.stringify({ prompt, seed, locale, country, industry, rowCount }),
      });
      set({ plan: data.plan, result: data.result, loading: false });
      const entry = buildEntry("prompt", data.plan, data.result);
      set({ history: saveToHistory(entry) });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Prompt generation failed." });
    }
  },

  // Edit the current dataset with a chat sentence (AI mode).
  generateChat: async (sentence) => {
    const plan = get().plan;
    if (!plan) {
      set({ error: "Generate some data first, then chat to edit it." });
      return;
    }
    set({ loading: true, error: null });
    try {
      const data = await api<{ plan: Plan; result: GenerationResult; changes: string[] }>(
        "/api/generate/chat",
        { method: "POST", body: JSON.stringify({ plan, sentence }) },
      );
      set({ plan: data.plan, result: data.result, chatChanges: data.changes, loading: false });
      const entry = buildEntry("chat", data.plan, data.result);
      set({ history: saveToHistory(entry) });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Chat edit failed." });
    }
  },

  // Generate from a CSV-learned plan and compute similarity + copied-rows proof.
  learnGenerate: async (plan) => {
    const sampleId = get().sampleId;
    set({ loading: true, error: null });
    try {
      const data = await api<{ result: GenerationResult; similarity: number; copied: { copied: number; checked: number } }>(
        "/api/learn/generate",
        { method: "POST", body: JSON.stringify({ plan, sampleId }) },
      );
      set({ plan, result: data.result, similarity: data.similarity, copied: data.copied, loading: false });
      const entry = buildEntry("learn", plan, data.result);
      set({ history: saveToHistory(entry) });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Generation failed." });
    }
  },

  // Ask the AI to review 20 sample rows for impossible values.
  runRealismCheck: async () => {
    const { plan, result } = get();
    if (!plan || !result) return;
    set({ loading: true, error: null });
    try {
      const sample = result.tables[0]?.rows.slice(0, 20) ?? [];
      const data = await api<{ issues: string[]; note?: string }>("/api/realism-check", {
        method: "POST",
        body: JSON.stringify({ plan, sampleRows: sample }),
      });
      set({ realismIssues: data.issues, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : "Realism check failed." });
    }
  },
}));
