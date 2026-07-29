import { describe, expect, test } from "vitest";

import {
  buildSignInUrl,
  sanitizeRedirectPath,
} from "@/app/lib/routing/safe-redirect";

describe("sanitizeRedirectPath", () => {
  test("keeps a same-origin absolute path with query and fragment", () => {
    expect(sanitizeRedirectPath("/onboarding?step=results#top")).toBe(
      "/onboarding?step=results#top",
    );
  });

  test("falls back for protocol-relative and absolute URLs", () => {
    expect(sanitizeRedirectPath("//evil.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("https://evil.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/\\evil.com")).toBe("/dashboard");
  });

  test("falls back for schemes, control characters, and non-paths", () => {
    expect(sanitizeRedirectPath("javascript:alert(1)")).toBe("/dashboard");
    expect(sanitizeRedirectPath("mailto:a@b.com")).toBe("/dashboard");
    expect(sanitizeRedirectPath("relative/path")).toBe("/dashboard");
    expect(sanitizeRedirectPath("/ok\nnope")).toBe("/dashboard");
  });

  test("falls back for empty or missing input, honoring a custom fallback", () => {
    expect(sanitizeRedirectPath(null)).toBe("/dashboard");
    expect(sanitizeRedirectPath("", "/home")).toBe("/home");
  });
});

describe("buildSignInUrl", () => {
  test("omits the next param when it is the default destination", () => {
    expect(buildSignInUrl("/dashboard")).toBe("/sign-in");
  });

  test("preserves a safe intended path", () => {
    expect(buildSignInUrl("/onboarding?step=goals")).toBe(
      "/sign-in?next=%2Fonboarding%3Fstep%3Dgoals",
    );
  });

  test("drops an unsafe intended path but keeps the reason", () => {
    expect(
      buildSignInUrl("https://evil.com", { reason: "session-expired" }),
    ).toBe("/sign-in?reason=session-expired");
  });
});
