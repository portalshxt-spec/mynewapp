/**
 * Run controller.
 *
 * Owns the frame loop, the phase machine, and the wiring between simulation,
 * scene and audio. React talks to this through a small snapshot callback and
 * never reaches into the simulation directly.
 */

import { MatrixAudio } from "./audio";
import {
  COPY,
  HIT_FLASH,
  LEVELS,
  RESTART_TIME,
  TRANSITION_TIME,
  layerClearLine,
  levelSpeed,
} from "./config";
import { generateLayer } from "./generator";
import { InputManager } from "./input";
import {
  GHOST_SAMPLE_INTERVAL,
  ghostFor,
  load,
  recordLayer,
  recordRun,
  type GhostSample,
  type Settings,
} from "./persistence";
import { MatrixScene } from "./render/scene";
import { detectTier, type QualityTier } from "./render/post";
import { Rng, layerSeed, randomSeed } from "./rng";
import { Simulation } from "./sim";
import type { HudSnapshot, LevelConfig, RunPhase } from "./types";

/** Fixed simulation step. Small enough that the swept tests never stretch. */
const FIXED_STEP = 1 / 120;
const MAX_SUBSTEPS = 8;
/** HUD updates at 20Hz; the bar animates in CSS between pushes. */
const HUD_INTERVAL = 0.05;

export interface GameCallbacks {
  onHud: (snapshot: HudSnapshot) => void;
  onPauseToggle: (paused: boolean) => void;
}

/** Assist mode caps the speed step; everything else about a layer is unchanged. */
function configureLevel(level: LevelConfig, assist: boolean): LevelConfig {
  if (!assist) return level;
  return { ...level, speed: levelSpeed(level.n, true) };
}

export class MatrixGame {
  private readonly scene: MatrixScene;
  private readonly input: InputManager;
  private readonly audio = new MatrixAudio();
  private readonly callbacks: GameCallbacks;

  private settings: Settings;
  private tier: QualityTier;

  private phase: RunPhase = "title";
  private level: LevelConfig;
  private sim: Simulation | null = null;
  private runSeed = randomSeed();

  private raf = 0;
  private lastFrame = 0;
  private accumulator = 0;
  private hudTimer = 0;
  private phaseTimer = 0;
  private flash = 0;
  private whiteout = 0;
  private constrict = 0;
  private banner = "";
  private message: string = COPY.start;
  private paused = false;
  private disposed = false;
  private running = false;

  private ghostRecord: GhostSample[] = [];
  private ghostTimer = 0;

  private carried = { trace: 0, cycles: 0, score: 0, certCharges: 0 };
  private probeFrames = 0;
  private probeTotal = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.callbacks = callbacks;
    const data = load();
    this.settings = data.settings;

    const mobile = typeof navigator !== "undefined" && /Mobi|Android/i.test(navigator.userAgent);
    this.tier = this.settings.quality ?? (mobile ? "medium" : "high");

    this.level = configureLevel(LEVELS[0], this.settings.assist);
    this.scene = new MatrixScene(canvas, this.level, this.tier);
    this.input = new InputManager(canvas, this.settings.bindings);
    this.input.onPause = () => this.togglePause();

    this.audio.setSettings(this.settings.audio);
    this.resize();
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  resize() {
    const canvas = this.scene.renderer.domElement;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    this.scene.setSize(width, height);
  }

  applySettings(settings: Settings) {
    this.settings = settings;
    this.input.setBindings(settings.bindings);
    this.audio.setSettings(settings.audio);
    if (settings.quality && settings.quality !== this.tier) {
      this.tier = settings.quality;
      this.scene.setTier(this.tier);
    }
    if (this.sim) {
      // Assist changes speed, so rebuild the layer config in place.
      this.level = configureLevel(LEVELS[this.level.n - 1], settings.assist);
    }
    this.scene.setGhost(settings.showGhost ? ghostFor(this.level.n) : null);
  }

  /**
   * Bring the scene up behind the title card. The tube renders and the rain
   * moves, but nothing is simulated until the player injects.
   */
  mount() {
    this.beginLayer(1);
    this.phase = "title";
    this.message = COPY.compileStamp;
    this.pushHud(true);
    if (!this.running) {
      this.running = true;
      this.loop();
    }
  }

