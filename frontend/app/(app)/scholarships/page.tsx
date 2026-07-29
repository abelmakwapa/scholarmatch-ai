import type { Metadata } from "next";

import { DataState } from "@/app/components/product/data-state";
import { RetryButton } from "@/app/components/product/retry-button";
import { ScholarshipFiltersForm } from "@/app/components/scholarships/scholarship-filters";
import { ScholarshipResults } from "@/app/components/scholarships/scholarship-results";
import { createServerApiClient } from "@/app/lib/api/server-client";
import { requireStudentSession } from "@/app/lib/auth/server-session";
import {
  parseScholarshipFilters,
  type SearchParamValue,
} from "@/app/lib/scholarships/filters";

export const metadata: Metadata = {
  title: "Scholarships",
  robots: { index: false, follow: false },
};

export default async function ScholarshipsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, SearchParamValue>>;
}) {
  const [{ accessToken }, params] = await Promise.all([
    requireStudentSession("/scholarships"),
    searchParams,
  ]);
  const filters = parseScholarshipFilters(params);
  let result;
  try {
    result = await createServerApiClient(accessToken).listScholarships(filters);
  } catch {
    result = null;
  }

  return (
    <div className="workspace-page scholarship-discovery">
      <header className="workspace-page__header">
        <div>
          <p className="product-eyebrow">Discovery</p>
          <h1>Find scholarships that fit.</h1>
          <p>
            Search the live catalogue, then use compatibility filters to narrow
            the results. Eligibility signals reflect current profile data—not a
            guarantee from the provider.
          </p>
        </div>
      </header>
      <ScholarshipFiltersForm filters={filters} />
      {result ? (
        <ScholarshipResults initialPage={result} filters={filters} />
      ) : (
        <DataState
          kind="error"
          title="Scholarships could not be loaded"
          description="The catalogue is temporarily unavailable. Your filters remain in the URL."
          action={<RetryButton />}
          compact
        />
      )}
    </div>
  );
}
