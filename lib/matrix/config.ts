/**
 * MIFTACH'S MATRIX — world constants and the ten layer configs.
 *
 * Every number here comes from the GDD. The two that matter most are the
 * forward-speed base (1.1 per layer) and the angular-speed base (1.08 per
 * layer). Angular speed scaling *slightly under* forward speed is what makes
 * the world tighten by ~2% a layer without breaking clean lines. Tune those
 * before touching anything else.
 */

import type { Band, LevelConfig } from "./types";

// ---------------------------------------------------------------------------
// The Conduit
// ---------------------------------------------------------------------------

/** Tube radius. */
export const TUBE_RADIUS = 6.0;

/** Radial bands the player and entities occupy. */
export const BAND_RADIUS: Record<Band, number> = {
  WALL: 5.7,
  MID: 5.0,
  CORE: 4.2,
};

export const BANDS: Band[] = ["WALL", "MID", "CORE"];

/** Band ordering outward→inward, used for single-step radial movement. */
export const BAND_ORDER: Band[] = ["WALL", "MID", "CORE"];

/** 16 angular slots, 22.5° apart. Player angle is continuous; entities snap. */
export const SLOT_COUNT = 16;
export const SLOT_DEG = 360 / SLOT_COUNT;
export const SLOT_RAD = (Math.PI * 2) / SLOT_COUNT;

/** A rib every 8u along the tube. */
export const RIB_SPACING = 8;

/** How far past the player entities stay alive before being recycled. */
export const DESPAWN_BEHIND = 12;

// ---------------------------------------------------------------------------
// Movement feel
// ---------------------------------------------------------------------------

/** Angular input ramps. Momentum carries; nothing snaps. */
export const ANGULAR_ACCEL_TIME = 0.09;
export const ANGULAR_DECEL_TIME = 0.13;

/** Camera sits behind the Keyshard and rolls opposite the turn. */
export const CAMERA_TRAIL = 2.2;
export const CAMERA_ROLL_MAX_DEG = 12;

/** Keyshard leans into turns up to this angle. */
export const LEAN_MAX_DEG = 28;

/** Overclock adds this to the FOV for its duration. */
export const OVERCLOCK_FOV_BONUS = 8;

/** Grazing within this distance without contact pays out. */
export const GRAZE_DISTANCE = 0.35;
export const GRAZE_CYCLES = 15;

// ---------------------------------------------------------------------------
// Trace — the fail state
// ---------------------------------------------------------------------------

export const TRACE_MAX = 100;
/** Passive decay per second, once the player has been clean for DECAY_DELAY. */
export const TRACE_DECAY_PER_SEC = 1.5;
export const TRACE_DECAY_DELAY = 2.0;
export const TRACE_MINOR = 10;
export const TRACE_MAJOR = 22;
export const TRACE_HONEYPOT = 25;
export const TRACE_NULLVOID = 40;
export const TRACE_BEACON_PER_SEC = 4;
export const TRACE_SCRUB = -18;
export const TRACE_LAYER_CLEAR = -25;

/** The ladder. Each rung is a piece of information, not a mood. */
export const TRACE_SCANLINES = 40;
export const TRACE_WALL_WRITES = 70;
export const TRACE_SONAR = 90;

/** Telemetry beacon sight radius, in world units. */
export const BEACON_SIGHT = 9;

// ---------------------------------------------------------------------------
// Cycles — the boost economy
// ---------------------------------------------------------------------------

export const CYCLES_MAX = 100;
export const OVERCLOCK_COST = 35;
export const OVERCLOCK_DURATION = 1.2;
export const OVERCLOCK_SPEED_MULT = 1.6;
export const OVERCLOCK_SCORE_MULT = 2;
export const CYCLES_MOTE = 12;
export const CYCLES_PERFECT_CHUNK = 25;

// ---------------------------------------------------------------------------
// Score & combo
// ---------------------------------------------------------------------------

export const COMBO_START = 1;
export const COMBO_STEP = 0.25;
export const COMBO_MAX = 8;
/** Speed bonus is measured against the layer-1 base speed. */
export const SPEED_BONUS_BASE = 22;

// ---------------------------------------------------------------------------
// Rate limiter / null void / socket payloads
// ---------------------------------------------------------------------------

export const RATELIMIT_DURATION = 1.2;
export const RATELIMIT_SPEED_MULT = 0.5;
export const NULLVOID_TUMBLE = 1.0;
export const SOCKET_PAD_DURATION = 1.5;
export const SOCKET_PAD_MULT = 1.25;
export const ROOT_TOKEN_SKIP = 0.15;

/** Hitstop and the red push that sells a hit. */
export const HITSTOP = 0.12;
export const HIT_FLASH = 0.2;

/** Major hazards announce themselves this far ahead, in seconds. */
export const WARN_LEAD = 0.8;

// ---------------------------------------------------------------------------
// Layers
// ---------------------------------------------------------------------------

const SPEED_BASE = 22.0;
const SPEED_RATE = 1.1;
const OMEGA_BASE = 220;
const OMEGA_RATE = 1.08;
const RADIAL_BASE = 0.18;
const RADIAL_RATE = 0.97;
const BPM_BASE = 100;

/** Layer lengths ramp 60s → 90s. */
const DURATIONS = [60, 63, 66, 70, 73, 76, 80, 83, 86, 90];

