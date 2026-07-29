import type { User } from "@supabase/supabase-js";

export type WorkspaceRole = "student" | "admin" | "unknown";

/**
 * Reads only the authorization role needed by the student workspace. Supabase
 * projects created before roles were introduced have no claim, so an absent
 * role keeps the existing student experience working. Explicit non-student
 * roles are denied.
 */
export function workspaceRole(user: Pick<User, "app_metadata">): WorkspaceRole {
  const role = user.app_metadata?.role;
  if (role === undefined || role === null || role === "student") {
    return "student";
  }
  if (role === "admin") return "admin";
  return "unknown";
}

export function canAccessStudentWorkspace(
  user: Pick<User, "app_metadata">,
): boolean {
  return workspaceRole(user) === "student";
}
