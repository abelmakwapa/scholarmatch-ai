import { reportClientFault } from "@/app/lib/observability/client";

try {
  window.addEventListener("error", () => reportClientFault("window_error"));
  window.addEventListener("unhandledrejection", () =>
    reportClientFault("unhandled_rejection"),
  );
} catch {
  // Instrumentation failures must not prevent hydration.
}

export function onRouterTransitionStart() {
  try {
    performance.mark("scholarmatch-route-transition-start");
  } catch {
    // Performance marks are optional and contain no route or user data.
  }
}
