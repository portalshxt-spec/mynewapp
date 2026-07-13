"use client";

import MuxPlayer from "@mux/mux-player-react";

export default function FilmPlayer({
  playbackId,
  title,
  poster,
  tokens,
}: {
  playbackId: string;
  title: string;
  poster: string | null;
  tokens: { playback: string; thumbnail: string; storyboard: string };
}) {
  return (
    <MuxPlayer
      playbackId={playbackId}
      streamType="on-demand"
      playsInline
      poster={poster ?? undefined}
      tokens={tokens}
      metadata={{ video_title: title }}
      accentColor="#C9A961"
      className="block w-full"
      style={{ aspectRatio: "16 / 9", width: "100%" }}
    />
  );
}
