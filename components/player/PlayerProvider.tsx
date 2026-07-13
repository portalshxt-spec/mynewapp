"use client";

/**
 * The player core. UI skins (the bottom RadioBar today, The Tuner in Phase 2)
 * consume this context and never touch audio elements directly, so new skins
 * can be added without changing playback logic.
 *
 * Playback details:
 * - Audio streams via short-lived signed URLs fetched per track from
 *   /api/player/track-url (entitlement-checked server side).
 * - Near-gapless: the next track's audio element is created and buffered while
 *   the current one plays, then swapped in the instant `ended` fires.
 * - Built to handle 80+ track queues: only two audio elements ever exist.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export interface QueueTrack {
  id: string;
  title: string;
  duration: number | null;
}

export interface QueueInfo {
  releaseId: string;
  releaseTitle: string;
  artwork: string | null;
  tracks: QueueTrack[];
}

interface PlayerContextValue {
  queue: QueueInfo | null;
  index: number;
  playing: boolean;
  currentTime: number;
  duration: number;
  loading: boolean;
  playQueue: (queue: QueueInfo, startIndex?: number) => void;
  playIndex: (i: number) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

const URL_FRESH_MS = 8 * 60 * 1000; // signed URLs live 10 min; treat as stale after 8

interface Preloaded {
  trackId: string;
  audio: HTMLAudioElement;
  fetchedAt: number;
}

export default function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<QueueInfo | null>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const preloadRef = useRef<Preloaded | null>(null);
  const queueRef = useRef<QueueInfo | null>(null);
  const indexRef = useRef(0);
  queueRef.current = queue;
  indexRef.current = index;

  const fetchUrl = useCallback(async (trackId: string): Promise<string> => {
    const res = await fetch(`/api/player/track-url?id=${encodeURIComponent(trackId)}`);
    if (!res.ok) throw new Error("Not authorized for this track");
    const json = await res.json();
    return json.url as string;
  }, []);

  const teardown = useCallback((audio: HTMLAudioElement | null) => {
    if (!audio) return;
    audio.onended = null;
    audio.ontimeupdate = null;
    audio.onloadedmetadata = null;
    audio.onplay = null;
    audio.onpause = null;
    audio.pause();
    audio.removeAttribute("src");
  }, []);

  const wire = useCallback((audio: HTMLAudioElement) => {
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      maybePreloadNext(audio);
    };
    audio.onloadedmetadata = () => setDuration(audio.duration || 0);
    audio.onplay = () => setPlaying(true);
    audio.onpause = () => setPlaying(false);
    audio.onended = () => advance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maybePreloadNext = useCallback(
    (audio: HTMLAudioElement) => {
      const q = queueRef.current;
      if (!q) return;
      const nextIdx = indexRef.current + 1;
      if (nextIdx >= q.tracks.length) return;
      const nextTrack = q.tracks[nextIdx];
      const pre = preloadRef.current;
      const remaining = (audio.duration || 0) - audio.currentTime;
      const stale = pre && Date.now() - pre.fetchedAt > URL_FRESH_MS;
      if (pre && pre.trackId === nextTrack.id && !stale) return;
      // Preload once we're within 30s of the end (or if the cached URL went stale).
      if (!isFinite(remaining) || remaining > 30) return;
      preloadRef.current = { trackId: nextTrack.id, audio: new Audio(), fetchedAt: Date.now() };
      const target = preloadRef.current;
      fetchUrl(nextTrack.id)
        .then((url) => {
          if (preloadRef.current !== target) return;
          target.audio.preload = "auto";
          target.audio.src = url;
          target.audio.load();
          target.fetchedAt = Date.now();
        })
        .catch(() => {
          if (preloadRef.current === target) preloadRef.current = null;
        });
    },
    [fetchUrl]
  );

  const startTrack = useCallback(
    async (i: number) => {
      const q = queueRef.current;
      if (!q || i < 0 || i >= q.tracks.length) return;
      const track = q.tracks[i];
      setIndex(i);
      indexRef.current = i;
      setCurrentTime(0);
      setDuration(track.duration ?? 0);
      setLoading(true);

      teardown(audioRef.current);

      try {
        const pre = preloadRef.current;
        let audio: HTMLAudioElement;
        if (pre && pre.trackId === track.id && pre.audio.src && Date.now() - pre.fetchedAt < URL_FRESH_MS) {
          audio = pre.audio;
          preloadRef.current = null;
        } else {
          const url = await fetchUrl(track.id);
          audio = new Audio(url);
          audio.preload = "auto";
        }
        audioRef.current = audio;
        wire(audio);
        await audio.play();
        updateMediaSession(q, track);
      } catch {
        setPlaying(false);
      } finally {
        setLoading(false);
      }
    },
    [fetchUrl, teardown, wire]
  );

  const advance = useCallback(() => {
    const q = queueRef.current;
    if (!q) return;
    const nextIdx = indexRef.current + 1;
    if (nextIdx < q.tracks.length) {
      void startTrack(nextIdx);
    } else {
      setPlaying(false);
    }
  }, [startTrack]);

  const playQueue = useCallback(
    (q: QueueInfo, startIndex = 0) => {
      preloadRef.current = null;
      setQueue(q);
      queueRef.current = q;
      void startTrack(startIndex);
    },
    [startTrack]
  );

  const playIndex = useCallback((i: number) => void startTrack(i), [startTrack]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      const q = queueRef.current;
      if (q) void startTrack(indexRef.current);
      return;
    }
    if (audio.paused) void audio.play();
    else audio.pause();
  }, [startTrack]);

  const next = useCallback(() => advance(), [advance]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    const prevIdx = indexRef.current - 1;
    if (prevIdx >= 0) void startTrack(prevIdx);
  }, [startTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  function updateMediaSession(q: QueueInfo, track: QueueTrack) {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: "BLakHarts",
      album: q.releaseTitle,
      artwork: q.artwork ? [{ src: q.artwork, sizes: "512x512" }] : [],
    });
  }

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;
    navigator.mediaSession.setActionHandler("play", () => toggle());
    navigator.mediaSession.setActionHandler("pause", () => toggle());
    navigator.mediaSession.setActionHandler("nexttrack", () => next());
    navigator.mediaSession.setActionHandler("previoustrack", () => prev());
  }, [toggle, next, prev]);

  useEffect(() => {
    return () => {
      teardown(audioRef.current);
      teardown(preloadRef.current?.audio ?? null);
    };
  }, [teardown]);

  return (
    <PlayerContext.Provider
      value={{
        queue,
        index,
        playing,
        currentTime,
        duration,
        loading,
        playQueue,
        playIndex,
        toggle,
        next,
        prev,
        seek,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
