/**
 * Input. Keyboard, gamepad, touch and mouse all collapse into one InputState.
 *
 * Touch is a relative drag anywhere on screen, not a virtual stick, and there
 * are no on-screen buttons except pause.
 */

import type { InputState } from "./sim";

export interface Bindings {
  left: string[];
  right: string[];
  dive: string[];
  hug: string[];
  boost: string[];
  pause: string[];
}

export const DEFAULT_BINDINGS: Bindings = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  dive: ["ArrowDown", "KeyS"],
  hug: ["ArrowUp", "KeyW"],
  boost: ["Space"],
  pause: ["Escape"],
};

/** Drag distance, in px, that maps to full deflection. */
const TOUCH_RANGE = 90;
/** Mouse deflection is measured against this fraction of the viewport width. */
const MOUSE_RANGE = 0.28;

export class InputManager {
  private readonly keys = new Set<string>();
  private bindings: Bindings;
  private readonly element: HTMLElement;

  private touchId: number | null = null;
  private touchStart = { x: 0, y: 0 };
  private touchDelta = { x: 0, y: 0 };
  private touchBoost = false;

  private mouseTurn = 0;
  private mouseDive = false;
  private mouseBoost = false;
  private mouseActive = false;

  private boostLatch = false;
  private pausePressed = false;
  private prevGamepadBoost = false;
  private prevGamepadPause = false;

  /** Set by the host so pause can be surfaced to React. */
  onPause: (() => void) | null = null;

  constructor(element: HTMLElement, bindings: Bindings = DEFAULT_BINDINGS) {
    this.element = element;
    this.bindings = bindings;
    this.attach();
  }

  setBindings(bindings: Bindings) {
    this.bindings = bindings;
  }

  private attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointerup", this.onPointerUp);
    this.element.addEventListener("pointercancel", this.onPointerUp);
    this.element.addEventListener("contextmenu", this.onContextMenu);
    this.element.addEventListener("touchstart", this.onTouchStart, { passive: false });
    this.element.addEventListener("touchmove", this.onTouchMove, { passive: false });
    this.element.addEventListener("touchend", this.onTouchEnd);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointerup", this.onPointerUp);
    this.element.removeEventListener("pointercancel", this.onPointerUp);
    this.element.removeEventListener("contextmenu", this.onContextMenu);
    this.element.removeEventListener("touchstart", this.onTouchStart);
    this.element.removeEventListener("touchmove", this.onTouchMove);
    this.element.removeEventListener("touchend", this.onTouchEnd);
  }

  // ---- keyboard -----------------------------------------------------------

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isBound(e.code)) e.preventDefault();
    if (this.keys.has(e.code)) return;
    this.keys.add(e.code);
    if (this.bindings.boost.includes(e.code)) this.boostLatch = true;
    if (this.bindings.pause.includes(e.code)) this.pausePressed = true;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
    this.mouseActive = false;
    this.touchId = null;
    this.touchDelta = { x: 0, y: 0 };
  };

  private isBound(code: string): boolean {
    return Object.values(this.bindings).some((list) => list.includes(code));
  }

  private held(list: string[]): boolean {
    return list.some((code) => this.keys.has(code));
  }

  // ---- mouse --------------------------------------------------------------

  private onPointerMove = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    this.mouseActive = true;
    const rect = this.element.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    const range = rect.width * MOUSE_RANGE;
    this.mouseTurn = Math.max(-1, Math.min(1, (e.clientX - centre) / range));
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (e.button === 0) {
      this.mouseBoost = true;
      this.boostLatch = true;
    }
    if (e.button === 2) this.mouseDive = true;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    if (e.button === 0) this.mouseBoost = false;
    if (e.button === 2) this.mouseDive = false;
  };

  private onContextMenu = (e: Event) => {
    // Right mouse is the CORE dive, so the menu must not fire.
    e.preventDefault();
  };

  // ---- touch --------------------------------------------------------------

  private onTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    // Two-finger tap is Overclock.
    if (e.touches.length >= 2) {
      this.touchBoost = true;
      this.boostLatch = true;
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) return;

    // Top-left corner is pause. It is the only on-screen button.
    const rect = this.element.getBoundingClientRect();
    if (touch.clientX - rect.left < 72 && touch.clientY - rect.top < 72) {
      this.pausePressed = true;
      return;
    }

    this.touchId = touch.identifier;
    this.touchStart = { x: touch.clientX, y: touch.clientY };
    this.touchDelta = { x: 0, y: 0 };
  };

  private onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (this.touchId === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier !== this.touchId) continue;
      this.touchDelta = {
        x: touch.clientX - this.touchStart.x,
        y: touch.clientY - this.touchStart.y,
      };
    }
  };

  private onTouchEnd = (e: TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === this.touchId) {
        this.touchId = null;
        this.touchDelta = { x: 0, y: 0 };
      }
    }
    if (e.touches.length === 0) this.touchBoost = false;
  };

  // ---- gamepad ------------------------------------------------------------

  private readGamepad(): { turn: number; dive: boolean; hug: boolean; boost: boolean } {
    const empty = { turn: 0, dive: false, hug: false, boost: false };
    if (typeof navigator === "undefined" || !navigator.getGamepads) return empty;
    const pads = navigator.getGamepads();
    for (const pad of pads) {
      if (!pad) continue;
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      const dead = 0.18;
      const turn = Math.abs(x) > dead ? x : 0;
      const trigger = (pad.buttons[6]?.value ?? 0) > 0.4;
      const boost = (pad.buttons[0]?.pressed ?? false) || (pad.buttons[5]?.pressed ?? false);
      const start = pad.buttons[9]?.pressed ?? false;

      if (start && !this.prevGamepadPause) this.pausePressed = true;
      this.prevGamepadPause = start;
      if (boost && !this.prevGamepadBoost) this.boostLatch = true;
      this.prevGamepadBoost = boost;

      return {
        turn,
        dive: y > dead || trigger,
        hug: y < -dead,
        boost,
      };
    }
    this.prevGamepadBoost = false;
    this.prevGamepadPause = false;
    return empty;
  }

  /** Consume the current frame's input. Boost is edge-triggered. */
  sample(): InputState {
    const pad = this.readGamepad();

    let turn = 0;
    if (this.held(this.bindings.left)) turn -= 1;
    if (this.held(this.bindings.right)) turn += 1;
    if (turn === 0 && pad.turn !== 0) turn = pad.turn;
    if (turn === 0 && this.touchId !== null) {
      turn = Math.max(-1, Math.min(1, this.touchDelta.x / TOUCH_RANGE));
    }
    if (turn === 0 && this.mouseActive) turn = this.mouseTurn;

    const touchDive = this.touchId !== null && this.touchDelta.y > TOUCH_RANGE * 0.45;
    const touchHug = this.touchId !== null && this.touchDelta.y < -TOUCH_RANGE * 0.45;

    const state: InputState = {
      turn: Math.max(-1, Math.min(1, turn)),
      dive: this.held(this.bindings.dive) || pad.dive || touchDive || this.mouseDive,
      hug: this.held(this.bindings.hug) || pad.hug || touchHug,
      boost: this.boostLatch,
    };

    this.boostLatch = false;

    if (this.pausePressed) {
      this.pausePressed = false;
      this.onPause?.();
    }

    return state;
  }
}
