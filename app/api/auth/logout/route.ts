import { NextResponse } from "next/server";
import { siteUrl } from "@/lib/env";
import { sessionCookieOptions } from "@/lib/session";

export async function GET() {
  const res = NextResponse.redirect(`${siteUrl()}/`);
  const { name } = sessionCookieOptions();
  res.cookies.delete(name);
  return res;
}
