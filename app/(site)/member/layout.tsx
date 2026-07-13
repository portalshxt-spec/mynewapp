import PlayerProvider from "@/components/player/PlayerProvider";
import RadioBar from "@/components/player/RadioBar";
import { requireMember } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  await requireMember();
  return (
    <PlayerProvider>
      {/* bottom padding keeps content clear of the persistent player bar */}
      <div className="pb-32">{children}</div>
      <RadioBar />
    </PlayerProvider>
  );
}
