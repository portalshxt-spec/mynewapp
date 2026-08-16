/**
 * Scene orchestration.
 *
 * The world group rotates so the Keyshard always sits at the bottom of the
 * frame — the Sonic 2 half-pipe read. The player's radial band still moves them
 * vertically on screen, which is what makes the second axis legible.
 */

import * as THREE from "three";
import {
  CAMERA_ROLL_MAX_DEG,
  CAMERA_TRAIL,
  LEVELS,
  OVERCLOCK_FOV_BONUS,
  RAIL_CYCLE_HUES,
  RAIL_CYCLE_PERIOD,
  TRACE_WALL_WRITES,
} from "../config";
import type { LevelConfig } from "../types";
import type { Simulation } from "../sim";
import { EntityRenderer } from "./entities";
import { GlyphQuads, GlyphRain, Keyshard, Trail, makeGlyphAtlas } from "./keyshard";
import { PostStack, tierParticles, type QualityTier } from "./post";
import { Tube } from "./tube";
import type { GhostSample } from "../persistence";

/** How much of the ghost path is drawn around the player, in world units. */
const GHOST_WINDOW = 140;
const GHOST_MAX = 64;

const DEG = Math.PI / 180;

export interface SceneState {
  /** 0..1 red push after a hit. */
  flash: number;
  /** 0..1 terminal whiteout. */
  whiteout: number;
  reducedMotion: boolean;
  /** 0..1 constriction toward the vanishing point during a layer transition. */
  constrict: number;
}

