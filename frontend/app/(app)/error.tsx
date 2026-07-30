"use client";

import { useEffect } from "react";

import { DataState } from "@/app/components/product/data-state";
import { reportClientFault } from "@/app/lib/observability/client";

export default function WorkspaceError({
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
