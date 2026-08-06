const WEB_VITAL_NAMES = new Set(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);

export type MarketingCtaId =
  | "closing_create_profile"
  | "closing_dashboard"
  | "closing_sign_in"
  | "closing_view_matches"
  | "faq_all_questions"
  | "how_it_works_details"
  | "match_anatomy_glossary"
  | "resources_guide"
  | "stories_student_paths";

const MARKETING_CTA_IDS = new Set<MarketingCtaId>([
  "closing_create_profile",
  "closing_dashboard",
  "closing_sign_in",
  "closing_view_matches",
  "faq_all_questions",
  "how_it_works_details",
  "match_anatomy_glossary",
  "resources_guide",
  "stories_student_paths",
]);

export type RouteGroup =
  | "marketing"
  | "auth"
  | "student_workspace"
  | "administration"
  | "unknown";

type OperationalEvent =
  | {
      event: "web_vital";
      metric: string;
      rating: "good" | "needs-improvement" | "poor" | "unknown";
      value: number;
      route_group: RouteGroup;
    }
  | {
      event: "client_fault";
      source: "error_boundary" | "window_error" | "unhandled_rejection";
      route_group: RouteGroup;
    }
  | {
      event: "marketing_cta";
      cta_id: MarketingCtaId;
      route: string;
    };

function routeGroup(pathname: string): RouteGroup {
  if (pathname === "/") return "marketing";
  if (
    /^\/(sign-in|sign-up|forgot-password|reset-password|verify-email)/.test(
      pathname,
    )
  ) {
    return "auth";
  }
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "administration";
  }
  if (
    /^\/(dashboard|onboarding|matches|scholarships|applications|documents|profile|settings)(\/|$)/.test(
      pathname,
    )
  ) {
    return "student_workspace";
  }
  return "unknown";
}

function reportingEndpoint(): string | null {
  const candidate = process.env.NEXT_PUBLIC_OBSERVABILITY_ENDPOINT?.trim();
  return candidate && candidate.startsWith("/") && !candidate.startsWith("//")
    ? candidate
    : null;
}

function trackingDisabled(): boolean {
  const navigatorWithGpc = navigator as Navigator & {
    globalPrivacyControl?: boolean;
  };
  return (
    navigator.doNotTrack === "1" ||
    navigatorWithGpc.globalPrivacyControl === true
  );
}

function send(event: OperationalEvent): void {
  const endpoint = reportingEndpoint();
  if (!endpoint || trackingDisabled()) return;
  void fetch(endpoint, {
    method: "POST",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ schema_version: 1, ...event }),
  }).catch(() => {
    // Observability must never affect the product experience.
  });
}

export function reportWebVital(
  name: string,
  value: number,
  rating: string | undefined,
): void {
  if (!WEB_VITAL_NAMES.has(name) || !Number.isFinite(value)) return;
  send({
    event: "web_vital",
    metric: name,
    rating: RATINGS.has(rating ?? "")
      ? (rating as "good" | "needs-improvement" | "poor")
      : "unknown",
    value: Math.round(value * 1000) / 1000,
    route_group: routeGroup(window.location.pathname),
  });
}

export function reportClientFault(
  source: "error_boundary" | "window_error" | "unhandled_rejection",
): void {
  send({
    event: "client_fault",
    source,
    route_group: routeGroup(window.location.pathname),
  });
}

export function reportMarketingCta(
  ctaId: MarketingCtaId,
  destination: string,
): void {
  if (!MARKETING_CTA_IDS.has(ctaId)) return;

  let destinationUrl: URL;
  try {
    destinationUrl = new URL(destination, window.location.origin);
  } catch {
    return;
  }
  if (destinationUrl.origin !== window.location.origin) return;

  send({
    event: "marketing_cta",
    cta_id: ctaId,
    route: destinationUrl.pathname,
  });
}

export const observabilityPolicy = {
  allowedEvents: ["web_vital", "client_fault", "marketing_cta"] as const,
  allowedMarketingCtaIds: [...MARKETING_CTA_IDS],
  prohibitedFields: [
    "profile_answers",
    "profile_facts",
    "document_name",
    "document_content",
    "document_details",
    "query_text",
    "search_terms",
    "scholarship_name",
    "form_contents",
    "token",
    "ai_explanation",
    "error_message",
    "stack",
    "url",
  ] as const,
};