  /** Begin a fresh run. Must be called from a user gesture so audio can start. */
  async start(fromLevel = 1) {
    await this.audio.resume();
    this.runSeed = randomSeed();
    this.carried = { trace: 0, cycles: 0, score: 0, certCharges: 0 };
    this.beginLayer(fromLevel);
    if (!this.running) {
      this.running = true;
      this.loop();
    }
  }

  /** Instant layer restart — under 400ms, no loading screen, the tube re-seeds. */
  restartLayer() {
    if (!this.sim) return;
    this.carried = { trace: 0, cycles: 0, score: this.carried.score, certCharges: 0 };
    this.beginLayer(this.level.n);
  }

  /** Restart the whole run from layer 1. */
  async recompile() {
    this.runSeed = randomSeed();
    this.carried = { trace: 0, cycles: 0, score: 0, certCharges: 0 };
    await this.audio.resume();
    this.beginLayer(1);
  }

  togglePause() {
    if (this.phase === "title") return;
    this.paused = !this.paused;
    this.callbacks.onPauseToggle(this.paused);
    if (this.paused) this.audio.stop();
    else this.audio.startLayer(this.level.n, this.level.bpm);
  }

  setPaused(paused: boolean) {
    if (this.paused !== paused) this.togglePause();
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.audio.dispose();
    this.scene.dispose();
  }

  // -------------------------------------------------------------------------
  // Phase machine
  // -------------------------------------------------------------------------

  private beginLayer(n: number) {
    const config = configureLevel(LEVELS[n - 1], this.settings.assist);
    this.level = config;

    const rng = new Rng(layerSeed(this.runSeed, n));
    const plan = generateLayer(n, config.speed, config.duration, rng);

    this.sim = new Simulation(config, plan, { assist: this.settings.assist });
    this.sim.seed(this.carried);

    this.scene.setLevel(config);
    this.scene.setGhost(this.settings.showGhost ? ghostFor(n) : null);

    this.ghostRecord = [];
    this.ghostTimer = 0;

    this.phase = "playing";
    this.phaseTimer = 0;
    this.constrict = 0;
    this.whiteout = 0;
    this.banner = "";
    this.message = n === 1 ? COPY.start : "";

    this.audio.resetBlip();
    this.audio.startLayer(n, config.bpm);
    this.pushHud(true);
  }

  private finishLayer() {
    const sim = this.sim!;
    recordLayer(this.level.n, sim.score, this.ghostRecord);
    this.carried = sim.carry();

    if (this.level.n >= LEVELS.length) {
      this.phase = "root";
      this.phaseTimer = 0;
      this.message = COPY.root;
      recordRun(sim.score);
      this.audio.layerClear();
      this.audio.stop();
      this.pushHud(true);
      return;
    }

    this.phase = "transition";
    this.phaseTimer = 0;
    this.banner = layerClearLine(this.level.n);
    this.audio.layerClear();
    this.pushHud(true);
  }

  private fail() {
    const sim = this.sim!;
    this.phase = "traced";
    this.phaseTimer = 0;
    this.message = COPY.traced;
    recordLayer(this.level.n, sim.score, this.ghostRecord);
    recordRun(sim.score);
    this.audio.stop();
    this.pushHud(true);
  }

