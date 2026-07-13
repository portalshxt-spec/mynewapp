export default function OnAirBadge({ live }: { live: boolean }) {
  return (
    <span
      className={`display inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold tracking-[0.2em] transition-all ${
        live
          ? "onair-live border-onair text-onair shadow-neon-red"
          : "border-edge text-neutral-600"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-onair" : "bg-neutral-700"}`}
      />
      ON AIR
    </span>
  );
}
