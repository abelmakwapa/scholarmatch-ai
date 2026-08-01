import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { enhanceProductStory } from "@/app/components/marketing/product-story-enhancer";
import {
  FaqSection,
  HowItWorksSection,
  MatchAnatomySection,
  OpportunityExplorerSection,
  ReadinessSection,
  UseCasesSection,
} from "@/app/components/marketing/sections";

describe("ScholarMatch product story", () => {
  beforeEach(() => {
    vi.mocked(window.matchMedia).mockImplementation(
      (query) =>
        ({
          addEventListener: vi.fn(),
          addListener: vi.fn(),
          dispatchEvent: vi.fn(),
          matches: false,
          media: query,
          onchange: null,
          removeEventListener: vi.fn(),
          removeListener: vi.fn(),
        }) as MediaQueryList,
    );
  });

  test("keeps every major section available through a stable hash", () => {
    const { container } = render(
      <>
        <HowItWorksSection />
        <MatchAnatomySection />
        <OpportunityExplorerSection />
        <ReadinessSection />
        <UseCasesSection />
        <FaqSection />
      </>,
    );

    for (const id of [
      "how-it-works",
      "match-anatomy",
      "opportunity-explorer",
      "application-readiness",
      "use-cases",
      "faq",
    ]) {
      expect(container.querySelector(`#${id}`)).toBeInTheDocument();
    }
    expect(
      screen.getByRole("link", { name: "Prepare an example checklist" }),
    ).toHaveAttribute("href", "#application-readiness");
  });

  test("enhances every server-rendered control under reduced motion", async () => {
    const user = userEvent.setup();
    vi.mocked(window.matchMedia).mockImplementation(
      (query) =>
        ({
          addEventListener: vi.fn(),
          addListener: vi.fn(),
          dispatchEvent: vi.fn(),
          matches: query === "(prefers-reduced-motion: reduce)",
          media: query,
          onchange: null,
          removeEventListener: vi.fn(),
          removeListener: vi.fn(),
        }) as MediaQueryList,
    );
    const { container } = render(
      <>
        <MatchAnatomySection />
        <OpportunityExplorerSection />
        <ReadinessSection />
        <UseCasesSection />
        <FaqSection />
      </>,
    );
    const cleanupEnhancement = enhanceProductStory();

    const anatomy = within(container.querySelector("#match-anatomy")!);
    await user.click(anatomy.getByRole("tab", { name: "Requirements" }));
    await user.keyboard("{ArrowRight}");
    expect(anatomy.getByRole("tab", { name: "Deadline" })).toHaveFocus();
    expect(
      anatomy.getByRole("tabpanel", { name: "Deadline" }),
    ).toHaveTextContent("official provider page");

    const explorer = within(container.querySelector("#opportunity-explorer")!);
    await user.selectOptions(
      explorer.getByRole("combobox", { name: "Study level" }),
      "Postgraduate",
    );
    await user.selectOptions(
      explorer.getByRole("combobox", { name: "Destination type" }),
      "Home country",
    );
    await user.selectOptions(
      explorer.getByRole("combobox", { name: "Funding type" }),
      "Study support",
    );
    expect(
      explorer.getByRole("heading", {
        name: "No examples match every selected filter.",
      }),
    ).toBeVisible();
    await user.click(
      explorer.getByRole("button", { name: "Show all examples" }),
    );
    expect(explorer.getByText("6 illustrative results")).toBeVisible();

    const readiness = within(
      container.querySelector("#application-readiness")!,
    );
    await user.click(
      readiness.getByRole("checkbox", { name: "Eligibility evidence" }),
    );
    expect(readiness.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await user.click(
      readiness.getByRole("button", { name: "Reset checklist" }),
    );
    expect(
      readiness.getByRole("checkbox", { name: "Eligibility evidence" }),
    ).not.toBeChecked();

    const cases = within(container.querySelector("#use-cases")!);
    await user.click(cases.getByRole("tab", { name: "Research" }));
    expect(cases.getByRole("tabpanel", { name: "Research" })).toHaveTextContent(
      "proposal and supervisor",
    );
    await user.keyboard("{ArrowRight}");
    expect(cases.getByRole("tab", { name: "Community" })).toHaveFocus();

    const faq = within(container.querySelector("#faq")!);
    await user.click(faq.getByText("How does ranking work?"));
    expect(faq.getByText(/published eligibility rules first/i)).toBeVisible();
    expect(
      faq.getByRole("link", { name: "Report data for review" }),
    ).toHaveAttribute("href", "/contact");

    cleanupEnhancement();
  });
});
