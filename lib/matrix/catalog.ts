/**
 * MIFTACH'S MATRIX — the entity catalog.
 *
 * Every entity is a real concept from the work Miftach is doing. The shape
 * rule is the whole readability system, and it is what makes the game
 * colorblind-safe at 51.9 m/s:
 *
 *   if a working operator would want it   → it glows and it's round
 *   if a working operator would run from it → it's angular and it's red-shifted
 *
 * Colour is redundant information here, never primary.
 */

import {
  TRACE_HONEYPOT,
  TRACE_MAJOR,
  TRACE_MINOR,
  TRACE_NULLVOID,
  TRACE_SCRUB,
  CYCLES_MOTE,
  SLOT_DEG,
} from "./config";
import type { EntityDef, EntityKind } from "./types";

function def(d: Partial<EntityDef> & Pick<EntityDef, "kind" | "role" | "label" | "concept">): EntityDef {
  return {
    arcDeg: 14,
    depth: 1.6,
    band: "MID",
    trace: 0,
    major: false,
    minLevel: 1,
    score: 0,
    combo: 0,
    cycles: 0,
    ...d,
  };
}

export const CATALOG: Record<EntityKind, EntityDef> = {
  // -- 10.1 Collect ---------------------------------------------------------
  packet: def({
    kind: "packet",
    role: "collect",
    label: "Packet fragment",
    concept: "Data in transit",
    arcDeg: 12,
    depth: 1.4,
    score: 100,
    combo: 0.25,
    minLevel: 1,
  }),
  mote: def({
    kind: "mote",
    role: "collect",
    label: "Entropy mote",
    concept: "Randomness pool",
    arcDeg: 12,
    depth: 1.4,
    cycles: CYCLES_MOTE,
    minLevel: 1,
  }),
  zeroday: def({
    kind: "zeroday",
    role: "collect",
    label: "Zero-day capsule",
    concept: "Undisclosed exploit",
    arcDeg: 16,
    depth: 2.0,
    score: 1000,
    combo: 1.0,
    minLevel: 2,
  }),
  roottoken: def({
    kind: "roottoken",
    role: "collect",
    label: "Root token",
    concept: "Privilege escalation",
    arcDeg: 16,
    depth: 2.0,
    minLevel: 3,
  }),
  scrub: def({
    kind: "scrub",
    role: "collect",
    label: "Scrub token",
    concept: "Log wiping",
    // A hollow ring you fly through, so it is wider than a solid pickup.
    arcDeg: 26,
    depth: 1.6,
    trace: TRACE_SCRUB,
    minLevel: 3,
  }),
  cert: def({
    kind: "cert",
    role: "collect",
    label: "Forged cert",
    concept: "Signed but false credential",
    arcDeg: 16,
    depth: 2.0,
    minLevel: 5,
  }),
  socket: def({
    kind: "socket",
    role: "collect",
    label: "Open socket",
    concept: "Listening port",
    // A ring gate spanning 3 slots — fly through the ring.
    arcDeg: SLOT_DEG * 3,
    depth: 2.4,
    score: 500,
    minLevel: 4,
  }),

  // -- 10.2 Avoid -----------------------------------------------------------
  tripwire: def({
    kind: "tripwire",
    role: "avoid",
    label: "Tripwire",
    concept: "Canary token / alert trigger",
    // A single thin line across 4 slots, one band only.
    arcDeg: SLOT_DEG * 4,
    depth: 0.8,
    trace: TRACE_MINOR,
    minLevel: 1,
  }),
  debris: def({
    kind: "debris",
    role: "avoid",
    label: "Deprecated debris",
    concept: "Dead code, unpatched junk",
    arcDeg: 14,
    depth: 1.6,
    trace: TRACE_MINOR,
    minLevel: 1,
  }),
  firewall: def({
    kind: "firewall",
    role: "avoid",
    label: "Firewall ring",
    concept: "Packet filter / iptables",
    // Full ring, closed except its open slots. Threading is the whole point.
    arcDeg: 360,
    depth: 1.8,
    band: "ALL",
    trace: TRACE_MAJOR,
    major: true,
    minLevel: 2,
  }),
  ids: def({
    kind: "ids",
    role: "avoid",
    label: "IDS sweep",
    concept: "Intrusion detection scan",
    // A wide beam rotating around the axis: a timing gate, not a position gate.
    arcDeg: 45,
    depth: 2.4,
    band: "ALL",
    trace: TRACE_MAJOR,
    major: true,
    minLevel: 3,
  }),
  honeypot: def({
    kind: "honeypot",
    role: "avoid",
    label: "Honeypot",
    concept: "Decoy target",
    arcDeg: 16,
    depth: 2.0,
    trace: TRACE_HONEYPOT,
    // Major so Overclock cannot phase through the lesson.
    major: true,
    minLevel: 4,
  }),
  hashwall: def({
    kind: "hashwall",
    role: "avoid",
    label: "Hash wall",
    concept: "Checksum barrier",
    // Full-band wall, one band open. Forces a radial move, not an angular one.
    arcDeg: 360,
    depth: 1.8,
    band: "ALL",
    trace: TRACE_MAJOR,
    major: true,
    minLevel: 5,
  }),
  ratelimit: def({
    kind: "ratelimit",
    role: "avoid",
    label: "Rate limiter",
    concept: "Throttle",
    // Does not damage. Halves speed and kills combo gain — worse than damage
    // when the combo is high.
    arcDeg: 360,
    depth: 6.0,
    band: "MID",
    trace: 0,
    minLevel: 5,
  }),
  ice: def({
    kind: "ice",
    role: "avoid",
    label: "ICE lance",
    concept: "Intrusion countermeasures",
    // The only entity that reads you. Bait it, then move.
    arcDeg: 14,
    depth: 2.0,
    band: "ALL",
    trace: TRACE_MAJOR,
    major: true,
    minLevel: 6,
  }),
  nullvoid: def({
    kind: "nullvoid",
    role: "avoid",
    label: "Null void",
    concept: "Segfault / unmapped memory",
    // A hole in the tube skin. Only the WALL band can fall out of it.
    arcDeg: SLOT_DEG * 2,
    depth: 8,
    band: "WALL",
    trace: TRACE_NULLVOID,
    major: true,
    minLevel: 6,
  }),
  race: def({
    kind: "race",
    role: "avoid",
    label: "Race condition",
    concept: "Concurrency fault",
    // Two adjacent slot groups flickering at 6Hz — read the phase, then commit.
    arcDeg: SLOT_DEG * 2,
    depth: 1.8,
    band: "ALL",
    trace: TRACE_MAJOR,
    major: true,
    minLevel: 7,
  }),
  logicbomb: def({
    kind: "logicbomb",
    role: "avoid",
    label: "Logic bomb",
    concept: "Timed payload",
    arcDeg: 16,
    depth: 2.0,
    band: "ALL",
    trace: TRACE_MAJOR,
    major: true,
    minLevel: 8,
  }),
  gc: def({
    kind: "gc",
    role: "avoid",
    label: "Garbage collector",
    concept: "Memory reclamation",
    // Chase pressure from behind. Contact ends the run — no Trace math.
    arcDeg: 360,
    depth: 4,
    band: "ALL",
    trace: 0,
    major: true,
    minLevel: 8,
  }),
  sentinel: def({
    kind: "sentinel",
    role: "avoid",
    label: "Sentinel",
    concept: "Adaptive AI defense",
    // Does not damage on contact — it doubles Trace gain while locked on.
    arcDeg: 30,
    depth: 1.4,
    band: "ALL",
    trace: 0,
    minLevel: 9,
  }),
  beacon: def({
    kind: "beacon",
    role: "avoid",
    label: "Telemetry beacon",
    concept: "Passive reporting endpoint",
    // Raises Trace continuously while the player is inside its sight radius.
    arcDeg: 12,
    depth: 1.4,
    band: "ALL",
    trace: 0,
    minLevel: 7,
  }),
};

