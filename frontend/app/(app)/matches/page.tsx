import type { Metadata } from "next";

import { RankedMatchList } from "@/app/components/matches/ranked-match-list";
import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireStudentSession } from "@/app/lib/auth/server-session";

export const metadata: Metadata = {
  title: "Scholarship matches",
  robots: { index: false, follow: false },
};

export default async function MatchesPage() {
  const { accessToken } = await requireStudentSession("/matches");
  let page;
  try {
    page = await createServerApiClient(accessToken).listMatches({ limit: 20 });
  } catch {
    page = null;
  }

  return (
    <div className="workspace-page matches-page">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Explainable ranking</p>
          <h1>Matches you can inspect.</h1>
          <p>
            Ranked by profile fit, verified requirements, and inferred
            relevance. Scores help prioritise research; they never estimate your
            chance of winning.
          </p>
        </div>
      </header>
      {page ? (
        <RankedMatchList initialPage={page} />
      ) : (
        <DataState
          kind="error"
          title="Matches could not be loaded"
          description="Your existing applications and profile are unaffected. Try loading the ranking again."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
