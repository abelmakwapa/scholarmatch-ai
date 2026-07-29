import "server-only";

import type { ProfileResponse } from "@/app/lib/api/client";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export type ProfileLoadState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "ready"; profile: ProfileResponse };

export async function loadProfile(): Promise<ProfileLoadState> {
  const session = await requireStudentSession("/profile");
  const api = createServerApiClient(session.accessToken);
  try {
    const profile = await api.getProfile();
    return profile ? { kind: "ready", profile } : { kind: "empty" };
  } catch {
    return {
      kind: "error",
      message:
        "We couldn’t load your profile right now. Your saved information has not been changed.",
    };
  }
}
