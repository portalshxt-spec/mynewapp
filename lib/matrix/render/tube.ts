/**
 * The Conduit.
 *
 * One mesh, one shader, one draw call. The rails and ribs are computed
 * analytically in the fragment shader rather than being separate geometry —
 * that gets us the GDD's "screen-space width floor of 1.5px so they never
 * vanish at distance" for free via fwidth, and keeps the draw-call budget
 * intact.
 *
 * The same shader carries the signature moment: above 70% Trace the skin
 * around and behind the player blends in the live telemetry log.
 */

import * as THREE from "three";
import { RAIL_HUE_SPREAD, RIB_SPACING, SLOT_COUNT, TUBE_RADIUS } from "../config";
import { makeCodeTexture, TelemetryLog } from "./textures";

const TUBE_LENGTH = 520;
/** How much tube sits behind the player, where the log is legible. */
const TUBE_BEHIND = 34;

const VERT = /* glsl */ `
varying vec2 vUv;
varying float vWorldZ;
varying float vDepth;

void main() {
  vUv = uv;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldZ = world.z;
  vec4 view = viewMatrix * world;
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const FRAG = /* glsl */ `
precision highp float;

varying vec2 vUv;
varying float vWorldZ;
varying float vDepth;

uniform sampler2D uCode;
uniform sampler2D uLog;
uniform float uScroll;
uniform float uTime;
uniform vec3 uRail;
uniform vec3 uAccent;
uniform vec3 uBg;
uniform float uFogDensity;
uniform float uTrace;
uniform float uRailSpread;
uniform float uSlots;
uniform float uRibSpacing;
uniform float uQuality;
uniform float uLogStrength;
uniform float uWhiteout;

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

/** An analytically anti-aliased line with a hard minimum screen width. */
float line(float coord, float px) {
  float f = fract(coord);
  float d = min(f, 1.0 - f);
  float w = max(fwidth(d) * px, 0.0012);
  return 1.0 - smoothstep(0.0, w, d);
}

