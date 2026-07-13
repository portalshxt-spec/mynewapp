"use client";

/** PAGES — every line of site copy and the band cards, editable in plain fields. */

import { useState } from "react";
import { Btn, Label, Note, inputCls } from "./atoms";
import { api, uploadToStorage } from "./uploads";
import type { BandMember, SiteSettings } from "@/lib/types";

const COPY_FIELDS: { key: keyof SiteSettings; label: string; rows?: number }[] = [
  { key: "tagline", label: "Tagline (under logo)" },
  { key: "hero_line", label: "Hero line", rows: 2 },
  { key: "signup_header", label: "Email signup header" },
  { key: "signup_subtext", label: "Email signup subtext" },
  { key: "footer_text", label: "Footer" },
  { key: "lore_title", label: "Lore title" },
  { key: "lore_text", label: "Lore text", rows: 6 },
];

export default function PagesEditor({ initial }: { initial: SiteSettings }) {
  const [copy, setCopy] = useState(initial);
  const [band, setBand] = useState<BandMember[]>(initial.band_members);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    setErr(null);
    try {
      await api("/api/admin/settings", "POST", {
        tagline: copy.tagline,
        hero_line: copy.hero_line,
        signup_header: copy.signup_header,
        signup_subtext: copy.signup_subtext,
        footer_text: copy.footer_text,
        lore_title: copy.lore_title,
        lore_text: copy.lore_text,
        band_members: JSON.stringify(band),
      });
      setMsg("Saved. The live site updates immediately.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setMember(i: number, patch: Partial<BandMember>) {
    setBand((b) => b.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }

  async function uploadPortrait(i: number, file: File) {
    try {
      const { publicUrl } = await uploadToStorage("artwork", "band", file);
      if (publicUrl) setMember(i, { image: publicUrl });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Image upload failed");
    }
  }

  return (
    <div className="space-y-8">
      <section className="rounded border border-edge bg-panel p-6">
        <h2 className="display mb-4 text-xl font-bold tracking-wider text-gold">SITE COPY</h2>
        <div className="space-y-4">
          {COPY_FIELDS.map((f) => (
            <div key={f.key}>
              <Label>{f.label}</Label>
              {f.rows ? (
                <textarea
                  rows={f.rows}
                  value={copy[f.key] as string}
                  onChange={(e) => setCopy((c) => ({ ...c, [f.key]: e.target.value }))}
                  className={inputCls}
                />
              ) : (
                <input
                  value={copy[f.key] as string}
                  onChange={(e) => setCopy((c) => ({ ...c, [f.key]: e.target.value }))}
                  className={inputCls}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded border border-edge bg-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="display text-xl font-bold tracking-wider text-gold">BAND CARDS</h2>
          <Btn
            kind="ghost"
            onClick={() => setBand((b) => [...b, { name: "", role: "", bio: "", image: "" }])}
          >
            + ADD MEMBER
          </Btn>
        </div>
        <div className="space-y-6">
          {band.map((m, i) => (
            <div key={i} className="grid grid-cols-1 gap-4 rounded border border-edge p-4 sm:grid-cols-[110px_1fr]">
              <label className="block cursor-pointer">
                {m.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.image}
                    alt={m.name}
                    className="aspect-square w-full rounded border border-edge object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded border border-dashed border-edge text-center text-[10px] text-neutral-500">
                    Upload photo
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadPortrait(i, e.target.files[0])}
                />
              </label>
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={m.name}
                    onChange={(e) => setMember(i, { name: e.target.value })}
                    placeholder="Name"
                    className={inputCls}
                  />
                  <input
                    value={m.role}
                    onChange={(e) => setMember(i, { role: e.target.value })}
                    placeholder="Role"
                    className={inputCls}
                  />
                </div>
                <textarea
                  value={m.bio}
                  onChange={(e) => setMember(i, { bio: e.target.value })}
                  placeholder="Two-line bio"
                  rows={2}
                  className={inputCls}
                />
                <button
                  onClick={() => setBand((b) => b.filter((_, idx) => idx !== i))}
                  className="text-xs text-neutral-600 transition hover:text-onair"
                >
                  Remove member
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex items-center gap-4">
        <Btn onClick={save} disabled={saving}>
          {saving ? "SAVING…" : "SAVE ALL PAGES"}
        </Btn>
        {msg && <Note tone="ok">{msg}</Note>}
        {err && <Note tone="warn">{err}</Note>}
      </div>
    </div>
  );
}
