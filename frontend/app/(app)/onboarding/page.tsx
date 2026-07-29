import type { Metadata } from "next";
import { Suspense } from "react";

import { OnboardingClient } from "./onboarding-client";

export const metadata: Metadata = {
  title: "Set up your profile",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return (
    <div className="onboarding-page">
      <Suspense
        fallback={
          <div className="onboarding-loading" aria-hidden="true">
            <span className="onboarding-loading__spinner" />
          </div>
        }
      >
        <OnboardingClient />
      </Suspense>
    </div>
  );
}
