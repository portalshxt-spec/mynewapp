/**
 * MIFTACH'S MATRIX — the simulation.
 *
 * Pure logic: movement, entity behaviour, analytic collision in cylindrical
 * coordinates, Trace / Cycles / combo. No Three.js, no DOM. The renderer reads
 * this; it never writes to it.
 */

import {
  ANGULAR_ACCEL_TIME,
  ANGULAR_DECEL_TIME,
  ASSIST_TRACE_MULT,
  BAND_RADIUS,
  BEACON_SIGHT,
  COMBO_MAX,
  COMBO_START,
  CYCLES_MAX,
  CYCLES_PERFECT_CHUNK,
  DESPAWN_BEHIND,
  GRAZE_CYCLES,
  GRAZE_DISTANCE,
  HITSTOP,
  LEAN_MAX_DEG,
  NULLVOID_TUMBLE,
  OVERCLOCK_COST,
  OVERCLOCK_DURATION,
  OVERCLOCK_SCORE_MULT,
  OVERCLOCK_SPEED_MULT,
  RATELIMIT_DURATION,
  RATELIMIT_SPEED_MULT,
  ROOT_TOKEN_SKIP,
  SLOT_RAD,
  SOCKET_PAD_DURATION,
  SOCKET_PAD_MULT,
  SPEED_BONUS_BASE,
  TRACE_BEACON_PER_SEC,
  TRACE_DECAY_DELAY,
  TRACE_DECAY_PER_SEC,
  TRACE_LAYER_CLEAR,
  TRACE_MAX,
  WARN_LEAD,
  angularDelta,
  slotAngle,
} from "./config";
import {
  ICE_TRACK_TIME,
  LOGICBOMB_BURST_ARC,
  LOGICBOMB_FUSE,
  RACE_HZ,
  SENTINEL_DELAY,
  SENTINEL_TRACE_MULT,
} from "./catalog";
import type { Band, Entity, EntityKind, LevelConfig } from "./types";
import type { LayerPlan } from "./generator";

const DEG = Math.PI / 180;

/** Band ownership zones, taken at the midpoints between band radii. */
const WALL_MID = (BAND_RADIUS.WALL + BAND_RADIUS.MID) / 2;
const MID_CORE = (BAND_RADIUS.MID + BAND_RADIUS.CORE) / 2;

/** The Keyshard's own footprint, used for contact and graze tests. */
const PLAYER_ARC_DEG = 6;
const PLAYER_RADIAL_HALF = 0.18;

/** Trail: 24 samples fading over 0.8s. */
const TRAIL_SAMPLES = 24;
const TRAIL_FADE = 0.8;
const TRAIL_INTERVAL = TRAIL_FADE / TRAIL_SAMPLES;

/** How far behind the player the garbage collector spawns, and how fast it gains. */
const GC_GAP = 50;
const GC_CLOSE_RATE = 1.03;
const GC_LIFETIME = 15;

export type SimEvent =
  | { type: "collect"; kind: EntityKind; points: number }
  | { type: "hit"; kind: EntityKind; major: boolean; trace: number }
  | { type: "absorb"; kind: EntityKind }
  | { type: "graze" }
  | { type: "overclock" }
  | { type: "warn"; kind: EntityKind }
  | { type: "combo-break" }
  | { type: "perfect-chunk" }
  | { type: "backdoor" }
  | { type: "layer-clear"; level: number }
  | { type: "traced" }
  | { type: "root" };

export interface InputState {
  /** -1 .. 1 around the tube. */
  turn: number;
  /** Hold to dive to CORE. */
  dive: boolean;
  /** Hold to hug WALL. */
  hug: boolean;
  /** Edge-triggered Overclock. */
  boost: boolean;
}

export interface TrailSample {
  theta: number;
  radius: number;
  z: number;
}

export interface SimOptions {
  assist: boolean;
}

export class Simulation {
  readonly level: LevelConfig;
  readonly plan: LayerPlan;
  private readonly assist: boolean;

  // ---- player ----
  z = 0;
  prevZ = 0;
  theta = 0;
  omega = 0;
  radius = BAND_RADIUS.MID;
  band: Band = "MID";
  lean = 0;

