import PagesEditor from "@/components/admin/PagesEditor";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Pages" };

export default async function AdminPagesPage() {
  const settings = await getSettings();

  return (
    <div>
      <h1 className="display mb-8 text-3xl font-bold tracking-wider text-gold">PAGES</h1>
      <PagesEditor initial={settings} />
    </div>
  );
}
