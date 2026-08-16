/**
 * Procedural textures. Nothing here loads from disk — the whole art direction
 * is generated, which is what keeps the load budget at zero bytes of art.
 *
 * Everything on screen is code: the tube skin is literally scrolling source,
 * unique per layer theme.
 */

import * as THREE from "three";

/**
 * Per-layer source corpora. Packet headers on EDGE, SQL in the VAULT, opcodes
 * in RING 0 — the wall tells you where you are before the layer card does.
 */
const CORPUS: string[][] = [
  // 1 EDGE — public net, recon
  [
    "GET /v1/session HTTP/2",
    "TTL=64 PROTO=TCP WIN=65535",
    "SYN ACK seq=0x1f4a2c len=0",
    "X-Forwarded-For: 10.0.0.0/8",
    "ICMP echo request id=0x2a",
    "dst=443 flags=[S] mss=1460",
    "resolve edge.4009.net AAAA",
    "hop 07  12.4ms  *  *  ",
  ],
  // 2 DMZ — perimeter
  [
    "-A INPUT -p tcp --dport 22 -j DROP",
    "chain FORWARD policy DENY",
    "match state RELATED,ESTABLISHED",
    "nat POSTROUTING MASQUERADE",
    "deny ip any any log",
    "zone dmz -> zone trust : inspect",
    "conntrack -L | wc -l  = 41822",
    "-m limit --limit 3/min -j LOG",
  ],
  // 3 AUTH — credential layer
  [
    "bind uid=miftach ou=keys dc=4009",
    "kinit -kt /etc/krb5.keytab",
    "TOTP drift=+2 window=1",
    "pam_unix(sshd:auth) failure",
    "assert claims.exp > now()",
    "grant_type=client_credentials",
    "scope=read:vault write:none",
    "HMAC-SHA256 verify -> OK",
  ],
  // 4 USERLAND — application
  [
    "for (const p of packets) emit(p)",
    "try { await open(chan) } catch",
    "if (!user.trusted) return 403",
    "render(<Signal freq={106.9} />)",
    "queue.push({ id, ttl: 30 })",
    "export default function main()",
    "assert(state !== undefined)",
    "await sleep(16); tick();",
  ],
  // 5 VAULT — data store
  [
    "SELECT * FROM identities WHERE",
    "  pattern_hash = $1 LIMIT 1;",
    "BEGIN; LOCK TABLE clone_rows;",
    "INSERT INTO ledger (z, theta)",
    "CREATE INDEX ON vault (subject)",
    "UPDATE assets SET status='REC'",
    "EXPLAIN ANALYZE seq scan 4.1M",
    "COMMIT; -- 0 rows returned",
  ],
  // 6 RING 0 — kernel
  [
    "mov  rax, qword [rsp+0x18]",
    "test rax, rax ; jz .fault",
    "syscall  ; sys_ptrace",
    "lea  rdi, [rip+0x2f10]",
    "xor  ecx, ecx ; rep stosq",
    "int3 ; breakpoint trap",
    "call *%r11 ; indirect",
    "iretq ; return to ring 3",
  ],
  // 7 CRYPT — key material
  [
    "-----BEGIN PRIVATE KEY-----",
    "d4f1 9ac2 0e77 b310 5fa8 22c9",
    "curve=secp256k1 cofactor=1",
    "kdf=argon2id t=3 m=65536",
    "seed 0x00 not disclosed",
    "wipe(buf, len); memset_s()",
    "signature valid: false",
    "-----END PRIVATE KEY-----",
  ],
  // 8 CONSENSUS — distributed ledger
  [
    "block 0x4009 nonce=88213",
    "prev 0000a1f4c7 depth=17",
    "quorum 4/7 commit round=2",
    "merkle root 9f2c...ae01",
    "peer 12 vote=ACCEPT",
    "fork detected at height 4008",
    "finalize(epoch) -> sealed",
    "gossip fanout=6 ttl=3",
  ],
  // 9 SENTINEL — adaptive defense
  [
    "model=sentinel-v9 conf=0.94",
    "observe(theta, band, dv/dt)",
    "predict next 0.5s -> lock",
    "anomaly score 7.2 sigma",
    "retrain on subject trace",
    "policy: escalate, do not touch",
    "lock acquired. holding.",
    "target deviation < 90deg",
  ],
  // 10 ROOT ZERO
  [
    "root@4009:/# whoami",
    "uid=0(root) gid=0(root)",
    "shred -u /var/log/*",
    "we were never here",
    "0x00 0x00 0x00 0x00",
    "history -c && exit",
    "SUBJECT: not found",
    "miftach out.",
  ],
];

function canvas(w: number, h: number): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * The scrolling source that forms the tube skin for a layer.
 * Rendered dark so the rails and entities stay the brightest things on screen.
 */
