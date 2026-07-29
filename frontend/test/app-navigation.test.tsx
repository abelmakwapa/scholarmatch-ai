import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/profile" }));

import { AppNavigation } from "@/app/components/product/app-navigation";

describe("AppNavigation", () => {
  test("exposes every destination and marks the current route", () => {
    render(<AppNavigation displayName="Ada" email="ada@example.com" />);
    for (const label of [
      "Dashboard",
      "Matches",
      "Scholarships",
      "Applications",
      "Documents",
      "Profile",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("opens and closes the mobile menu with keyboard controls", async () => {
    const user = userEvent.setup();
    render(<AppNavigation displayName="Ada" email={null} />);
    const openButton = screen.getByRole("button", {
      name: "Open application menu",
    });
    await user.click(openButton);
    expect(
      screen.getAllByRole("button", { name: "Close application menu" }),
    ).not.toHaveLength(0);
    await user.keyboard("{Escape}");
    expect(
      screen.getByRole("button", { name: "Open application menu" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
