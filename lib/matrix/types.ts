/**
 * MIFTACH'S MATRIX — shared types.
 *
 * The whole game speaks cylindrical coordinates: an angle around the tube, a
 * radial band, and a depth along -Z. Nothing in here knows about Three.js.
 */

export type Band = "WALL" | "MID" | "CORE";
export type BandTarget = Band | "ALL";

export type CollectKind =
  | "packet"
  | "mote"
  | "zeroday"
  | "roottoken"
  | "scrub"
  | "cert"
  | "socket";

export type AvoidKind =
  | "tripwire"
  | "debris"
  | "firewall"
  | "ids"
  | "honeypot"
  | "hashwall"
  | "ratelimit"
  | "ice"
  | "nullvoid"
  | "race"
  | "logicbomb"
  | "gc"
  | "sentinel"
  | "beacon";

export type EntityKind = CollectKind | AvoidKind;

export type EntityRole = "collect" | "avoid";

/** Static description of an entity type — the catalog row. */
export interface EntityDef {
  kind: EntityKind;
  role: EntityRole;
  /** Display name, used by the codex and the accessibility readout. */
  label: string;
  /** The real concept it stands for. Everything on screen is code. */
  concept: string;
  /** Angular width in degrees. 360 means it spans the whole ring. */
  arcDeg: number;
  /** Extent along Z in world units. */
  depth: number;
  /** Default band when a chunk does not name one. */
  band: BandTarget;
  /** Trace delta applied on contact. Negative values reduce Trace. */
  trace: number;
  /** Major hazards are not phased through by Overclock and get a warning cue. */
  major: boolean;
  /** First layer this entity may appear in. */
  minLevel: number;
  score: number;
  combo: number;
  cycles: number;
}

/** A live entity in the current layer's z-sorted array. */
export interface Entity {
  id: number;
  kind: EntityKind;
  def: EntityDef;
  /** Depth along the tube. The player travels toward -Z, so z decreases. */
  z: number;
  /** Authored slot index 0..15 (base angle before any animation). */
  slot: number;
  /** Current centre angle in radians. Animated types rewrite this each frame. */
  theta: number;
  arcDeg: number;
  band: BandTarget;
  depth: number;
  /** Set once the entity has been consumed or has hit the player. */
  spent: boolean;
  /** Local age in seconds, started when the entity enters the active window. */
  age: number;
  /** True once the pre-warning audio cue has fired. */
  warned: boolean;

  // ---- per-kind state -------------------------------------------------
  /** firewall: open slot indices; hashwall: the single open band. */
  openSlots?: number[];
  openBand?: Band;
  /** firewall / ids: rotation in degrees per second (sign = direction). */
  spin?: number;
  /** packet: draw a collect trail toward this slot. */
  trailTo?: number;
  /** debris: angular drift in degrees per second. */
  drift?: number;
  /** race: 6Hz phase offset, so paired groups alternate. */
  phase?: number;
  /** ice: locked angle once it commits; logicbomb: detonation state. */
  lockedTheta?: number;
  committed?: boolean;
  detonated?: boolean;
  /** sentinel: whether it currently has lock on the player. */
  locked?: boolean;
  /** socket / scrub: whether the player passed cleanly through the ring. */
  threaded?: boolean;
}

/** One authored pattern, 8–16 seconds of tube. */
export interface Chunk {
  id: string;
  cost: number;
  /** Length along Z in world units. */
  length: number;
  minLevel: number;
  maxLevel?: number;
  tags: string[];
  entities: ChunkEntity[];
}

export interface ChunkEntity {
  t: EntityKind;
  /** Offset from the chunk origin along Z. */
  z: number;
  slot?: number;
  slots?: number[];
  band?: BandTarget;
  open?: number[];
  openBand?: Band;
  spin?: number;
  trailTo?: number;
  drift?: number;
  phase?: number;
}

export interface LevelConfig {
  n: number;
  name: string;
  subtitle: string;
  /** Forward speed in m/s. */
  speed: number;
  /** Angular speed in degrees per second. */
  omega: number;
  /** Radial band transition time in seconds. */
  radial: number;
  /** Lookahead in seconds — how far the horizon sits. */
  horizon: number;
  /** Layer length in seconds. */
  duration: number;
  fov: number;
  bpm: number;
  bg: string;
  rail: string;
  accent: string;
  introduces: string;
  /** Level 10 cycles every previous rail hue instead of using one. */
  cycleRails: boolean;
}

export type RunPhase =
  | "title"
  | "layer-intro"
  | "playing"
  | "transition"
  | "traced"
  | "root";

export interface HudSnapshot {
  phase: RunPhase;
  level: number;
  levelName: string;
  accent: string;
  trace: number;
  cycles: number;
  score: number;
  combo: number;
  speed: number;
  layerProgress: number;
  overclock: boolean;
  certCharges: number;
  message: string;
  /** Set while a layer-clear line is on screen. */
  banner: string;
}
