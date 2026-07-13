import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader tagline={settings.tagline} />
      <main className="flex-1">{children}</main>
      <SiteFooter text={settings.footer_text} />
    </div>
  );
}
