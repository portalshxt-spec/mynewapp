import { NextResponse } from "next/server";
import { db } from "@/lib/supabase";
import { isValidEmail } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    const { error } = await db().from("signups").upsert({ email }, { onConflict: "email" });
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("signup error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
