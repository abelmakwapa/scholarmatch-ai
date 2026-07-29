import { getPublicEnv } from "@/app/lib/env";
import {
  ApiError,
  apiErrorFromNetwork,
  apiErrorFromResponse,
} from "@/app/lib/api/errors";
import type { components } from "@/app/lib/api/schema";

export type ProfileWrite = components["schemas"]["ProfileWrite"];
export type ProfileResponse = components["schemas"]["ProfileResponse"];

/** Resolves the current Supabase access token, or null when signed out. */
export type AccessTokenProvider = () => Promise<string | null>;

type RequestOptions = {
  method: "GET" | "PUT" | "POST" | "PATCH";
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
