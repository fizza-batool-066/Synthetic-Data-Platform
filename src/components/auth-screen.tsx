"use client";
// Login / signup screen. A single clean card that toggles between the two modes.
import { useState } from "react";
import { useStore } from "@/store";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Database, Loader2 } from "lucide-react";

export function AuthScreen() {
  const setUser = useStore((s) => s.setUser);
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const url = tab === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body = tab === "login" ? { email, password } : { name, email, password };
      const data = await api<{ user: { id: string; email: string; name?: string | null } }>(url, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setUser(data.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4 bg-muted/30">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 justify-center mb-6">
            <div className="size-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <Database className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Synthetic Data Platform</h1>
              <p className="text-xs text-muted-foreground">Realistic, privacy-safe fake data</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "login" | "signup")}>
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="login">Log in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-4">
                <form onSubmit={submit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Log in
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <form onSubmit={submit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ada Lovelace" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email-su">Email</Label>
                    <Input id="email-su" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="password-su">Password (6+ chars)</Label>
                    <Input id="password-su" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                  </div>
                  {error && <p className="text-sm text-destructive">{error}</p>}
                  <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    {loading && <Loader2 className="size-4 mr-2 animate-spin" />}
                    Create account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-4">
            Your account stores your saved recipes and AI provider settings only.
          </p>
        </div>
      </main>
      <footer className="border-t py-3 text-center text-xs text-muted-foreground">
        Synthetic Data Platform · Built for a hackathon
      </footer>
    </div>
  );
}
