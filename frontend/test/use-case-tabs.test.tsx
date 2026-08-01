import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { UseCaseTabs } from "@/app/components/marketing/use-case-tabs";

describe("UseCaseTabs", () => {
  test("changes panels with click and keyboard navigation", async () => {
    const user = userEvent.setup();
    render(<UseCaseTabs />);

    const researchTab = screen.getByRole("tab", { name: "Research" });
    await user.click(researchTab);

    expect(researchTab).toHaveAttribute("aria-selected", "true");
    const researchPanel = await screen.findByRole("tabpanel", {
      name: "Research",
    });
    expect(researchPanel).toHaveTextContent("research match");
    expect(researchPanel).toHaveTextContent("proposal and supervisor");
    expect(
      within(researchPanel).getByRole("link", {
        name: "Explore research guidance",
      }),
    ).toHaveAttribute("href", "/for-students/research");

    await user.keyboard("{ArrowRight}");
    const communityTab = screen.getByRole("tab", { name: "Community" });
    expect(communityTab).toHaveFocus();
    expect(communityTab).toHaveAttribute("aria-selected", "true");
  });
});
