"use client";
// Animated hero page shown on first visit. Features:
//  - Animated gradient background + floating "data" particles
//  - Staggered headline/subhead reveal
//  - Animated stat counters
//  - Smooth "Get started" button that fades into the auth screen
// The hero only shows on the very first visit (flag in sessionStorage), so
// returning users go straight to the auth/app.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Database, Sparkles, ShieldCheck, Table2, FileText, Network, ArrowRight, Zap } from "lucide-react";

const FEATURES = [
  { icon: Table2, title: "Tabular data", desc: "Tables with realistic distributions" },
  { icon: Network, title: "Relational", desc: "Linked tables, correct foreign keys" },
  { icon: FileText, title: "Documents", desc: "Invoices & bank statements (PDF)" },
  { icon: Sparkles, title: "AI prompts", desc: "Describe data in plain words" },
  { icon: ShieldCheck, title: "Privacy-safe", desc: "Learn from CSV, mask PII" },
  { icon: Zap, title: "Realism checks", desc: "Valid ranges, stable IDs, totals" },
];

const STATS = [
  { value: 50, suffix: "+", label: "Data types" },
  { value: 20, suffix: "+", label: "Locales" },
  { value: 100, suffix: "%", label: "Privacy-safe" },
];

export function HeroPage({ onEnter }: { onEnter: () => void }) {
  const [exiting, setExiting] = useState(false);

  function enter() {
    setExiting(true);
    // Wait for the exit animation, then hand off to the auth/app.
    setTimeout(onEnter, 700);
  }

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          className="fixed inset-0 overflow-hidden bg-slate-950 text-white"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.7, ease: "easeInOut" }}
        >
          {/* Animated gradient blobs */}
          <div className="absolute inset-0 overflow-hidden">
            <motion.div
              className="absolute -top-40 -left-40 size-[500px] rounded-full bg-emerald-500/30 blur-3xl"
              animate={{ x: [0, 80, 0], y: [0, 40, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute top-1/3 -right-40 size-[480px] rounded-full bg-teal-500/25 blur-3xl"
              animate={{ x: [0, -60, 0], y: [0, 50, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="absolute -bottom-40 left-1/4 size-[520px] rounded-full bg-cyan-500/20 blur-3xl"
              animate={{ x: [0, 50, 0], y: [0, -40, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* Floating data particles (small dots + table-row glyphs) */}
          <FloatingParticles />

          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Content */}
          <div className="relative z-10 min-h-screen flex flex-col">
            {/* Top bar */}
            <motion.header
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="flex items-center justify-between px-6 py-5"
            >
              <div className="flex items-center gap-2.5">
                <motion.div
                  initial={{ rotate: -90, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                  className="size-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30"
                >
                  <Database className="size-5 text-white" />
                </motion.div>
                <span className="font-semibold tracking-tight">Synthetic Data Platform</span>
              </div>
              <button
                onClick={enter}
                className="text-sm text-white/70 hover:text-white transition-colors flex items-center gap-1.5"
              >
                Skip intro <ArrowRight className="size-3.5" />
              </button>
            </motion.header>

            {/* Hero content */}
            <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
              {/* Badge */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/80 mb-8 backdrop-blur"
              >
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Realistic · Privacy-safe · AI-powered
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.05] mb-6"
              >
                Generate{" "}
                <span className="relative inline-block">
                  <motion.span
                    className="bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1, duration: 0.8 }}
                  >
                    realistic
                  </motion.span>
                  <motion.span
                    className="absolute -bottom-1 left-0 right-0 h-1 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 1.3, duration: 0.6, ease: "easeOut" }}
                    style={{ transformOrigin: "left" }}
                  />
                </span>
                <br />
                fake data in seconds
              </motion.h1>

              {/* Subhead */}
              <motion.p
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.6 }}
                className="text-lg sm:text-xl text-white/60 max-w-2xl mb-10"
              >
                Create tables, relational datasets, invoices and bank statements — all privacy-safe,
                all with correct totals, realistic names, and locale-aware data.
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.1, duration: 0.6 }}
                className="flex flex-col sm:flex-row items-center gap-3 mb-16"
              >
                <motion.button
                  onClick={enter}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  className="group inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-7 py-3.5 font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition-colors"
                >
                  Get started
                  <motion.span
                    className="inline-block"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="size-4" />
                  </motion.span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={enter}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-7 py-3.5 font-medium text-white backdrop-blur transition-colors"
                >
                  <Sparkles className="size-4 text-emerald-300" />
                  Try a prompt
                </motion.button>
              </motion.div>

              {/* Stats */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.3, duration: 0.6 }}
                className="flex items-center gap-8 sm:gap-14 mb-14"
              >
                {STATS.map((s) => (
                  <StatCounter key={s.label} value={s.value} suffix={s.suffix} label={s.label} />
                ))}
              </motion.div>

              {/* Feature pills */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 1.5, duration: 0.6 }}
                className="flex flex-wrap items-center justify-center gap-2.5 max-w-2xl"
              >
                {FEATURES.map((f, i) => (
                  <motion.div
                    key={f.title}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 1.6 + i * 0.08, duration: 0.4 }}
                    whileHover={{ y: -3, scale: 1.05 }}
                    className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur"
                  >
                    <f.icon className="size-3.5 text-emerald-300" />
                    {f.title}
                  </motion.div>
                ))}
              </motion.div>
            </main>

            {/* Footer */}
            <motion.footer
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2, duration: 0.6 }}
              className="px-6 py-5 text-center text-xs text-white/40"
            >
              Built for a hackathon · Realistic distributions · Privacy-safe · Locale-aware names
            </motion.footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Animated stat counter that counts up from 0 to the target value.
function StatCounter({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const duration = 1400;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      // ease-out cubic for a nice deceleration
      const eased = 1 - Math.pow(1 - p, 3);
      setCount(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className="text-center">
      <div className="text-2xl sm:text-3xl font-bold tabular-nums">
        {count}
        <span className="text-emerald-300">{suffix}</span>
      </div>
      <div className="text-[11px] text-white/50 mt-0.5">{label}</div>
    </div>
  );
}

// Floating particles: small dots + tiny "row" glyphs drifting upward.
function FloatingParticles() {
  const particles = Array.from({ length: 22 });
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((_, i) => {
        const left = (i * 37) % 100;
        const size = 3 + (i % 4) * 2;
        const duration = 9 + (i % 5) * 3;
        const delay = (i * 0.7) % 6;
        const isRow = i % 5 === 0;
        return (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              bottom: -20,
              width: isRow ? 40 : size,
              height: isRow ? 6 : size,
              background: isRow
                ? "linear-gradient(90deg, rgba(52,211,153,0.25), rgba(34,211,238,0.25))"
                : i % 3 === 0
                  ? "rgba(52,211,153,0.4)"
                  : "rgba(34,211,238,0.3)",
              borderRadius: isRow ? 3 : "50%",
            }}
            animate={{ y: [0, -window.innerHeight - 60], opacity: [0, 0.8, 0] }}
            transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
          />
        );
      })}
    </div>
  );
}
