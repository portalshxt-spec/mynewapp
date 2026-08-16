# MIFTACH'S MATRIX — Engineering Handoff

**Status:** Feature-complete against GDD v1.0. Builds clean, typechecks clean, runs in-browser with zero console errors. **Not yet validated on real GPU hardware.**

**Repository:** `portalshxt-spec/mynewapp`
**Branch:** `claude/do-it-xo3lwp`
**Commit:** `9b6c6a4ad15756f47bcbec7d18e66a161b6d2800` (2026-08-16)
**Base branch:** `main` (branch forked at `807d8a8`)
**Route:** `/matrix`
**Scale:** 7,842 lines across 21 new files + 1 new dependency (`three`)

---

## 0. Read this first

You are picking up a finished implementation of a game design document, built into an existing Next.js site. Three things to know before you touch anything:

1. **The GDD is the spec and it is unusually good.** Where it gives a number, that number is in the code verbatim. Where I deviated, it is documented in §7 with the reason. Do not "improve" a GDD number without reading §7 first — several of them are load-bearing.
2. **`npm run matrix:verify` is your fastest feedback loop.** It runs all ten layers headless in ~2 seconds, no GPU, and asserts the tuning table and library invariants. Run it before and after any change to `config.ts`, `catalog.ts`, `chunks.json`, `generator.ts`, or `sim.ts`.
3. **The one genuinely unfinished thing is GPU validation.** See §9. Everything else is either done or explicitly listed as future scope by the GDD itself.

---

## 1. Source documents

Four documents were provided. All four should travel with this handoff.

| Document | Role | Authority |
| --- | --- | --- |
| `Miftachs_Matrix_GDD.md` | The build spec. 19 sections, v1.0. | **Primary.** This is what was implemented. |
| `4009_BLakHartz_Master_Universe_and_Character_Bible_v1_0.pdf` | 30-page universe/character canon, v1.0, 3 Aug 2026. | Canon authority for anything the GDD leaves open. |
| `4009_BLakHartz_Master_Universe_and_Character_Bible_v1_0_1.pdf` | **Byte-identical duplicate** of the above (`md5 03bf895f…`). | Ignore. Not a second revision. |
| `The_BLakHartz_Visual_Directory_6_Members.pdf` | 9-page visual directory, six members. | Visual canon. Not needed for the game (no character art ships), but needed for anything downstream. |

Two reference images of MIFTACH were also supplied (turnaround sheet + forearm-interface detail). They informed nothing in the shipped game — see §7.6 on why no character art exists.

### Canon status key used by the Bible

- **LOCKED CANON** — established, do not contradict.
- **CURRENT DESIGN DIRECTION** — latest active solution, still open to final lock.
- **RESERVED / TO BE LOCKED** — deliberate blank, do not invent into it.
- **LEGACY CONTINUITY** — superseded, retained for provenance.

---

## 2. Canon guardrails

These are LOCKED CANON from the Bible and constrain any future work on this property. They are reproduced here because the next session may not receive the PDFs.

### The Three Laws of the 4009 universe

1. **Man versus AI.** The central conflict is humanity against a machine system, not one human faction against another.
2. **Humans versus Bots.** Physical conflict runs along the human-versus-machine axis only.
3. **No human-versus-human violence. Ever.** *"This is not a production preference. It is the point."* A proposed scene that depends on humans attacking each other violates the universe at its foundation and must be rewritten.

The game complies trivially: there are no human characters in it. Every hazard is a system defence (firewall, IDS, ICE, sentinel), never a person. **Keep it that way.**

### MIFTACH — the character the game is named for

| Field | Canon |
| --- | --- |
| Name | MIFTACH · 𐤇𐤕𐤐𐤌 · "Key; the one who unlocks" |
| Title | The Keybearer, BLakHartz #2 |
| Height | 5'10" / 178 cm — one inch taller than STRESMATIC |
| Build | Compact, broad-shouldered, regal, imposing without being tall |
| Face | Smooth, completely featureless glossy black faceplate framed by polished chrome. No eyes, mouth, markings, skull details. |
| Crown | Short Bantu-knot-inspired liberty-spike sensor formation; black bases, pure silver conductive tips |
| Chest | Sharply engineered circular processor, upper **left** chest |
| Cooling | Separate open shoulder exhaust vent above the processor, layered metal fins |
| Left forearm | Jacket opens to reveal matte-black unmarked control keys + small hacking screen |
| Right arm | **Normal, unmodified** black leather sleeve |
| Role | Hacker, access specialist, harmonic architect, channel opener and sealer |
| Voice rule | Measured, technical, regal. Key-oriented vocabulary: *access, seal, channel, chord, permission, breach.* |

