"use client";

import dynamic from "next/dynamic";
import { muxThumb } from "@/lib/utils";

// Loaded as a separate chunk so the heavy player never blocks first paint —
// the Mux poster frame is the LCP, and the player hydrates in over it.
const MuxPlayer = dynamic(() => import("@mux/mux-player-react"), {
  ssr: false,
  loading: () => null,
});

export default function HeroVideo({
  playbackId,
  title,
}: {
  playbackId: string;
  title: string;
}) {
  return (
    <div
      className="relative w-full bg-black bg-cover bg-center"
      style={{ aspectRatio: "16 / 9", backgroundImage: `url(${muxThumb(playbackId, 1280)})` }}
    >
      <MuxPlayer
        playbackId={playbackId}
        streamType="on-demand"
        autoPlay="muted"
        loop
        playsInline
        metadata={{ video_title: title }}
        accentColor="#C9A961"
        className="absolute inset-0 h-full w-full"
        style={{ aspectRatio: "16 / 9", width: "100%", ["--media-object-fit" as string]: "cover" }}
      />
    </div>
  );
}