  // ---- systems ----
  trace = 0;
  cycles = 0;
  score = 0;
  combo = COMBO_START;
  certCharges = 0;

  overclockTimer = 0;
  overclockReady = true;
  private rateLimitTimer = 0;
  private socketPadTimer = 0;
  private hitstopTimer = 0;
  private tumbleTimer = 0;
  private sinceHit = TRACE_DECAY_DELAY;
  private time = 0;
  /** Current frame's delta, so per-second effects don't assume 60fps. */
  private dt = 1 / 60;

  /** Set when the layer is over. */
  finished = false;
  traced = false;
  /** Distance at which the backdoor opens. Root tokens pull this in. */
  endAt: number;

  /** 24-sample ribbon of past positions — this is what sells the speed. */
  readonly trail: TrailSample[] = [];
  /**
   * The ribbon fades over 0.8s, so 24 samples means one every 1/30s. Sampling
   * every substep instead would compress the whole tail into 0.2s of history
   * and bury it inside the Keyshard.
   */
  private trailTimer = 0;
  /** Rolling theta history so the Sentinel can mirror on a delay. */
  private thetaHistory: Array<{ t: number; theta: number }> = [];

  private head = 0;
  private events: SimEvent[] = [];

  /** Garbage collector chase state. */
  gcActive = false;
  gcZ = 0;
  private gcTimer = 0;

  /** Sentinel lock, exposed so the HUD and audio can react. */
  sentinelLocked = false;

  /** Chunk-clear bookkeeping for the perfect-clear bonus. */
  private chunkIndex = 0;
  private chunkClean = true;

