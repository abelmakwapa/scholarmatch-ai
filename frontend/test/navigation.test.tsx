import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { Navigation } from "@/app/components/marketing/navigation";

describe("Navigation", () => {
  test("opens and closes the accessible mobile menu", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const toggle = screen.getByRole("button", { name: "Open navigation menu" });
    const menu = document.querySelector("#mobile-navigation");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveAttribute("hidden");

    await user.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveAccessibleName("Close navigation menu");
    expect(menu).not.toHaveAttribute("hidden");

    await user.keyboard("{Escape}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