  // -------------------------------------------------------------------------
  // Frame loop
  // -------------------------------------------------------------------------

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);

    const now = performance.now();
    const rawDt = this.lastFrame ? (now - this.lastFrame) / 1000 : 1 / 60;
    this.lastFrame = now;
    const dt = Math.min(0.05, rawDt);

    // Quality tiers auto-detect from first-frame timing.
    if (this.probeFrames < 30 && this.settings.quality == null) {
      this.probeFrames++;
      this.probeTotal += rawDt * 1000;
      if (this.probeFrames === 30) {
        const mobile = /Mobi|Android/i.test(navigator.userAgent);
        const detected = detectTier(this.probeTotal / 30, mobile);
        if (detected !== this.tier) {
          this.tier = detected;
          this.scene.setTier(detected);
        }
      }
    }

    if (!this.paused) this.update(dt);
    this.draw(dt);
  };

  private update(dt: number) {
    const sim = this.sim;
    if (!sim) return;

    this.phaseTimer += dt;
    this.flash = Math.max(0, this.flash - dt / HIT_FLASH);

    if (this.phase === "playing") {
      const input = this.input.sample();
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= FIXED_STEP && steps < MAX_SUBSTEPS) {
        sim.step(FIXED_STEP, input);
        this.accumulator -= FIXED_STEP;
        steps++;
        if (sim.finished) break;
      }
      if (steps === MAX_SUBSTEPS) this.accumulator = 0;

      this.recordGhost(dt);
      this.consumeEvents();

      this.audio.setState({
        trace: sim.trace,
        combo: sim.combo,
        overclock: sim.overclocking,
      });
      this.audio.tick();

      if (sim.finished) {
        if (sim.traced) this.fail();
        else this.finishLayer();
      }
    } else if (this.phase === "transition") {
      // The tube constricts to the vanishing point, a backdoor glyph resolves,
      // the speed multiplier ticks up. No menu, no button press.
      const t = Math.min(1, this.phaseTimer / TRANSITION_TIME);
      this.constrict = Math.sin(t * Math.PI);
      if (this.phaseTimer >= TRANSITION_TIME) {
        this.beginLayer(this.level.n + 1);
      }
    } else if (this.phase === "traced") {
      // The wall resolves your identity and the tube goes white.
      this.whiteout = Math.min(1, this.phaseTimer / 0.9);
    }

    this.hudTimer += dt;
    if (this.hudTimer >= HUD_INTERVAL) {
      this.hudTimer = 0;
      this.pushHud(false);
    }
  }

  private draw(dt: number) {
    const sim = this.sim;
    if (!sim) return;
    this.scene.render(dt, sim, {
      flash: this.flash,
      whiteout: this.whiteout,
      reducedMotion: this.settings.reducedMotion,
      constrict: this.constrict,
    });
  }

  private recordGhost(dt: number) {
    const sim = this.sim!;
    this.ghostTimer += dt;
    if (this.ghostTimer < GHOST_SAMPLE_INTERVAL) return;
    this.ghostTimer = 0;
    this.ghostRecord.push({
      z: Math.round(sim.z * 100) / 100,
      theta: Math.round(sim.theta * 1000) / 1000,
      radius: Math.round(sim.radius * 100) / 100,
    });
  }

  private consumeEvents() {
    const sim = this.sim!;
    for (const event of sim.drainEvents()) {
      switch (event.type) {
        case "collect":
          if (event.kind === "packet") this.audio.packet();
          else if (event.kind === "mote") this.audio.mote();
          else if (event.kind === "zeroday") this.audio.zeroday(false);
          else this.audio.mote();
          break;

        case "hit":
          this.flash = 1;
          this.scene.onHit();
          // The honeypot's tell is the zero-day sound played backwards.
          if (event.kind === "honeypot") this.audio.zeroday(true);
          else if (event.major) this.audio.majorHit();
          else this.audio.minorHit();
          break;

        case "absorb":
          this.audio.mote();
          this.message = "CERT SPENT";
          break;

        case "graze":
          this.audio.graze(sim.omega > 0 ? 0.7 : -0.7);
          break;

        case "combo-break":
          this.audio.resetBlip();
          break;

        case "overclock":
          this.audio.overclockCue();
          break;

        case "warn":
          this.audio.warn(event.kind);
          break;

        case "perfect-chunk":
          this.audio.mote();
          break;

        case "backdoor":
          this.message = "BACKDOOR OPEN — LAYER TRUNCATED";
          break;

        default:
          break;
      }
    }
  }

  private pushHud(force: boolean) {
    const sim = this.sim;
    if (!sim && !force) return;
    const snapshot: HudSnapshot = {
      phase: this.phase,
      level: this.level.n,
      levelName: this.level.subtitle
        ? `${this.level.name} · ${this.level.subtitle}`
        : this.level.name,
      accent: this.level.accent,
      trace: sim ? sim.trace : 0,
      cycles: sim ? sim.cycles : 0,
      score: sim ? sim.score : 0,
      combo: sim ? sim.combo : 1,
      speed: sim ? sim.speed : this.level.speed,
      layerProgress: sim ? sim.progress : 0,
      overclock: sim ? sim.overclocking : false,
      certCharges: sim ? sim.certCharges : 0,
      message: this.message,
      banner: this.phase === "transition" ? this.banner : "",
    };
    this.callbacks.onHud(snapshot);
  }
}

export { LEVELS, COPY, RESTART_TIME };
