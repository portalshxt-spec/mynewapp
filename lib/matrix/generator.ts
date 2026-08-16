/**
 * MIFTACH'S MATRIX — layer generation.
 *
 * Hand-authored chunks, shuffled per run by a seeded PRNG against a difficulty
 * budget. Deliberately not fully procedural: procedural obstacle courses feel
 * like noise, and rhythm is the whole point.
 *
 * The budget fills linearly from 60% to 100% across a layer's duration. The
 * generator never repeats a chunk within 3 draws, and forces a breath chunk
 * after any two chunks costing 30+. That breath rule is what keeps a layer
 * feeling like music instead of an assault.
 */

import rawChunks from "./chunks.json";
import { CATALOG, FIREWALL_SPIN } from "./catalog";
import { SLOT_COUNT, SLOT_DEG, slotAngle } from "./config";
import type { Rng } from "./rng";
import type { Band, BandTarget, Chunk, ChunkEntity, Entity, EntityKind } from "./types";

const CHUNKS = rawChunks as Chunk[];

/**
 * Chunks are authored in world units at layer-1 speed. Scaling every offset by
 * `speed / 22` keeps a pattern's *duration* constant across all ten layers, so
 * an authored 8–16 second phrase still reads as an 8–16 second phrase at Root
 * Zero. Without this the same chunk would blow past in 2.4x less time.
 */
export const CHUNK_REFERENCE_SPEED = 22;

/** Spacing between the packets a `trailTo` run expands into. */
const TRAIL_STEP = 14;

/** Clear run-up before the first chunk so nothing is on top of the player. */
export const LEAD_IN = 70;

/** A breath chunk costs no more than this and carries collectibles only. */
export const BREATH_MAX_COST = 10;

/**
 * Chunks must spend at least this fraction of the current ceiling to be drawn.
 * Breath chunks are exempt — they are the deliberate release.
 */
export const BUDGET_FLOOR = 0.62;

/** Per-layer cost ceiling at 100% budget. */
export function layerMaxCost(level: number): number {
  return 30 + 5 * (level - 1);
}

/** The ceiling at normalised layer progress t ∈ [0,1]. */
export function budgetCeiling(level: number, t: number): number {
  return layerMaxCost(level) * (0.6 + 0.4 * Math.min(1, Math.max(0, t)));
}

export function isBreath(chunk: Chunk): boolean {
  return chunk.cost <= BREATH_MAX_COST && chunk.tags.includes("breath");
}

function eligible(chunk: Chunk, level: number): boolean {
  if (chunk.minLevel > level) return false;
  if (chunk.maxLevel != null && chunk.maxLevel < level) return false;
  return true;
}

/** Circular mean of a slot list, so [14,15,0,1] centres on 15.5 and not 7.5. */
function slotCentre(slots: number[]): number {
  const base = slots[0];
  let sum = 0;
  for (const s of slots) {
    let d = (s - base) % SLOT_COUNT;
    if (d > SLOT_COUNT / 2) d -= SLOT_COUNT;
    if (d < -SLOT_COUNT / 2) d += SLOT_COUNT;
    sum += d;
  }
  return base + sum / slots.length;
}

let nextEntityId = 1;

function makeEntity(
  kind: EntityKind,
  z: number,
  slot: number,
  overrides: Partial<Entity> = {},
): Entity {
  const catalogDef = CATALOG[kind];
  return {
    id: nextEntityId++,
    kind,
    def: catalogDef,
    z,
    slot,
    theta: slotAngle(slot),
    arcDeg: catalogDef.arcDeg,
    band: catalogDef.band,
    depth: catalogDef.depth,
    spent: false,
    age: 0,
    warned: false,
    ...overrides,
  };
}

/**
 * Expand one authored entity into live entities. A `trailTo` packet expands
 * into a run of packets walking the short way round to the target slot — the
 * bread crumbs that draw the line through a chunk.
 */
function expand(source: ChunkEntity, originZ: number, scale: number, rng: Rng): Entity[] {
  const kind = source.t;
  const catalogDef = CATALOG[kind];
  const z = originZ + source.z * scale;
  const band: BandTarget = source.band ?? catalogDef.band;

  if (source.trailTo != null && source.slot != null) {
    // Walk the short way round from slot to trailTo.
    const from = source.slot;
    let delta = (source.trailTo - from) % SLOT_COUNT;
    if (delta > SLOT_COUNT / 2) delta -= SLOT_COUNT;
    if (delta < -SLOT_COUNT / 2) delta += SLOT_COUNT;
    const steps = Math.abs(delta);
    const dir = Math.sign(delta) || 1;
    const out: Entity[] = [];
    for (let i = 0; i <= steps; i++) {
      out.push(
        makeEntity(kind, z + i * TRAIL_STEP * scale, from + dir * i, {
          band,
          trailTo: source.trailTo,
        }),
      );
    }
    return out;
  }

  if (source.slots && source.slots.length) {
    return [
      makeEntity(kind, z, slotCentre(source.slots), {
        band,
        arcDeg: source.slots.length * SLOT_DEG,
      }),
    ];
  }

  const overrides: Partial<Entity> = { band };

  switch (kind) {
    case "firewall": {
      overrides.openSlots = source.open ?? [0, 1];
      // Rotation direction flips per instance.
      overrides.spin = source.spin ?? FIREWALL_SPIN * rng.sign();
      overrides.band = "ALL";
      break;
    }
    case "ids": {
      overrides.spin = source.spin ?? 90 * rng.sign();
      overrides.band = "ALL";
      break;
    }
    case "hashwall": {
      overrides.openBand = (source.openBand ?? "MID") as Band;
      overrides.band = "ALL";
      break;
    }
    case "debris": {
      overrides.drift = source.drift ?? rng.range(-12, 12);
      break;
    }
    case "race": {
      overrides.phase = source.phase ?? 0;
      overrides.band = "ALL";
      break;
    }
    case "ratelimit":
    case "gc":
    case "sentinel": {
      overrides.band = kind === "ratelimit" ? "MID" : "ALL";
      break;
    }
    default:
      break;
  }

  return [makeEntity(kind, z, source.slot ?? 0, overrides)];
}

