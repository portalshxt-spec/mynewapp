/**
 * The Keyshard — the player avatar.
 *
 * Not a character, not a ship, not a vehicle. A credential in motion: a
 * hovering, self-rotating shard of light shaped like a physical key crossed
 * with a text caret.
 *
 * Canon note: *miftach* (𐤇𐤕𐤐𐤌) is the Hebrew word for key, and the Character
 * Bible locks MIFTACH as "The Key; the one who unlocks", with an encrypted key
 * vault and a universal hardline access key among his systems. The avatar is
 * built to read as a key on purpose — the title and the object on screen say
 * the same thing.
 *
 * Reads at a glance: bright white-cyan arrowhead with a dark segmented tail.
 * That silhouette has to survive being 14 pixels tall on a phone.
 */

import * as THREE from "three";
import { GLYPH_COLS, GLYPH_ROWS, makeGlyphAtlas, makeHexTexture } from "./textures";
import { TUBE_RADIUS } from "../config";

/** Traced red. Reserved: it appears nowhere else in the game. */
export const TRACED_RED = 0xff2e4d;
const CLEAN_CORE = 0xffffff;
const CLEAN_RIM = 0x7df6ff;

// ---------------------------------------------------------------------------
// Instanced glyph billboards — shared by the trail, the bow, and the rain
// ---------------------------------------------------------------------------

const GLYPH_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec3 aParams;   // glyph index, size, alpha

varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;

uniform vec2 uAtlas;      // cols, rows

void main() {
  float index = aParams.x;
  float col = mod(index, uAtlas.x);
  float row = floor(index / uAtlas.x);
  vUv = (uv + vec2(col, row)) / uAtlas;

  vColor = aColor;
  vAlpha = aParams.z;

  vec4 centre = modelViewMatrix * vec4(aOffset, 1.0);
  centre.xy += position.xy * aParams.y;
  gl_Position = projectionMatrix * centre;
}
`;

const GLYPH_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
uniform sampler2D uAtlasMap;

void main() {
  float mask = texture2D(uAtlasMap, vUv).a;
  if (mask * vAlpha < 0.02) discard;
  gl_FragColor = vec4(vColor * mask, mask * vAlpha);
}
`;

export class GlyphQuads {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly offset: Float32Array;
  private readonly color: Float32Array;
  private readonly params: Float32Array;
  private readonly max: number;
  private count = 0;

