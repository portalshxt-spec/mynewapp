"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { muxThumb } from "@/lib/utils";
import type { Video } from "@/lib/types";

const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), { ssr: false });

function VideoCard({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false);
  if (!video.playback_id) return null;

  return (
    <div className="group overflow-hidden rounded border border-edge bg-panel">
      <div className="relative aspect-video w-full bg-black">
        {playing ? (
          <MuxPlayer
            playbackId={video.playback_id}
            streamType="on-demand"
            autoPlay
            playsInline
            accentColor="#C9A961"
            metadata={{ video_title: video.title }}
            className="h-full w-full"
            style={{ aspectRatio: "16 / 9", width: "100%" }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            className="relative block h-full w-full"
            aria-label={`Play ${video.title}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={video.thumbnail || muxThumb(video.playback_id)}
              alt={video.title}
              loading="lazy"
              className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border border-cyan/70 bg-ink/70 text-cyan shadow-neon-cyan transition group-hover:scale-110">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="px-3 py-2">
        <h3 className="display truncate text-sm font-semibold tracking-wider text-neutral-200">
          {video.title}
        </h3>
      </div>
    </div>
  );
}

export default function VideoWall({ videos }: { videos: Video[] }) {
  if (videos.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (
        <VideoCard key={v.id} video={v} />
      ))}
    </div>
  );
}