**Retired (LEGACY CONTINUITY):** the permanent full arm made of visible keyboard keys. Do not restore it without a new lock from the creator.

**Canon detail that drove the game's core design:** *"In the Corporate Vault tradition, a sealed door opens because he produces the frequency the system recognizes, not because someone mechanically picks the lock."* His systems include an **encrypted key vault** and a **universal hardline access key**.

### Absolute visual continuity rules

- Do not equalise character heights or body types for composition.
- Do not merge head systems, hair systems, crystals, instruments, or signature technology between characters.
- TSAPHON alone has laid-back sensor filaments and mass-preserving elongation.
- MIFTACH alone has the silver-tipped short crown, chest processor, shoulder exhaust, adaptive access suite.
- RA'AM alone has the tourmaline crown array, blue electrical eyes, PORT POX conductor.
- DATA ZAKAR alone has the skull helmet, mirrored goggles, metallic teeth, Town Car time vessel.
- Instruments are matte black unless a scene deliberately establishes otherwise.

### Height and stature continuity (LOCKED)

| Order | Character | Height |
| --- | --- | --- |
| 1 | TSAPHON | 7'2" standard; 10'6" elongated |
| 2 | DATA ZAKAR | 6'3" |
| 3 | MIFTACH | 5'10" |
| 4 | STRESMATIC | 5'9" |
| 5 | RA'AM | 5'7" (shortest and broadest) |

### Credit and rights

- **Credit line:** STRESMATIC x DROOP-E / Trillionaire Thoughts Entertainment
- **Copyright:** © 2026 [COPYRIGHT OWNER] — *the owner and human-author fields in the Bible are still `[INSERT]` placeholders.* Appendix D lists eleven reserved fields to complete before the v1.2 deposit edition.

---

## 3. ⚠️ Open discrepancy: BLakHarts vs BLakHartz

**The Bible declares LOCKED CANON:** *"The current franchise spelling is **BLakHartz**. Earlier source documents use BLVCKHEARTS, Blvckhearts, and related variants. Those legacy spellings remain part of the development archive, but this edition uses BLakHartz as the forward-facing canonical name."*

**The repository uses `BLakHarts` (with an s) in 26 places and `BLakHartz` in zero.** This includes the site title, the package name, the database schema, admin panel copy, and transactional email templates.

The GDD itself is inconsistent — its header says *"Property: 4009 / The BLakHartz"* while §19.3 refers to *"the BLakHarts site"*.

**I did not change this.** Renaming a brand across a live storefront, a Supabase schema, and outgoing email is the owner's call, not an incidental refactor inside a game feature. The Bible's own Canon Decision Log flags it as an action item: *"Global search and replace in final manuscript while retaining source-history note."*

**Decision needed from the creator before anyone touches it.** If the answer is "rename," it is a cross-cutting change touching `supabase/schema.sql`, `lib/settings.ts`, `lib/email.ts`, `app/layout.tsx`, `package.json`, and seeded database rows — not a find-and-replace you can safely run unattended.

---

## 4. Repository state

### Running it

```bash
git fetch origin claude/do-it-xo3lwp
git checkout claude/do-it-xo3lwp
npm install
npm run dev          # http://localhost:3000/matrix
```

**The game requires zero environment variables.** It touches no Supabase, Stripe, Mux, or Resend. Verified: `/matrix` returns 200 in dev with no `.env.local` present. This is by design — it is a self-contained route and must stay that way unless someone deliberately adds member-gating.

Node 18.18+ required (tested on v22.22.2).

### Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server. |
| `npm run build` | Production build. Currently passes. |
| `npm run matrix:verify` | **Headless tuning harness.** All ten layers, no GPU, ~2s. |
| `npx tsc --noEmit` | Typecheck. Currently clean. |

`matrix:verify` compiles `lib/matrix/verify.ts` to CommonJS in `.matrix-verify/` (gitignored) and runs it under Node. CommonJS is required because `generator.ts` does a plain `import chunks from "./chunks.json"`, which Node ESM would reject without import attributes.

### Where it lives in the site

