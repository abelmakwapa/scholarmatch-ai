"use client";

import { useState } from "react";

import { DataState } from "@/app/components/product/data-state";
import { ScholarshipCard } from "@/app/components/scholarships/scholarship-card";
import type { ScholarshipPage } from "@/app/lib/api/client";
import { createBrowserApiClient } from "@/app/lib/api/browser-client";
import type { ScholarshipFilters } from "@/app/lib/scholarships/filters";

export function ScholarshipResults({
  initialPage,
  filters,
  loadPage,
}: {
  initialPage: ScholarshipPage;
  filters: ScholarshipFilters;
  loadPage?: (cursor: string) => Promise<ScholarshipPage>;
}) {
  const [items, setItems] = useState(initialPage.data);
  const [pagination, setPagination] = useState(initialPage.pagination);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadMore() {
    if (!pagination.next_cursor) return;
    setLoading(true);
    setError("");
    try {
      const page = loadPage
        ? await loadPage(pagination.next_cursor)
        : await createBrowserApiClient().listScholarships({
            ...filters,
            cursor: pagination.next_cursor,
          });
      setItems((current) => [...current, ...page.data]);
      setPagination(page.pagination);
    } catch {
      setError(
        "The next page could not be loaded. Your current results are still here.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <DataState
        kind="empty"
        title="No scholarships match these filters"
        description="Try widening the deadline window, clearing a compatibility filter, or using a broader search term."
        compact
      />
    );
  }

  return (
    <section aria-labelledby="scholarship-results-title">
      <div className="scholarship-results__heading">
        <h2 id="scholarship-results-title">Scholarships</h2>
        <p aria-live="polite">
          {items.length} {items.length === 1 ? "result" : "results"} loaded
        </p>
      </div>
      <div className="scholarship-grid">
        {items.map((scholarship) => (
          <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
        ))}
      </div>
      {error ? (
        <p className="scholarship-pagination-error" role="alert">
          {error}
        </p>
      ) : null}
      {pagination.has_more && pagination.next_cursor ? (
        <div className="scholarship-load-more">
          <button
            className="product-button product-button--accent"
            type="button"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
