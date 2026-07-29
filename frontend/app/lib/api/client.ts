import { getPublicEnv } from "@/app/lib/env";
import {
  ApiError,
  apiErrorFromNetwork,
  apiErrorFromResponse,
} from "@/app/lib/api/errors";
import type { components, operations } from "@/app/lib/api/schema";

export type ProfileWrite = components["schemas"]["ProfileWrite"];
export type ProfileResponse = components["schemas"]["ProfileResponse"];
export type MatchPage = components["schemas"]["MatchPage"];
export type MatchResponse = components["schemas"]["MatchResponse"];
export type ApplicationPage = components["schemas"]["ApplicationPage"];
export type ApplicationResponse = components["schemas"]["ApplicationResponse"];
export type ScholarshipPage = components["schemas"]["ScholarshipPage"];
export type ScholarshipResponse = components["schemas"]["ScholarshipResponse"];
export type EligibilityStatus = components["schemas"]["EligibilityStatus"];
export type SavedScholarshipResponse =
  components["schemas"]["SavedScholarshipResponse"];
export type ScholarshipReportCreate =
  components["schemas"]["ScholarshipReportCreate"];
export type ScholarshipReportResponse =
  components["schemas"]["ScholarshipReportResponse"];
export type ApplicationCreate = components["schemas"]["ApplicationCreate"];

/** Resolves the current Supabase access token, or null when signed out. */
export type AccessTokenProvider = () => Promise<string | null>;

type RequestOptions = {
  method: "GET" | "PUT" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
  /** When false, a missing token still sends the request (public endpoints). */
  requireAuth?: boolean;
};

/**
 * A thin, typed HTTP client for the `/api/v1` contract. It attaches the
 * Supabase bearer token, normalizes every failure into an `ApiError`, and
 * treats a 204/empty body as `null`.
 */
export class ApiClient {
  private readonly baseUrl: string;
  private readonly getAccessToken: AccessTokenProvider;

  constructor(getAccessToken: AccessTokenProvider, baseUrl?: string) {
    this.getAccessToken = getAccessToken;
    this.baseUrl = (baseUrl ?? getPublicEnv().apiBaseUrl).replace(/\/$/, "");
  }

  private async request<T>(options: RequestOptions): Promise<T> {
    const headers = new Headers({ Accept: "application/json" });

    const token = await this.getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    } else if (options.requireAuth !== false) {
      // Fail fast rather than sending an unauthenticated request the server
      // will only reject; the UI treats this as an expired session.
      throw sessionExpiredError();
    }

    if (options.idempotencyKey) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }

    let payload: BodyInit | undefined;
    if (options.body !== undefined) {
      headers.set("Content-Type", "application/json");
      payload = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${options.path}`, {
        method: options.method,
        headers,
        body: payload,
        signal: options.signal,
        cache: "no-store",
        credentials: "omit",
      });
    } catch (cause) {
      throw apiErrorFromNetwork(cause);
    }

    if (!response.ok) {
      throw await apiErrorFromResponse(response);
    }

    if (response.status === 204) {
      return null as T;
    }

    const text = await response.text();
    return (text.length > 0 ? JSON.parse(text) : null) as T;
  }

  /** GET /profile — returns null when the student has no profile yet (404). */
  async getProfile(signal?: AbortSignal): Promise<ProfileResponse | null> {
    try {
      return await this.request<ProfileResponse>({
        method: "GET",
        path: "/profile",
        signal,
      });
    } catch (error) {
      if (isNotFound(error)) {
        return null;
      }
      throw error;
    }
  }

  /** PUT /profile — creates or fully replaces the student's profile. */
  async replaceProfile(
    body: ProfileWrite,
    signal?: AbortSignal,
  ): Promise<ProfileResponse> {
    return this.request<ProfileResponse>({
      method: "PUT",
      path: "/profile",
      body,
      signal,
    });
  }

  /** GET /matches — newest server-ranked matches for the current student. */
  async listMatches(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<MatchPage> {
    return this.request<MatchPage>({
      method: "GET",
      path: pagePath("/matches", options),
      signal: options.signal,
    });
  }

  /** GET /applications — applications owned by the current student. */
  async listApplications(
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<ApplicationPage> {
    return this.request<ApplicationPage>({
      method: "GET",
      path: pagePath("/applications", options),
      signal: options.signal,
    });
  }

  /** GET /scholarships — server-filtered discovery results. */
  async listScholarships(
    options: ScholarshipListOptions = {},
  ): Promise<ScholarshipPage> {
    const { signal, ...query } = options;
    return this.request<ScholarshipPage>({
      method: "GET",
      path: queryPath("/scholarships", query),
      signal,
    });
  }

  async getScholarship(
    scholarshipId: string,
    signal?: AbortSignal,
  ): Promise<ScholarshipResponse> {
    return this.request<ScholarshipResponse>({
      method: "GET",
      path: `/scholarships/${encodeURIComponent(scholarshipId)}`,
      signal,
    });
  }

  async listRelatedScholarships(
    scholarshipId: string,
    options: { limit?: number; cursor?: string; signal?: AbortSignal } = {},
  ): Promise<ScholarshipPage> {
    return this.request<ScholarshipPage>({
      method: "GET",
      path: pagePath(
        `/scholarships/${encodeURIComponent(scholarshipId)}/related`,
        options,
      ),
      signal: options.signal,
    });
  }

  async setScholarshipSaved(
    scholarshipId: string,
    saved: boolean,
    signal?: AbortSignal,
  ): Promise<SavedScholarshipResponse | null> {
    return this.request<SavedScholarshipResponse | null>({
      method: saved ? "PUT" : "DELETE",
      path: `/scholarships/${encodeURIComponent(scholarshipId)}/saved`,
      signal,
    });
  }

  async createApplication(
    body: ApplicationCreate,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ApplicationResponse> {
    return this.request<ApplicationResponse>({
      method: "POST",
      path: "/applications",
      body,
      idempotencyKey,
      signal,
    });
  }

  async reportScholarship(
    scholarshipId: string,
    body: ScholarshipReportCreate,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<ScholarshipReportResponse> {
    return this.request<ScholarshipReportResponse>({
      method: "POST",
      path: `/scholarships/${encodeURIComponent(scholarshipId)}/reports`,
      body,
      idempotencyKey,
      signal,
    });
  }
}

export type ScholarshipListOptions = NonNullable<
  operations["listScholarships"]["parameters"]["query"]
> & {
  signal?: AbortSignal;
};

function pagePath(
  path: string,
  options: { limit?: number; cursor?: string },
): string {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set("limit", String(options.limit));
  if (options.cursor) params.set("cursor", options.cursor);
  const query = params.toString();
  return query.length > 0 ? `${path}?${query}` : path;
}

function queryPath(
  path: string,
  options: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    (error as { kind?: unknown }).kind === "not_found"
  );
}

// Constructs the "session expired" ApiError without an HTTP round-trip.
function sessionExpiredError(): ApiError {
  return new ApiError({
    kind: "unauthorized",
    status: 401,
    code: "UNAUTHORIZED",
    message: "Your session has expired. Please sign in again to continue.",
  });
}