`/matrix` sits at `app/matrix/page.tsx` — **outside** the `(site)` route group. That is deliberate: the `(site)` layout injects `SiteHeader`/`SiteFooter` and calls `getSettings()` (a Supabase read). A full-bleed game surface wants neither. A `MATRIX` link was added to `SiteHeader` nav for discoverability.

---

## 5. Architecture

### Layering rule

`lib/matrix/*.ts` (except `render/`) **must not import Three.js or touch the DOM.** The simulation is pure logic. This is what makes `matrix:verify` possible and it is worth preserving.

```
app/matrix/page.tsx           server component, fonts, metadata
  └── components/matrix/MatrixCanvas.tsx    "use client" — canvas, menus, settings
        ├── components/matrix/Hud.tsx        the four diegetic HUD elements
        └── lib/matrix/game.ts               frame loop + phase machine
              ├── lib/matrix/sim.ts          ← pure logic, no renderer
              ├── lib/matrix/input.ts
              ├── lib/matrix/audio.ts
              ├── lib/matrix/persistence.ts
              └── lib/matrix/render/scene.ts ← all Three.js lives below here
```

### File map

| File | Lines | Responsibility |
| --- | --- | --- |
| `lib/matrix/config.ts` | 314 | **The tuning spine.** World constants, all ten layer configs, every threshold. |
| `lib/matrix/types.ts` | 183 | Shared types. No logic. |
| `lib/matrix/catalog.ts` | 341 | All 21 entity definitions: arc, depth, band, Trace value, gating. |
| `lib/matrix/chunks.json` | 1102 | 81 hand-authored chunks. |
| `lib/matrix/generator.ts` | 311 | Seeded chunk shuffler against the difficulty budget. |
| `lib/matrix/rng.ts` | 64 | mulberry32 seeded PRNG + per-layer seed derivation. |
| `lib/matrix/sim.ts` | 770 | Movement, swept collision, Trace/Cycles/combo, entity behaviour. |
| `lib/matrix/game.ts` | 446 | Frame loop, fixed timestep, phase machine, event routing. |
| `lib/matrix/input.ts` | 267 | Keyboard, gamepad, touch, mouse → one `InputState`. |
| `lib/matrix/audio.ts` | 457 | Synthesised adaptive score + SFX bus. |
| `lib/matrix/persistence.ts` | 159 | localStorage with in-memory fallback. |
| `lib/matrix/verify.ts` | 313 | Headless harness. Not imported by the game. |
| `lib/matrix/render/scene.ts` | 281 | Scene graph, camera, world rotation, orchestration. |
| `lib/matrix/render/tube.ts` | 253 | The Conduit. One mesh, one shader. |
| `lib/matrix/render/entities.ts` | 825 | Gate/prop/halo instanced layers. |
| `lib/matrix/render/keyshard.ts` | 554 | Avatar, trail, glyph rain, shared glyph billboards. |
| `lib/matrix/render/textures.ts` | 320 | Procedural code textures, glyph atlas, telemetry log canvas. |
| `lib/matrix/render/post.ts` | 209 | Post stack + quality tier detection. |
| `components/matrix/MatrixCanvas.tsx` | 487 | React shell, title/pause/end screens, settings, codex, layer select. |
| `components/matrix/Hud.tsx` | 131 | Trace bar, Cycles, score/combo, layer name. |
| `app/matrix/page.tsx` | 55 | Route, fonts, metadata. |

---

## 6. The tuning spine

**Two numbers govern everything.** Both live in `config.ts`.

```
forward speed  v(n) = 22.0 × 1.10^(n-1)      →  22.0 … 51.87 m/s
angular speed  ω(n) = 220  × 1.08^(n-1)      →  220  … 439.8 °/s
```

The GDD is emphatic and correct about why ω scales *below* v: *"if angular speed stayed flat, at L10 you'd cover only 42% of the arc per metre travelled and clean lines would become impossible. Scaling it slightly under forward speed means the world tightens by ~2% per level — enough to feel the squeeze, not enough to break the lines. This is the single most important tuning number in the game; tune it before anything else."*

### Computed layer table (as shipped)

