"use client";

/** Persistent bottom player bar — the default skin over the player core. */

import Image from "next/image";
import OnAirBadge from "../OnAirBadge";
import { usePlayer } from "./PlayerProvider";
import { formatDuration } from "@/lib/utils";

export default function RadioBar() {
  const { queue, index, playing, currentTime, duration, loading, toggle, next, prev, seek } =
    usePlayer();

  if (!queue) return null;
  const track = queue.tracks[index];

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-edge bg-panel/95 backdrop-blur">
      <input
        type="range"
        className="scrubber block w-full"
        min={0}
        max={duration || track?.duration || 0}
        step={1}
        value={Math.min(currentTime, duration || Infinity)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Seek"
      />
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 sm:gap-4">
        <div className="relative hidden h-11 w-11 shrink-0 overflow-hidden rounded bg-ink sm:block">
          {queue.artwork && (
            <Image src={queue.artwork} alt="" fill sizes="44px" className="object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="display truncate text-sm font-semibold tracking-wider text-white">
            {track?.title ?? "—"}
          </p>
          <p className="truncate text-[11px] text-neutral-500">
            {queue.releaseTitle} · {index + 1}/{queue.tracks.length} ·{" "}
            {formatDuration(currentTime)} / {formatDuration(duration || track?.duration)}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={prev}
            aria-label="Previous track"
            className="text-neutral-400 transition hover:text-cyan"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button
            onClick={toggle}
            aria-label={playing ? "Pause" : "Play"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gold text-ink transition hover:shadow-neon-gold disabled:opacity-60"
            disabled={loading}
          >
            {playing ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={next}
            aria-label="Next track"
            className="text-neutral-400 transition hover:text-cyan"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 6h2v12h-2zM6 18l8.5-6L6 6z" />
            </svg>
          </button>
        </div>
        <div className="hidden sm:block">
          <OnAirBadge live={playing} />
        </div>
      </div>
    </div>
  );
}
