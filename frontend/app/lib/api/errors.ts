import type { components } from "@/app/lib/api/schema";

export type ErrorEnvelope = components["schemas"]["ErrorEnvelope"];
export type ErrorDetail = ErrorEnvelope["error"]["details"][number];

/**
 * Kinds of failure the UI reacts to differently. Every network or protocol
 * failure is normalized into one of these so components never branch on raw
 * status codes or fetch exceptions.
 */
export type ApiErrorKind =
  | "offline" // the request never reached the server
  | "unauthorized" // 401 — session missing or expired
  | "forbidden" // 403
  | "not_found" // 404
  | "conflict" // 409 — duplicate resource / idempotency conflict
  | "validation" // 400 / 422 — field-level problems
  | "rate_limited" // 429
  | "server" // 5xx
  | "unknown"; // anything we could not classify

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  readonly code: string;
  readonly details: ErrorDetail[];
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(init: {
    kind: ApiErrorKind;
    status: number;
    message: string;
    code?: string;
    details?: ErrorDetail[];
    requestId?: string | null;
    retryAfterSeconds?: number | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code ?? "UNKNOWN";
    this.details = init.details ?? [];
    this.requestId = init.requestId ?? null;
    this.retryAfterSeconds = init.retryAfterSeconds ?? null;
  }

  /** True when the failure is transient and re-submitting may succeed. */
  get isRecoverable(): boolean {
    return (
      this.kind === "offline" ||
      this.kind === "rate_limited" ||
      this.kind === "server"
    );
  }

  /** Field-level messages keyed by field name, for inline form errors. */
  fieldErrors(): Record<string, string> {
    const map: Record<string, string> = {};
    for (const detail of this.details) {
      if (detail.field && detail.message && !map[detail.field]) {
        map[detail.field] = detail.message;
      }
    }
    return map;
  }
}

function kindForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
    case 422:
      return "validation";
    case 401:
      return "unauthorized";
    case 403:
      return "forbidden";
    case 404:
      return "not_found";
    case 409:
      return "conflict";
    case 429:
      return "rate_limited";
    default:
      return status >= 500 ? "server" : "unknown";
  }
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const error = (value as { error?: unknown }).error;
  return (
    typeof error === "object" &&
    error !== null &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

const FRIENDLY_MESSAGES: Partial<Record<ApiErrorKind, string>> = {
  offline:
    "You appear to be offline. Check your connection — your answers are saved.",
  unauthorized: "Your session has expired. Please sign in again to continue.",
  forbidden: "You do not have permission to do that.",
  rate_limited: "Too many attempts. Please wait a moment and try again.",
  server: "Something went wrong on our side. Please try again.",
  unknown: "Something went wrong. Please try again.",
};

/**
 * Builds an {@link ApiError} from a failed HTTP response, preferring the safe,
 * server-provided message inside an {@link ErrorEnvelope} when present.
 */
export async function apiErrorFromResponse(
  response: Response,
): Promise<ApiError> {
  const kind = kindForStatus(response.status);
  const retryAfterHeader = response.headers.get("retry-after");
  const retryAfterSeconds = retryAfterHeader
    ? Number.parseInt(retryAfterHeader, 10)
    : null;

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Non-JSON error body; fall back to a generic message.
  }

  if (isErrorEnvelope(payload)) {
    return new ApiError({
      kind,
      status: response.status,
      message:
        payload.error.message || FRIENDLY_MESSAGES[kind] || "Request failed.",
      code: payload.error.code,
      details: payload.error.details ?? [],
      requestId: payload.error.request_id ?? null,
      retryAfterSeconds:
        retryAfterSeconds && Number.isFinite(retryAfterSeconds)
          ? retryAfterSeconds
          : null,
    });
  }

  return new ApiError({
    kind,
    status: response.status,
    message: FRIENDLY_MESSAGES[kind] ?? `Request failed (${response.status}).`,
    retryAfterSeconds:
      retryAfterSeconds && Number.isFinite(retryAfterSeconds)
        ? retryAfterSeconds
        : null,
  });
}

/** Wraps a thrown network error (DNS failure, offline, abort) as an ApiError. */
export function apiErrorFromNetwork(cause: unknown): ApiError {
  const aborted = cause instanceof DOMException && cause.name === "AbortError";
  return new ApiError({
    kind: aborted ? "unknown" : "offline",
    status: 0,
    message: aborted
      ? "The request was cancelled."
      : (FRIENDLY_MESSAGES.offline as string),
  });
}
