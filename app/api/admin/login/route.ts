import { NextResponse } from "next/server";
import { isEmailConfigured, sendAdminLink } from "@/lib/email";
import { adminEmails } from "@/lib/env";
import { createMagicToken } from "@/lib/tokens";
import { isValidEmail } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }
    // Same generic answer whether or not the email is allowlisted.
    if (isEmailConfigured() && adminEmails().includes(email)) {
      const token = await createMagicToken(email, "admin");
      await sendAdminLink(email, token);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("admin login error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
