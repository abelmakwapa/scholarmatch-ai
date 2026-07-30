"use client";

import { useEffect } from "react";

import { DataState } from "@/app/components/product/data-state";
import { reportClientFault } from "@/app/lib/observability/client";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void error;
    reportClientFault("error_boundary");
  }, [error]);
  return (
    <main className="system-page" id="main-content">
      <DataState
        kind="error"
        title="ScholarMatch couldn’t load this page"
        description="No information was changed. Check your connection, then retry the page."
        action={
          <button
            className="product-button product-button--ink"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
        }
      />
    </main>
  );
}
