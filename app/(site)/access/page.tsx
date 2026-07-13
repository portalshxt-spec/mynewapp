import AccessForm from "@/components/AccessForm";

export const metadata = { title: "Access" };

export default function AccessPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-24">
      <p className="display neon-cyan text-center text-xs tracking-[0.3em]">MEMBER RE-ENTRY</p>
      <h1 className="display mt-3 text-center text-4xl font-bold tracking-wider text-gold">
        ACCESS
      </h1>
      <p className="mt-4 text-center text-sm leading-relaxed text-neutral-400">
        Already a BlakHart? Enter the email you bought with and we&apos;ll beam you a fresh access
        link. No passwords, ever.
      </p>
      <div className="mt-8">
        <AccessForm />
      </div>
    </div>
  );
}
