"use client";
// Chat box: change the generated data with one sentence, e.g.
// "make 20% more late payments". Uses the AI to turn the sentence into rule
// overrides, then regenerates the dataset.
import { useState } from "react";
import { useStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, Send } from "lucide-react";

const SUGGESTIONS = [
  "make 20% more late payments",
  "increase female students to 50%",
  "add more high-value orders",
];

export function ChatBox() {
  const { generateChat, plan, loading, chatChanges } = useStore();
  const [text, setText] = useState("");

  function send(s?: string) {
    const sentence = (s ?? text).trim();
    if (!sentence) return;
    generateChat(sentence);
    setText("");
  }

  if (!plan) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <MessageSquare className="size-4 text-emerald-600" /> Chat to edit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Describe a change…"
            disabled={loading}
          />
          <Button size="icon" onClick={() => send()} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-xs rounded-full border px-2.5 py-1 text-muted-foreground hover:bg-muted"
              disabled={loading}
            >
              {s}
            </button>
          ))}
        </div>
        {chatChanges.length > 0 && (
          <ul className="space-y-1 pt-1">
            {chatChanges.map((c, i) => (
              <li key={i} className="text-xs text-emerald-700">• {c}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