| n | Name | v (m/s) | ω (°/s) | radial (s) | horizon (s) | dur (s) | FOV | BPM | bg / rail / accent |
|---|---|---|---|---|---|---|---|---|---|
| 1 | EDGE | 22.00 | 220.0 | 0.1800 | 3.200 | 60 | 72.00 | 100.0 | `#0A1A24` / `#22D3EE` / `#7DD3FC` |
| 2 | DMZ | 24.20 | 237.6 | 0.1746 | 3.111 | 63 | 74.67 | 110.0 | `#1A1206` / `#F59E0B` / `#FCD34D` |
| 3 | AUTH | 26.62 | 256.6 | 0.1694 | 3.022 | 66 | 77.33 | 121.0 | `#140A22` / `#A855F7` / `#E9D5FF` |
| 4 | USERLAND | 29.28 | 277.1 | 0.1643 | 2.933 | 70 | 80.00 | 133.1 | `#06180F` / `#34D399` / `#A7F3D0` |
| 5 | VAULT | 32.21 | 299.3 | 0.1594 | 2.844 | 73 | 82.67 | 146.4 | `#041C1C` / `#2DD4BF` / `#99F6E4` |
| 6 | RING 0 | 35.43 | 323.3 | 0.1546 | 2.756 | 76 | 85.33 | 161.1 | `#1C0508` / `#FB7185` / `#FFFFFF` |
| 7 | CRYPT | 38.97 | 349.1 | 0.1499 | 2.667 | 80 | 88.00 | 177.2 | `#1A1405` / `#EAB308` / `#FDE68A` |
| 8 | CONSENSUS | 42.87 | 377.0 | 0.1454 | 2.578 | 83 | 90.67 | 194.9 | `#0D1117` / `#94A3B8` / `#E2E8F0` |
| 9 | SENTINEL | 47.16 | 407.2 | 0.1411 | 2.489 | 86 | 93.33 | 214.4 | `#1A0620` / `#F0ABFC` / `#FFFFFF` |
| 10 | ROOT ZERO | 51.87 | 439.8 | 0.1368 | 2.400 | 90 | 96.00 | 235.8 | `#000000` / cycles all 9 / `#FFFFFF` |

All values match the GDD's tables (it rounds 51.87→51.9, 439.8→440, 0.1368→0.13, 235.8→236).

### The Conduit

- Tube radius **R = 6.0u**
- Bands: **WALL r=5.7**, **MID r=5.0**, **CORE r=4.2** (MID is the default lane)
- Band ownership zones split at the midpoints: 5.35 and 4.6
- **16 angular slots**, 22.5° apart. Player angle is continuous; entities snap to slots.
- Ribs every 8u
- Slot 0 is at the top of the tube; θ increases clockwise; `x = sin θ · r`, `y = cos θ · r`

---

## 7. Decisions, deviations, and resolved ambiguities

**This is the most important section in the document.** Everything here is a place where the GDD was silent, ambiguous, or (in two cases) where following it literally produced a worse game. Each entry states what I did and why, so you can reverse it knowingly.

### 7.1 Chunk authoring is scaled by speed — DEVIATION

**GDD §12** describes chunks as *"8–16 second patterns"* but its schema and worked example are in world units (`thread-the-needle`, length 96u).

Those cannot both hold. Speed rises 2.36× across the run, so a fixed unit length reads as 4.4s at EDGE and 1.9s at ROOT ZERO.

**What I did:** chunks are authored in world units at layer-1 speed, and the generator multiplies every `z` offset and the chunk length by `speed / 22` at generation time (`CHUNK_REFERENCE_SPEED` in `generator.ts`). An authored phrase therefore keeps its **duration** across all ten layers, which is what makes the GDD's 8–16s target true everywhere.

`thread-the-needle` is in the library **verbatim** at its specified 96u/cost 34 — it reads as a short, aggressive 4.4s phrase. The other 80 chunks are sized 176–380u to land in the 8–16s window.

**To reverse:** set `CHUNK_REFERENCE_SPEED` scaling to 1 and re-author every chunk length.

### 7.2 The generator has a budget *floor*, not just a ceiling — DEVIATION

**GDD §12** says the budget *"fills linearly from 60% to 100% across its duration"* and the generator *"draws chunks whose cost fits the remaining window."*

Implemented literally (draw anything under the ceiling), this is broken, and I only caught it because `matrix:verify` prints hazard density. The cheap early-layer chunks vastly outnumber the late ones, so a uniform draw regresses every layer's difficulty toward EDGE regardless of budget. **Root Zero was generating 11 hazards in 90 seconds** — a recital of nothing.