void main() {
  // Scroll the source down the tube at the travel rate.
  float travel = vWorldZ - uScroll;

  vec3 col = uBg * 0.55;

  // ---- tube skin: scrolling source ------------------------------------
  if (uQuality > 0.5) {
    vec2 codeUv = vec2(vUv.x * 6.0, travel * 0.055);
    vec3 code = texture2D(uCode, codeUv).rgb;
    col += code * 1.25;
  }

  // ---- rails: 16 longitudinal lines, ±20° hue spread -------------------
  float railCoord = vUv.x * uSlots;
  float railMask = line(railCoord, 1.5);
  float railIndex = floor(railCoord);
  vec3 railHsv = rgb2hsv(uRail);
  // The bundle fans into colour at the vanishing point, with intent per hue.
  railHsv.x = fract(railHsv.x + ((railIndex / uSlots) - 0.5) * 2.0 * (uRailSpread / 360.0));
  vec3 railCol = hsv2rgb(railHsv);
  // Structure, not spectacle — entities have to stay the brightest things.
  col += railCol * railMask * 0.95;

  // ---- ribs every 8u, opacity falling off with distance ----------------
  float ribMask = line(travel / uRibSpacing, 1.5);
  float ribFade = 1.0 - clamp(vDepth / 260.0, 0.0, 1.0);
  col += uAccent * ribMask * 0.32 * ribFade;

  // ---- the wall writes you --------------------------------------------
  // Above 70% Trace the skin around and behind the player prints the system's
  // live log of the run. Nothing else in the game is allowed to be this loud.
  if (uLogStrength > 0.001 && vWorldZ > -8.0) {
    vec2 logUv = vec2(vUv.x * 2.0, travel * 0.02);
    vec3 logCol = texture2D(uLog, logUv).rgb;
    float nearness = smoothstep(-8.0, 12.0, vWorldZ);
    col = mix(col, col + logCol * 2.2, uLogStrength * nearness);
  }

  // ---- fog: emissive, colour = layer bg, density scales with speed -----
  float fog = 1.0 - exp(-uFogDensity * vDepth);
  col = mix(col, uBg, clamp(fog, 0.0, 1.0));

  // A traced run pushes the whole tube red before it goes white.
  col = mix(col, vec3(1.0, 0.18, 0.30), uTrace * 0.16);
  col = mix(col, vec3(1.0), uWhiteout);

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Tube {
  readonly mesh: THREE.Mesh;
  readonly log = new TelemetryLog();
  private readonly material: THREE.ShaderMaterial;
  private codeTexture: THREE.Texture;

  constructor(level: number, accent: string, rail: string, bg: string) {
    const geometry = new THREE.CylinderGeometry(
      TUBE_RADIUS,
      TUBE_RADIUS,
      TUBE_LENGTH,
      96,
      1,
      true,
    );
    geometry.rotateX(Math.PI / 2);

    this.codeTexture = makeCodeTexture(level, accent);

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: true,
      uniforms: {
        uCode: { value: this.codeTexture },
        uLog: { value: this.log.texture },
        uScroll: { value: 0 },
        uTime: { value: 0 },
        uRail: { value: new THREE.Color(rail) },
        uAccent: { value: new THREE.Color(accent) },
        uBg: { value: new THREE.Color(bg) },
        uFogDensity: { value: 0.006 },
        uTrace: { value: 0 },
        uRailSpread: { value: RAIL_HUE_SPREAD },
        uSlots: { value: SLOT_COUNT },
        uRibSpacing: { value: RIB_SPACING },
        uQuality: { value: 2 },
        uLogStrength: { value: 0 },
        uWhiteout: { value: 0 },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    // Push the tube forward so a little of it sits behind the player, which is
    // where the log is readable at the screen edges.
    this.mesh.position.z = -TUBE_LENGTH / 2 + TUBE_BEHIND;
    this.mesh.frustumCulled = false;
  }

  /** Re-theme for a new layer without rebuilding geometry. */
  setLayer(level: number, accent: string, rail: string, bg: string) {
    this.codeTexture.dispose();
    this.codeTexture = makeCodeTexture(level, accent);
    this.material.uniforms.uCode.value = this.codeTexture;
    this.material.uniforms.uAccent.value = new THREE.Color(accent);
    this.material.uniforms.uRail.value = new THREE.Color(rail);
    this.material.uniforms.uBg.value = new THREE.Color(bg);
    this.log.reset();
    this.material.uniforms.uLogStrength.value = 0;
    this.material.uniforms.uWhiteout.value = 0;
  }

  /** Root Zero cycles the rails through all nine previous palettes. */
  setRailColor(color: THREE.Color) {
    this.material.uniforms.uRail.value = color;
  }

  setQuality(tier: number) {
    this.material.uniforms.uQuality.value = tier;
  }

  setWhiteout(amount: number) {
    this.material.uniforms.uWhiteout.value = amount;
  }

  update(
    dt: number,
    state: {
      z: number;
      time: number;
      speed: number;
      trace: number;
      theta: number;
      band: string;
      logStrength: number;
    },
  ) {
    const u = this.material.uniforms;
    u.uScroll.value = state.z;
    u.uTime.value = state.time;
    u.uTrace.value = state.trace / 100;
    // Fog density scales with speed: the faster you go, the less you are given.
    u.uFogDensity.value = 0.0042 + (state.speed / 52) * 0.0055;
    u.uLogStrength.value = state.logStrength;

    if (state.logStrength > 0) {
      this.log.update(dt, {
        theta: state.theta,
        band: state.band,
        speed: state.speed,
        trace: state.trace,
        z: state.z,
      });
    }
  }

  /** At 100% the log resolves to a single identity line. */
  resolveIdentity() {
    this.log.resolve();
    this.material.uniforms.uLogStrength.value = 1;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.codeTexture.dispose();
    this.log.texture.dispose();
  }
}
