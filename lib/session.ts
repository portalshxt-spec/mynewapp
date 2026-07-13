import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE = "bh_session";
const THIRTY_DAYS = 60 * 60 * 24 * 30;

export interface Session {
  email: string;
  role: "member" | "admin";
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env("SESSION_SECRET"));
}

export async function createSessionJwt(session: Session): Promise<string> {
  return new SignJWT({ email: session.email, role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${THIRTY_DAYS}s`)
    .sign(secret());
}

export function sessionCookieOptions() {
  return {
    name: COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: THIRTY_DAYS,
  };
}

export async function getSession(): Promise<Session | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    const email = typeof payload.email === "string" ? payload.email : null;
    const role = payload.role === "admin" ? "admin" : "member";
    if (!email) return null;
    return { email: email.toLowerCase(), role };
  } catch {
    return null;
  }
}
