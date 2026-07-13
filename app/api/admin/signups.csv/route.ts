import { apiAdminSession } from "@/lib/auth";
import { db } from "@/lib/supabase";

/** CSV export of the Become a BlakHart email list. */
export async function GET() {
  if (!(await apiAdminSession())) return new Response("Unauthorized", { status: 401 });

  const { data } = await db()
    .from("signups")
    .select("email, created_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []).map((r) => `${r.email},${r.created_at}`);
  return new Response(["email,signed_up_at", ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="blakharts-list-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
