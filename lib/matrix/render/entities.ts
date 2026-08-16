/**
 * Entity rendering.
 *
 * Three instanced layers cover the whole catalog, which keeps the draw-call
 * budget at ≤ 40:
 *
 *   GateLayer  — annulus sectors across the tube cross-section. Every ring,
 *                wall, beam, sweep and burst is one of these.
 *   PropLayer  — small solid meshes at a point. One instanced mesh per kind.
 *   HaloLayer  — billboarded halos. The honeypot's square halo lives here;
 *                it is the single most important tell in the game.
 *
 * Shape carries all hazard/collect information. Colour is redundant, never
 * primary — and Traced red #FF2E4D appears nowhere in this file.
 */

import * as THREE from "three";
import { BAND_RADIUS, TUBE_RADIUS, slotAngle } from "../config";
import { LOGICBOMB_BURST_ARC } from "../catalog";
import type { Entity, EntityKind } from "../types";

const DEG = Math.PI / 180;
const MAX_GATES = 128;
const MAX_PROPS = 128;
const MAX_HALOS = 48;
/** Anything this far behind the player is off-camera. */
const CULL_BEHIND = 10;

/** Collectibles read brighter and higher-saturation than the layer palette. */
const COLORS: Record<EntityKind, number> = {
  packet: 0x5eeaff,
  mote: 0xffffff,
  zeroday: 0xffc93c,
  roottoken: 0xffe9a8,
  scrub: 0x9df5c4,
  cert: 0xbfe6ff,
  socket: 0x7de8ff,
  // Hazards are red-shifted relative to the layer palette.
  tripwire: 0xf5a524,
  debris: 0x8a8f98,
  firewall: 0xff6b4a,
  ids: 0xff4d6d,
  // The honeypot deliberately wears the zero-day's colour. The halo is the tell.
  honeypot: 0xffc93c,
  hashwall: 0xff7a5c,
  ratelimit: 0xe0a030,
  ice: 0xff5a47,
  nullvoid: 0x05060b,
  race: 0xff7043,
  logicbomb: 0xff8a3d,
  gc: 0x6b7280,
  sentinel: 0xf0abfc,
  beacon: 0xff9e6b,
};

const FOG_CHUNK = /* glsl */ `
uniform float uFogDensity;
uniform vec3 uFogColor;
vec3 applyFog(vec3 col, float depth) {
  float f = 1.0 - exp(-uFogDensity * depth);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`;

// ---------------------------------------------------------------------------
// Gates — annulus sectors
// ---------------------------------------------------------------------------

const GATE_VERT = /* glsl */ `
attribute float aZ;
attribute vec2 aAngles;   // start, sweep (radians)
attribute vec2 aRadii;    // inner, outer
attribute vec3 aColor;
attribute vec3 aFlags;    // style, alpha, param

varying vec3 vColor;
varying vec3 vFlags;
varying vec2 vUv;
varying float vDepth;

void main() {
  vColor = aColor;
  vFlags = aFlags;
  vUv = uv;

  float ang = aAngles.x + uv.x * aAngles.y;
  float r = mix(aRadii.x, aRadii.y, uv.y);
  vec3 p = vec3(sin(ang) * r, cos(ang) * r, aZ);

  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 view = viewMatrix * world;
  vDepth = -view.z;
  gl_Position = projectionMatrix * view;
}
`;

const GATE_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying vec3 vFlags;
varying vec2 vUv;
varying float vDepth;
uniform float uTime;
${FOG_CHUNK}