**What I did:** added `BUDGET_FLOOR = 0.62` in `generator.ts`. A chunk must cost at least 62% of the current ceiling to be drawn. Breath chunks are exempt (they are the deliberate release), and the forced teaching chunk is exempt (see 7.3).

**Result:** L10 average chunk cost went from ~20 to 37.7 against a ceiling of 75, and Root Zero now draws its recital chunks.

**This is the single most consequential change I made to the design.** If Root Zero ever feels thin again, check this constant first.

### 7.3 The generator forces each layer's teaching chunk — ADDITION

**GDD §11:** *"Each layer teaches exactly one new thing, then compounds."*

Left to the shuffle, a layer could fail to draw any chunk carrying its new mechanic. The generator now forces the first non-breath draw of a layer to come from the pool of chunks whose `minLevel === level`, when such chunks exist, and takes the cheapest one even if it exceeds the early ceiling. `matrix:verify` asserts this holds across 12 seeded runs per layer.

### 7.4 Layers end at their nominal duration — DEVIATION

Originally the layer ended wherever the last chunk finished, overshooting the GDD's duration table by up to 7%. `plan.length` is now exactly `speed × duration`; content is still generated past the boundary so the tube is full when the backdoor opens. A phrase cut at the boundary is invisible because the transition constricts the tube.

### 7.5 Sonar ping threshold — AMBIGUITY RESOLVED

**GDD §9.1** puts the locked-on sonar ping at **90%** Trace, in an explicit 40/70/90/100 ladder. **GDD §15** lists it under the *"Trace above 70%"* adaptive rule.

**Resolved to 90%**, because §9.1 is the systems spec and owns the ladder. The high-pass filter and −4dB duck still land at **70%**, where both sections agree. Constants: `FILTER_TRACE = 70`, `PING_TRACE = 90` in `audio.ts`.

### 7.6 Avatar-as-key — GDD OPEN QUESTION §19.1 RESOLVED

The GDD asks: *"is that already canon for the character, or is the name coincidental?"*

**Resolved: it is canon.** The Bible gives MIFTACH 𐤇𐤕𐤐𐤌 as *"Key; the one who unlocks,"* lists an **encrypted key vault** and a **universal hardline access key** among his systems, and describes his signature act as producing the frequency a sealed door recognises. The Keyshard silhouette is built on that, and the citation is in the header comment of `render/keyshard.ts`.

**Corollary:** GDD §18 puts *"any appearance by Miftach himself"* out of scope for v1, and §3 says *"His face never appears."* The two supplied reference images therefore informed no shipped asset. The game has **zero bitmap art** — every pixel is generated. This is also why no image pipeline (Higgsfield or otherwise) was wired up.

### 7.7 Where it lives — GDD OPEN QUESTION §19.3 RESOLVED

The GDD offers: standalone site, member-area unlock, or itch.io.

**Resolved: public route at `/matrix`, outside the `(site)` layout group.** Lowest-risk choice that keeps every option open — it is playable and linkable now, needs no env vars, and member-gating later is a middleware change, not a restructure. Persistence is `localStorage`, per §16.

### 7.8 Soundtrack — GDD OPEN QUESTION §19.2 NOT RESOLVED — **needs the creator**

Still open. The GDD asks: ten existing catalogue cuts vs. purpose-written stems.

**What I built to keep both doors open:** audio is fully synthesised, so the game ships with a real adaptive score and zero audio assets. Tempo already tracks the GDD's map (`100 × 1.1^(n-1)`, landing at 235.8 BPM). `MatrixAudio.loadStems(urls: Record<number, string>)` accepts one buffer per layer; when a stem exists for the current layer it replaces the synth bed and the step scheduler stands down. Adaptive mixing, ducking, filtering and the whole SFX bus are unaffected either way.

**If the answer is "use the catalogue":** the ten cuts must share key and harmonic bed (GDD §15) for the transitions to work, and their tempos should sit near the table above or the tempo/speed coupling breaks.

### 7.9 Root Zero ending — GDD OPEN QUESTION §19.4 NOT RESOLVED

Does clearing Root Zero unlock anything in the wider 4009 property? Currently it prints `ROOT ZERO. WE WERE NEVER HERE.` plus a Miftach sign-off and returns to the title. Copy lives in `COPY` in `config.ts`.

### 7.10 The telemetry beacon — GAP FILLED

