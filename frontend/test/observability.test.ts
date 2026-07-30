import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  observabilityPolicy,
  reportClientFault,
  reportWebVital,
} from "@/app/lib/observability/client";

describe("privacy-safe observability", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_OBSERVABILITY_ENDPOINT", "/api/observability");
    window.history.replaceState({}, "", "/profile?private=query");
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      value: "0",
    });
    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("sends only an allowlisted route group and operational fields", () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));

    reportClientFault("error_boundary");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
    expect(payload).toEqual({
      schema_version: 1,
      event: "client_fault",
      source: "error_boundary",
      route_group: "student_workspace",
    });
    for (const field of observabilityPolicy.prohibitedFields) {
      expect(payload).not.toHaveProperty(field);
    }
  });

  test("ignores unknown metrics and honors privacy signals", () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    reportWebVital("PROFILE_ANSWER", 10, "good");
    expect(fetchMock).not.toHaveBeenCalled();

    Object.defineProperty(navigator, "globalPrivacyControl", {
      configurable: true,
      value: true,
    });
    reportWebVital("LCP", 1234.56, "good");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("refuses a cross-origin reporting endpoint", () => {
    vi.stubEnv(
      "NEXT_PUBLIC_OBSERVABILITY_ENDPOINT",
      "https://telemetry.example.test/collect",
    );
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 202 }));
    reportClientFault("window_error");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