void main() {
  float style = vFlags.x;
  float alpha = vFlags.y;
  float param = vFlags.z;
  vec3 col = vColor;

  // Edge emphasis: every gate reads as a hard boundary, which is what makes it
  // identifiable within 0.4s at the horizon.
  float edge = min(min(vUv.y, 1.0 - vUv.y), min(vUv.x, 1.0 - vUv.x) * 4.0);
  float rim = 1.0 - smoothstep(0.0, 0.14, edge);
  col += vColor * rim * 1.6;

  if (style < 0.5) {
    // firewall — closed sector with a scanning band
    float scan = sin(vUv.y * 22.0 - uTime * 5.0) * 0.5 + 0.5;
    col *= 0.55 + scan * 0.5;
  } else if (style < 1.5) {
    // hashwall — a wall of scrolling hex
    float rows = fract(vUv.y * 14.0 - uTime * 1.2);
    col *= 0.45 + step(0.5, fract(vUv.x * 90.0 + floor(vUv.y * 14.0) * 0.37)) * rows * 1.1;
  } else if (style < 2.5) {
    // ids beam — bright, banded, unmistakably a sweep
    float band = sin(vUv.x * 30.0 + uTime * 8.0) * 0.5 + 0.5;
    col *= 0.6 + band * 0.9;
    alpha *= 0.85;
  } else if (style < 3.5) {
    // ratelimit — amber viscous field
    float visc = sin(vUv.x * 12.0 + uTime * 2.0) * sin(vUv.y * 9.0 - uTime * 1.4);
    col *= 0.5 + visc * 0.35;
    alpha *= 0.5;
  } else if (style < 4.5) {
    // nullvoid — a hole. No rails across it, nothing inside it.
    col = mix(vec3(0.0), vColor, rim * 0.6);
    alpha = 1.0;
  } else if (style < 5.5) {
    // race condition — solid and hollow alternate; param carries solidity
    col *= 0.4 + param * 1.1;
    alpha *= 0.25 + param * 0.75;
  } else if (style < 6.5) {
    // garbage collector — a wall of dissolving geometry
    float n = fract(sin(dot(floor(vUv * 40.0), vec2(12.99, 78.23))) * 43758.5453);
    if (n < 0.35) discard;
    col *= 0.5 + n * 0.9;
  } else if (style < 7.5) {
    // sentinel — a magenta ring that mirrors you. param = locked
    float pulse = sin(uTime * 6.0) * 0.5 + 0.5;
    col *= 0.7 + pulse * (0.4 + param * 0.9);
    alpha *= 0.55 + param * 0.45;
  } else if (style < 8.5) {
    // socket — a gate you fly through, so only the rim is drawn
    if (rim < 0.35) discard;
    col *= 1.4;
  } else {
    // tripwire — a single thin line
    col *= 1.5;
  }

  col = applyFog(col, vDepth);
  gl_FragColor = vec4(col, alpha);
}
`;

class GateLayer {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly z = new Float32Array(MAX_GATES);
  private readonly angles = new Float32Array(MAX_GATES * 2);
  private readonly radii = new Float32Array(MAX_GATES * 2);
  private readonly color = new Float32Array(MAX_GATES * 3);
  private readonly flags = new Float32Array(MAX_GATES * 3);
  private count = 0;

  constructor() {
    const base = new THREE.PlaneGeometry(1, 1, 40, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.attributes.position = base.attributes.position;
    this.geometry.attributes.uv = base.attributes.uv;
    this.geometry.setAttribute("aZ", new THREE.InstancedBufferAttribute(this.z, 1));
    this.geometry.setAttribute("aAngles", new THREE.InstancedBufferAttribute(this.angles, 2));
    this.geometry.setAttribute("aRadii", new THREE.InstancedBufferAttribute(this.radii, 2));
    this.geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(this.color, 3));
    this.geometry.setAttribute("aFlags", new THREE.InstancedBufferAttribute(this.flags, 3));

    this.material = new THREE.ShaderMaterial({
      vertexShader: GATE_VERT,
      fragmentShader: GATE_FRAG,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFogDensity: { value: 0.006 },
        uFogColor: { value: new THREE.Color("#05060B") },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
  }

  begin() {
    this.count = 0;
  }

  push(
    z: number,
    angleStart: number,
    sweep: number,
    r0: number,
    r1: number,
    colorHex: number,
    style: number,
    alpha: number,
    param = 0,
  ) {
    if (this.count >= MAX_GATES) return;
    const i = this.count++;
    this.z[i] = z;
    this.angles[i * 2] = angleStart;
    this.angles[i * 2 + 1] = sweep;
    this.radii[i * 2] = r0;
    this.radii[i * 2 + 1] = r1;
    const c = new THREE.Color(colorHex);
    this.color[i * 3] = c.r;
    this.color[i * 3 + 1] = c.g;
    this.color[i * 3 + 2] = c.b;
    this.flags[i * 3] = style;
    this.flags[i * 3 + 1] = alpha;
    this.flags[i * 3 + 2] = param;
  }

  end(time: number, fogDensity: number, fogColor: THREE.Color) {
    this.geometry.instanceCount = this.count;
    for (const name of ["aZ", "aAngles", "aRadii", "aColor", "aFlags"]) {
      (this.geometry.attributes[name] as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uFogDensity.value = fogDensity;
    this.material.uniforms.uFogColor.value = fogColor;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------
// Props — small solid meshes
// ---------------------------------------------------------------------------

const PROP_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec3 aFlags;   // spinRate, alpha, style

varying vec3 vColor;
varying vec3 vFlags;
varying float vDepth;
varying vec3 vNormalView;
uniform float uTime;

mat3 rotY(float a) {
  float c = cos(a); float s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}
mat3 rotX(float a) {
  float c = cos(a); float s = sin(a);
  return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c);
}

void main() {
  vColor = aColor;
  vFlags = aFlags;

  float spin = uTime * aFlags.x;
  mat3 r = rotY(spin) * rotX(spin * 0.6);
  vec3 p = r * position + aOffset;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 view = viewMatrix * world;
  vDepth = -view.z;
  vNormalView = normalize(mat3(viewMatrix) * mat3(modelMatrix) * (r * normal));
  gl_Position = projectionMatrix * view;
}
`;

