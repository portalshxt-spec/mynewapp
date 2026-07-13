"use client";

/** Tiny shared form primitives for the admin panel. */

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="display mb-1 block text-[11px] font-semibold tracking-widest text-neutral-400">
      {children}
    </label>
  );
}

export const inputCls =
  "w-full rounded border border-edge bg-ink px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none focus:border-cyan";

export function Btn({
  children,
  onClick,
  disabled,
  kind = "gold",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  kind?: "gold" | "ghost" | "danger";
  type?: "button" | "submit";
}) {
  const styles = {
    gold: "bg-gold text-ink hover:shadow-neon-gold",
    ghost: "border border-edge text-neutral-300 hover:border-cyan hover:text-cyan",
    danger: "border border-onair/50 text-onair hover:bg-onair/10",
  }[kind];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`display rounded px-4 py-2 text-xs font-bold tracking-widest transition disabled:opacity-40 ${styles}`}
    >
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm text-neutral-300"
    >
      <span
        className={`flex h-5 w-9 items-center rounded-full p-0.5 transition ${
          checked ? "justify-end bg-gold" : "justify-start bg-edge"
        }`}
      >
        <span className="h-4 w-4 rounded-full bg-ink" />
      </span>
      {label}
    </button>
  );
}

export function Note({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "warn" | "ok" }) {
  const cls = { info: "text-neutral-500", warn: "text-onair", ok: "text-cyan" }[tone];
  return <p className={`mt-2 text-xs ${cls}`}>{children}</p>;
}
