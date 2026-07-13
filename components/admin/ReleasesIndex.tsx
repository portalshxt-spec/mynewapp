"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, Note, inputCls } from "./atoms";
import { api } from "./uploads";
import type { Release } from "@/lib/types";
import { formatPrice } from "@/lib/utils";

export default function ReleasesIndex({ initialReleases }: { initialReleases: Release[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const json = await api<{ release: Release }>("/api/admin/releases", "POST", { title });
      router.push(`/admin/releases/${json.release.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create release");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={create} className="flex gap-2 rounded border border-edge bg-panel p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New release title…"
          className={inputCls}
        />
        <Btn type="submit" disabled={busy}>
          {busy ? "CREATING…" : "+ NEW RELEASE"}
        </Btn>
      </form>
      {err && <Note tone="warn">{err}</Note>}

      <div className="divide-y divide-edge overflow-hidden rounded border border-edge bg-panel">
        {initialReleases.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-neutral-500">
            No releases yet — name your first transmission above.
          </p>
        )}
        {initialReleases.map((r) => (
          <Link
            key={r.id}
            href={`/admin/releases/${r.id}`}
            className="flex items-center gap-4 px-4 py-3 transition hover:bg-ink/60"
          >
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-ink">
              {r.artwork && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.artwork} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="display truncate text-sm font-bold tracking-wider text-white">
                {r.title}
              </p>
              <p className="text-xs text-neutral-500">
                {formatPrice(r.price_standard_cents)} / {formatPrice(r.price_deluxe_cents)} ·{" "}
                {r.release_date ?? "no date"}
              </p>
            </div>
            <span
              className={`display rounded px-2 py-1 text-[10px] font-bold tracking-widest ${
                r.published ? "border border-cyan text-cyan" : "border border-edge text-neutral-500"
              }`}
            >
              {r.published ? "LIVE" : "DRAFT"}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