const PROP_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying vec3 vFlags;
varying float vDepth;
varying vec3 vNormalView;
uniform float uTime;
${FOG_CHUNK}

void main() {
  vec3 col = vColor;
  float style = vFlags.z;

  // A cheap rim term so solids read as volumes at 14 pixels tall.
  float facing = abs(vNormalView.z);
  float rim = pow(1.0 - facing, 2.0);

  if (style < 0.5) {
    // glowing collectible
    col *= 0.75 + rim * 1.4;
  } else if (style < 1.5) {
    // deprecated debris — no glow, flat, grey
    col *= 0.35 + facing * 0.45;
  } else if (style < 2.5) {
    // honeypot — the seam flickers. Subtle, but every time.
    float flicker = step(0.5, fract(uTime * 8.5)) * 0.45;
    col *= 0.7 + rim * 1.2 + flicker;
  } else if (style < 3.5) {
    // ICE lance — hot leading edge
    col *= 0.8 + rim * 1.8;
  } else {
    // logic bomb — visible countdown pulse, param-free
    float tick = sin(uTime * 14.0) * 0.5 + 0.5;
    col *= 0.6 + tick * 0.9;
  }

  col = applyFog(col, vDepth);
  gl_FragColor = vec4(col, vFlags.y);
}
`;

interface PropKindState {
  mesh: THREE.Mesh;
  geometry: THREE.InstancedBufferGeometry;
  offset: Float32Array;
  color: Float32Array;
  flags: Float32Array;
  count: number;
}

function propGeometry(kind: EntityKind): THREE.BufferGeometry {
  switch (kind) {
    case "packet":
      return new THREE.BoxGeometry(0.5, 0.5, 0.5);
    case "mote":
      return new THREE.IcosahedronGeometry(0.26, 1);
    case "zeroday":
    case "honeypot": {
      // Gold seed pod with a seam of light.
      const g = new THREE.SphereGeometry(0.32, 14, 10);
      g.scale(1, 1.45, 1);
      return g;
    }
    case "roottoken": {
      const g = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 6);
      g.rotateX(Math.PI / 2);
      return g;
    }
    case "cert": {
      const g = new THREE.OctahedronGeometry(0.44);
      g.scale(0.85, 1.15, 0.35);
      return g;
    }
    case "debris":
      return new THREE.TetrahedronGeometry(0.42);
    case "ice": {
      // A spike that points back down the tube at you.
      const g = new THREE.ConeGeometry(0.2, 1.5, 5);
      g.rotateX(Math.PI / 2);
      return g;
    }
    case "beacon":
      return new THREE.OctahedronGeometry(0.3);
    case "logicbomb":
      return new THREE.SphereGeometry(0.36, 14, 10);
    default:
      return new THREE.BoxGeometry(0.4, 0.4, 0.4);
  }
}

const PROP_KINDS: EntityKind[] = [
  "packet",
  "mote",
  "zeroday",
  "honeypot",
  "roottoken",
  "cert",
  "debris",
  "ice",
  "beacon",
  "logicbomb",
];

function propStyle(kind: EntityKind): number {
  switch (kind) {
    case "debris":
      return 1;
    case "honeypot":
      return 2;
    case "ice":
      return 3;
    case "logicbomb":
      return 4;
    default:
      return 0;
  }
}

function propSpin(kind: EntityKind): number {
  switch (kind) {
    case "packet":
      return 1.1;
    case "mote":
      return 2.4;
    case "roottoken":
      return 1.8;
    case "debris":
      return 0.7;
    case "zeroday":
    case "honeypot":
      return 0.5;
    default:
      return 0;
  }
}

class PropLayer {
  readonly group = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private readonly kinds = new Map<EntityKind, PropKindState>();

  constructor() {
    this.material = new THREE.ShaderMaterial({
      vertexShader: PROP_VERT,
      fragmentShader: PROP_FRAG,
      transparent: true,
      depthWrite: true,
      uniforms: {
        uTime: { value: 0 },
        uFogDensity: { value: 0.006 },
        uFogColor: { value: new THREE.Color("#05060B") },
      },
    });

    for (const kind of PROP_KINDS) {
      const base = propGeometry(kind);
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.index = base.index;
      geometry.attributes.position = base.attributes.position;
      geometry.attributes.normal = base.attributes.normal;
      const offset = new Float32Array(MAX_PROPS * 3);
      const color = new Float32Array(MAX_PROPS * 3);
      const flags = new Float32Array(MAX_PROPS * 3);
      geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(offset, 3));
      geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(color, 3));
      geometry.setAttribute("aFlags", new THREE.InstancedBufferAttribute(flags, 3));
      const mesh = new THREE.Mesh(geometry, this.material);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.kinds.set(kind, { mesh, geometry, offset, color, flags, count: 0 });
    }
  }

  begin() {
    for (const state of this.kinds.values()) state.count = 0;
  }

  push(kind: EntityKind, x: number, y: number, z: number, alpha = 1) {
    const state = this.kinds.get(kind);
    if (!state || state.count >= MAX_PROPS) return;
    const i = state.count++;
    state.offset[i * 3] = x;
    state.offset[i * 3 + 1] = y;
    state.offset[i * 3 + 2] = z;
    const c = new THREE.Color(COLORS[kind]);
    state.color[i * 3] = c.r;
    state.color[i * 3 + 1] = c.g;
    state.color[i * 3 + 2] = c.b;
    state.flags[i * 3] = propSpin(kind);
    state.flags[i * 3 + 1] = alpha;
    state.flags[i * 3 + 2] = propStyle(kind);
  }

  end(time: number, fogDensity: number, fogColor: THREE.Color) {
    for (const state of this.kinds.values()) {
      state.geometry.instanceCount = state.count;
      for (const name of ["aOffset", "aColor", "aFlags"]) {
        (state.geometry.attributes[name] as THREE.InstancedBufferAttribute).needsUpdate = true;
      }
    }
    this.material.uniforms.uTime.value = time;
    this.material.uniforms.uFogDensity.value = fogDensity;
    this.material.uniforms.uFogColor.value = fogColor;
  }

  dispose() {
    for (const state of this.kinds.values()) state.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------
// Halos — the honeypot tell
// ---------------------------------------------------------------------------

const HALO_VERT = /* glsl */ `
attribute vec3 aOffset;
attribute vec3 aColor;
attribute vec2 aParams;   // size, square?

