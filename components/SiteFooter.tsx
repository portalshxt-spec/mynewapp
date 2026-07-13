export default function SiteFooter({ text }: { text: string }) {
  return (
    <footer className="border-t border-edge">
      <div className="dial-ticks" />
      <div className="mx-auto max-w-6xl px-4 py-10 text-center">
        <p className="display text-sm font-semibold tracking-[0.3em] text-gold">{text}</p>
        <p className="mt-2 text-[11px] uppercase tracking-widest text-neutral-600">
          Broadcasting from nowhere · Heard everywhere · FREQ 4009
        </p>
      </div>
    </footer>
  );
}