export function makeCodeTexture(level: number, accent: string): THREE.Texture {
  const size = 1024;
  const c = canvas(size, size);
  if (!c) return new THREE.Texture();
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, size, size);

  const lines = CORPUS[Math.min(CORPUS.length - 1, Math.max(0, level - 1))];
  const rowHeight = 26;
  ctx.font = "16px ui-monospace, 'JetBrains Mono', 'Courier New', monospace";
  ctx.textBaseline = "top";

  for (let y = 0, i = 0; y < size; y += rowHeight, i++) {
    const line = lines[i % lines.length];
    // Two columns so the skin reads as dense source rather than sparse text.
    for (const x of [8, size / 2 + 8]) {
      ctx.fillStyle = i % 7 === 0 ? accent : "#8FA6B4";
      ctx.globalAlpha = i % 7 === 0 ? 0.5 : 0.22;
      ctx.fillText(line, x + ((i * 13) % 40), y);
    }
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Characters used by the trail, the blade faces, and the glyph rain. */
const GLYPHS = "0123456789ABCDEF·:/\\<>[]{}=+-*#$%&@!?";
export const GLYPH_COLS = 8;
export const GLYPH_ROWS = 5;
export const GLYPH_COUNT = GLYPH_COLS * GLYPH_ROWS;

/** A single atlas the rain, the trail, and the blade all sample. */
export function makeGlyphAtlas(): THREE.Texture {
  const cell = 64;
  const c = canvas(GLYPH_COLS * cell, GLYPH_ROWS * cell);
  if (!c) return new THREE.Texture();
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `bold ${Math.floor(cell * 0.72)}px ui-monospace, 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < GLYPH_COUNT; i++) {
    const ch = GLYPHS[i % GLYPHS.length];
    const cx = (i % GLYPH_COLS) * cell + cell / 2;
    const cy = Math.floor(i / GLYPH_COLS) * cell + cell / 2;
    ctx.fillText(ch, cx, cy);
  }

  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/** Live scrolling hex for the Keyshard's blade faces. */
export function makeHexTexture(): THREE.Texture {
  const w = 256;
  const h = 256;
  const c = canvas(w, h);
  if (!c) return new THREE.Texture();
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#04121A";
  ctx.fillRect(0, 0, w, h);
  ctx.font = "13px ui-monospace, monospace";
  ctx.textBaseline = "top";
  for (let y = 0; y < h; y += 16) {
    let line = "";
    for (let i = 0; i < 10; i++) {
      line += Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0")
        .toUpperCase() + " ";
    }
    ctx.fillStyle = y % 64 === 0 ? "#BDF5FF" : "#3F7E92";
    ctx.fillText(line, 4, y);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * The signature moment: the tunnel skin behind the player renders the system's
 * live log of you. This canvas is redrawn ~10 times a second above 70% Trace
 * and blended onto the tube.
 */
export class TelemetryLog {
  readonly texture: THREE.Texture;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly width = 1024;
  private readonly height = 512;
  private readonly lines: string[] = [];
  private accumulator = 0;
  private resolved = false;

  constructor() {
    const c = canvas(this.width, this.height);
    if (!c) {
      this.ctx = null;
      this.texture = new THREE.Texture();
      return;
    }
    this.ctx = c.getContext("2d");
    this.texture = new THREE.CanvasTexture(c);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.redraw();
  }

  /**
   * Append a live coordinate line. The player can watch themselves being
   * logged in their own rear view.
   */
  update(
    dt: number,
    state: { theta: number; band: string; speed: number; trace: number; z: number },
  ) {
    if (!this.ctx || this.resolved) return;
    this.accumulator += dt;
    if (this.accumulator < 0.1) return;
    this.accumulator = 0;

    const deg = ((state.theta * 180) / Math.PI).toFixed(1).padStart(5, " ");
    const stamp = state.z.toFixed(1).padStart(8, " ");
    this.lines.unshift(
      `t=${stamp}  θ=${deg}°  band=${state.band.padEnd(4)}  v=${state.speed.toFixed(1)}m/s  trace=${state.trace.toFixed(0)}%`,
    );
    if (this.lines.length > 18) this.lines.pop();
    this.redraw();
  }

  /** At 100% the log resolves into a single identity line. */
  resolve() {
    if (!this.ctx) return;
    this.resolved = true;
    const ctx = this.ctx;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = "#FF2E4D";
    ctx.font = "bold 54px ui-monospace, 'JetBrains Mono', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("SUBJECT IDENTIFIED", this.width / 2, this.height / 2);
    ctx.textAlign = "left";
    this.texture.needsUpdate = true;
  }

  reset() {
    this.resolved = false;
    this.lines.length = 0;
    this.redraw();
  }

  private redraw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.font = "22px ui-monospace, 'JetBrains Mono', monospace";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    this.lines.forEach((line, i) => {
      // Freshest line is brightest; older lines fade away down the tube.
      ctx.globalAlpha = Math.max(0.08, 1 - i * 0.06);
      ctx.fillStyle = "#FF2E4D";
      ctx.fillText(line, 24, 12 + i * 28);
    });
    ctx.globalAlpha = 1;
    this.texture.needsUpdate = true;
  }
}