**GDD §9.1** gives a Trace rule for *"Telemetry beacon in sight radius, per second: +4/s"* but §10's entity catalog never defines the beacon.

I implemented it as a passive entity (`beacon`, `BEACON_SIGHT = 9u`, introduced L7) rather than dropping the rule. It raises Trace continuously while you are inside its radius — no contact required. This is completing the spec, not inventing, but flag it if the creator intended something else.

### 7.11 Honeypot is classed as a *major* hazard — INTERPRETATION

Overclock *"phases through minor hazards."* Classing the honeypot as minor would let Overclock nullify the one entity whose whole purpose is to break the player's trust in glowing round things (§10, design note). It is `major: true` so the lesson always lands.

### 7.12 Trail depth is compressed in the renderer — RENDERING COMPROMISE

The trail's 24 samples fade over 0.8s = 17.6u of history at layer 1. The camera sits 2.2u behind the Keyshard. A physically-placed ribbon renders **entirely behind the near plane** and is invisible.

The *angles* are the informative part — a turn leaves an arc of past positions curving around the tube. So `Trail.update()` keeps θ and radius true and compresses z into the gap between the bow and the camera (`TRAIL_NEAR = 0.5`, `TRAIL_FAR = 1.85`). The read is identical and it is actually on screen. Documented in-file.

### 7.13 Rails and ribs are shader-computed, not geometry — IMPLEMENTATION CHOICE

GDD §13.2 lists rails as *"instanced line geometry with a screen-space width floor of 1.5px."* Implementing them as analytic lines inside the tube's fragment shader (via `fwidth`) gets that floor exactly, for free, and costs **zero extra draw calls**. Same for ribs. This is how the whole scene fits the ≤40 draw-call budget with room to spare.

### 7.14 Traced red is reserved and audited

`#FF2E4D` appears **only** in: the Trace bar, the Keyshard core above 60% Trace, the trail above 60% Trace, the telemetry log text, and the hit flash. Every hazard colour was chosen to avoid it — e.g. ICE is `#FF5A47`, not the reserved red. Preserve this. It is the reason the screen going red is felt before it is read.

---

## 8. Systems reference

### Trace (the fail state)

| Event | Δ Trace |
| --- | --- |
| Passive decay, clean for 2s | −1.5 /s |
| Minor hazard (tripwire, debris) | +10 |
| Major hazard (firewall, IDS, hash wall, ICE, race, logic bomb) | +22 |
| Honeypot | +25 and combo reset |
| Null void (fall out of the skin) | +40 and a 1s tumble |
| Telemetry beacon, per second in radius | +4 /s |
| Scrub token | −18 |
| Layer clear | −25 (carries between layers) |

Ladder: **40%** scanlines fade in · **70%** the wall starts printing your coordinates · **90%** sonar ping every 0.6s · **100%** `SUBJECT IDENTIFIED`, tube goes white, run ends.

Sentinel doubles Trace *gain* while locked. Assist mode halves it.

### Cycles / Overclock

0–100, spend 35. Overclock = 1.6× speed for 1.2s, phase through **minor** hazards only, 2× score, Trace decay pauses. Refill: entropy mote +12, graze +15, perfect chunk clear +25.

### Score

`points = base × combo × (1 + speed_bonus) × overclock_mult`, where `speed_bonus = v/22 − 1`.
Combo starts ×1, +0.25 per collectible (+1.0 for zero-day), caps ×8, resets on any Trace-raising hit. The rate limiter kills combo *gain* without damaging — worse than damage at high combo.

### Entity catalog — 21 kinds

Shape rule (this is the accessibility system): **want it → round and glowing. Run from it → angular and red-shifted.** Colour is redundant, never primary.

