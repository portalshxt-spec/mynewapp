import { NextResponse } from "next/server";
import { isEmailConfigured, sendAccessLink } from "@/lib/email";
import { hasAnyEntitlement } from "@/lib/entitlements";
import { createMagicToken } from "@/lib/tokens";
import { isValidEmail } from "@/lib/utils";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Only email real buyers, but always answer the same way so the endpoint
    // can't be used to probe which emails have purchased.
    if (isEmailConfigured() && (await hasAnyEntitlement(email))) {
      const token = await createMagicToken(email, "member");
      await sendAccessLink(email, token);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("access error", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
