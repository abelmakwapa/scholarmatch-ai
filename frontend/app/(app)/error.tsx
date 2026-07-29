"use client";

import { useEffect } from "react";

import { DataState } from "@/app/components/product/data-state";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep private error details out of the UI while retaining diagnostics.
    console.error(error);
  }, [error]);

  return (
    <div className="workspace-page">
      <DataState
        kind="error"
        title="This page couldn’t load"
        description="Your saved information has not been changed. Try the request again."
        action={
          <button
            className="product-button product-button--ink"
            type="button"
            onClick={reset}
          >
            Try again
          </button>
        }
      />
    </div>
  );
}
