/**
 * MIFTACH'S MATRIX — headless tuning harness. `npm run matrix:verify`.
 *
 * Runs the simulation with no renderer so the design can be checked without a
 * GPU. It asserts the GDD's tuning table, the chunk library's invariants (the
 * no-repeat-within-3 rule, the forced breath chunk after two 30+ chunks, the
 * budget floor and ceiling, per-layer entity gating), that every entity kind is
 * reachable and every hazard actually registers contact, and then plays all ten
 * layers with a simple autopilot to print score, hazard density and clear times.
 *
 * This is the fastest way to feel out a tuning change before opening a browser.
 * Nothing in the shipped game imports it.
 */
import { LEVELS, TRACE_MAX, angularDelta, BAND_RADIUS } from "./config";
import { generateLayer, budgetCeiling, isBreath, allChunks, LEAD_IN } from "./generator";
import { Rng, layerSeed } from "./rng";
import { Simulation } from "./sim";
import { CATALOG } from "./catalog";
import type { Entity, EntityKind } from "./types";

const STEP = 1 / 120;
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (!ok) {
    failures++;
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

// --- 1. Chunk library sanity ----------------------------------------------
const chunks = allChunks();
console.log(`chunks: ${chunks.length} (${chunks.filter(isBreath).length} breath)`);
const ids = new Set<string>();
for (const c of chunks) {
  check(`unique id ${c.id}`, !ids.has(c.id));
  ids.add(c.id);
  check(`${c.id} has entities`, c.entities.length > 0);
  check(`${c.id} length sane`, c.length >= 90 && c.length <= 400, String(c.length));
  for (const e of c.entities) {
    check(`${c.id} kind ${e.t} in catalog`, !!CATALOG[e.t as EntityKind]);
    check(`${c.id} entity z within length`, e.z <= c.length, `${e.z} > ${c.length}`);
    const def = CATALOG[e.t as EntityKind];
    if (def) {
      check(`${c.id} ${e.t} respects minLevel`, def.minLevel <= c.minLevel,
        `entity L${def.minLevel} in chunk L${c.minLevel}`);
    }
  }
}
// Breath chunks must be collectibles only.
for (const c of chunks.filter(isBreath)) {
  for (const e of c.entities) {
    check(`breath ${c.id} collect-only`, CATALOG[e.t as EntityKind].role === "collect", e.t);
  }
}

// --- 2. Generation: budget, no-repeat, breath rule, teaching chunk ---------
const seen = new Set<EntityKind>();
for (const level of LEVELS) {
  for (let run = 0; run < 12; run++) {
    const rng = new Rng(layerSeed(1000 + run, level.n));
    const plan = generateLayer(level.n, level.speed, level.duration, rng);
    check(`L${level.n} matches nominal duration`,
      Math.abs(plan.length - level.speed * level.duration) < 1);
    if (run === 0) {
      const hazards = plan.entities.filter((e) => e.def.role === "avoid").length;
      const collects = plan.entities.filter((e) => e.def.role === "collect").length;
      const avgCost =
        plan.order.reduce((sum, id) => sum + chunks.find((c) => c.id === id)!.cost, 0) /
        plan.order.length;
      console.log(
        `  L${String(level.n).padStart(2)} density: ${String(hazards).padStart(3)} hazards, ` +
          `${String(collects).padStart(3)} collects, ${plan.order.length} chunks, ` +
          `avg cost ${avgCost.toFixed(1)} / ceiling ${budgetCeiling(level.n, 1).toFixed(0)}`,
      );
    }
    check(`L${level.n} has entities`, plan.entities.length > 20, String(plan.entities.length));

    // z-sorted, so the moving index pointer is valid.
    for (let i = 1; i < plan.entities.length; i++) {
      check(`L${level.n} z-sorted`, plan.entities[i].z >= plan.entities[i - 1].z);
    }

    // No repeat within 3 draws.
    for (let i = 3; i < plan.order.length; i++) {
      const window = plan.order.slice(i - 3, i);
      check(`L${level.n} no repeat within 3`, !window.includes(plan.order[i]), plan.order[i]);
    }

    // Never two 30+ chunks followed by a third without a breath.
    let heavy = 0;
    for (const id of plan.order) {
      const chunk = chunks.find((c) => c.id === id)!;
      if (isBreath(chunk)) { heavy = 0; continue; }
      if (chunk.cost >= 30) heavy++; else heavy = 0;
      check(`L${level.n} breath rule`, heavy <= 2, `${id} made it ${heavy}`);
    }

    // Cost ceiling: a drawn chunk fits the window it was drawn in (breath and
    // the forced teaching chunk are the documented exceptions).
    let cursor = LEAD_IN * (level.speed / 22);
    for (const id of plan.order) {
      const chunk = chunks.find((c) => c.id === id)!;
      const t = cursor / (level.speed * level.duration);
      const ceiling = budgetCeiling(level.n, t);
      const exempt = isBreath(chunk) || chunk.minLevel === level.n;
      check(`L${level.n} budget ${id}`, exempt || chunk.cost <= ceiling + 0.001,
        `${chunk.cost} > ${ceiling.toFixed(1)}`);
      cursor += chunk.length * (level.speed / 22);
    }

    // Each layer teaches its new thing.
    const teaches = chunks.some((c) => c.minLevel === level.n);
    if (teaches) {
      check(`L${level.n} introduces its mechanic`,
        plan.order.some((id) => chunks.find((c) => c.id === id)!.minLevel === level.n));
    }

    for (const e of plan.entities) seen.add(e.kind);
  }
}
console.log(`entity kinds generated: ${seen.size}/${Object.keys(CATALOG).length}`);
for (const kind of Object.keys(CATALOG) as EntityKind[]) {
  check(`kind ${kind} reachable`, seen.has(kind));
}

// --- 3. Autopilot run: collection, combo, score, layer clear ---------------
function autopilot(sim: Simulation): { turn: number; dive: boolean; hug: boolean; boost: boolean } {
  // Steer toward the nearest collectible ahead, matching its band.
  let best: Entity | null = null;
  for (const e of sim.visible()) {
    if (e.def.role !== "collect" || e.spent) continue;
    if (e.z < sim.z) continue;
    if (!best || e.z < best.z) best = e;
  }
  if (!best) return { turn: 0, dive: false, hug: false, boost: false };
  const d = angularDelta(best.theta, sim.theta);
  const band = best.band === "ALL" ? "MID" : best.band;
  return {
    turn: Math.max(-1, Math.min(1, d * 3)),
    dive: band === "CORE",
    hug: band === "WALL",
    boost: sim.cycles >= 60,
  };
}

for (const level of LEVELS) {
  const rng = new Rng(layerSeed(7, level.n));
  const plan = generateLayer(level.n, level.speed, level.duration, rng);
  const sim = new Simulation(level, plan, { assist: false });

  let steps = 0;
  const kinds = new Set<string>();
  let collected = 0;
  let hits = 0;
  let grazes = 0;
  while (!sim.finished && steps < 120 * 200) {
    sim.step(STEP, autopilot(sim));
    for (const ev of sim.drainEvents()) {
      kinds.add(ev.type);
      if (ev.type === "collect") collected++;
      if (ev.type === "hit") hits++;
      if (ev.type === "graze") grazes++;
    }
    steps++;
  }

  const simSeconds = steps * STEP;
  console.log(
    `L${String(level.n).padStart(2)} ${level.name.padEnd(10)} ` +
      `v=${level.speed.toFixed(1)} t=${simSeconds.toFixed(1)}s ` +
      `score=${String(sim.score).padStart(8)} collect=${String(collected).padStart(3)} ` +
      `hit=${String(hits).padStart(2)} graze=${String(grazes).padStart(2)} ` +
      `trace=${sim.trace.toFixed(0).padStart(3)} combo=${sim.combo.toFixed(2)} ` +
      `${sim.traced ? "TRACED" : "CLEARED"}`,
  );

  check(`L${level.n} terminated`, sim.finished);
  check(`L${level.n} collected something`, collected > 0);
  check(`L${level.n} scored`, sim.score > 0);
  check(`L${level.n} trace in range`, sim.trace >= 0 && sim.trace <= TRACE_MAX);
  check(`L${level.n} duration plausible`, simSeconds > 5 && simSeconds < level.duration * 1.6,
    `${simSeconds.toFixed(1)} vs ${level.duration}`);
}

// --- 4. Idle run: does nothing, must still terminate -----------------------
{
  const level = LEVELS[9];
  const rng = new Rng(layerSeed(3, 10));
  const plan = generateLayer(10, level.speed, level.duration, rng);
  const sim = new Simulation(level, plan, { assist: false });
  let steps = 0;
  while (!sim.finished && steps < 120 * 200) {
    sim.step(STEP, { turn: 0, dive: false, hug: false, boost: false });
    sim.drainEvents();
    steps++;
  }
  console.log(`idle L10: ${sim.traced ? "TRACED" : "CLEARED"} trace=${sim.trace.toFixed(0)} t=${(steps * STEP).toFixed(1)}s`);
  check("idle run terminates", sim.finished);

  // Diagnostic: how many hazards did the idle line actually pass through?
  const rng2 = new Rng(layerSeed(3, 10));
  const plan2 = generateLayer(10, level.speed, level.duration, rng2);
  const counts: Record<string, number> = {};
  let inLane = 0;
  for (const e of plan2.entities) {
    if (e.def.role !== "avoid") continue;
    counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    const covers =
      e.arcDeg >= 360 || Math.abs(angularDelta(0, e.theta)) < (e.arcDeg / 2) * (Math.PI / 180);
    const bandOk = e.band === "ALL" || e.band === "MID";
    if (covers && bandOk) inLane++;
  }
  console.log(`  idle diag: hazards=${JSON.stringify(counts)} inLaneAtTheta0=${inLane}`);
  console.log(
    `  hashwall openBands: ${plan2.entities
      .filter((e) => e.kind === "hashwall")
      .map((e) => e.openBand)
      .join(",")}`,
  );
  console.log(
    `  firewall open slots: ${plan2.entities
      .filter((e) => e.kind === "firewall")
      .map((e) => (e.openSlots ?? []).join("/"))
      .join(" ")}`,
  );

  // Re-run idle and report which avoid entities were consumed.
  const sim2 = new Simulation(level, plan2, { assist: false });
  let s2 = 0;
  while (!sim2.finished && s2 < 120 * 200) {
    sim2.step(STEP, { turn: 0, dive: false, hug: false, boost: false });
    sim2.drainEvents();
    s2++;
  }
  const consumed = plan2.entities.filter((e) => e.def.role === "avoid" && e.spent);
  console.log(
    `  idle consumed ${consumed.length} avoid entities: ${consumed.map((e) => e.kind).join(",")}`,
  );
  console.log(`  idle travelled ${sim2.z.toFixed(0)}u of ${plan2.length.toFixed(0)}u`);
}

// --- 5. Direct hazard contact: every hazard kind must register -------------
{
  const level = LEVELS[9];
  for (const kind of Object.keys(CATALOG) as EntityKind[]) {
    const def = CATALOG[kind];
    if (def.role !== "avoid") continue;
    if (kind === "gc" || kind === "sentinel" || kind === "beacon") continue;

    const rng = new Rng(1);
    const plan = generateLayer(10, level.speed, level.duration, rng);
    // Replace the layer with a single hazard dead ahead, in the player's lane.
    const probe: Entity = {
      id: 1,
      kind,
      def,
      z: 120,
      slot: 0,
      theta: 0,
      arcDeg: def.arcDeg,
      band: kind === "nullvoid" ? "WALL" : kind === "ratelimit" ? "MID" : def.band,
      depth: def.depth,
      spent: false,
      age: 0,
      warned: false,
      openSlots: kind === "firewall" ? [8, 9] : undefined,
      openBand: kind === "hashwall" ? "CORE" : undefined,
      spin: 0,
      phase: 0,
    };
    let registered = false;
    // A race condition is a genuine coin flip on arrival time, so probe a
    // spread of depths and require it to land at least once.
    const offsets = kind === "race" ? [120, 128, 136, 144, 152, 160] : [120];
    for (const offset of offsets) {
      if (registered) break;
      plan.entities = [{ ...probe, z: offset, spent: false, age: 0 }];
      plan.bounds = [];
      const sim = new Simulation(level, plan, { assist: false });
      let steps = 0;
      while (!sim.finished && steps < 120 * 20 && !registered) {
        sim.step(STEP, {
          turn: 0,
          dive: false,
          hug: kind === "nullvoid",
          boost: false,
        });
        for (const ev of sim.drainEvents()) {
          if (ev.type === "hit") registered = true;
        }
        if (sim.rateLimited) registered = true;
        steps++;
      }
    }
    check(`hazard ${kind} registers contact`, registered);
  }
}

// --- 6. Tuning table matches the GDD --------------------------------------
const expected: Array<[number, number, number]> = [
  [1, 22.0, 220],
  [10, 51.9, 440],
];
for (const [n, speed, omega] of expected) {
  const level = LEVELS[n - 1];
  check(`L${n} speed`, Math.abs(level.speed - speed) < 0.06, String(level.speed));
  check(`L${n} omega`, Math.abs(level.omega - omega) < 0.5, String(level.omega));
}
check("L10 bpm ≈ 236", Math.abs(LEVELS[9].bpm - 236) < 0.5, String(LEVELS[9].bpm));
check("bands", BAND_RADIUS.WALL === 5.7 && BAND_RADIUS.MID === 5.0 && BAND_RADIUS.CORE === 4.2);

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECKS FAILED`);
process.exit(failures === 0 ? 0 : 1);
