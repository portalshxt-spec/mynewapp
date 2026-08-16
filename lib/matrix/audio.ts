/**
 * Adaptive audio.
 *
 * Fully synthesised, so the game ships with a real score and zero bytes of
 * audio assets. `loadStems()` is the hook for swapping in ten cuts from the
 * existing instrumental catalogue later — the adaptive mixing, tempo map and
 * SFX bus stay exactly as they are.
 *
 * Tempo tracks the speed curve: 100 × 1.1^(n-1), landing at 236 BPM at Root
 * Zero, which puts layer 7 onward squarely in drum & bass / footwork territory.
 *
 * One GDD ambiguity resolved here: §9.1 puts the locked-on sonar ping at 90%
 * Trace while §15 lists it under the 70% adaptive rule. The 40/70/90/100 ladder
 * in §9.1 is the authority, so the filter and duck land at 70% and the ping at
 * 90%.
 */

import type { EntityKind } from "./types";

const PING_TRACE = 90;
const FILTER_TRACE = 70;

/** A minor pentatonic bed — every layer shares key and harmonic bed so
 *  transitions are seamless. */
const BASS_STEPS = [0, 0, 3, 0, 5, 3, 0, -2];
const LEAD_STEPS = [12, 15, 19, 15, 17, 15, 12, 10];
const ROOT_HZ = 55; // A1

function midiToHz(semitonesFromRoot: number): number {
  return ROOT_HZ * 2 ** (semitonesFromRoot / 12);
}

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  muted: boolean;
}

export const DEFAULT_AUDIO: AudioSettings = {
  master: 0.8,
  music: 0.7,
  sfx: 0.9,
  muted: false,
};