/** Detonation arc of a logic bomb: a 5-slot burst. */
export const LOGICBOMB_BURST_ARC = SLOT_DEG * 5;
export const LOGICBOMB_FUSE = 2.0;

/** ICE tracks the player's angle for this long, then commits and fires. */
export const ICE_TRACK_TIME = 1.2;

/** The Sentinel mirrors the player's angle on this delay. */
export const SENTINEL_DELAY = 0.5;
/** Breaking lock takes a full 180° arc away from the Sentinel. */
export const SENTINEL_BREAK_DEG = 180;
export const SENTINEL_TRACE_MULT = 2;

/** Race condition groups flicker at 6Hz. */
export const RACE_HZ = 6;

/** Firewall ring default rotation. Direction flips per instance. */
export const FIREWALL_SPIN = 40;

export function isCollect(kind: EntityKind): boolean {
  return CATALOG[kind].role === "collect";
}

export function isAvoid(kind: EntityKind): boolean {
  return CATALOG[kind].role === "avoid";
}

/** Ordered for the in-game codex / accessibility readout. */
export const CODEX_ORDER: EntityKind[] = [
  "packet",
  "mote",
  "zeroday",
  "roottoken",
  "scrub",
  "cert",
  "socket",
  "tripwire",
  "debris",
  "firewall",
  "ids",
  "honeypot",
  "hashwall",
  "ratelimit",
  "ice",
  "nullvoid",
  "race",
  "logicbomb",
  "gc",
  "sentinel",
  "beacon",
];
