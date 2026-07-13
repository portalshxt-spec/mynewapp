"use client";

/**
 * The whole per-release workflow, no code required:
 * details + artwork + prices (auto-synced to Stripe), bulk track upload with
 * drag reorder, download zips per tier, and the Deluxe film.
 */

import Link from "next/link";
import { useState } from "react";
import { Btn, Label, Note, Toggle, inputCls } from "./atoms";
import ReorderList from "./ReorderList";
import { api, audioDuration, uploadToMux, uploadToStorage } from "./uploads";
import type { Film, Release, Track } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

export default function ReleaseEditor({
  initialRelease,
  initialTracks,
  initialFilm,
}: {
  initialRelease: Release;
  initialTracks: Track[];
  initialFilm: Film | null;
}) {
  const [release, setRelease] = useState(initialRelease);
  const [tracks, setTracks] = useState(initialTracks);
  const [film, setFilm] = useState(initialFilm);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: "ok" | "warn" } | null>(null);
  const [trackStatus, setTrackStatus] = useState<string | null>(null);
  const [filmStatus, setFilmStatus] = useState<string | null>(null);

  function flash(text: string, tone: "ok" | "warn" = "ok") {
    setMsg({ text, tone });
    setTimeout(() => setMsg(null), 6000);
  }

  // ------------------------------------------------------------- release
  async function saveRelease(extra: Partial<Release> = {}) {
    setSaving(true);
    try {
      const body = {
        id: release.id,
        title: release.title,
        description: release.description,
        release_date: release.release_date,
        published: release.published,
        price_standard_cents: release.price_standard_cents,
        price_deluxe_cents: release.price_deluxe_cents,
        artwork: release.artwork,
        ...extra,
      };
      const json = await api<{ release: Release; stripeWarning?: string }>(
        "/api/admin/releases",
        "PATCH",
        body
      );
      setRelease(json.release);
      flash(json.stripeWarning ?? "Saved. Stripe is in sync.", json.stripeWarning ? "warn" : "ok");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Save failed", "warn");
    } finally {
      setSaving(false);
    }
  }

  async function uploadArtwork(file: File) {
    try {
      const { publicUrl } = await uploadToStorage("artwork", `releases/${release.id}`, file);
      setRelease((r) => ({ ...r, artwork: publicUrl }));
      await saveRelease({ artwork: publicUrl as any });
    } catch (e) {
      flash(e instanceof Error ? e.message : "Artwork upload failed", "warn");
    }
  }

  function priceInput(field: "price_standard_cents" | "price_deluxe_cents") {
    const cents = release[field];
    return (
      <input
        type="number"
        min={0}
        step="0.01"
        value={cents != null ? (cents / 100).toString() : ""}
        onChange={(e) => {
          const v = e.target.value;
          setRelease((r) => ({
            ...r,
            [field]: v === "" ? null : Math.round(parseFloat(v) * 100),
          }));
        }}
        placeholder="0.00"
        className={inputCls}
      />
    );
  }

  // -------------------------------------------------------------- tracks
  async function bulkUpload(files: FileList) {
    const list = [...files];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setTrackStatus(`Uploading ${i + 1}/${list.length}: ${file.name}`);
      try {
        const duration = await audioDuration(file);
        const { path } = await uploadToStorage("audio", `releases/${release.id}`, file);
        const title = file.name.replace(/\.[^.]+$/, "").replace(/^[\d\s._-]+/, "") || file.name;
        const json = await api<{ track: Track }>("/api/admin/tracks", "POST", {
          releaseId: release.id,
          title,
          audioKey: path,
          duration,
        });
        setTracks((t) => [...t, json.track]);
      } catch (e) {
        flash(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`, "warn");
      }
    }
    setTrackStatus(null);
  }

  async function renameTrack(id: string, title: string) {
    if (!title.trim()) return;
    await api(`/api/admin/tracks/${id}`, "PATCH", { title });
  }

  async function deleteTrack(id: string) {
    if (!confirm("Delete this track and its audio file?")) return;
    await api(`/api/admin/tracks/${id}`, "DELETE");
    setTracks((t) => t.filter((x) => x.id !== id));
  }

  // ----------------------------------------------------------- downloads
  async function uploadZip(tier: "standard" | "deluxe", file: File) {
    try {
      setTrackStatus(`Uploading ${tier} zip…`);
      const { path } = await uploadToStorage("downloads", `releases/${release.id}`, file);
      const field = tier === "standard" ? "download_standard_key" : "download_deluxe_key";
      setRelease((r) => ({ ...r, [field]: path }));
      await saveRelease({ [field]: path } as Partial<Release>);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Zip upload failed", "warn");
    } finally {
      setTrackStatus(null);
    }
  }

  // ---------------------------------------------------------------- film
  async function uploadFilm(file: File) {
    try {
      const assetId = await uploadToMux("signed", file, setFilmStatus);
      const json = await api<{ film: Film }>("/api/admin/films", "POST", {
        releaseId: release.id,
        title: film?.title || `${release.title} — The Film`,
        muxAssetId: assetId,
      });
      setFilm(json.film);
      setFilmStatus(json.film.playback_id ? null : "Processing — hit SYNC in a minute.");
    } catch (e) {
      setFilmStatus(null);
      flash(e instanceof Error ? e.message : "Film upload failed", "warn");
    }
  }

  async function syncFilm() {
    try {
      const json = await api<{ ready: boolean; film?: Film; status?: string }>(
        "/api/admin/films",
        "PATCH",
        { releaseId: release.id }
      );
      if (json.ready && json.film) {
        setFilm(json.film);
        setFilmStatus(null);
        flash("Film is ready to stream.");
      } else {
        setFilmStatus(`Mux status: ${json.status ?? "processing"} — try again shortly.`);
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : "Sync failed", "warn");
    }
  }

  async function saveFilmMeta() {
    if (!film) return;
    const json = await api<{ film: Film }>("/api/admin/films", "POST", {
      releaseId: release.id,
      title: film.title,
      description: film.description,
      poster: film.poster,
    });
    setFilm(json.film);
    flash("Film details saved.");
  }

  async function uploadPoster(file: File) {
    try {
      const { publicUrl } = await uploadToStorage("artwork", `films/${release.id}`, file);
      setFilm((f) => (f ? { ...f, poster: publicUrl } : f));
      await api("/api/admin/films", "POST", { releaseId: release.id, poster: publicUrl });
      flash("Poster updated.");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Poster upload failed", "warn");
    }
  }

  async function removeFilm() {
    if (!confirm("Detach the film from this release?")) return;
    await api("/api/admin/films", "DELETE", { releaseId: release.id });
    setFilm(null);
  }

  const fileBtn =
    "display inline-block cursor-pointer rounded border border-edge px-4 py-2 text-xs font-bold tracking-widest text-neutral-300 transition hover:border-cyan hover:text-cyan";

  return (
    <div className="space-y-12">
      {msg && (
        <div
          className={`fixed right-4 top-4 z-50 rounded border px-4 py-2 text-sm ${
            msg.tone === "ok" ? "border-cyan/50 bg-panel text-cyan" : "border-onair/50 bg-panel text-onair"
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* ------------------------------------------------ release details */}
      <section className="rounded border border-edge bg-panel p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="display text-xl font-bold tracking-wider text-gold">RELEASE</h2>
          <Toggle
            checked={release.published}
            onChange={(v) => {
              setRelease((r) => ({ ...r, published: v }));
              void saveRelease({ published: v });
            }}
            label={release.published ? "Published" : "Draft"}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
          <div>
            <Label>Artwork</Label>
            <label className="block cursor-pointer">
              {release.artwork ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={release.artwork}
                  alt="Artwork"
                  className="aspect-square w-full rounded border border-edge object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center rounded border border-dashed border-edge text-xs text-neutral-500">
                  Upload artwork
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadArtwork(e.target.files[0])}
              />
            </label>
          </div>

          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <input
                value={release.title}
                onChange={(e) => setRelease((r) => ({ ...r, title: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <Label>Description</Label>
              <textarea
                value={release.description ?? ""}
                onChange={(e) => setRelease((r) => ({ ...r, description: e.target.value }))}
                rows={4}
                className={inputCls}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label>Release date</Label>
                <input
                  type="date"
                  value={release.release_date ?? ""}
                  onChange={(e) => setRelease((r) => ({ ...r, release_date: e.target.value }))}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Standard price ($)</Label>
                {priceInput("price_standard_cents")}
              </div>
              <div>
                <Label>Deluxe price ($)</Label>
                {priceInput("price_deluxe_cents")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Btn onClick={() => saveRelease()} disabled={saving}>
                {saving ? "SAVING…" : "SAVE RELEASE"}
              </Btn>
              <Link
                href={`/store/${release.slug}`}
                className="text-xs text-neutral-500 hover:text-cyan"
                target="_blank"
              >
                View store page ↗
              </Link>
            </div>
            <Note>
              Saving creates/updates the Stripe product and prices automatically. Store page: /store/
              {release.slug}
            </Note>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- tracks */}
      <section className="rounded border border-edge bg-panel p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display text-xl font-bold tracking-wider text-gold">
            TRACKS <span className="text-sm text-neutral-500">({tracks.length})</span>
          </h2>
          <label className={fileBtn}>
            + BULK UPLOAD AUDIO
            <input
              type="file"
              accept="audio/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && bulkUpload(e.target.files)}
            />
          </label>
        </div>
        {trackStatus && <Note tone="ok">{trackStatus}</Note>}
        {tracks.length > 0 ? (
          <ReorderList
            items={tracks}
            setItems={setTracks}
            onCommit={(order) =>
              api("/api/admin/tracks", "PATCH", { releaseId: release.id, order })
            }
            render={(track, i) => (
              <div className="flex items-center gap-3">
                <span className="display w-7 shrink-0 text-right text-xs text-neutral-600">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <input
                  defaultValue={track.title}
                  onBlur={(e) => renameTrack(track.id, e.target.value)}
                  className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-white outline-none focus:border-cyan"
                />
                <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                  {formatDuration(track.duration)}
                </span>
                <button
                  onClick={() => deleteTrack(track.id)}
                  className="shrink-0 text-neutral-600 transition hover:text-onair"
                  title="Delete track"
                >
                  ✕
                </button>
              </div>
            )}
          />
        ) : (
          <p className="text-sm text-neutral-500">
            No tracks yet. Bulk-select your audio files above — titles come from filenames and are
            editable after.
          </p>
        )}
      </section>

      {/* ---------------------------------------------------- downloads */}
      <section className="rounded border border-edge bg-panel p-6">
        <h2 className="display mb-2 text-xl font-bold tracking-wider text-gold">DOWNLOAD ZIPS</h2>
        <Note>
          Upload a prepared zip per tier. Members get them through signed, expiring links only.
        </Note>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(["standard", "deluxe"] as const).map((tier) => {
            const key = tier === "standard" ? release.download_standard_key : release.download_deluxe_key;
            return (
              <div key={tier} className="rounded border border-edge p-4">
                <p className="display text-xs font-bold tracking-widest text-neutral-300">
                  {tier.toUpperCase()} ZIP
                </p>
                <p className="mt-1 truncate text-xs text-neutral-500">
                  {key ? key.split("/").pop() : "Not uploaded yet"}
                </p>
                <label className={`${fileBtn} mt-3`}>
                  {key ? "REPLACE" : "UPLOAD"}
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadZip(tier, e.target.files[0])}
                  />
                </label>
              </div>
            );
          })}
        </div>
      </section>

      {/* --------------------------------------------------------- film */}
      <section className="rounded border border-edge bg-panel p-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="display text-xl font-bold tracking-wider text-gold">THE FILM</h2>
          {film && (
            <Btn kind="danger" onClick={removeFilm}>
              REMOVE FILM
            </Btn>
          )}
        </div>
        <Note>
          Deluxe-only. The film uploads to Mux with a <em>signed</em> playback policy — it can never
          be hotlinked.
        </Note>

        {filmStatus && <Note tone="ok">{filmStatus}</Note>}

        {!film ? (
          <label className={`${fileBtn} mt-4`}>
            + UPLOAD FILM
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadFilm(e.target.files[0])}
            />
          </label>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[200px_1fr]">
            <div>
              <Label>Poster</Label>
              <label className="block cursor-pointer">
                {film.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={film.poster}
                    alt="Poster"
                    className="aspect-video w-full rounded border border-edge object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded border border-dashed border-edge text-xs text-neutral-500">
                    Upload poster
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadPoster(e.target.files[0])}
                />
              </label>
              <p className="mt-2 text-xs">
                {film.playback_id ? (
                  <span className="text-cyan">● Ready to stream</span>
                ) : (
                  <span className="text-neutral-500">
                    ○ Processing on Mux{" "}
                    <button onClick={syncFilm} className="text-cyan underline">
                      SYNC
                    </button>
                  </span>
                )}
              </p>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Film title</Label>
                <input
                  value={film.title}
                  onChange={(e) => setFilm((f) => (f ? { ...f, title: e.target.value } : f))}
                  className={inputCls}
                />
              </div>
              <div>
                <Label>Description</Label>
                <textarea
                  value={film.description ?? ""}
                  onChange={(e) =>
                    setFilm((f) => (f ? { ...f, description: e.target.value } : f))
                  }
                  rows={3}
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-3">
                <Btn onClick={saveFilmMeta}>SAVE FILM DETAILS</Btn>
                <label className={fileBtn}>
                  REPLACE FILM FILE
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFilm(e.target.files[0])}
                  />
                </label>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
