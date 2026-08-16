"use client";

import { useEffect, useRef, useState } from "react";
import type { HudSnapshot } from "@/lib/matrix/types";

/** Traced red. Reserved — the only red thing on screen. */
const TRACED_RED = "#FF2E4D";
const CYCLE_SEGMENTS = 10;

/**
 * Diegetic and minimal. Four elements, no panels, no boxes.
 */
export default function Hud({ hud }: { hud: HudSnapshot }) {
  const [layerVisible, setLayerVisible] = useState(true);
  const [shake, setShake] = useState(false);
  const previousCombo = useRef(hud.combo);
  const previousLevel = useRef(hud.level);

  // Layer name fades out 3s after the layer starts.
  useEffect(() => {
    if (previousLevel.current !== hud.level) {
      previousLevel.current = hud.level;
    }
    setLayerVisible(true);
    const timer = window.setTimeout(() => setLayerVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, [hud.level]);

  // The combo number physically shakes apart when it breaks.
  useEffect(() => {
    if (hud.combo < previousCombo.current - 0.001) {
      setShake(true);
      const timer = window.setTimeout(() => setShake(false), 420);
      previousCombo.current = hud.combo;
      return () => window.clearTimeout(timer);
    }
    previousCombo.current = hud.combo;
  }, [hud.combo]);

  const lit = Math.round((hud.cycles / 100) * CYCLE_SEGMENTS);
  const overclockReady = hud.cycles >= 35;

  return (
    <div className="pointer-events-none absolute inset-0 select-none font-mono text-[11px] uppercase tracking-[0.2em]">
      {/* Layer name — top left */}
      <div
        className="absolute left-6 top-5 transition-opacity duration-700"
        style={{ opacity: layerVisible ? 1 : 0, color: hud.accent }}
      >
        <span className="text-[10px] opacity-70">LAYER {String(hud.level).padStart(2, "0")} · </span>
        <span>{hud.levelName}</span>
      </div>

      {/* Trace — right edge, vertical, fills upward. The only red thing. */}
      <div className="absolute right-5 top-1/2 h-[46vh] w-[6px] -translate-y-1/2 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="absolute bottom-0 left-0 w-full transition-[height] duration-100 ease-linear"
          style={{
            height: `${hud.trace}%`,
            background: `linear-gradient(to top, ${TRACED_RED}, ${TRACED_RED}cc)`,
            boxShadow: hud.trace > 60 ? `0 0 14px ${TRACED_RED}` : "none",
          }}
        />
      </div>
      <div
        className="absolute right-[6px] top-1/2 translate-y-[26vh] text-[9px] tracking-[0.3em] opacity-60"
        style={{ color: hud.trace > 40 ? TRACED_RED : "#8FA6B4" }}
      >
        TRACE
      </div>

      {/* Cycles — bottom left, segmented. The bar pulses when Overclock is up. */}
      <div className="absolute bottom-6 left-6 flex items-center gap-3">
        <div className={`flex gap-[3px] ${overclockReady && !hud.overclock ? "animate-pulse" : ""}`}>
          {Array.from({ length: CYCLE_SEGMENTS }).map((_, i) => (
            <span
              key={i}
              className="block h-[10px] w-[13px] skew-x-[-18deg]"
              style={{
                background: i < lit ? hud.accent : "rgba(255,255,255,0.09)",
                boxShadow: i < lit && hud.overclock ? `0 0 10px ${hud.accent}` : "none",
              }}
            />
          ))}
        </div>
        <span className="text-[9px] tracking-[0.3em] opacity-60">CYCLES</span>
        {hud.certCharges > 0 && (
          <span className="text-[9px] tracking-[0.3em]" style={{ color: "#BFE6FF" }}>
            CERT ×{hud.certCharges}
          </span>
        )}
      </div>

      {/* Score + combo — bottom right */}
      <div className="absolute bottom-6 right-6 text-right">
        <div className="text-[15px] tracking-[0.14em] text-white/90 tabular-nums">
          {hud.score.toLocaleString()}
        </div>
        <div
          className={`text-[13px] tabular-nums ${shake ? "mm-shake" : ""}`}
          style={{ color: hud.accent }}
        >
          ×{hud.combo.toFixed(2)}
        </div>
      </div>

      {/* Layer progress — a hairline along the bottom, no panel */}
      <div className="absolute bottom-0 left-0 h-[2px] w-full bg-white/[0.05]">
        <div
          className="h-full transition-[width] duration-150 ease-linear"
          style={{ width: `${hud.layerProgress * 100}%`, background: hud.accent }}
        />
      </div>

      {/* System-log messages */}
      {hud.message && (
        <div className="absolute left-1/2 top-16 -translate-x-1/2 text-[10px] tracking-[0.35em] text-white/55">
          {hud.message}
        </div>
      )}
      {hud.banner && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] tracking-[0.3em]"
          style={{ color: hud.accent }}
        >
          {hud.banner}
        </div>
      )}
    </div>
  );
}
