import "server-only";

import type { ProfileResponse } from "@/app/lib/api/client";
import { createServerApiClient } from "@/app/lib/api/server-client";
import type { ApiError } from "@/app/lib/api/errors";
import {
  buildDashboardViewModel,
  type DashboardSource,
  type DashboardViewModel,
} from "@/app/lib/dashboard/model";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export type DashboardLoadState =
  | { kind: "first-use" }
  | { kind: "error"; message: string }
  | { kind: "ready"; view: DashboardViewModel };

export async function loadDashboard(): Promise<DashboardLoadState> {
  const session = await requireStudentSession("/dashboard");
  const api = createServerApiClient(session.accessToken);

  const [profileResult, matchesResult, applicationsResult] =
    await Promise.allSettled([
      api.getProfile(),
      api.listMatches({ limit: 50 }),
      api.listApplications({ limit: 50 }),
    ]);

  if (profileResult.status === "rejected") {
    return {
      kind: "error",
      message: safeLoadMessage(profileResult.reason),
    };
  }
  if (!profileResult.value) return { kind: "first-use" };

  const unavailableSources: DashboardSource[] = [];
  if (matchesResult.status === "rejected") unavailableSources.push("matches");
  if (applicationsResult.status === "rejected") {
    unavailableSources.push("applications");
  }

  return {
    kind: "ready",
    view: buildDashboardViewModel({
      profile: profileResult.value as ProfileResponse,
      matches:
        matchesResult.status === "fulfilled" ? matchesResult.value.data : [],
      applications:
        applicationsResult.status === "fulfilled"
          ? applicationsResult.value.data
          : [],
      unavailableSources,
    }),
  };
}

function safeLoadMessage(error: unknown): string {
  const candidate = error as Partial<ApiError> | null;
  if (candidate?.kind === "offline") {
    return "ScholarMatch could not reach the profile service. Check your connection and try again.";
  }
  return "We couldn’t load your profile right now. Your saved information has not been changed.";
}