varying vec3 vColor;
varying vec2 vUv;
varying float vSquare;
varying float vDepth;

void main() {
  vColor = aColor;
  vUv = uv;
  vSquare = aParams.y;

  // Billboard toward the camera.
  vec4 centre = modelViewMatrix * vec4(aOffset, 1.0);
  centre.xy += position.xy * aParams.x;
  vDepth = -centre.z;
  gl_Position = projectionMatrix * centre;
}
`;

const HALO_FRAG = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying vec2 vUv;
varying float vSquare;
varying float vDepth;
${FOG_CHUNK}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  // Round halo = safe. Square halo = decoy. Keep the tell subtle but
  // consistent: square, flickering seam, every time.
  float dRound = length(p);
  float dSquare = max(abs(p.x), abs(p.y));
  float d = mix(dRound, dSquare, vSquare);
  float ring = smoothstep(1.0, 0.72, d) - smoothstep(0.66, 0.44, d);
  if (ring <= 0.002) discard;
  vec3 col = applyFog(vColor * ring * 2.0, vDepth);
  gl_FragColor = vec4(col, ring);
}
`;

class HaloLayer {
  readonly mesh: THREE.Mesh;
  private readonly geometry: THREE.InstancedBufferGeometry;
  private readonly material: THREE.ShaderMaterial;
  private readonly offset = new Float32Array(MAX_HALOS * 3);
  private readonly color = new Float32Array(MAX_HALOS * 3);
  private readonly params = new Float32Array(MAX_HALOS * 2);
  private count = 0;

