/**
 * Post stack, in the GDD's order:
 *
 *   bloom (threshold 0.75, strength scales with combo)
 *     → chromatic aberration (0 at rest, 0.004 during Overclock)
 *     → radial motion blur at the screen edges only, strength = v/52
 *     → subtle film grain
 *     → scanlines that only appear above 40% Trace
 *
 * The scanlines are a mechanic, not a mood. That's the whole trick — the CRT
 * nod is earned by being informational.
 */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAberration: { value: 0 },
    uBlur: { value: 0 },
    uGrain: { value: 0.035 },
    uScanline: { value: 0 },
    uFlash: { value: 0 },
    uWhiteout: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAberration;
    uniform float uBlur;
    uniform float uGrain;
    uniform float uScanline;
    uniform float uFlash;
    uniform float uWhiteout;
    uniform vec2 uResolution;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centre = uv - 0.5;
      float dist = length(centre);

      // ---- radial motion blur, screen edges only ----------------------
      vec3 col = vec3(0.0);
      float edge = smoothstep(0.22, 0.72, dist);
      float strength = uBlur * edge * 0.055;
      if (strength > 0.0005) {
        float total = 0.0;
        for (int i = 0; i < 6; i++) {
          float t = float(i) / 5.0;
          vec2 offset = centre * strength * t;
          float w = 1.0 - t * 0.5;
          col += texture2D(tDiffuse, uv - offset).rgb * w;
          total += w;
        }
        col /= total;
      } else {
        col = texture2D(tDiffuse, uv).rgb;
      }

      // ---- chromatic aberration ---------------------------------------
      if (uAberration > 0.00001) {
        vec2 shift = centre * uAberration * 60.0;
        col.r = texture2D(tDiffuse, uv + shift).r;
        col.b = texture2D(tDiffuse, uv - shift).b;
      }

      // ---- scanlines: informational, above 40% Trace only --------------
      if (uScanline > 0.001) {
        float lines = sin(uv.y * uResolution.y * 1.4) * 0.5 + 0.5;
        col *= 1.0 - uScanline * 0.28 * lines;
        // A slow roll so the reading feels like a live capture, not a filter.
        float roll = smoothstep(0.0, 0.02, abs(fract(uv.y + uTime * 0.08) - 0.5) - 0.48);
        col += vec3(0.35, 0.05, 0.09) * roll * uScanline * 0.5;
      }

      // ---- film grain ---------------------------------------------------
      float g = hash(uv * uResolution + fract(uTime) * 137.0) - 0.5;
      col += g * uGrain;

      // ---- hit flash and the terminal whiteout --------------------------
      col = mix(col, vec3(1.0, 0.18, 0.30), uFlash);
      col = mix(col, vec3(1.0), uWhiteout);

      // A gentle vignette so the vanishing point stays the brightest thing.
      col *= 1.0 - dist * dist * 0.35;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export type QualityTier = "low" | "medium" | "high";

export class PostStack {
  readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass | null;
  private readonly grade: ShaderPass;
  private tier: QualityTier;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    tier: QualityTier,
  ) {
    this.tier = tier;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));

    const size = renderer.getSize(new THREE.Vector2());

    if (tier === "high" || tier === "medium") {
      this.bloom = new UnrealBloomPass(size, 0.9, 0.5, 0.75);
      this.composer.addPass(this.bloom);
    } else {
      this.bloom = null;
    }

    this.grade = new ShaderPass(GRADE_SHADER);
    this.grade.uniforms.uResolution.value = size;
    if (tier === "low") {
      // Low tier must still be playable and readable, not just runnable.
      this.grade.uniforms.uGrain.value = 0;
    }
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
  }

  setSize(width: number, height: number) {
    this.composer.setSize(width, height);
    this.grade.uniforms.uResolution.value.set(width, height);
    this.bloom?.setSize(width, height);
  }

  update(state: {
    time: number;
    combo: number;
    speed: number;
    trace: number;
    overclock: boolean;
    flash: number;
    whiteout: number;
    reducedMotion: boolean;
  }) {
    const u = this.grade.uniforms;
    u.uTime.value = state.time;

    // Reduced motion kills chromatic aberration, camera roll and shake.
    // Gameplay is untouched.
    u.uAberration.value = state.reducedMotion ? 0 : state.overclock ? 0.004 : 0;
    u.uBlur.value = state.reducedMotion ? 0 : state.speed / 52;

    // Scanlines fade in at 40% Trace and are gone below it.
    u.uScanline.value = Math.max(0, Math.min(1, (state.trace - 40) / 30));
    u.uFlash.value = state.flash;
    u.uWhiteout.value = state.whiteout;

    if (this.bloom) {
      // Bloom strength scales with combo — the screen rewards the run.
      this.bloom.strength = 0.7 + (state.combo / 8) * 0.75;
    }
  }

  render(deltaSeconds: number) {
    this.composer.render(deltaSeconds);
  }

  dispose() {
    this.composer.dispose();
  }
}

/**
 * Auto-detect a quality tier from first-frame timing.
 *
 *   high   — full post stack, 2000 particles, 4x MSAA
 *   medium — bloom only, 800 particles, no MSAA
 *   low    — no post, 200 particles, rails only (no code texture on the skin)
 */
export function detectTier(frameMs: number, mobile: boolean): QualityTier {
  if (mobile && frameMs > 22) return "low";
  if (frameMs > 26) return "low";
  if (frameMs > 15) return "medium";
  return mobile ? "medium" : "high";
}

export function tierParticles(tier: QualityTier): number {
  return tier === "high" ? 2000 : tier === "medium" ? 800 : 200;
}