export class MatrixScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;

  private readonly world = new THREE.Group();
  private readonly tube: Tube;
  private readonly entities = new EntityRenderer();
  private readonly keyshard: Keyshard;
  private readonly trail: Trail;
  private rain: GlyphRain;
  private readonly atlas: THREE.Texture;
  private readonly ghostQuads: GlyphQuads;
  private ghostPath: GhostSample[] | null = null;
  private ghostCursor = 0;
  private post: PostStack;
  private tier: QualityTier;

  private level: LevelConfig;
  private time = 0;
  private identityResolved = false;

  constructor(canvas: HTMLCanvasElement, level: LevelConfig, tier: QualityTier) {
    this.level = level;
    this.tier = tier;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier === "high",
      powerPreference: "high-performance",
      alpha: false,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, tier === "high" ? 2 : 1.5));
    this.renderer.setClearColor(new THREE.Color(level.bg), 1);

    this.camera = new THREE.PerspectiveCamera(level.fov, 1, 0.1, 700);

    this.atlas = makeGlyphAtlas();
    this.tube = new Tube(level.n, level.accent, level.rail, level.bg);
    this.keyshard = new Keyshard(this.atlas);
    this.trail = new Trail(this.atlas);
    this.rain = new GlyphRain(this.atlas, tierParticles(tier), new THREE.Color(level.accent));
    this.ghostQuads = new GlyphQuads(GHOST_MAX, this.atlas);

    this.world.add(this.tube.mesh);
    this.world.add(this.entities.group);
    this.world.add(this.rain.mesh);
    this.world.add(this.ghostQuads.mesh);
    this.scene.add(this.world);
    this.scene.add(this.keyshard.group);
    this.scene.add(this.trail.quads.mesh);

    this.tube.setQuality(tier === "low" ? 0 : 2);
    this.post = new PostStack(this.renderer, this.scene, this.camera, tier);
  }

  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.post.setSize(width, height);
  }

  /** The best run for this layer, replayed as a translucent path. */
  setGhost(path: GhostSample[] | null) {
    this.ghostPath = path && path.length ? path : null;
    this.ghostCursor = 0;
    if (!this.ghostPath) {
      this.ghostQuads.begin();
      this.ghostQuads.end();
    }
  }

  private updateGhost(playerZ: number) {
    if (!this.ghostPath) return;
    const path = this.ghostPath;
    // Walk a moving cursor rather than searching the whole path each frame.
    while (this.ghostCursor > 0 && path[this.ghostCursor].z > playerZ - GHOST_WINDOW * 0.25) {
      this.ghostCursor--;
    }
    while (
      this.ghostCursor < path.length - 1 &&
      path[this.ghostCursor].z < playerZ - GHOST_WINDOW * 0.25
    ) {
      this.ghostCursor++;
    }

    const ghostColor = new THREE.Color(0x4a5b66);
    this.ghostQuads.begin();
    for (let i = this.ghostCursor; i < path.length; i++) {
      const s = path[i];
      const ahead = s.z - playerZ;
      if (ahead > GHOST_WINDOW) break;
      const x = Math.sin(s.theta) * s.radius;
      const y = Math.cos(s.theta) * s.radius;
      this.ghostQuads.push(x, y, -ahead, 12, 0.34, 0.28, ghostColor);
    }
    this.ghostQuads.end();
  }

  setLevel(level: LevelConfig) {
    this.level = level;
    this.identityResolved = false;
    this.tube.setLayer(level.n, level.accent, level.rail, level.bg);
    this.rain.setAccent(new THREE.Color(level.accent));
    this.renderer.setClearColor(new THREE.Color(level.bg), 1);
    this.tube.setWhiteout(0);
  }

  /** The blade fractures into six shards and reassembles. */
  onHit() {
    this.keyshard.onHit();
  }

  render(dt: number, sim: Simulation, state: SceneState) {
    this.time += dt;

    // ---- Root Zero: rails cycle through all nine previous palettes -------
    if (this.level.cycleRails) {
      const t = this.time / RAIL_CYCLE_PERIOD;
      const i = Math.floor(t) % RAIL_CYCLE_HUES.length;
      const j = (i + 1) % RAIL_CYCLE_HUES.length;
      const mix = t % 1;
      const a = new THREE.Color(RAIL_CYCLE_HUES[i]);
      const b = new THREE.Color(RAIL_CYCLE_HUES[j]);
      this.tube.setRailColor(a.lerp(b, mix));
    }

    // ---- world rotation: the player rides the bottom of the frame --------
    this.world.rotation.z = sim.theta - Math.PI;

    // ---- camera ----------------------------------------------------------
    const fovBonus = sim.overclocking ? OVERCLOCK_FOV_BONUS : 0;
    // The tube constricts to the vanishing point between layers.
    const constrictFov = state.constrict * -34;
    const targetFov = this.level.fov + fovBonus + constrictFov;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 8);
    this.camera.updateProjectionMatrix();

    const r = sim.radius;
    this.camera.position.set(0, -r * 0.86, CAMERA_TRAIL);
    this.camera.lookAt(0, -r * 0.5, -50);
    if (!state.reducedMotion) {
      // Rolls up to 12° opposite the turn direction.
      const maxOmega = this.level.omega * DEG;
      const roll = (-sim.omega / maxOmega) * CAMERA_ROLL_MAX_DEG * DEG;
      this.camera.rotateZ(roll);
    }

    // ---- the Keyshard sits at the bottom of the tube ---------------------
    this.keyshard.group.position.set(0, -r, 0);
    this.keyshard.update({
      dt,
      time: this.time,
      speed: sim.speed,
      omega: sim.omega,
      lean: state.reducedMotion ? 0 : sim.lean,
      trace: sim.trace,
      overclock: sim.overclocking,
    });

    this.trail.update(sim.trail, sim.theta, sim.z, sim.trace, sim.overclocking);

    // ---- the wall writes you ---------------------------------------------
    const logStrength = Math.max(
      0,
      Math.min(1, (sim.trace - TRACE_WALL_WRITES) / 12),
    );
    this.tube.update(dt, {
      z: sim.z,
      time: this.time,
      speed: sim.speed,
      trace: sim.trace,
      theta: sim.theta,
      band: sim.band,
      logStrength,
    });
    if (sim.trace >= 100 && !this.identityResolved) {
      this.identityResolved = true;
      this.tube.resolveIdentity();
    }
    this.tube.setWhiteout(state.whiteout);

    // ---- entities ---------------------------------------------------------
    const fogDensity = 0.0042 + (sim.speed / 52) * 0.0055;
    const fogColor = new THREE.Color(this.level.bg);
    this.entities.update(sim.visible(), sim.z, this.time, fogDensity, fogColor, {
      active: sim.gcActive,
      z: sim.gcZ,
    });

    this.rain.update(this.time, sim.z);
    this.updateGhost(sim.z);

    // ---- post -------------------------------------------------------------
    this.post.update({
      time: this.time,
      combo: sim.combo,
      speed: sim.speed,
      trace: sim.trace,
      overclock: sim.overclocking,
      flash: state.flash,
      whiteout: state.whiteout,
      reducedMotion: state.reducedMotion,
    });
    this.post.render(dt);
  }

  /** Swap quality tier at runtime without tearing down the scene. */
  setTier(tier: QualityTier) {
    if (tier === this.tier) return;
    this.tier = tier;
    this.tube.setQuality(tier === "low" ? 0 : 2);

    this.world.remove(this.rain.mesh);
    this.rain.dispose();
    this.rain = new GlyphRain(this.atlas, tierParticles(tier), new THREE.Color(this.level.accent));
    this.world.add(this.rain.mesh);

    this.post.dispose();
    this.post = new PostStack(this.renderer, this.scene, this.camera, tier);
    const size = this.renderer.getSize(new THREE.Vector2());
    this.post.setSize(size.x, size.y);
  }

  dispose() {
    this.tube.dispose();
    this.entities.dispose();
    this.keyshard.dispose();
    this.trail.dispose();
    this.rain.dispose();
    this.ghostQuads.dispose();
    this.atlas.dispose();
    this.post.dispose();
    this.renderer.dispose();
  }
}

export { LEVELS };
