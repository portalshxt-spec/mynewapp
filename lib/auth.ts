import { redirect } from "next/navigation";
import { adminEmails } from "./env";
import { getSession, Session } from "./session";

export async function requireMember(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/access");
  return session;
}

export async function requireAdmin(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "admin" || !adminEmails().includes(session.email)) {
    redirect("/admin/login");
  }
  return session!;
}

/** For API routes: returns the session or null (caller responds 401). */
export async function apiSession(): Promise<Session | null> {
  return getSession();
}

export async function apiAdminSession(): Promise<Session | null> {
  const session = await getSession();
  if (!session || session.role !== "admin" || !adminEmails().includes(session.email)) return null;
  return session;
}
