"use client";

import { useState } from "react";

export default function AccessForm({ admin = false }: { admin?: boolean }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try {
      const res = await fetch(admin ? "/api/admin/login" : "/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="rounded border border-cyan/40 bg-panel p-6 text-center">
        <p className="display neon-cyan text-sm tracking-[0.2em]">TRANSMISSION SENT</p>
        <p className="mt-3 text-sm text-neutral-400">
          If that email has {admin ? "admin clearance" : "an active purchase"}, a single-use access
          link is on its way. It expires in 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="w-full rounded border border-edge bg-panel px-4 py-3 text-sm text-white placeholder-neutral-600 outline-none focus:border-cyan"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="display w-full rounded bg-gold px-6 py-3 text-sm font-bold tracking-widest text-ink transition hover:shadow-neon-gold disabled:opacity-50"
      >
        {state === "busy" ? "TRANSMITTING…" : "SEND MY ACCESS LINK"}
      </button>
      {state === "error" && (
        <p className="text-center text-xs text-onair">Something jammed the signal. Try again.</p>
      )}
    </form>
  );
}
