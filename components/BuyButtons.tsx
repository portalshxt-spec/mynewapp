"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/utils";

export default function BuyButtons({
  releaseId,
  standardCents,
  deluxeCents,
  hasFilm,
}: {
  releaseId: string;
  standardCents: number | null;
  deluxeCents: number | null;
  hasFilm: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buy(tier: "standard" | "deluxe") {
    setBusy(tier);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId, tier }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || "Checkout unavailable");
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout unavailable");
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {standardCents != null && (
        <button
          onClick={() => buy("standard")}
          disabled={busy !== null}
          className="display block w-full rounded bg-gold px-6 py-4 text-left text-ink transition hover:shadow-neon-gold disabled:opacity-50"
        >
          <span className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-bold tracking-widest">
                BUY NOW — STANDARD
              </span>
              <span className="block text-[11px] font-medium normal-case tracking-normal opacity-80">
                Full album access: stream + download
              </span>
            </span>
            <span className="text-xl font-bold">{formatPrice(standardCents)}</span>
          </span>
        </button>
      )}
      {deluxeCents != null && (
        <button
          onClick={() => buy("deluxe")}
          disabled={busy !== null}
          className="display block w-full rounded border border-cyan bg-ink px-6 py-4 text-left text-cyan transition hover:shadow-neon-cyan disabled:opacity-50"
        >
          <span className="flex items-center justify-between">
            <span>
              <span className="block text-sm font-bold tracking-widest">
                BUY NOW — DELUXE
              </span>
              <span className="block text-[11px] font-medium normal-case tracking-normal opacity-80">
                Album access{hasFilm ? " + the full-length film" : " + film access"}
              </span>
            </span>
            <span className="text-xl font-bold">{formatPrice(deluxeCents)}</span>
          </span>
        </button>
      )}
      {busy && <p className="text-xs text-neutral-500">Opening secure checkout…</p>}
      {error && <p className="text-xs text-onair">{error}</p>}
    </div>
  );
}
