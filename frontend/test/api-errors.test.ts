import { describe, expect, test } from "vitest";

import {
  ApiError,
  apiErrorFromNetwork,
  apiErrorFromResponse,
} from "@/app/lib/api/errors";

function jsonResponse(status: number, body: unknown, headers?: HeadersInit) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

const envelope = (code: string, message: string, details: unknown[] = []) => ({
  error: {
    code,
    message,
    details,
    request_id: "11111111-1111-1111-1111-111111111111",
  },
});

describe("apiErrorFromResponse", () => {
  test("classifies a 422 validation error and exposes field errors", async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(
        422,
        envelope("VALIDATION_ERROR", "Fields failed validation.", [
          { code: "too_long", field: "full_name", message: "Too long." },
        ]),
      ),
    );
    expect(error.kind).toBe("validation");
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.fieldErrors()).toEqual({ full_name: "Too long." });
    expect(error.requestId).toBe("11111111-1111-1111-1111-111111111111");
  });

  test("classifies 401 as unauthorized (session expired)", async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(401, envelope("UNAUTHORIZED", "Token invalid.")),
    );
    expect(error.kind).toBe("unauthorized");
  });

  test("classifies 409 as a conflict (duplicate account / idempotency)", async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(409, envelope("IDEMPOTENCY_CONFLICT", "Already exists.")),
    );
    expect(error.kind).toBe("conflict");
  });

  test("reads Retry-After on a 429 rate limit", async () => {
    const error = await apiErrorFromResponse(
      jsonResponse(429, envelope("RATE_LIMITED", "Slow down."), {
        "retry-after": "30",
      }),
    );
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.isRecoverable).toBe(true);
  });

  test("falls back to a safe message when the body is not an envelope", async () => {
    const error = await apiErrorFromResponse(
      new Response("nope", { status: 500 }),
    );
    expect(error.kind).toBe("server");
    expect(error.message.length).toBeGreaterThan(0);
  });
});

describe("apiErrorFromNetwork", () => {
  test("treats a fetch failure as offline and recoverable", () => {
    const error = apiErrorFromNetwork(new TypeError("Failed to fetch"));
    expect(error).toBeInstanceOf(ApiError);
    expect(error.kind).toBe("offline");
    expect(error.isRecoverable).toBe(true);
  });

  test("treats an abort as non-offline", () => {
    const abort = new DOMException("aborted", "AbortError");
    expect(apiErrorFromNetwork(abort).kind).toBe("unknown");
  });
});
