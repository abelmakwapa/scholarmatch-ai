import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/verification",
}));

import { AdminNavigation } from "@/app/components/admin/admin-navigation";

describe("admin navigation", () => {
  test("contains only administrative destinations and identifies the current page", () => {
    render(<AdminNavigation displayName="Admin" email="admin@example.test" />);
    for (const label of [
      "Overview",
      "Scholarships",
      "Ingestion",
      "Duplicates",
      "Verification",
      "Audit history",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Verification" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
  });

  test("opens and closes the administration menu from the keyboard", async () => {
    const user = userEvent.setup();
    render(<AdminNavigation displayName="Admin" email={null} />);
    const open = screen.getByRole("button", {
      name: "Open administration menu",
    });
    open.focus();
    await user.keyboard("{Enter}");
    expect(open).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(open).toHaveAttribute("aria-expanded", "false");
  });
});
