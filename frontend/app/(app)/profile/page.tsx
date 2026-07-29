import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { ProfileEditor } from "@/app/(app)/profile/profile-editor";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { loadProfile } from "@/app/lib/profile/server";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const [state, params] = await Promise.all([loadProfile(), searchParams]);

  if (state.kind === "error") {
    return (
      <div className="workspace-page">
        <DataState
          kind="error"
          title="Your profile isn’t available"
          description={state.message}
          action={<RetryButton />}
        />
      </div>
    );
  }

  if (state.kind === "empty") {
    return (
      <div className="workspace-page">
        <DataState
          kind="empty"
          title="No matching profile yet"
          description="Complete onboarding to create the profile ScholarMatch will use for explainable matching."
          action={
            <Link
              className="product-button product-button--accent"
              href="/onboarding"
            >
              Build profile
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <ProfileEditor
      initialProfile={state.profile}
      initialEdit={params.edit === "1"}
    />
  );
}
