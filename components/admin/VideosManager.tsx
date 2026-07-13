"use client";

/**
 * Music video manager: upload to Mux or paste a URL (Mux ingests it),
 * publish toggle, drag reorder, and exactly one FEATURED video for the
 * homepage hero.
 */

import { useState } from "react";
import { Btn, Label, Note, inputCls } from "./atoms";
import ReorderList from "./ReorderList";
import { api, uploadToMux, uploadToStorage } from "./uploads";
import type { Video } from "@/lib/types";
import { muxThumb } from "@/lib/utils";

export default function VideosManager({ initialVideos }: { initialVideos: Video[] }) {
  const [videos, setVideos] = useState(initialVideos);
  const [status, setStatus] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function replaceVideo(v: Video) {
    setVideos((list) => list.map((x) => (x.id === v.id ? v : x)));
  }

  async function pollUntilReady(videoId: string) {
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 4000));
      try {
        const json = await api<{ ready: boolean; video?: Video }>(
          `/api/admin/videos/${videoId}`,
          "POST"
        );
        if (json.ready && json.video) {
          replaceVideo(json.video);
          setStatus(null);
          return;
        }
      } catch {
        break;
      }
    }
    setStatus("Still processing — refresh this page in a bit.");
  }

  async function uploadVideo(file: File) {
    setError(null);
    try {
      const assetId = await uploadToMux("public", file, setStatus);
      const json = await api<{ video: Video }>("/api/admin/videos", "POST", {
        title: title.trim() || file.name.replace(/\.[^.]+$/, ""),
        muxAssetId: assetId,
      });
      setVideos((v) => [...v, json.video]);
      setTitle("");
      if (!json.video.playback_id) {
        setStatus("Processing on Mux…");
        void pollUntilReady(json.video.id);
      } else {
        setStatus(null);
      }
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function ingestUrl() {
    if (!sourceUrl.trim()) return;
    setError(null);
    setStatus("Sending URL to Mux…");
    try {
      const json = await api<{ video: Video }>("/api/admin/videos", "POST", {
        title: title.trim() || "Untitled video",
        sourceUrl: sourceUrl.trim(),
      });
      setVideos((v) => [...v, json.video]);
      setTitle("");
      setSourceUrl("");
      setStatus("Mux is ingesting the URL…");
      void pollUntilReady(json.video.id);
    } catch (e) {
      setStatus(null);
      setError(e instanceof Error ? e.message : "Ingest failed");
    }
  }

  async function patchVideo(id: string, patch: Record<string, unknown>) {
    try {
      const json = await api<{ video: Video }>(`/api/admin/videos/${id}`, "PATCH", patch);
      if (patch.featured === true) {
        setVideos((list) =>
          list.map((v) => (v.id === id ? json.video : { ...v, featured: false }))
        );
      } else {
        replaceVideo(json.video);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }

  async function uploadThumb(id: string, file: File) {
    try {
      const { publicUrl } = await uploadToStorage("artwork", "video-thumbs", file);
      await patchVideo(id, { thumbnail: publicUrl });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Thumbnail upload failed");
    }
  }

  async function deleteVideo(id: string) {
    if (!confirm("Delete this video from the site? (The Mux asset is kept.)")) return;
    await api(`/api/admin/videos/${id}`, "DELETE");
    setVideos((v) => v.filter((x) => x.id !== id));
  }

  const fileBtn =
    "display inline-block cursor-pointer rounded border border-edge px-4 py-2 text-xs font-bold tracking-widest text-neutral-300 transition hover:border-cyan hover:text-cyan";

  return (
    <div className="space-y-8">
      <section className="rounded border border-edge bg-panel p-6">
        <h2 className="display mb-4 text-xl font-bold tracking-wider text-gold">ADD A VIDEO</h2>
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title"
              className={inputCls}
            />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className={fileBtn}>
              UPLOAD VIDEO FILE
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && uploadVideo(e.target.files[0])}
              />
            </label>
            <span className="text-xs text-neutral-600">or</span>
            <div className="min-w-0 flex-1">
              <input
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="Paste a direct video URL (Mux will ingest it)"
                className={inputCls}
              />
            </div>
            <Btn onClick={ingestUrl} kind="ghost">
              INGEST URL
            </Btn>
          </div>
          {status && <Note tone="ok">{status}</Note>}
          {error && <Note tone="warn">{error}</Note>}
        </div>
      </section>

      <section>
        <h2 className="display mb-4 text-xl font-bold tracking-wider text-gold">
          ALL VIDEOS <span className="text-sm text-neutral-500">({videos.length})</span>
        </h2>
        {videos.length === 0 ? (
          <p className="text-sm text-neutral-500">Nothing on the wall yet.</p>
        ) : (
          <ReorderList
            items={videos}
            setItems={setVideos}
            onCommit={(order) => api("/api/admin/videos", "PATCH", { order })}
            render={(video) => (
              <div className="flex flex-wrap items-center gap-3 py-1">
                <label className="relative block h-14 w-24 shrink-0 cursor-pointer overflow-hidden rounded bg-ink" title="Click to upload a custom thumbnail">
                  {video.playback_id ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={video.thumbnail || muxThumb(video.playback_id, 240)}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-neutral-600">
                      processing
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadThumb(video.id, e.target.files[0])}
                  />
                </label>
                <input
                  defaultValue={video.title}
                  onBlur={(e) =>
                    e.target.value.trim() &&
                    e.target.value !== video.title &&
                    patchVideo(video.id, { title: e.target.value })
                  }
                  className="min-w-[10rem] flex-1 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-white outline-none focus:border-cyan"
                />
                <label className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <input
                    type="checkbox"
                    checked={video.published}
                    onChange={(e) => patchVideo(video.id, { published: e.target.checked })}
                    className="accent-[#C9A961]"
                  />
                  Published
                </label>
                <label className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <input
                    type="radio"
                    name="featured"
                    checked={video.featured}
                    onChange={() => patchVideo(video.id, { featured: true })}
                    className="accent-[#3DE8E8]"
                  />
                  <span className={video.featured ? "neon-cyan" : ""}>Featured (hero)</span>
                </label>
                <button
                  onClick={() => deleteVideo(video.id)}
                  className="text-neutral-600 transition hover:text-onair"
                  title="Delete video"
                >
                  ✕
                </button>
              </div>
            )}
          />
        )}
      </section>
    </div>
  );
}