  constructor(level: LevelConfig, plan: LayerPlan, options: SimOptions) {
    this.level = level;
    this.plan = plan;
    this.assist = options.assist;
    this.endAt = plan.length;
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  /** Current forward speed, after every multiplier. */
  get speed(): number {
    let v = this.level.speed;
    if (this.overclockTimer > 0) v *= OVERCLOCK_SPEED_MULT;
    if (this.rateLimitTimer > 0) v *= RATELIMIT_SPEED_MULT;
    if (this.socketPadTimer > 0) v *= SOCKET_PAD_MULT;
    return v;
  }

  get overclocking(): boolean {
    return this.overclockTimer > 0;
  }

  get rateLimited(): boolean {
    return this.rateLimitTimer > 0;
  }

  get progress(): number {
    return Math.min(1, this.z / this.endAt);
  }

  /** Score multiplier from raw speed, per the GDD formula. */
  private get speedBonus(): number {
    return this.speed / SPEED_BONUS_BASE - 1;
  }

  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  private emit(event: SimEvent) {
    this.events.push(event);
  }

  // -------------------------------------------------------------------------
  // Step
  // -------------------------------------------------------------------------

  step(dt: number, input: InputState) {
    if (this.finished) return;
    this.dt = dt;
    this.time += dt;

    // Hitstop freezes motion but not timers — the pause has to be felt.
    const frozen = this.hitstopTimer > 0;
    if (frozen) this.hitstopTimer -= dt;

    this.tickTimers(dt);
    this.updateAngular(dt, input, frozen);
    this.updateRadial(dt, input);

    this.prevZ = this.z;
    if (!frozen) this.z += this.speed * dt;

    this.recordHistory();
    this.updateEntities(dt);
    this.collide();
    this.updateGc(dt);
    this.updateTrace(dt);
    this.checkChunkClear();

    if (input.boost) this.tryOverclock();

    if (this.trace >= TRACE_MAX) {
      this.trace = TRACE_MAX;
      this.traced = true;
      this.finished = true;
      this.emit({ type: "traced" });
      return;
    }

    if (this.z >= this.endAt) {
      this.finished = true;
      this.trace = Math.max(0, this.trace + TRACE_LAYER_CLEAR);
      this.emit({ type: "layer-clear", level: this.level.n });
    }
  }

  private tickTimers(dt: number) {
    if (this.overclockTimer > 0) this.overclockTimer -= dt;
    if (this.rateLimitTimer > 0) this.rateLimitTimer -= dt;
    if (this.socketPadTimer > 0) this.socketPadTimer -= dt;
    if (this.tumbleTimer > 0) this.tumbleTimer -= dt;
    this.sinceHit += dt;
    this.overclockReady = this.cycles >= OVERCLOCK_COST;
  }

  private updateAngular(dt: number, input: InputState, frozen: boolean) {
    const maxOmega = this.level.omega * DEG;
    // A tumble takes the controls away for a beat.
    const turn = this.tumbleTimer > 0 ? 0 : Math.max(-1, Math.min(1, input.turn));
    const target = frozen ? 0 : turn * maxOmega;

    // Accelerating into a turn is quicker than letting go of one. Momentum
    // carries; nothing snaps.
    const ramping = Math.abs(target) > Math.abs(this.omega);
    const rampTime = ramping ? ANGULAR_ACCEL_TIME : ANGULAR_DECEL_TIME;
    const rate = (maxOmega / rampTime) * dt;
    const delta = target - this.omega;
    this.omega += Math.abs(delta) <= rate ? delta : Math.sign(delta) * rate;

    if (this.tumbleTimer > 0) {
      // Null void spat you out — spin freely for the duration.
      this.theta += maxOmega * 1.4 * dt;
    } else {
      this.theta += this.omega * dt;
    }
    this.theta = ((this.theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

    // The bit points along velocity and leans into turns.
    const leanTarget = (this.omega / maxOmega) * LEAN_MAX_DEG;
    this.lean += (leanTarget - this.lean) * Math.min(1, dt * 12);
  }

  private updateRadial(dt: number, input: InputState) {
    // Default lane is MID; hold to commit to a band.
    const targetRadius = input.dive
      ? BAND_RADIUS.CORE
      : input.hug
        ? BAND_RADIUS.WALL
        : BAND_RADIUS.MID;

    // Full WALL↔CORE travel takes the layer's radial transition time.
    const span = BAND_RADIUS.WALL - BAND_RADIUS.CORE;
    const rate = (span / this.level.radial) * dt;
    const delta = targetRadius - this.radius;
    this.radius += Math.abs(delta) <= rate ? delta : Math.sign(delta) * rate;

    this.band = this.radius >= WALL_MID ? "WALL" : this.radius >= MID_CORE ? "MID" : "CORE";
  }

  private recordHistory() {
    this.trailTimer += this.dt;
    if (this.trailTimer >= TRAIL_INTERVAL) {
      this.trailTimer = 0;
      this.trail.unshift({ theta: this.theta, radius: this.radius, z: this.z });
      if (this.trail.length > TRAIL_SAMPLES) this.trail.pop();
    }

    this.thetaHistory.push({ t: this.time, theta: this.theta });
    while (this.thetaHistory.length > 2 && this.thetaHistory[0].t < this.time - SENTINEL_DELAY - 0.1) {
      this.thetaHistory.shift();
    }
  }

  private thetaAt(delay: number): number {
    const want = this.time - delay;
    for (let i = this.thetaHistory.length - 1; i >= 0; i--) {
      if (this.thetaHistory[i].t <= want) return this.thetaHistory[i].theta;
    }
    return this.thetaHistory.length ? this.thetaHistory[0].theta : this.theta;
  }

  // -------------------------------------------------------------------------
  // Entity behaviour
  // -------------------------------------------------------------------------

  /** Advance the moving index pointer past everything behind the player. */
  private advanceHead() {
    const entities = this.plan.entities;
    while (
      this.head < entities.length &&
      entities[this.head].z + entities[this.head].depth < this.z - DESPAWN_BEHIND
    ) {
      this.head++;
    }
  }

  private updateEntities(dt: number) {
    this.advanceHead();
    const entities = this.plan.entities;
    const window = this.level.horizon * this.speed;
    this.sentinelLocked = false;

    for (let i = this.head; i < entities.length; i++) {
      const e = entities[i];
      const ahead = e.z - this.z;
      if (ahead > window) break;
      e.age += dt;

      // Accessibility: every major hazard announces itself 0.8s out.
      if (!e.warned && e.def.major && ahead > 0 && ahead < this.speed * WARN_LEAD) {
        e.warned = true;
        this.emit({ type: "warn", kind: e.kind });
      }

      switch (e.kind) {
        case "debris":
          e.theta += (e.drift ?? 0) * DEG * dt;
          break;

        case "firewall":
        case "ids":
          e.theta += (e.spin ?? 0) * DEG * dt;
          break;

        case "ice": {
          // The only entity that reads you. Bait it, then move.
          if (!e.committed) {
            if (e.age >= ICE_TRACK_TIME) {
              e.committed = true;
              e.lockedTheta = e.theta;
            } else {
              const d = angularDelta(this.theta, e.theta);
              e.theta += d * Math.min(1, dt * 6);
            }
          }
          break;
        }

        case "logicbomb": {
          if (!e.detonated && e.age >= LOGICBOMB_FUSE) {
            e.detonated = true;
            e.arcDeg = LOGICBOMB_BURST_ARC;
          }
          break;
        }

        case "sentinel": {
          e.theta = this.thetaAt(SENTINEL_DELAY);
          const gap = Math.abs(angularDelta(this.theta, e.theta)) / DEG;
          // A full 180° arc puts the delayed mirror far enough away to break.
          e.locked = gap < 90 && Math.abs(e.z - this.z) < window;
          if (e.locked) this.sentinelLocked = true;
          break;
        }

        default:
          break;
      }
    }
  }

  /** Is a race-condition group solid this instant? */
  private raceSolid(e: Entity): boolean {
    const beat = Math.floor(this.time * RACE_HZ) % 2;
    return beat === (e.phase ?? 0);
  }

  // -------------------------------------------------------------------------
  // Collision — pure analytic, cylindrical, swept in z
  // -------------------------------------------------------------------------

  /**
   * Distance in world units between the player and an entity's edge. Returns 0
   * or less when they overlap. Used for both contact and the graze reward.
   */
  private missDistance(e: Entity): number {
    // Angular gap, measured as arc length at the player's radius.
    const dTheta = Math.abs(angularDelta(this.theta, e.theta));
    const halfArcs = (e.arcDeg / 2 + PLAYER_ARC_DEG / 2) * DEG;
    const angularGap = e.arcDeg >= 360 ? -1 : (dTheta - halfArcs) * this.radius;

    // Radial gap between the player and the entity's band.
    let radialGap = -1;
    if (e.band !== "ALL") {
      const er = BAND_RADIUS[e.band];
      radialGap = Math.abs(this.radius - er) - (PLAYER_RADIAL_HALF + 0.25);
    }

    if (angularGap <= 0 && radialGap <= 0) return 0;
    if (angularGap <= 0) return radialGap;
    if (radialGap <= 0) return angularGap;
    return Math.hypot(angularGap, radialGap);
  }

  /** Does the player's swept z range overlap this entity's depth? */
  private sweptZ(e: Entity): boolean {
    const near = e.z - e.depth / 2;
    const far = e.z + e.depth / 2;
    // The player occupies [prevZ, z] this frame. At 51.9 m/s that span is
    // 0.87u, which is wider than some entities are deep — hence the sweep.
    return this.prevZ <= far && this.z >= near;
  }

  private collide() {
    const entities = this.plan.entities;
    const window = this.level.horizon * this.speed;

    for (let i = this.head; i < entities.length; i++) {
      const e = entities[i];
      if (e.z - this.z > window) break;
      if (e.spent) continue;

      // Beacons report continuously while you are inside their sight radius —
      // no contact required.
      if (e.kind === "beacon") {
        if (Math.abs(e.z - this.z) < BEACON_SIGHT) {
          this.addTrace(TRACE_BEACON_PER_SEC * this.dt);
        }
        continue;
      }

      // The Sentinel never touches you. It just watches, and watching costs.
      if (e.kind === "sentinel") continue;

      if (!this.sweptZ(e)) continue;

      const contact = this.resolveContact(e);
      if (contact) continue;

      // Reward the near miss — this is where the flow feeling comes from.
      if (e.def.role === "avoid" && !e.spent) {
        const gap = this.missDistance(e);
        if (gap > 0 && gap < GRAZE_DISTANCE) {
          e.spent = true;
          this.cycles = Math.min(CYCLES_MAX, this.cycles + GRAZE_CYCLES);
          this.emit({ type: "graze" });
        }
      }
    }
  }

  /** Returns true when the entity produced a contact this frame. */
  private resolveContact(e: Entity): boolean {
    switch (e.kind) {
      case "firewall": {
        // Full ring, closed except its open slots, rotating with the instance.
        const local = angularDelta(this.theta, e.theta);
        const open = (e.openSlots ?? []).some(
          (slot) => Math.abs(angularDelta(local, slotAngle(slot))) < SLOT_RAD / 2,
        );
        if (open) return false;
        this.takeHit(e);
        return true;
      }

      case "hashwall": {
        // Full-band wall with one band open — forces a radial move.
        if (this.band === e.openBand) return false;
        this.takeHit(e);
        return true;
      }

      case "ratelimit": {
        // Doesn't damage. Halves speed and kills combo gain, which is worse
        // than damage when the combo is high.
        if (this.band !== "MID") return false;
        this.rateLimitTimer = RATELIMIT_DURATION;
        if (this.combo > COMBO_START) {
          this.combo = COMBO_START;
          this.emit({ type: "combo-break" });
        }
        return true;
      }

      case "nullvoid": {
        // A hole in the skin. Only fall out if you are riding the WALL band.
        if (this.band !== "WALL") return false;
        if (this.missDistance(e) > 0) return false;
        e.spent = true;
        this.tumbleTimer = NULLVOID_TUMBLE;
        this.applyHitTrace(e.def.trace, e.kind, true);
        return true;
      }

      case "race": {
        if (!this.raceSolid(e)) return false;
        if (this.missDistance(e) > 0) return false;
        this.takeHit(e);
        return true;
      }

      case "logicbomb": {
        // Before it blows it is a small target; after, a 5-slot burst.
        if (this.missDistance(e) > 0) return false;
        this.takeHit(e);
        return true;
      }

      case "ids":
      case "ice":
      case "tripwire":
      case "debris":
      case "honeypot": {
        if (this.missDistance(e) > 0) return false;
        this.takeHit(e);
        return true;
      }

      default:
        break;
    }

    if (e.def.role === "collect") {
      if (this.missDistance(e) > 0) return false;
      this.collect(e);
      return true;
    }

    return false;
  }

  private takeHit(e: Entity) {
    // Overclock phases through minor hazards. It is not invincibility — it is
    // a gamble, and majors still land.
    if (this.overclocking && !e.def.major) {
      e.spent = true;
      return;
    }

    // A forged cert absorbs exactly one major hazard.
    if (e.def.major && this.certCharges > 0) {
      this.certCharges--;
      e.spent = true;
      this.emit({ type: "absorb", kind: e.kind });
      return;
    }

    e.spent = true;
    this.applyHitTrace(e.def.trace, e.kind, e.def.major);
  }

  private applyHitTrace(amount: number, kind: EntityKind, major: boolean) {
    this.addTrace(amount);
    this.sinceHit = 0;
    this.hitstopTimer = HITSTOP;
    this.chunkClean = false;
    if (this.combo > COMBO_START) {
      this.combo = COMBO_START;
      this.emit({ type: "combo-break" });
    }
    this.emit({ type: "hit", kind, major, trace: amount });
  }

  private collect(e: Entity) {
    e.spent = true;

    if (e.def.cycles) {
      this.cycles = Math.min(CYCLES_MAX, this.cycles + e.def.cycles);
    }
    if (e.def.trace) {
      this.addTrace(e.def.trace);
    }
    if (e.def.combo) {
      // The rate limiter kills combo gain for its duration.
      if (!this.rateLimited) {
        this.combo = Math.min(COMBO_MAX, this.combo + e.def.combo);
      }
    }

    let points = 0;
    if (e.def.score) {
      const mult = this.overclocking ? OVERCLOCK_SCORE_MULT : 1;
      points = Math.round(e.def.score * this.combo * (1 + this.speedBonus) * mult);
      this.score += points;
    }

    switch (e.kind) {
      case "cert":
        this.certCharges++;
        break;
      case "socket":
        this.socketPadTimer = SOCKET_PAD_DURATION;
        break;
      case "roottoken":
        // Opens the layer's backdoor early — skips the last 15%.
        this.endAt = Math.min(this.endAt, this.plan.length * (1 - ROOT_TOKEN_SKIP));
        this.emit({ type: "backdoor" });
        break;
      default:
        break;
    }

    this.emit({ type: "collect", kind: e.kind, points });
  }

  // -------------------------------------------------------------------------
  // Trace, Cycles, chase
  // -------------------------------------------------------------------------

  private addTrace(amount: number) {
    let delta = amount;
    if (delta > 0) {
      // The Sentinel doesn't damage on contact — it doubles Trace gain while
      // it has lock.
      if (this.sentinelLocked) delta *= SENTINEL_TRACE_MULT;
      if (this.assist) delta *= ASSIST_TRACE_MULT;
    }
    this.trace = Math.max(0, Math.min(TRACE_MAX, this.trace + delta));
  }

  private updateTrace(dt: number) {
    // Overclock pauses decay; it is already paying you in other currencies.
    if (this.overclocking) return;
    if (this.sinceHit >= TRACE_DECAY_DELAY) {
      this.trace = Math.max(0, this.trace - TRACE_DECAY_PER_SEC * dt);
    }
  }

  private tryOverclock() {
    if (this.overclocking) return;
    if (this.cycles < OVERCLOCK_COST) return;
    this.cycles -= OVERCLOCK_COST;
    this.overclockTimer = OVERCLOCK_DURATION;
    this.emit({ type: "overclock" });
  }

  private updateGc(dt: number) {
    const entities = this.plan.entities;

    // Trip any garbage collector marker we have just passed.
    for (let i = this.head; i < entities.length; i++) {
      const e = entities[i];
      if (e.z - this.z > 0) break;
      if (e.kind === "gc" && !e.spent) {
        e.spent = true;
        this.gcActive = true;
        this.gcZ = this.z - GC_GAP;
        this.gcTimer = GC_LIFETIME;
      }
    }

    if (!this.gcActive) return;

    this.gcTimer -= dt;
    // It closes slowly at base speed, so one Overclock buys real distance and
    // a rate limiter is genuinely dangerous.
    this.gcZ += this.level.speed * GC_CLOSE_RATE * dt;

    if (this.gcZ >= this.z) {
      // Contact = run over. No Trace math.
      this.trace = TRACE_MAX;
      this.traced = true;
      this.finished = true;
      this.emit({ type: "traced" });
      return;
    }

    if (this.gcTimer <= 0) {
      this.gcActive = false;
    }
  }

  private checkChunkClear() {
    const bounds = this.plan.bounds;
    while (this.chunkIndex < bounds.length && this.z > bounds[this.chunkIndex].end) {
      const chunk = bounds[this.chunkIndex];
      if (this.chunkClean && chunk.hazards > 0) {
        this.cycles = Math.min(CYCLES_MAX, this.cycles + CYCLES_PERFECT_CHUNK);
        this.emit({ type: "perfect-chunk" });
      }
      this.chunkClean = true;
      this.chunkIndex++;
    }
  }

  // -------------------------------------------------------------------------
  // Carry-over between layers
  // -------------------------------------------------------------------------

  /** Trace and Cycles carry between layers; position and combo do not. */
  carry(): { trace: number; cycles: number; score: number; certCharges: number } {
    return {
      trace: this.trace,
      cycles: this.cycles,
      score: this.score,
      certCharges: this.certCharges,
    };
  }

  seed(state: { trace: number; cycles: number; score: number; certCharges: number }) {
    this.trace = state.trace;
    this.cycles = state.cycles;
    this.score = state.score;
    this.certCharges = state.certCharges;
  }

  /** Entities currently inside the render window, nearest first. */
  visible(): Entity[] {
    const out: Entity[] = [];
    const entities = this.plan.entities;
    const window = this.level.horizon * this.speed;
    for (let i = this.head; i < entities.length; i++) {
      const e = entities[i];
      if (e.z - this.z > window) break;
      if (e.spent && e.def.role === "collect") continue;
      if (e.spent && e.kind !== "ratelimit") continue;
      out.push(e);
    }
    return out;
  }
}
