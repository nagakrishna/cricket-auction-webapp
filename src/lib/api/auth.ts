import { getCurrentSession } from "@/lib/auth/session";

export async function requireApiSession() {
  const session = await getCurrentSession();

  if (!session) {
    return null;
  }

  return session;
}

export async function requireApiRole(role: "ADMIN" | "TEAM_OWNER") {
  const session = await getCurrentSession();

  if (!session || session.user.role !== role) {
    return null;
  }

  return session;
}