export class MatrixAudio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private filter!: BiquadFilterNode;
  private duck!: GainNode;

  private settings: AudioSettings = { ...DEFAULT_AUDIO };
  private bpm = 100;
  private step = 0;
  private nextStepTime = 0;
  private running = false;

  private comboLayer = 0;
  private overclock = false;
  private trace = 0;
  private lastPing = 0;
  /** Pitched blip rises a semitone per combo step and resets on break. */
  private blipStep = 0;

  private stems: Map<number, AudioBuffer> = new Map();
  private stemSource: AudioBufferSourceNode | null = null;

  // -------------------------------------------------------------------------
  // Lifecycle
  // -------------------------------------------------------------------------

  /** Must be called from a user gesture. */
  async resume(): Promise<void> {
    if (!this.ctx) this.build();
    if (this.ctx && this.ctx.state === "suspended") await this.ctx.resume();
  }

  private build() {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.settings.muted ? 0 : this.settings.master;
    this.master.connect(ctx.destination);

    // Music runs through the duck and the high-pass; SFX bypass both so a hit
    // still cuts through a ducked mix.
    this.filter = ctx.createBiquadFilter();
    this.filter.type = "highpass";
    this.filter.frequency.value = 20;
    this.filter.connect(this.master);

    this.duck = ctx.createGain();
    this.duck.gain.value = 1;
    this.duck.connect(this.filter);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.settings.music;
    this.musicBus.connect(this.duck);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.settings.sfx;
    this.sfxBus.connect(this.master);
  }

  setSettings(settings: AudioSettings) {
    this.settings = settings;
    if (!this.ctx) return;
    this.master.gain.value = settings.muted ? 0 : settings.master;
    this.musicBus.gain.value = settings.music;
    this.sfxBus.gain.value = settings.sfx;
  }

  /** Optional: swap the synth bed for real cuts, one per layer. */
  async loadStems(urls: Record<number, string>) {
    if (!this.ctx) this.build();
    if (!this.ctx) return;
    for (const [level, url] of Object.entries(urls)) {
      try {
        const response = await fetch(url);
        const bytes = await response.arrayBuffer();
        this.stems.set(Number(level), await this.ctx.decodeAudioData(bytes));
      } catch {
        // A missing stem just falls back to the synth bed for that layer.
      }
    }
  }

  startLayer(level: number, bpm: number) {
    this.bpm = bpm;
    this.step = 0;
    this.blipStep = 0;
    this.running = true;
    if (!this.ctx) return;
    this.nextStepTime = this.ctx.currentTime + 0.05;

    this.stemSource?.stop();
    this.stemSource = null;
    const buffer = this.stems.get(level);
    if (buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(this.musicBus);
      source.start();
      this.stemSource = source;
    }
  }

  stop() {
    this.running = false;
    this.stemSource?.stop();
    this.stemSource = null;
  }

  // -------------------------------------------------------------------------
  // Adaptive mix
  // -------------------------------------------------------------------------

  setState(state: { trace: number; combo: number; overclock: boolean }) {
    this.trace = state.trace;
    this.overclock = state.overclock;
    // A melodic layer at ×4 and another at ×8. Losing the combo loses the
    // layer — the player hears their own performance.
    this.comboLayer = state.combo >= 8 ? 2 : state.combo >= 4 ? 1 : 0;

    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Overclock opens the filter fully; high Trace clamps it to 400Hz.
    const traced = this.trace >= FILTER_TRACE && !this.overclock;
    this.filter.frequency.setTargetAtTime(traced ? 400 : 20, now, 0.08);
    // −4dB duck ≈ 0.63 linear.
    this.duck.gain.setTargetAtTime(traced ? 0.63 : 1, now, 0.12);
  }

  /** Drive the step scheduler from the game loop. */
  tick() {
    if (!this.ctx || !this.running) return;
    const now = this.ctx.currentTime;

    // Sonar ping every 0.6s once the system has you.
    if (this.trace >= PING_TRACE && now - this.lastPing > 0.6) {
      this.lastPing = now;
      this.ping();
    }

    // A step is a 16th note.
    const stepDuration = 60 / this.bpm / 4;
    while (this.nextStepTime < now + 0.12) {
      if (!this.stemSource) this.scheduleStep(this.step, this.nextStepTime, stepDuration);
      this.step = (this.step + 1) % 16;
      this.nextStepTime += stepDuration;
    }
  }

  private scheduleStep(step: number, time: number, duration: number) {
    const ctx = this.ctx!;
    const bar = step % 8;

    // Kick on the quarter.
    if (step % 4 === 0) this.drum(time, 52, 0.16, 0.9, "sine");
    // Snare on the backbeat.
    if (step === 4 || step === 12) this.noise(time, 0.12, 0.35, 1800);
    // Hats on the eighth, doubled during Overclock.
    if (step % 2 === 0) this.noise(time, 0.035, 0.12, 7000);
    if (this.overclock) this.noise(time + duration / 2, 0.03, 0.1, 9000);

    // Bass bed.
    if (step % 2 === 0) {
      this.tone(time, midiToHz(BASS_STEPS[bar]), duration * 1.8, 0.22, "sawtooth", 240);
    }

    // Melodic layers earned by the combo.
    if (this.comboLayer >= 1 && step % 4 === 2) {
      this.tone(time, midiToHz(LEAD_STEPS[bar] + 12), duration * 2, 0.09, "square", 2200);
    }
    if (this.comboLayer >= 2 && step % 2 === 1) {
      this.tone(time, midiToHz(LEAD_STEPS[(bar + 2) % 8] + 24), duration * 1.2, 0.06, "triangle", 3600);
    }
  }

  // -------------------------------------------------------------------------
  // Voices
  // -------------------------------------------------------------------------

  private tone(
    time: number,
    freq: number,
    duration: number,
    gain: number,
    type: OscillatorType,
    cutoff: number,
    bus: GainNode = this.musicBus,
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(lp).connect(env).connect(bus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private drum(time: number, freq: number, duration: number, gain: number, type: OscillatorType) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * 2.4, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.6, time + duration);
    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(env).connect(this.musicBus);
    osc.start(time);
    osc.stop(time + duration + 0.02);
  }

  private noiseBuffer(duration: number): AudioBuffer {
    const ctx = this.ctx!;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private noise(
    time: number,
    duration: number,
    gain: number,
    cutoff: number,
    bus: GainNode = this.musicBus,
    reversed = false,
  ) {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer(duration);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = cutoff;
    const env = ctx.createGain();
    if (reversed) {
      // A reversed cymbal: swell in, then cut.
      env.gain.setValueAtTime(0.0001, time);
      env.gain.exponentialRampToValueAtTime(gain, time + duration * 0.92);
      env.gain.linearRampToValueAtTime(0, time + duration);
    } else {
      env.gain.setValueAtTime(gain, time);
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    }
    source.connect(hp).connect(env).connect(bus);
    source.start(time);
  }

  // -------------------------------------------------------------------------
  // SFX — short, dry, no reverb tails. Reverb reads as sluggish at speed.
  // -------------------------------------------------------------------------

  private get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  packet() {
    if (!this.ctx) return;
    // Rises a semitone per combo step.
    const freq = 660 * 2 ** (this.blipStep / 12);
    this.blipStep = Math.min(24, this.blipStep + 1);
    this.tone(this.now, freq, 0.08, 0.3, "square", 6000, this.sfxBus);
  }

  resetBlip() {
    this.blipStep = 0;
  }

  mote() {
    if (!this.ctx) return;
    this.tone(this.now, 1200, 0.06, 0.18, "triangle", 8000, this.sfxBus);
  }

  /** Sub hit + reversed cymbal. Played backwards, this is the honeypot. */
  zeroday(reversed = false) {
    if (!this.ctx) return;
    const t = this.now;
    if (reversed) {
      this.noise(t, 0.34, 0.28, 2600, this.sfxBus, false);
      this.drum(t + 0.3, 44, 0.3, 0.5, "sine");
    } else {
      this.drum(t, 44, 0.3, 0.6, "sine");
      this.noise(t + 0.02, 0.34, 0.3, 2600, this.sfxBus, true);
    }
  }

  graze(side: number) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-1, Math.min(1, side));
    pan.connect(this.sfxBus);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    gain.connect(pan);
    this.noise(this.now, 0.14, 0.16, 2400, gain);
  }

  minorHit() {
    if (!this.ctx) return;
    // Clipped noise burst, 80ms.
    this.noise(this.now, 0.08, 0.42, 900, this.sfxBus);
  }

  majorHit() {
    if (!this.ctx) return;
    // Sub drop — the 120ms hitstop is audible too, as the silence after it.
    const t = this.now;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.26);
    env.gain.setValueAtTime(0.7, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(env).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.32);
    this.duckFor(0.12);
  }

  private duckFor(seconds: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.duck.gain.cancelScheduledValues(t);
    this.duck.gain.setValueAtTime(0, t);
    this.duck.gain.setValueAtTime(0, t + seconds);
    this.duck.gain.linearRampToValueAtTime(1, t + seconds + 0.08);
  }

  overclockCue() {
    if (!this.ctx) return;
    const t = this.now;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(1400, t + 0.22);
    env.gain.setValueAtTime(0.25, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(env).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.27);
  }

  /** Rising pitch sweep matching the +10% step. */
  layerClear() {
    if (!this.ctx) return;
    const t = this.now;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(330 * 1.1, t + 0.5);
    env.gain.setValueAtTime(0.28, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(env).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.62);
  }

  private ping() {
    if (!this.ctx) return;
    this.tone(this.now, 1760, 0.16, 0.2, "sine", 9000, this.sfxBus);
  }

  /**
   * Distinct pre-warning cue 0.8s before a major hazard becomes actionable.
   * Play the game with your eyes shut and you should survive ten seconds.
   */
  warn(kind: EntityKind) {
    if (!this.ctx) return;
    const pitches: Partial<Record<EntityKind, number>> = {
      firewall: 392,
      ids: 466,
      hashwall: 294,
      ice: 622,
      nullvoid: 196,
      race: 523,
      logicbomb: 349,
      gc: 147,
      honeypot: 740,
    };
    const freq = pitches[kind] ?? 440;
    this.tone(this.now, freq, 0.12, 0.16, "sine", 5000, this.sfxBus);
  }

  dispose() {
    this.stop();
    this.ctx?.close();
    this.ctx = null;
  }
}