  constructor(max: number, atlas: THREE.Texture) {
    this.max = max;
    const base = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.attributes.position = base.attributes.position;
    this.geometry.attributes.uv = base.attributes.uv;

    this.offset = new Float32Array(max * 3);
    this.color = new Float32Array(max * 3);
    this.params = new Float32Array(max * 3);
    this.geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(this.offset, 3));
    this.geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(this.color, 3));
    this.geometry.setAttribute("aParams", new THREE.InstancedBufferAttribute(this.params, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: GLYPH_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uAtlasMap: { value: atlas },
        uAtlas: { value: new THREE.Vector2(GLYPH_COLS, GLYPH_ROWS) },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
  }

  begin() {
    this.count = 0;
  }

  push(x: number, y: number, z: number, glyph: number, size: number, alpha: number, color: THREE.Color) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.offset[i * 3] = x;
    this.offset[i * 3 + 1] = y;
    this.offset[i * 3 + 2] = z;
    this.color[i * 3] = color.r;
    this.color[i * 3 + 1] = color.g;
    this.color[i * 3 + 2] = color.b;
    this.params[i * 3] = glyph;
    this.params[i * 3 + 1] = size;
    this.params[i * 3 + 2] = alpha;
  }

  end() {
    this.geometry.instanceCount = this.count;
    for (const name of ["aOffset", "aColor", "aParams"]) {
      (this.geometry.attributes[name] as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------
// The blade — a hexagonal prism that fractures on hit and ghosts on Overclock
// ---------------------------------------------------------------------------

const BLADE_VERT = /* glsl */ `
attribute float aAngle;    // which of the six faces
attribute vec3 aParams;    // radius, ghost z offset, alpha

varying vec2 vUv;
varying float vAlpha;
varying float vGhost;

uniform float uSpin;

void main() {
  vUv = uv;
  vAlpha = aParams.z;
  vGhost = abs(aParams.y);

  float ang = aAngle + uSpin;
  float r = aParams.x;
  vec3 centre = vec3(sin(ang) * r, cos(ang) * r, aParams.y);
  vec3 outward = vec3(sin(ang), cos(ang), 0.0);
  vec3 tangent = vec3(cos(ang), -sin(ang), 0.0);
  vec3 axis = vec3(0.0, 0.0, 1.0);

  vec3 p = centre + tangent * position.x + axis * position.y;

  vec4 view = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * view;
}
`;

const BLADE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vAlpha;
varying float vGhost;

uniform sampler2D uHex;
uniform float uScroll;
uniform vec3 uCore;

void main() {
  // Faces render live scrolling hex bytes that change every frame.
  vec3 hex = texture2D(uHex, vec2(vUv.x, vUv.y * 0.6 - uScroll)).rgb;
  vec3 col = mix(hex * 1.4, uCore, 0.45);
  // Overclock ghosts split chromatically away from the real blade.
  col.r += vGhost * 0.35;
  col.b += vGhost * 0.2;
  gl_FragColor = vec4(col, vAlpha);
}
`;

const BLADE_FACES = 6;
const BLADE_GHOSTS = 3;
const BLADE_INSTANCES = BLADE_FACES * BLADE_GHOSTS;
/**
 * Kept deliberately small. The camera sits 2.2u back, so every 0.1u here is
 * roughly 25px of screen at 800p — the avatar has to read as a bright
 * arrowhead with a dark segmented tail, not fill the lower third.
 */
const BLADE_RADIUS = 0.15;
const BLADE_LENGTH = 0.52;
const BOW_RADIUS = 0.22;
const BOW_GLYPH_SIZE = 0.06;

export class Keyshard {
  readonly group = new THREE.Group();

  private readonly bit: THREE.Mesh;
  private readonly bitMaterial: THREE.MeshBasicMaterial;
  private readonly bladeGeometry: THREE.InstancedBufferGeometry;
  private readonly bladeMaterial: THREE.ShaderMaterial;
  private readonly bladeParams = new Float32Array(BLADE_INSTANCES * 3);
  private readonly bow: GlyphQuads;
  private readonly hexTexture: THREE.Texture;

  private spin = 0;
  private bowLag = 0;
  private bowVel = 0;
  private bowPhase = 0;
  private fracture = 0;

  constructor(atlas: THREE.Texture) {
    // ---- Bit: a hard caret wedge, opaque white-hot core ------------------
    const bitGeometry = new THREE.ConeGeometry(0.13, 0.62, 4);
    // Point it along velocity, which is -Z.
    bitGeometry.rotateX(-Math.PI / 2);
    bitGeometry.translate(0, 0, -0.46);
    this.bitMaterial = new THREE.MeshBasicMaterial({ color: CLEAN_CORE });
    this.bit = new THREE.Mesh(bitGeometry, this.bitMaterial);
    this.group.add(this.bit);

    // ---- Blade: hexagonal prism of six faces -----------------------------
    const side = 2 * BLADE_RADIUS * Math.tan(Math.PI / BLADE_FACES);
    const plate = new THREE.PlaneGeometry(side * 1.02, BLADE_LENGTH);
    this.bladeGeometry = new THREE.InstancedBufferGeometry();
    this.bladeGeometry.index = plate.index;
    this.bladeGeometry.attributes.position = plate.attributes.position;
    this.bladeGeometry.attributes.uv = plate.attributes.uv;

    const angles = new Float32Array(BLADE_INSTANCES);
    for (let g = 0; g < BLADE_GHOSTS; g++) {
      for (let f = 0; f < BLADE_FACES; f++) {
        angles[g * BLADE_FACES + f] = (f / BLADE_FACES) * Math.PI * 2;
      }
    }
    this.bladeGeometry.setAttribute("aAngle", new THREE.InstancedBufferAttribute(angles, 1));
    this.bladeGeometry.setAttribute(
      "aParams",
      new THREE.InstancedBufferAttribute(this.bladeParams, 3),
    );

    this.hexTexture = makeHexTexture();
    this.bladeMaterial = new THREE.ShaderMaterial({
      vertexShader: BLADE_VERT,
      fragmentShader: BLADE_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uHex: { value: this.hexTexture },
        uScroll: { value: 0 },
        uSpin: { value: 0 },
        uCore: { value: new THREE.Color(CLEAN_RIM) },
      },
    });
    const bladeMesh = new THREE.Mesh(this.bladeGeometry, this.bladeMaterial);
    bladeMesh.frustumCulled = false;
    this.group.add(bladeMesh);

    // ---- Bow: an open ring of 8 orbiting glyph particles ------------------
    this.bow = new GlyphQuads(8, atlas);
    this.group.add(this.bow.mesh);
  }

  /** Called on any Trace-raising hit: the blade fractures and reassembles. */
  onHit() {
    this.fracture = 1;
  }

  update(state: {
    dt: number;
    time: number;
    speed: number;
    omega: number;
    lean: number;
    trace: number;
    overclock: boolean;
  }) {
    const { dt, time, speed, omega, lean, trace, overclock } = state;

    // Slow axial spin, 90°/s, scaling with speed.
    this.spin += (Math.PI / 2) * (speed / 22) * dt;
    this.bladeMaterial.uniforms.uSpin.value = this.spin;
    this.bladeMaterial.uniforms.uScroll.value = time * 1.6;

    // Above 60% Trace the core shifts to the reserved red.
    const traced = trace > 60;
    const core = new THREE.Color(traced ? TRACED_RED : CLEAN_RIM);
    this.bladeMaterial.uniforms.uCore.value = core;
    this.bitMaterial.color.set(traced ? TRACED_RED : CLEAN_CORE);

    // The bit points along velocity and leans into turns, up to 28°.
    this.group.rotation.z = -lean * (Math.PI / 180);

    // Fracture recovery.
    if (this.fracture > 0) this.fracture = Math.max(0, this.fracture - dt / 0.32);
    const push = this.fracture * 0.34;

    for (let g = 0; g < BLADE_GHOSTS; g++) {
      // Overclock unfolds the blade into three parallel ghosts.
      const isGhost = g > 0;
      const alpha = isGhost ? (overclock ? 0.42 : 0) : 1;
      const zOffset = isGhost ? (g === 1 ? 0.3 : -0.3) : 0;
      for (let f = 0; f < BLADE_FACES; f++) {
        const i = (g * BLADE_FACES + f) * 3;
        this.bladeParams[i] = BLADE_RADIUS + push;
        this.bladeParams[i + 1] = zOffset;
        this.bladeParams[i + 2] = alpha;
      }
    }
    (this.bladeGeometry.attributes.aParams as THREE.InstancedBufferAttribute).needsUpdate = true;

    // The bow lags behind the blade with spring damping. This is what sells
    // the speed more than anything else on the avatar.
    const target = -omega * 0.09;
    const stiffness = 90;
    const damping = 12;
    this.bowVel += (target - this.bowLag) * stiffness * dt - this.bowVel * damping * dt;
    this.bowLag += this.bowVel * dt;
    this.bowPhase += dt * 2.2;

    this.bow.begin();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.bowPhase + this.bowLag;
      this.bow.push(
        Math.sin(a) * BOW_RADIUS,
        Math.cos(a) * BOW_RADIUS,
        0.4,
        (i * 5 + Math.floor(time * 9)) % (GLYPH_COLS * GLYPH_ROWS),
        BOW_GLYPH_SIZE,
        0.8,
        core,
      );
    }
    this.bow.end();
  }

  dispose() {
    this.bit.geometry.dispose();
    this.bitMaterial.dispose();
    this.bladeGeometry.dispose();
    this.bladeMaterial.dispose();
    this.hexTexture.dispose();
    this.bow.dispose();
  }
}

// ---------------------------------------------------------------------------
// The trail — 24 samples of past positions, rendered as a hash string
// ---------------------------------------------------------------------------

const TRAIL_MAX = 48;

/**
 * The trail's *angles* are the informative part — a turn leaves an arc of past
 * positions curving away around the tube. Its depth is not: 0.8s of history at
 * 22 m/s is 17.6u, and the camera sits only 2.2u back, so a physically-placed
 * ribbon would render entirely behind the near plane.
 *
 * So depth is compressed into the gap between the bow and the camera while
 * theta and radius stay true. The read is identical and it is actually visible.
 */
const TRAIL_NEAR = 0.5;
const TRAIL_FAR = 1.85;

export class Trail {
  readonly quads: GlyphQuads;

  constructor(atlas: THREE.Texture) {
    this.quads = new GlyphQuads(TRAIL_MAX, atlas);
  }

  /**
   * The characters are the last 24 coordinate hashes. Above 60% Trace they stop
   * being hashes and start being *your* coordinates.
   */
  update(
    samples: Array<{ theta: number; radius: number; z: number }>,
    playerTheta: number,
    playerZ: number,
    trace: number,
    overclock: boolean,
  ) {
    const traced = trace > 60;
    const color = new THREE.Color(traced ? TRACED_RED : CLEAN_RIM);
    // Overclock doubles the trail length.
    const limit = Math.min(samples.length, overclock ? TRAIL_MAX : 24);

    this.quads.begin();
    for (let i = 0; i < limit; i++) {
      const s = samples[Math.min(i, samples.length - 1)];
      // Undo the world rotation: the trail lives beside the Keyshard, outside
      // the rotating world group.
      const alpha = playerTheta - s.theta - Math.PI / 2;
      const x = Math.cos(alpha) * s.radius;
      const y = Math.sin(alpha) * s.radius;
      const z = TRAIL_NEAR + (i / limit) * (TRAIL_FAR - TRAIL_NEAR);

      const glyph = traced
        ? Math.floor(Math.abs(s.theta * 57.29 + s.z) ) % (GLYPH_COLS * GLYPH_ROWS)
        : hashGlyph(s.theta, s.radius, s.z);

      // Fades over 0.8s and goes red as Trace rises.
      const fade = 1 - i / limit;
      this.quads.push(x, y, z, glyph, 0.055 * fade + 0.02, fade * 0.55, color);
    }
    this.quads.end();
  }

  dispose() {
    this.quads.dispose();
  }
}

function hashGlyph(theta: number, radius: number, z: number): number {
  const h = Math.imul(Math.floor(theta * 1000) ^ Math.floor(radius * 100), 0x9e3779b1) ^
    Math.floor(z * 10);
  return Math.abs(h) % (GLYPH_COLS * GLYPH_ROWS);
}

// ---------------------------------------------------------------------------
// Glyph rain at the horizon plane
// ---------------------------------------------------------------------------

const RAIN_VERT = /* glsl */ `
attribute vec3 aSeed;      // x: angle, y: radius, z: z offset
attribute vec2 aParams;    // glyph, fall speed

varying vec2 vUv;
varying float vAlpha;

uniform vec2 uAtlas;
uniform float uTime;
uniform float uScroll;
uniform float uSpan;
uniform float uSize;

void main() {
  float index = aParams.x;
  float col = mod(index, uAtlas.x);
  float row = floor(index / uAtlas.x);
  vUv = (uv + vec2(col, row)) / uAtlas;

  // Fall around the tube while the whole field scrolls toward the player.
  float ang = aSeed.x - uTime * aParams.y * 0.12;
  float r = aSeed.y;
  float z = -uSpan + mod(aSeed.z + uScroll * 0.6, uSpan);

  vec3 p = vec3(sin(ang) * r, cos(ang) * r, z);
  vec4 centre = modelViewMatrix * vec4(p, 1.0);
  centre.xy += position.xy * uSize;

  // Fades in at the horizon and out as it reaches the player.
  vAlpha = smoothstep(0.0, 40.0, -z) * (1.0 - smoothstep(uSpan * 0.75, uSpan, -z));
  gl_Position = projectionMatrix * centre;
}
`;

const RAIN_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying float vAlpha;
uniform sampler2D uAtlasMap;
uniform vec3 uColor;

void main() {
  float mask = texture2D(uAtlasMap, vUv).a;
  float a = mask * vAlpha * 0.55;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor * mask, a);
}
`;

export class GlyphRain {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;

  constructor(atlas: THREE.Texture, count: number, accent: THREE.Color) {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.attributes.position = base.attributes.position;
    this.geometry.attributes.uv = base.attributes.uv;

    const seed = new Float32Array(count * 3);
    const params = new Float32Array(count * 2);
    const span = 260;
    for (let i = 0; i < count; i++) {
      seed[i * 3] = Math.random() * Math.PI * 2;
      seed[i * 3 + 1] = 1.2 + Math.random() * (TUBE_RADIUS - 1.4);
      seed[i * 3 + 2] = Math.random() * span;
      params[i * 2] = Math.floor(Math.random() * GLYPH_COLS * GLYPH_ROWS);
      params[i * 2 + 1] = 0.4 + Math.random() * 1.6;
    }
    this.geometry.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seed, 3));
    this.geometry.setAttribute("aParams", new THREE.InstancedBufferAttribute(params, 2));
    this.geometry.instanceCount = count;

    this.material = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uAtlasMap: { value: atlas },
        uAtlas: { value: new THREE.Vector2(GLYPH_COLS, GLYPH_ROWS) },
        uTime: { value: 0 },
        uScroll: { value: 0 },
        uSpan: { value: span },
        uSize: { value: 0.55 },
        uColor: { value: accent },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
  }

  update(time: number, scroll: number) {
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uScroll.value = scroll;
  }

  setAccent(color: THREE.Color) {
    this.material.uniforms.uColor.value = color;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

export { makeGlyphAtlas };
