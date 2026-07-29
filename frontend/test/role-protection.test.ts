import { describe, expect, test } from "vitest";

import {
  canAccessStudentWorkspace,
  workspaceRole,
} from "@/app/lib/auth/access";
import { isProtectedPath } from "@/app/lib/routing/routes";

describe("student workspace authorization", () => {
  test("allows student and legacy unassigned roles but rejects explicit non-student roles", () => {
    expect(
      canAccessStudentWorkspace({ app_metadata: { role: "student" } }),
    ).toBe(true);
    expect(canAccessStudentWorkspace({ app_metadata: {} })).toBe(true);
    expect(canAccessStudentWorkspace({ app_metadata: { role: "admin" } })).toBe(
      false,
    );
    expect(workspaceRole({ app_metadata: { role: "reviewer" } })).toBe(
      "unknown",
    );
  });

  test.each([
    "/dashboard",
    "/matches",
    "/scholarships",
    "/applications",
    "/documents",
    "/profile",
    "/settings",
  ])("classifies %s as protected", (pathname) => {
    expect(isProtectedPath(pathname)).toBe(true);
  });
});