export interface LayerPlan {
  entities: Entity[];
  /** Total distance the layer covers, in world units. */
  length: number;
  /** Chunk ids in draw order — useful for tuning and the debug overlay. */
  order: string[];
  /** Boundaries (z) of every chunk, for perfect-chunk-clear scoring. */
  bounds: Array<{ id: string; start: number; end: number; hazards: number }>;
}

/**
 * Build a full layer.
 *
 * @param level  1-based layer number
 * @param speed  forward speed for this layer, in m/s
 * @param duration  layer length in seconds
 * @param rng  seeded PRNG — same seed, same layer
 */
export function generateLayer(
  level: number,
  speed: number,
  duration: number,
  rng: Rng,
): LayerPlan {
  const scale = speed / CHUNK_REFERENCE_SPEED;
  const target = speed * duration;

  const pool = CHUNKS.filter((c) => eligible(c, level));
  const breathPool = pool.filter(isBreath);
  const bodyPool = pool.filter((c) => !isBreath(c));
  // Chunks that exist to teach this layer's new mechanic.
  const teachPool = bodyPool.filter((c) => c.minLevel === level);

  const entities: Entity[] = [];
  const order: string[] = [];
  const bounds: LayerPlan["bounds"] = [];

  let cursor = LEAD_IN * scale;
  const recent: string[] = [];
  let heavyStreak = 0;
  let taughtNew = teachPool.length === 0;

  const remember = (id: string) => {
    recent.push(id);
    if (recent.length > 3) recent.shift();
  };

  let guard = 0;
  while (cursor < target && guard++ < 400) {
    const t = cursor / target;
    const ceiling = budgetCeiling(level, t);

    let chunk: Chunk | undefined;

    if (heavyStreak >= 2 && breathPool.length) {
      // Forced breath. This rule is what makes a layer feel like music.
      const options = breathPool.filter((c) => !recent.includes(c.id));
      chunk = rng.pick(options.length ? options : breathPool);
      heavyStreak = 0;
    } else {
      // Each layer teaches exactly one new thing — make sure it actually shows
      // up, and early, rather than leaving it to the shuffle.
      const source = !taughtNew && teachPool.length ? teachPool : bodyPool;
      // "Draws chunks whose cost fits the remaining window" means chunks that
      // *use* the window. Without a floor the pool is dominated by the cheap
      // early-layer chunks — which vastly outnumber the late ones — and a
      // layer's difficulty regresses toward EDGE no matter what its budget
      // says. Root Zero in particular must be a recital, not a random walk.
      const floor = ceiling * BUDGET_FLOOR;
      let options = source.filter(
        (c) => c.cost <= ceiling && c.cost >= floor && !recent.includes(c.id),
      );
      if (!options.length) {
        options = source.filter((c) => c.cost <= ceiling && c.cost >= floor);
      }
      if (!options.length) {
        options = source.filter((c) => c.cost <= ceiling && !recent.includes(c.id));
      }
      if (!options.length) {
        options = source.filter((c) => c.cost <= ceiling);
      }
      if (!options.length && !taughtNew && teachPool.length) {
        // The teaching chunk is over the early ceiling — take the cheapest one
        // anyway so the layer still introduces its mechanic.
        options = [teachPool.reduce((a, b) => (a.cost <= b.cost ? a : b))];
      }
      if (!options.length) {
        options = breathPool.length ? breathPool : pool;
      }
      chunk = rng.pick(options);
      if (chunk.minLevel === level) taughtNew = true;
      heavyStreak = chunk.cost >= 30 ? heavyStreak + 1 : 0;
    }

    if (!chunk) break;

    const start = cursor;
    let hazards = 0;
    for (const source of chunk.entities) {
      const built = expand(source, cursor, scale, rng);
      for (const e of built) {
        if (e.def.role === "avoid") hazards++;
        entities.push(e);
      }
    }
    const length = chunk.length * scale;
    bounds.push({ id: chunk.id, start, end: start + length, hazards });
    order.push(chunk.id);
    remember(chunk.id);
    cursor += length;
  }

  // The backdoor sits at the end of the layer. Sort by z so the collision
  // window can walk the array with a single moving index pointer.
  entities.sort((a, b) => a.z - b.z);

  // The layer ends at its nominal duration from the GDD table, not wherever
  // the last chunk happened to finish. Content is generated past the boundary
  // so the tube is still full when the backdoor opens.
  return { entities, length: target, order, bounds };
}

/** Exposed for the tuning overlay and tests. */
export function allChunks(): Chunk[] {
  return CHUNKS;
}
