import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cache } from "react";

import {
  canAccessAdminWorkspace,
  canAccessStudentWorkspace,
} from "@/app/lib/auth/access";
import { buildSignInUrl } from "@/app/lib/routing/safe-redirect";
import { createSupabaseServerClient } from "@/app/lib/supabase/server";

export type AuthenticatedSession = {
  user: User;
  accessToken: string;
};

/** Request-scoped secure session lookup used by every private data path. */
const currentSession = cache(async (): Promise<AuthenticatedSession | null> => {
  const supabase = await createSupabaseServerClient();
  const [{ data: userData }, { data: sessionData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  if (!userData.user || !sessionData.session?.access_token) return null;

  return {
    user: userData.user,
    accessToken: sessionData.session.access_token,
  };
});

/** Reads the current session without redirecting, for public session-aware UI. */
export async function getOptionalAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  return currentSession();
}

export async function requireAuthenticatedSession(
  returnTo: string,
): Promise<AuthenticatedSession> {
  const session = await currentSession();
  if (!session) redirect(buildSignInUrl(returnTo));
  return session;
}

/** Enforces the student role before any student-owned API data is requested. */
export async function requireStudentSession(
  returnTo: string,
): Promise<AuthenticatedSession> {
  const session = await requireAuthenticatedSession(returnTo);
  if (!canAccessStudentWorkspace(session.user)) {
    redirect("/access-denied");
  }
  return session;
}

/** Enforces the admin claim before any administrative API data is requested. */
export async function requireAdminSession(
  returnTo: string,
): Promise<AuthenticatedSession> {
  const session = await requireAuthenticatedSession(returnTo);
  if (!canAccessAdminWorkspace(session.user)) {
    redirect("/access-denied");
  }
  return session;
}

export function sessionDisplayName(user: User, fallback = "Student"): string {
  const preferred = user.user_metadata?.preferred_name;
  const fullName = user.user_metadata?.full_name;
  if (typeof preferred === "string" && preferred.trim()) {
    return preferred.trim();
  }
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim();
  return fallback;
}
