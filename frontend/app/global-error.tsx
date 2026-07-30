"use client";

import { useEffect } from "react";

import { reportClientFault } from "@/app/lib/observability/client";

export default function GlobalError({
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
    <html lang="en">
      <body>
        <main className="system-page">
          <h1>ScholarMatch needs to reload.</h1>
          <p>No saved information was changed.</p>
          <button type="button" onClick={reset}>
            Reload ScholarMatch
          </button>
        </main>
      </body>
    </html>
  );
}
