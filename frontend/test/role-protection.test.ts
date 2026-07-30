import { describe, expect, test } from "vitest";

import {
  canAccessAdminWorkspace,
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

  test("allows only the explicit admin role into administration", () => {
    expect(canAccessAdminWorkspace({ app_metadata: { role: "admin" } })).toBe(
      true,
    );
    expect(canAccessAdminWorkspace({ app_metadata: { role: "student" } })).toBe(
      false,
    );
    expect(canAccessAdminWorkspace({ app_metadata: {} })).toBe(false);
    expect(
      canAccessAdminWorkspace({ app_metadata: { role: "reviewer" } }),
    ).toBe(false);
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

  test.each(["/admin", "/admin/scholarships", "/admin/ingestion/run-id"])(
    "classifies %s as protected administration",
    (pathname) => expect(isProtectedPath(pathname)).toBe(true),
  );
});
