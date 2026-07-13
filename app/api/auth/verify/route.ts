import { NextResponse } from "next/server";
import { adminEmails, siteUrl } from "@/lib/env";
import { createSessionJwt, sessionCookieOptions } from "@/lib/session";
import { consumeMagicToken } from "@/lib/tokens";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";

  const result = token ? await consumeMagicToken(token) : null;
  if (!result) {
    return NextResponse.redirect(`${siteUrl()}/access?expired=1`);
  }

  const isAdmin = result.purpose === "admin" && adminEmails().includes(result.email);
  const jwt = await createSessionJwt({
    email: result.email,
    role: isAdmin ? "admin" : "member",
  });

  const destination = isAdmin ? "/admin" : "/member";
  const res = NextResponse.redirect(`${siteUrl()}${destination}`);
  const { name, ...options } = sessionCookieOptions();
  res.cookies.set(name, jwt, options);
  return res;
}
