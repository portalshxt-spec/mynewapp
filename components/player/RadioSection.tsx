"use client";

/** THE RADIO — album player section on a member release page. */

import OnAirBadge from "../OnAirBadge";
import { usePlayer, QueueInfo } from "./PlayerProvider";
import { formatDuration } from "@/lib/utils";

export default function RadioSection({ queue }: { queue: QueueInfo }) {
  const player = usePlayer();
  const isThisQueue = player.queue?.releaseId === queue.releaseId;
  const activeIndex = isThisQueue ? player.index : -1;

  function playTrack(i: number) {
    if (isThisQueue) player.playIndex(i);
    else player.playQueue(queue, i);
  }

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="display text-2xl font-bold tracking-wider text-gold">THE RADIO</h2>
        <OnAirBadge live={isThisQueue && player.playing} />
      </div>

      <button
        onClick={() => (isThisQueue ? player.toggle() : player.playQueue(queue, 0))}
        className="display mb-6 w-full rounded bg-gold px-6 py-4 text-sm font-bold tracking-[0.2em] text-ink transition hover:shadow-neon-gold sm:w-auto sm:px-10"
      >
        {isThisQueue && player.playing ? "◼ PAUSE BROADCAST" : "▶ START BROADCAST"}
      </button>

      <ol className="divide-y divide-edge overflow-hidden rounded border border-edge bg-panel">
        {queue.tracks.map((track, i) => {
          const active = i === activeIndex;
          return (
            <li key={track.id}>
              <button
                onClick={() => playTrack(i)}
                className={`flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-ink/60 ${
                  active ? "bg-ink/80" : ""
                }`}
              >
                <span
                  className={`display w-8 shrink-0 text-right text-sm font-semibold ${
                    active ? "neon-gold" : "text-neutral-600"
                  }`}
                >
                  {active && player.playing ? "▶" : String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    active ? "text-cyan" : "text-neutral-200"
                  }`}
                >
                  {track.title}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-neutral-500">
                  {formatDuration(track.duration)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {queue.tracks.length === 0 && (
        <p className="mt-4 text-sm text-neutral-500">No tracks are live on this frequency yet.</p>
      )}
    </section>
  );
}
