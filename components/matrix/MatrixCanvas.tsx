"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Hud from "./Hud";
import { MatrixGame } from "@/lib/matrix/game";
import { COPY, LEVELS } from "@/lib/matrix/config";
import { CATALOG, CODEX_ORDER } from "@/lib/matrix/catalog";
import { DEFAULT_SETTINGS, load, saveSettings, type Settings } from "@/lib/matrix/persistence";
import type { HudSnapshot } from "@/lib/matrix/types";

const INITIAL_HUD: HudSnapshot = {
  phase: "title",
  level: 1,
  levelName: "EDGE · public net, recon",
  accent: "#7DD3FC",
  trace: 0,
  cycles: 0,
  score: 0,
  combo: 1,
  speed: 22,
  layerProgress: 0,
  overclock: false,
  certCharges: 0,
  message: "",
  banner: "",
};

type Panel = "none" | "settings" | "codex" | "layers";

export default function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<MatrixGame | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [paused, setPaused] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [panel, setPanel] = useState<Panel>("none");
  const [records, setRecords] = useState({ bestRun: 0, unlocked: 1 });
  const [ready, setReady] = useState(false);

  // ---- boot ---------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const data = load();
    setSettings(data.settings);
    setRecords({ bestRun: data.bestRun, unlocked: data.unlocked });

    const game = new MatrixGame(canvas, {
      onHud: setHud,
      onPauseToggle: setPaused,
    });
    gameRef.current = game;
    game.mount();
    setReady(true);

    const onResize = () => game.resize();
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  const inject = useCallback(
    async (level = 1) => {
      setPanel("none");
      await gameRef.current?.start(level);
    },
    [],
  );

  const recompile = useCallback(async () => {
    setPanel("none");
    await gameRef.current?.recompile();
    const data = load();
    setRecords({ bestRun: data.bestRun, unlocked: data.unlocked });
  }, []);

  const patchSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      saveSettings(next);
      gameRef.current?.applySettings(next);
      return next;
    });
  }, []);

  const showTitle = hud.phase === "title";
  const showEnd = hud.phase === "traced" || hud.phase === "root";
  const overlayOpen = showTitle || showEnd || paused;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        aria-label="Miftach's Matrix — the Conduit"
      />

      {!overlayOpen && <Hud hud={hud} />}

      {/* ---- Title ------------------------------------------------------ */}
      {showTitle && (
        <Overlay>
          <p className="mm-stamp">{COPY.compileStamp}</p>
          <h1 className="mm-title">
            MIFTACH&rsquo;S
            <br />
            MATRIX
          </h1>
          <p className="mm-sub">
            Ten layers down to root. Ten percent faster every layer.
            <br />
            Grab what gets you deeper. Dodge what gets you caught.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button className="mm-btn mm-btn-primary" onClick={() => inject(1)} disabled={!ready}>
              INJECT
            </button>
            <button className="mm-btn" onClick={() => setPanel(panel === "layers" ? "none" : "layers")}>
              LAYER SELECT
            </button>
            <button className="mm-btn" onClick={() => setPanel(panel === "codex" ? "none" : "codex")}>
              CODEX
            </button>
            <button
              className="mm-btn"
              onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
            >
              SETTINGS
            </button>
          </div>

          {records.bestRun > 0 && (
            <p className="mm-stamp mt-6">BEST RUN · {records.bestRun.toLocaleString()}</p>
          )}

          <Controls />

          {panel === "layers" && (
            <Panelled title="LAYER SELECT">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {LEVELS.map((level) => {
                  const locked = level.n > records.unlocked;
                  return (
                    <button
                      key={level.n}
                      disabled={locked}
                      onClick={() => inject(level.n)}
                      className="mm-cell"
                      style={{ borderColor: locked ? "#222" : level.rail }}
                    >
                      <span className="block text-[9px] opacity-60">
                        {String(level.n).padStart(2, "0")}
                      </span>
                      <span
                        className="block text-[11px]"
                        style={{ color: locked ? "#3a3a3a" : level.accent }}
                      >
                        {locked ? "LOCKED" : level.name}
                      </span>
                      <span className="block text-[9px] opacity-50">
                        {level.speed.toFixed(1)} m/s
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panelled>
          )}

          {panel === "codex" && (
            <Panelled title="CODEX">
              <p className="mb-3 text-[10px] leading-relaxed opacity-60">
                If a working operator would want it, it glows and it&rsquo;s round. If a working
                operator would run from it, it&rsquo;s angular and it&rsquo;s red-shifted.
              </p>
              <div className="grid max-h-[38vh] grid-cols-1 gap-x-6 gap-y-1 overflow-y-auto sm:grid-cols-2">
                {CODEX_ORDER.map((kind) => {
                  const def = CATALOG[kind];
                  return (
                    <div key={kind} className="flex items-baseline gap-2 text-[10px]">
                      <span
                        className="w-[86px] shrink-0"
                        style={{ color: def.role === "collect" ? "#7DE8FF" : "#FF8A6B" }}
                      >
                        {def.label}
                      </span>
                      <span className="opacity-50">{def.concept}</span>
                      <span className="ml-auto shrink-0 opacity-35">L{def.minLevel}</span>
                    </div>
                  );
                })}
              </div>
            </Panelled>
          )}

          {panel === "settings" && (
            <SettingsPanel settings={settings} onChange={patchSettings} />
          )}

          <Link href="/" className="mm-stamp mt-8 underline-offset-4 hover:underline">
            ← BLAKHARTS
          </Link>
        </Overlay>
      )}

      {/* ---- Paused ------------------------------------------------------ */}
      {paused && !showTitle && !showEnd && (
        <Overlay>
          <h2 className="mm-heading">PAUSED</h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button className="mm-btn mm-btn-primary" onClick={() => gameRef.current?.setPaused(false)}>
              RESUME
            </button>
            <button className="mm-btn" onClick={() => gameRef.current?.restartLayer()}>
              RESTART LAYER
            </button>
            <button className="mm-btn" onClick={recompile}>
              {COPY.retry}
            </button>
            <button
              className="mm-btn"
              onClick={() => setPanel(panel === "settings" ? "none" : "settings")}
            >
              SETTINGS
            </button>
          </div>
          {panel === "settings" && <SettingsPanel settings={settings} onChange={patchSettings} />}
        </Overlay>
      )}

      {/* ---- End of run --------------------------------------------------- */}
      {showEnd && (
        <Overlay>
          <h2
            className="mm-heading"
            style={{ color: hud.phase === "traced" ? "#FF2E4D" : "#FFFFFF" }}
          >
            {hud.phase === "traced" ? COPY.traced : COPY.root}
          </h2>
          {hud.phase === "root" && <p className="mm-sub mt-4">{COPY.signoff}</p>}
          <dl className="mt-8 flex gap-10 text-[11px] tracking-[0.25em]">
            <div>
              <dt className="opacity-50">SCORE</dt>
              <dd className="mt-1 text-[18px] tabular-nums">{hud.score.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="opacity-50">REACHED</dt>
              <dd className="mt-1 text-[18px] tabular-nums">
                LAYER {String(hud.level).padStart(2, "0")}
              </dd>
            </div>
            <div>
              <dt className="opacity-50">BEST</dt>
              <dd className="mt-1 text-[18px] tabular-nums">
                {Math.max(records.bestRun, hud.score).toLocaleString()}
              </dd>
            </div>
          </dl>
          <div className="mt-8 flex gap-3">
            <button className="mm-btn mm-btn-primary" onClick={recompile}>
              {COPY.retry}
            </button>
            <Link href="/" className="mm-btn">
              EXIT
            </Link>
          </div>
        </Overlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center overflow-y-auto bg-black/78 px-6 py-10 text-center backdrop-blur-sm">
      {children}
    </div>
  );
}

function Panelled({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 w-full max-w-2xl border-t border-white/10 pt-5 text-left">
      <h3 className="mm-stamp mb-3">{title}</h3>
      {children}
    </section>
  );
}

function Controls() {
  const rows: Array<[string, string]> = [
    ["ROTATE", "← → / A D · left stick · drag · mouse X"],
    ["DIVE TO CORE", "↓ / S · stick down / LT · drag down · hold RMB"],
    ["HUG WALL", "↑ / W · stick up · drag up"],
    ["OVERCLOCK", "SPACE · A / RB · two-finger tap · LMB"],
    ["PAUSE", "ESC · START · top-left corner"],
  ];
  return (
    <dl className="mt-10 grid w-full max-w-xl grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-left text-[10px] tracking-[0.18em] opacity-55">
      {rows.map(([action, binding]) => (
        <div key={action} className="contents">
          <dt>{action}</dt>
          <dd className="opacity-70">{binding}</dd>
        </div>
      ))}
    </dl>
  );
}

function SettingsPanel({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  return (
    <Panelled title="SETTINGS">
      <div className="grid gap-3 text-[10px] tracking-[0.18em] sm:grid-cols-2">
        <Toggle
          label="ASSIST MODE"
          hint="Caps speed at 1.05/layer, halves Trace gain"
          value={settings.assist}
          onChange={(assist) => onChange({ assist })}
        />
        <Toggle
          label="REDUCED MOTION"
          hint="No aberration, roll or shake. Gameplay untouched"
          value={settings.reducedMotion}
          onChange={(reducedMotion) => onChange({ reducedMotion })}
        />
        <Toggle
          label="GHOST TRAIL"
          hint="Replay your best run as a translucent path"
          value={settings.showGhost}
          onChange={(showGhost) => onChange({ showGhost })}
        />
        <Toggle
          label="MUTE"
          hint="Silence the whole mix"
          value={settings.audio.muted}
          onChange={(muted) => onChange({ audio: { ...settings.audio, muted } })}
        />

        <label className="flex flex-col gap-1">
          <span className="opacity-60">QUALITY</span>
          <select
            className="mm-select"
            value={settings.quality ?? "auto"}
            onChange={(e) =>
              onChange({
                quality: e.target.value === "auto" ? null : (e.target.value as Settings["quality"]),
              })
            }
          >
            <option value="auto">AUTO-DETECT</option>
            <option value="high">HIGH</option>
            <option value="medium">MEDIUM</option>
            <option value="low">LOW</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="opacity-60">MUSIC · {Math.round(settings.audio.music * 100)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.audio.music}
            className="scrubber"
            onChange={(e) =>
              onChange({ audio: { ...settings.audio, music: Number(e.target.value) } })
            }
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="opacity-60">SFX · {Math.round(settings.audio.sfx * 100)}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.audio.sfx}
            className="scrubber"
            onChange={(e) =>
              onChange({ audio: { ...settings.audio, sfx: Number(e.target.value) } })
            }
          />
        </label>
      </div>

      <Rebinder settings={settings} onChange={onChange} />
    </Panelled>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex flex-col items-start gap-1 border border-white/10 px-3 py-2 text-left transition-colors hover:border-white/30"
    >
      <span className="flex w-full items-center justify-between gap-3">
        <span>{label}</span>
        <span style={{ color: value ? "#7DE8FF" : "#555" }}>{value ? "ON" : "OFF"}</span>
      </span>
      <span className="text-[9px] normal-case tracking-normal opacity-40">{hint}</span>
    </button>
  );
}

const ACTIONS: Array<[keyof Settings["bindings"], string]> = [
  ["left", "ROTATE LEFT"],
  ["right", "ROTATE RIGHT"],
  ["dive", "DIVE TO CORE"],
  ["hug", "HUG WALL"],
  ["boost", "OVERCLOCK"],
  ["pause", "PAUSE"],
];

function Rebinder({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const [listening, setListening] = useState<keyof Settings["bindings"] | null>(null);

  useEffect(() => {
    if (!listening) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") {
        onChange({ bindings: { ...settings.bindings, [listening]: [e.code] } });
      }
      setListening(null);
    };
    window.addEventListener("keydown", onKey, { capture: true, once: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [listening, settings.bindings, onChange]);

  return (
    <div className="mt-5">
      <p className="mm-stamp mb-2">KEY BINDINGS</p>
      <div className="grid gap-1 sm:grid-cols-2">
        {ACTIONS.map(([action, label]) => (
          <button
            key={action}
            type="button"
            onClick={() => setListening(action)}
            className="flex items-center justify-between border border-white/10 px-3 py-1.5 text-[10px] tracking-[0.18em] transition-colors hover:border-white/30"
          >
            <span className="opacity-60">{label}</span>
            <span style={{ color: listening === action ? "#FFC93C" : "#7DE8FF" }}>
              {listening === action ? "PRESS A KEY" : settings.bindings[action].join(" / ")}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
