"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  OnboardingWizard,
  type StepNavigation,
} from "@/app/(app)/onboarding/onboarding-wizard";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import { isStepId } from "@/app/lib/onboarding/steps";
import { createOnboardingStore } from "@/app/lib/onboarding/store";
import type { OnboardingProgress } from "@/app/lib/onboarding/types";
import { buildSignInUrl } from "@/app/lib/routing/safe-redirect";
import { getSupabaseBrowserClient } from "@/app/lib/supabase/client";

/** URL-backed step navigation so refresh and back/forward stay consistent. */
function useUrlStepNavigation(): StepNavigation {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("step");
  const currentStep = raw && isStepId(raw) ? raw : null;

  const goToStep = useCallback<StepNavigation["goToStep"]>(
    (step, options) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", step);
      const url = `${pathname}?${params.toString()}`;
      if (options?.replace) {
        router.replace(url);
      } else {
        router.push(url);
      }
    },
    [pathname, router, searchParams],
  );

  return { currentStep, goToStep };
}

export function OnboardingClient() {
  const router = useRouter();
  const navigation = useUrlStepNavigation();

  const store = useMemo(
    () => createOnboardingStore(getSupabaseBrowserClient()),
    [],
  );
  const apiClient = useMemo(() => createBrowserApiClient(), []);

  const [loadState, setLoadState] = useState<"loading" | "ready">("loading");
  const [initialProgress, setInitialProgress] =
    useState<OnboardingProgress | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let active = true;
    store
      .load()
      .then((progress) => {
        if (active) {
          setInitialProgress(progress);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (active) setLoadState("ready");
      });
    return () => {
      active = false;
    };
  }, [store]);

  const submitProfile = useCallback(
    async (body: Parameters<typeof apiClient.replaceProfile>[0]) => {
      await apiClient.replaceProfile(body);
    },
    [apiClient],
  );

  if (loadState === "loading") {
    return (
      <div className="onboarding-loading" role="status" aria-live="polite">
        <span className="onboarding-loading__spinner" aria-hidden="true" />
        <p>Loading your progress…</p>
      </div>
    );
  }

  return (
    <OnboardingWizard
      store={store}
      navigation={navigation}
      submitProfile={submitProfile}
      initialProgress={initialProgress}
      onComplete={() => {
        router.replace("/dashboard");
        router.refresh();
      }}
      onSessionExpired={() => {
        router.replace(
          buildSignInUrl("/onboarding", { reason: "session-expired" }),
        );
      }}
    />
  );
}
