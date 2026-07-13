"use client";

/** Client-side upload helpers: files go straight to storage/Mux, never through the app server. */

import { browserSupabase } from "@/lib/supabase-browser";

export async function uploadToStorage(
  bucket: "artwork" | "audio" | "downloads",
  folder: string,
  file: File
): Promise<{ path: string; publicUrl: string | null }> {
  const res = await fetch("/api/admin/uploads/storage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bucket, folder, filename: file.name }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not start upload");

  const { error } = await browserSupabase()
    .storage.from(bucket)
    .uploadToSignedUrl(json.path, json.token, file);
  if (error) throw new Error(error.message);

  return { path: json.path, publicUrl: json.publicUrl ?? null };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Direct-upload a video file to Mux and wait for the asset id. */
export async function uploadToMux(
  policy: "public" | "signed",
  file: File,
  onStatus?: (status: string) => void
): Promise<string> {
  onStatus?.("Preparing upload…");
  const res = await fetch("/api/admin/uploads/mux", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ policy }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Could not start Mux upload");

  onStatus?.("Uploading video…");
  const put = await fetch(json.url, { method: "PUT", body: file });
  if (!put.ok) throw new Error("Video upload failed");

  onStatus?.("Processing on Mux…");
  for (let i = 0; i < 200; i++) {
    await sleep(3000);
    const poll = await fetch(`/api/admin/uploads/mux?id=${encodeURIComponent(json.uploadId)}`);
    const state = await poll.json();
    if (state.assetId) return state.assetId as string;
    if (state.status === "errored") throw new Error("Mux could not process this file");
  }
  throw new Error("Timed out waiting for Mux");
}

/** Read a local audio file's duration (seconds) before uploading. */
export function audioDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(isFinite(audio.duration) ? audio.duration : null);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    audio.src = url;
  });
}

export async function api<T = any>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json as T;
}