  constructor() {
    const base = new THREE.PlaneGeometry(1, 1);
    this.geometry = new THREE.InstancedBufferGeometry();
    this.geometry.index = base.index;
    this.geometry.attributes.position = base.attributes.position;
    this.geometry.attributes.uv = base.attributes.uv;
    this.geometry.setAttribute("aOffset", new THREE.InstancedBufferAttribute(this.offset, 3));
    this.geometry.setAttribute("aColor", new THREE.InstancedBufferAttribute(this.color, 3));
    this.geometry.setAttribute("aParams", new THREE.InstancedBufferAttribute(this.params, 2));

    this.material = new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uFogDensity: { value: 0.006 },
        uFogColor: { value: new THREE.Color("#05060B") },
      },
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  begin() {
    this.count = 0;
  }

  push(x: number, y: number, z: number, colorHex: number, size: number, square: boolean) {
    if (this.count >= MAX_HALOS) return;
    const i = this.count++;
    this.offset[i * 3] = x;
    this.offset[i * 3 + 1] = y;
    this.offset[i * 3 + 2] = z;
    const c = new THREE.Color(colorHex);
    this.color[i * 3] = c.r;
    this.color[i * 3 + 1] = c.g;
    this.color[i * 3 + 2] = c.b;
    this.params[i * 2] = size;
    this.params[i * 2 + 1] = square ? 1 : 0;
  }

