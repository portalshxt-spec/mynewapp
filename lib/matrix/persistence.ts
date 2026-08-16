/**
 * Persistence and settings.
 *
 * Everything lives in localStorage behind a guarded accessor, so the module is
 * safe during SSR and degrades to in-memory state anywhere storage is blocked
 * (private mode, sandboxed frames, claude.ai artifacts).
 */

import { DEFAULT_AUDIO, type AudioSettings } from "./audio";
import { DEFAULT_BINDINGS, type Bindings } from "./input";
import type { QualityTier } from "./render/post";

const KEY = "miftachs-matrix/v1";

export interface Settings {
  audio: AudioSettings;
  bindings: Bindings;
  /** Kills chromatic aberration, camera roll and screen shake. Gameplay untouched. */
  reducedMotion: boolean;
  /** Caps speed scaling at 1.05/layer and halves Trace gain. */
  assist: boolean;
  /** null means auto-detect from first-frame timing. */
  quality: QualityTier | null;
  showGhost: boolean;
}

export interface GhostSample {
  z: number;
  theta: number;
  radius: number;
}

export interface SaveData {
  settings: Settings;
  bestPerLayer: Record<number, number>;
  bestRun: number;
  /** Highest layer reached, so the layer select knows what is unlocked. */
  unlocked: number;
  ghost: Record<number, GhostSample[]>;
}

export const DEFAULT_SETTINGS: Settings = {
  audio: { ...DEFAULT_AUDIO },
  bindings: { ...DEFAULT_BINDINGS },
  reducedMotion: false,
  assist: false,
  quality: null,
  showGhost: true,
};

function emptySave(): SaveData {
  return {
    settings: { ...DEFAULT_SETTINGS },
    bestPerLayer: {},
    bestRun: 0,
    unlocked: 1,
    ghost: {},
  };
}

/** In-memory fallback so the game is fully playable without storage. */
let memory: SaveData | null = null;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    const test = "__mm__";
    window.localStorage.setItem(test, "1");
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return null;
  }
}

export function load(): SaveData {
  if (memory) return memory;
  const store = storage();
  if (!store) {
    memory = emptySave();
    return memory;
  }
  try {
    const raw = store.getItem(KEY);
    if (!raw) {
      memory = emptySave();
      return memory;
    }
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    memory = {
      ...emptySave(),
      ...parsed,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(parsed.settings ?? {}),
        audio: { ...DEFAULT_AUDIO, ...(parsed.settings?.audio ?? {}) },
        bindings: { ...DEFAULT_BINDINGS, ...(parsed.settings?.bindings ?? {}) },
      },
    };
    return memory;
  } catch {
    memory = emptySave();
    return memory;
  }
}

export function save(data: SaveData) {
  memory = data;
  const store = storage();
  if (!store) return;
  try {
    store.setItem(KEY, JSON.stringify(data));
  } catch {
    // Quota or private mode — memory still holds the session.
  }
}

export function saveSettings(settings: Settings) {
  const data = load();
  data.settings = settings;
  save(data);
}

export function recordLayer(level: number, score: number, ghost: GhostSample[]) {
  const data = load();
  const previous = data.bestPerLayer[level] ?? 0;
  if (score > previous) {
    data.bestPerLayer[level] = score;
    data.ghost[level] = ghost;
  }
  data.unlocked = Math.max(data.unlocked, Math.min(10, level + 1));
  save(data);
}

export function recordRun(score: number) {
  const data = load();
  if (score > data.bestRun) {
    data.bestRun = score;
    save(data);
  }
}

export function ghostFor(level: number): GhostSample[] | null {
  const data = load();
  return data.ghost[level] ?? null;
}

export function reset() {
  memory = emptySave();
  const store = storage();
  try {
    store?.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** Ghost paths are downsampled to keep a full ten-layer run well inside quota. */
export const GHOST_SAMPLE_INTERVAL = 0.5;