const PALETTES: Array<{
  name: string;
  subtitle: string;
  bg: string;
  rail: string;
  accent: string;
  introduces: string;
}> = [
  {
    name: "EDGE",
    subtitle: "public net, recon",
    bg: "#0A1A24",
    rail: "#22D3EE",
    accent: "#7DD3FC",
    introduces: "Movement, packets, tripwires, debris",
  },
  {
    name: "DMZ",
    subtitle: "perimeter",
    bg: "#1A1206",
    rail: "#F59E0B",
    accent: "#FCD34D",
    introduces: "Firewall rings, zero-days, Overclock",
  },
  {
    name: "AUTH",
    subtitle: "credential layer",
    bg: "#140A22",
    rail: "#A855F7",
    accent: "#E9D5FF",
    introduces: "IDS sweeps, root tokens, scrubs",
  },
  {
    name: "USERLAND",
    subtitle: "application",
    bg: "#06180F",
    rail: "#34D399",
    accent: "#A7F3D0",
    introduces: "Honeypots, open sockets",
  },
  {
    name: "VAULT",
    subtitle: "data store",
    bg: "#041C1C",
    rail: "#2DD4BF",
    accent: "#99F6E4",
    introduces: "Hash walls, rate limiters, forged certs",
  },
  {
    name: "RING 0",
    subtitle: "kernel",
    bg: "#1C0508",
    rail: "#FB7185",
    accent: "#FFFFFF",
    introduces: "ICE lances, null voids",
  },
  {
    name: "CRYPT",
    subtitle: "key material",
    bg: "#1A1405",
    rail: "#EAB308",
    accent: "#FDE68A",
    introduces: "Race conditions, dense collect phrasing",
  },
  {
    name: "CONSENSUS",
    subtitle: "distributed ledger",
    bg: "#0D1117",
    rail: "#94A3B8",
    accent: "#E2E8F0",
    introduces: "Logic bombs, garbage collector",
  },
  {
    name: "SENTINEL",
    subtitle: "adaptive defense",
    bg: "#1A0620",
    rail: "#F0ABFC",
    accent: "#FFFFFF",
    introduces: "The Sentinel. Lower hazard count, higher pressure.",
  },
  {
    name: "ROOT ZERO",
    subtitle: "",
    bg: "#000000",
    rail: "#FFFFFF",
    accent: "#FFFFFF",
    introduces: "Everything. A recital, not a new mechanic.",
  },
];

function round(value: number, places: number): number {
  const f = 10 ** places;
  return Math.round(value * f) / f;
}

export const LEVELS: LevelConfig[] = PALETTES.map((palette, i) => {
  const n = i + 1;
  const t = i / (PALETTES.length - 1);
  return {
    n,
    name: palette.name,
    subtitle: palette.subtitle,
    speed: round(SPEED_BASE * SPEED_RATE ** i, 2),
    omega: round(OMEGA_BASE * OMEGA_RATE ** i, 1),
    radial: round(RADIAL_BASE * RADIAL_RATE ** i, 4),
    horizon: round(3.2 + (2.4 - 3.2) * t, 3),
    duration: DURATIONS[i],
    fov: round(72 + (96 - 72) * t, 2),
    bpm: round(BPM_BASE * SPEED_RATE ** i, 1),
    bg: palette.bg,
    rail: palette.rail,
    accent: palette.accent,
    introduces: palette.introduces,
    cycleRails: n === 10,
  };
});

/** Root Zero cycles through every previous layer's rail hue every 4 seconds. */
export const RAIL_CYCLE_PERIOD = 4;
export const RAIL_CYCLE_HUES = LEVELS.slice(0, 9).map((l) => l.rail);

/** Rails carry a ±20° hue spread around the layer accent. */
export const RAIL_HUE_SPREAD = 20;

/** Assist mode caps the per-layer speed step and halves Trace gain. */
export const ASSIST_SPEED_RATE = 1.05;
export const ASSIST_TRACE_MULT = 0.5;

/** Layer transition length. No menu, no button press. */
export const TRANSITION_TIME = 2.5;

/** Layer restart must be instant — the tube just re-seeds. */
export const RESTART_TIME = 0.4;

/** Copy voice: terse, system-log register, no exclamation points. */
export const COPY = {
  start: "COMPILE COMPLETE — INJECT",
  traced: "SUBJECT IDENTIFIED — SESSION TERMINATED",
  root: "ROOT ZERO. WE WERE NEVER HERE.",
  retry: "RECOMPILE",
  compileStamp: "COMPILED BY MIFTACH · 𐤇𐤕𐤐𐤌 · THE ONE WHO UNLOCKS",
  signoff: "MIFTACH OUT. THE CHANNEL IS SEALED BEHIND YOU.",
} as const;

export function layerClearLine(level: number): string {
  const n = String(level).padStart(2, "0");
  return `LAYER ${n} CLEARED · TRACE ${TRACE_LAYER_CLEAR} · +10% CLOCK`;
}

/** Speed for a layer, honouring assist mode's flatter curve. */
export function levelSpeed(n: number, assist: boolean): number {
  const rate = assist ? ASSIST_SPEED_RATE : SPEED_RATE;
  return SPEED_BASE * rate ** (n - 1);
}

/** Angle in radians for a slot index. Slot 0 sits at the top of the tube. */
export function slotAngle(slot: number): number {
  return ((slot % SLOT_COUNT) + SLOT_COUNT) % SLOT_COUNT * SLOT_RAD;
}

/** Shortest signed angular difference between two angles, wrapped to ±π. */
export function angularDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function bandRadius(band: Band): number {
  return BAND_RADIUS[band];
}