| Kind | Role | Arc | Depth | Band | Trace | Major | L |
|---|---|---|---|---|---|---|---|
| packet | collect | 12° | 1.4 | authored | — | — | 1 |
| mote | collect | 12° | 1.4 | authored | — | — | 1 |
| zeroday | collect | 16° | 2.0 | authored | — | — | 2 |
| roottoken | collect | 16° | 2.0 | authored | — | — | 3 |
| scrub | collect | 26° | 1.6 | authored | −18 | — | 3 |
| cert | collect | 16° | 2.0 | authored | — | — | 5 |
| socket | collect | 67.5° | 2.4 | authored | — | — | 4 |
| tripwire | avoid | authored | 0.8 | one band | +10 | no | 1 |
| debris | avoid | 14° | 1.6 | authored | +10 | no | 1 |
| firewall | avoid | 360° | 1.8 | ALL | +22 | yes | 2 |
| ids | avoid | 45° | 2.4 | ALL | +22 | yes | 3 |
| honeypot | avoid | 16° | 2.0 | authored | +25 | yes | 4 |
| hashwall | avoid | 360° | 1.8 | ALL | +22 | yes | 5 |
| ratelimit | avoid | 360° | 6.0 | MID | 0 | no | 5 |
| ice | avoid | 14° | 2.0 | ALL | +22 | yes | 6 |
| nullvoid | avoid | 45° | 8.0 | WALL | +40 | yes | 6 |
| race | avoid | 45° | 1.8 | ALL | +22 | yes | 7 |
| logicbomb | avoid | 16°→112.5° | 2.0 | ALL | +22 | yes | 8 |
| gc | avoid | 360° | 4.0 | ALL | run over | yes | 8 |
| sentinel | avoid | 30° | 1.4 | ALL | ×2 gain | no | 9 |
| beacon | avoid | 12° | 1.4 | ALL | +4/s | no | 7 |

Behaviour constants: `ICE_TRACK_TIME 1.2s`, `LOGICBOMB_FUSE 2.0s`, `SENTINEL_DELAY 0.5s`, `SENTINEL_BREAK_DEG 180`, `RACE_HZ 6`, `FIREWALL_SPIN ±40°/s`.

Garbage collector: spawns 50u behind, closes at `1.03 ×` base speed for 15s. One Overclock buys real distance; a rate limiter is genuinely dangerous.

### Collision

Pure analytic in cylindrical coordinates, **swept in z**. At 51.87 m/s and 60fps the player moves 0.86u/frame, which is wider than some entities are deep — hence the sweep, as the GDD requires. Player footprint: 6° arc, ±0.18u radial. Graze = miss distance < 0.35u without contact.

The simulation runs a **fixed 1/120s timestep** with up to 8 substeps per frame (`game.ts`), so collision accuracy does not depend on framerate. Below ~15fps the game slows down rather than tunnelling — a deliberate, standard tradeoff.

### Chunk library

