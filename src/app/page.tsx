"use client";
// The single user-visible route. Shows an animated hero page on the first visit
// (flagged in sessionStorage so returning users skip it), then either the auth
// screen or the main platform depending on login state.
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Database, Loader2 } from "lucide-react";

const HERO_KEY = "sdp_hero_seen";
const HeroPage = dynamic(() => import("@/components/hero-page").then((module) => module.HeroPage));
const AuthScreen = dynamic(() => import("@/components/auth-screen").then((module) => module.AuthScreen));
const AppShell = dynamic(() => import("@/components/app-shell").then((module) => module.AppShell));

export default function Page() {
  const { user, setUser } = useStore();
  const [checking, setChecking] = useState(true);
  const [showHero, setShowHero] = useState(false);

  // On first mount: decide whether to show the hero (first visit only).
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (!sessionStorage.getItem(HERO_KEY)) {
          await Promise.resolve();
          if (active) setShowHero(true);
        }
      } catch {
        // sessionStorage might be unavailable; skip the hero.
      }
      api<{ user: { id: string; email: string; name?: string | null } | null }>("/api/auth/me")
        .then((d) => setUser(d.user))
        .catch(() => setUser(null))
        .finally(() => setChecking(false));
    };
    run();
    return () => {
      active = false;
    };
  }, [setUser]);

  // When the hero finishes, mark it seen and reveal the auth/app.
  function handleHeroDone() {
    try {
      sessionStorage.setItem(HERO_KEY, "1");
    } catch {
      /* ignore */
    }
    setShowHero(false);
  }

  // Hero takes priority on the very first visit.
  if (showHero) {
    return <HeroPage onEnter={handleHeroDone} />;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
          <Database className="size-5" />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  return user ? <AppShell /> : <AuthScreen />;
}