  end(fogDensity: number, fogColor: THREE.Color) {
    this.geometry.instanceCount = this.count;
    for (const name of ["aOffset", "aColor", "aParams"]) {
      (this.geometry.attributes[name] as THREE.InstancedBufferAttribute).needsUpdate = true;
    }
    this.material.uniforms.uFogDensity.value = fogDensity;
    this.material.uniforms.uFogColor.value = fogColor;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export class EntityRenderer {
  readonly group = new THREE.Group();
  private readonly gates = new GateLayer();
  private readonly props = new PropLayer();
  private readonly halos = new HaloLayer();

  constructor() {
    this.group.add(this.gates.mesh);
    this.group.add(this.props.group);
    this.group.add(this.halos.mesh);
  }

  /**
   * Rebuild the instance buffers from the simulation's visible set.
   *
   * @param playerZ  the simulation's travelled distance
   * @param raceSolid  which 6Hz phase is currently solid
   */
  update(
    entities: Entity[],
    playerZ: number,
    time: number,
    fogDensity: number,
    fogColor: THREE.Color,
    gc: { active: boolean; z: number },
  ) {
    this.gates.begin();
    this.props.begin();
    this.halos.begin();

    for (const e of entities) {
      // The simulation works in travelled distance; the scene works in -Z.
      const z = -(e.z - playerZ);
      if (z > CULL_BEHIND) continue;
      this.emit(e, z, time);
    }

    if (gc.active) {
      // A wall of dissolving geometry consuming the tunnel behind you.
      this.gates.push(-(gc.z - playerZ), 0, Math.PI * 2, 0, TUBE_RADIUS, COLORS.gc, 6, 0.95);
    }

    this.gates.end(time, fogDensity, fogColor);
    this.props.end(time, fogDensity, fogColor);
    this.halos.end(fogDensity, fogColor);
  }

  private emit(e: Entity, z: number, time: number) {
    const arc = e.arcDeg * DEG;
    const start = e.theta - arc / 2;

    switch (e.kind) {
      case "firewall": {
        // Draw the closed portion: everything except the open slots.
        const open = e.openSlots ?? [];
        if (!open.length) break;
        const first = slotAngle(Math.min(...open)) - Math.PI / 16;
        const last = slotAngle(Math.max(...open)) + Math.PI / 16;
        const closedStart = e.theta + last;
        const closedSweep = Math.PI * 2 - (last - first);
        this.gates.push(z, closedStart, closedSweep, 3.7, TUBE_RADIUS, COLORS.firewall, 0, 0.95);
        break;
      }

      case "hashwall": {
        // Every band except the open one.
        const openR = BAND_RADIUS[e.openBand ?? "MID"];
        const rings: Array<[number, number]> = [
          [3.7, 4.6],
          [4.6, 5.35],
          [5.35, TUBE_RADIUS],
        ];
        for (const [r0, r1] of rings) {
          if (openR > r0 && openR < r1) continue;
          this.gates.push(z, 0, Math.PI * 2, r0, r1, COLORS.hashwall, 1, 0.95);
        }
        break;
      }

      case "ids":
        this.gates.push(z, start, arc, 3.7, TUBE_RADIUS, COLORS.ids, 2, 0.9);
        break;

      case "ratelimit": {
        // Stack a few discs across its depth so the field reads as a volume.
        for (let i = 0; i < 4; i++) {
          const dz = z + (i / 3 - 0.5) * e.depth;
          this.gates.push(dz, 0, Math.PI * 2, 4.6, 5.35, COLORS.ratelimit, 3, 0.55);
        }
        break;
      }

      case "nullvoid": {
        for (let i = 0; i < 6; i++) {
          const dz = z + (i / 5 - 0.5) * e.depth;
          this.gates.push(dz, start, arc, 5.35, TUBE_RADIUS, COLORS.nullvoid, 4, 1);
        }
        break;
      }

      case "race": {
        const beat = Math.floor(time * 6) % 2;
        const solid = beat === (e.phase ?? 0) ? 1 : 0;
        this.gates.push(z, start, arc, 3.7, TUBE_RADIUS, COLORS.race, 5, 0.9, solid);
        break;
      }

      case "sentinel":
        this.gates.push(
          z,
          start,
          arc,
          3.7,
          TUBE_RADIUS,
          COLORS.sentinel,
          7,
          0.9,
          e.locked ? 1 : 0,
        );
        break;

      case "socket": {
        const r = BAND_RADIUS[e.band === "ALL" ? "MID" : e.band];
        this.gates.push(z, start, arc, r - 0.75, r + 0.75, COLORS.socket, 8, 1);
        break;
      }

      case "scrub": {
        // A pale green ring with a hollow centre — fly through it.
        const r = BAND_RADIUS[e.band === "ALL" ? "MID" : e.band];
        this.gates.push(z, start, arc, r - 0.55, r + 0.55, COLORS.scrub, 8, 1);
        break;
      }

      case "tripwire": {
        const r = BAND_RADIUS[e.band === "ALL" ? "MID" : e.band];
        this.gates.push(z, start, arc, r - 0.07, r + 0.07, COLORS.tripwire, 9, 1);
        break;
      }

      case "logicbomb": {
        if (e.detonated) {
          const burst = LOGICBOMB_BURST_ARC * DEG;
          this.gates.push(
            z,
            e.theta - burst / 2,
            burst,
            3.7,
            TUBE_RADIUS,
            COLORS.logicbomb,
            2,
            0.95,
          );
        } else {
          this.pushProp(e, z);
        }
        break;
      }

      case "gc":
        // Handled globally by the chase state.
        break;

      default:
        this.pushProp(e, z);
        break;
    }
  }

  private pushProp(e: Entity, z: number) {
    const r = BAND_RADIUS[e.band === "ALL" ? "MID" : e.band];
    const x = Math.sin(e.theta) * r;
    const y = Math.cos(e.theta) * r;
    this.props.push(e.kind, x, y, z);

    // Zero-days wear a round halo. Honeypots wear a square one.
    if (e.kind === "zeroday") {
      this.halos.push(x, y, z, COLORS.zeroday, 1.5, false);
    } else if (e.kind === "honeypot") {
      this.halos.push(x, y, z, COLORS.honeypot, 1.5, true);
    } else if (e.kind === "mote") {
      this.halos.push(x, y, z, COLORS.mote, 0.9, false);
    } else if (e.kind === "beacon") {
      this.halos.push(x, y, z, COLORS.beacon, 1.2, false);
    }
  }

  dispose() {
    this.gates.dispose();
    this.props.dispose();
    this.halos.dispose();
  }
}

export { COLORS as ENTITY_COLORS };
