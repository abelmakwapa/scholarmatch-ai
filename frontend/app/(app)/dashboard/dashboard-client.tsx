"use client";

import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { FormStatus } from "@/app/components/forms/form-status";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import type { ProfileResponse } from "@/app/lib/api/client";
import { ApiError } from "@/app/lib/api/errors";
import { countryName } from "@/app/lib/onboarding/countries";
import { buildSignInUrl } from "@/app/lib/routing/safe-redirect";

type Status =
  | { kind: "loading" }
  | { kind: "profile"; profile: ProfileResponse }
  | { kind: "needs-onboarding" }
  | { kind: "error"; error: ApiError };

export function DashboardClient() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const requestedRef = useRef(false);

  const load = useCallback(async () => {
    setStatus({ kind: "loading" });
    const api = createBrowserApiClient();
    try {
      const profile = await api.getProfile();
      setStatus(
        profile ? { kind: "profile", profile } : { kind: "needs-onboarding" },
      );
    } catch (error) {
      if (error instanceof ApiError && error.kind === "unauthorized") {
        router.replace(
          buildSignInUrl("/dashboard", { reason: "session-expired" }),
        );
        return;
      }
      setStatus({
        kind: "error",
        error:
          error instanceof ApiError
            ? error
            : new ApiError({
                kind: "unknown",
                status: 0,
                message: "We couldn't load your dashboard. Please try again.",
              }),
      });
    }
  }, [router]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    void load();
  }, [load]);

  if (status.kind === "loading") {
    return (
      <div className="dashboard-state" role="status" aria-live="polite">
        <span className="onboarding-loading__spinner" aria-hidden="true" />
        <p>Loading your dashboard…</p>
      </div>
    );
  }

  if (status.kind === "error") {
    return (
      <div className="dashboard-state">
        <FormStatus
          tone={status.error.kind === "offline" ? "offline" : "error"}
        >
          {status.error.message}
        </FormStatus>
        <button
          className="form-submit form-submit--ink"
          type="button"
          onClick={load}
        >
          <RefreshCw aria-hidden="true" size={16} />
          Try again
        </button>
      </div>
    );
  }

  if (status.kind === "needs-onboarding") {
    return (
      <div className="dashboard-empty">
        <h1>Let&rsquo;s set up your profile</h1>
        <p>
          Answer a few questions so we can check your eligibility and explain
          your scholarship matches. You can pause and resume anytime.
        </p>
        <Link className="form-submit form-submit--accent" href="/onboarding">
          Start onboarding
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    );
  }

  const { profile } = status;
  return (
    <div className="dashboard">
      <header className="dashboard__head">
        <p className="eyebrow">Your profile</p>
        <h1>Welcome, {profile.full_name}</h1>
        <p>
          Your profile is ready. We use these details to check eligibility and
          rank your matches.
        </p>
      </header>
      <dl className="dashboard__facts">
        <div>
          <dt>Country</dt>
          <dd>{countryName(profile.country) ?? profile.country}</dd>
        </div>
        <div>
          <dt>Study level</dt>
          <dd className="dashboard__capitalize">{profile.study_level}</dd>
        </div>
        <div>
          <dt>Field of study</dt>
          <dd>{profile.field_of_study ?? "Not specified"}</dd>
        </div>
        <div>
          <dt>Interests</dt>
          <dd>
            {profile.interests.length > 0
              ? profile.interests.join(", ")
              : "None added"}
          </dd>
        </div>
      </dl>
      <Link className="dashboard__edit" href="/onboarding?step=identity">
        Update my answers
      </Link>
    </div>
  );
}
