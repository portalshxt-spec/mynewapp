"use client";

import { useState } from "react";

export default function EmailSignup({
  header,
  subtext,
}: {
  header: string;
  subtext: string;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState("busy");
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="static-texture border-t border-edge bg-panel">
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h2 className="display text-3xl font-bold text-gold sm:text-4xl">{header}</h2>
        <p className="mt-2 text-sm text-neutral-400">{subtext}</p>
        {state === "done" ? (
          <p className="neon-cyan mt-8 display text-lg tracking-widest">
            SIGNAL RECEIVED. WELCOME.
          </p>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 flex max-w-md gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="min-w-0 flex-1 rounded border border-edge bg-ink px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-cyan"
            />
            <button
              type="submit"
              disabled={state === "busy"}
              className="display rounded bg-gold px-5 py-3 text-sm font-bold tracking-widest text-ink transition hover:shadow-neon-gold disabled:opacity-50"
            >
              {state === "busy" ? "…" : "TUNE IN"}
            </button>
          </form>
        )}
        {state === "error" && (
          <p className="mt-3 text-xs text-onair">Something jammed the signal. Try again.</p>
        )}
      </div>
    </section>
  );
}
