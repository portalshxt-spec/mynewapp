import Link from "next/link";
import { notFound } from "next/navigation";
import { getReleaseBySlug } from "@/lib/data";

export const dynamic = "force-dynamic";

export const metadata = { title: "You're in" };

export default async function ThanksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const release = await getReleaseBySlug(slug);
  if (!release) notFound();

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="display neon-cyan text-sm tracking-[0.3em]">SIGNAL LOCKED</p>
      <h1 className="display mt-4 text-4xl font-bold tracking-wider text-gold">
        WELCOME TO THE BROADCAST
      </h1>
      <p className="mt-6 text-base leading-relaxed text-neutral-300">
        Your access link for <strong className="text-white">{release.title}</strong> is on its way
        to your inbox right now. Tap it to enter THE RADIO.
      </p>
      <p className="mt-4 text-sm text-neutral-500">
        Nothing arriving? Check spam, then request a fresh link on the{" "}
        <Link href="/access" className="text-cyan underline">
          ACCESS
        </Link>{" "}
        page. Your email is your key — no passwords, ever.
      </p>
    </div>
  );
}