81 chunks: 6 shared breath chunks + 8 per layer for L1–L9 + 3 Root Zero recital chunks. (L1's row below includes the 6 breath chunks.)

| minLevel | Chunks | Cost range | Length range |
|---|---|---|---|
| 1 | 14 | 5–28 | 176–260 |
| 2 | 8 | 22–44 | 96–300 |
| 3 | 8 | 26–48 | 240–310 |
| 4 | 8 | 24–50 | 230–320 |
| 5 | 8 | 30–54 | 250–340 |
| 6 | 8 | 34–58 | 260–350 |
| 7 | 8 | 30–60 | 270–360 |
| 8 | 8 | 38–62 | 280–370 |
| 9 | 8 | 26–60 | 290–370 |
| 10 | 3 | 56–64 | 350–380 |

Authoring shorthands (expanded in `generator.ts`):
- `trailTo` on a packet expands into a run of packets walking the short way round to the target slot, 14u apart. This is the *"bread crumbs that draw the line."*
- `slots: [...]` sets the centre (circular mean, so `[14,15,0,1]` correctly centres on 15.5) and the arc width.
- `open: [...]` on a firewall names the open slots; the renderer draws the closed remainder.
- `openBand` on a hash wall names the single passable band.

Generator rules enforced and asserted: cost within `[0.62·ceiling, ceiling]`, no chunk repeats within 3 draws, a breath chunk is forced after any two 30+ chunks, each layer draws its teaching chunk.

---

## 9. Verified vs unverified — be precise about this

### Verified

- `npx tsc --noEmit` clean.
- `npx next build` passes. `/matrix` is statically prerendered, 174 kB route JS / 280 kB first load.
- `npm run matrix:verify` — **ALL CHECKS PASSED.** Covers: chunk id uniqueness, entity/level gating, breath chunks collectibles-only, z-sortedness, no-repeat-within-3, forced-breath rule, budget floor/ceiling, teaching-chunk presence (12 seeded runs × 10 layers), all 21 entity kinds reachable from generation, every hazard registers contact, GDD tuning table (L1/L10 speed and ω, L10 BPM, band radii), and a full autopilot playthrough of all ten layers.
- **In-browser, headless Chromium (software GL):** page loads, all shaders compile, **zero console errors**, entities render, packets are collected (score/combo advanced), HUD updates, no runtime exceptions.

### NOT verified — do this first

1. **60fps on real GPU hardware.** The container only has SwiftShader (~7fps), which cannot exercise the performance budget. GDD §16 budget: ≤40 draw calls, ≤120k triangles, 4ms post, 6ms headroom.
2. **Quality tier auto-detection.** `detectTier()` probes the first 30 frames. Its thresholds are untested against real hardware and will need tuning.
3. **The GDD's own feel test (§17.1)** — *"set the speed to level 10's 51.9 m/s and play for two minutes. If it's fun with grey boxes at full speed, the game works."* Use **LAYER SELECT → 10** on the title screen. **This is the single most valuable thing you can do next.**
4. **Mobile touch input.** Relative-drag steering, two-finger-tap Overclock and corner-tap pause are implemented but untested on a device. GDD requires testing low tier on a five-year-old Android.
5. **Gamepad.** Implemented against the standard mapping, no pad available to test.
6. **Audio.** No audio device in the container. Nothing has ever been heard.
7. **The wall-writes-you signature above 70% Trace.** The code path is implemented and compiles, but the autopilot never got Trace high enough to see it render. Force it by editing `TRACE_WALL_WRITES` down temporarily, or take deliberate hits.

### Known observation, not a bug

`matrix:verify` shows an **idle player survives Root Zero**: 7 hazard contacts across 90s, and passive decay at −1.5/s clears the damage. That is exactly what the GDD's numbers produce — Trace is a pressure system, not a health bar. If you want a passive line to be lethal at L10, the lever is `TRACE_DECAY_PER_SEC`, **not** hazard density. Raising density would break the breath-chunk rhythm that the GDD is emphatic about.

---

## 10. Suggested next steps, in order

1. **Run the §17.1 feel test on real hardware at L10.** Everything else is decoration until this passes. If it fails, tune ω scaling (`OMEGA_RATE`) and `RADIAL_BASE`/`RADIAL_RATE` in `config.ts`.
2. **Profile against the §16 budget** on a mid-range GPU and a phone. Tune `detectTier()` thresholds from real numbers.
3. **Get a creator decision on the soundtrack (§7.8)** — it is the last GDD open question with real engineering consequences.
4. **Get a creator decision on BLakHarts vs BLakHartz (§3).**
5. **Playtest the chunk library.** 81 chunks is the GDD's target, but they have only ever been played by an autopilot. Expect to re-cost and re-phrase a dozen of them. `matrix:verify` prints hazard density per layer to guide this.
6. **Verify the signature moment** (§9 item 7). GDD §13.5: *"build this one well and keep everything else disciplined."*

### Explicitly out of scope for v1 (GDD §18)

Multiplayer, online leaderboards, unlockable skins, story cutscenes, a player-facing level editor, procedural generation beyond the chunk shuffler, and any appearance by Miftach himself. *"None of them make the first version better, and all of them cost time that belongs to the feel test."*

---

## 11. Conventions

- **Never import Three.js into `lib/matrix/*.ts` outside `render/`.** It breaks `matrix:verify`.
- Copy voice is terse, system-log register, **no exclamation points, never cute.** All strings live in `COPY` in `config.ts`.
- Typography (GDD §13.4): JetBrains Mono for HUD/data, IBM Plex Mono for body, Archivo (variable, `wdth` 125) for titles. **Avoid Orbitron, Share Tech Mono, and anything else that ships pre-installed on the idea of "cyber."**
- Base ink is `#05060B` — never pure black except Root Zero, where black is the statement.
- Hazards are always red-shifted relative to the layer palette; collectibles always brighter and higher-saturation.
- Reduced motion kills chromatic aberration, camera roll and shake, and **must never touch gameplay.**
- The scanlines are a mechanic, not a mood. They appear above 40% Trace and nowhere else.

---

## 12. Attribution

Built to **MIFTACH'S MATRIX — Game Design Document v1.0**.
Property: **4009 / The BLakHartz**.
Credit line: **STRESMATIC x DROOP-E / Trillionaire Thoughts Entertainment**.
© 2026 [COPYRIGHT OWNER — field still unset in the Bible]. All rights reserved.
