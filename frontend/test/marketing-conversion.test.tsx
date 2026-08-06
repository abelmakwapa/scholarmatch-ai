import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import {
  ClosingSection,
  ResourcesSection,
  StudentStoriesSection,
} from "@/app/components/marketing/sections";

describe("homepage conversion paths", () => {
  test("offers real resource destinations and a contextual next step", () => {
    render(<ResourcesSection />);

    expect(
      screen.getByRole("link", { name: /Read the guide/ }),
    ).toHaveAttribute("href", "/resources/scholarship-guide");
    expect(
      screen.getByRole("link", { name: /Open the checklist/ }),
    ).toHaveAttribute("href", "/resources/application-checklist");
    expect(
      screen.getByRole("link", { name: /Browse definitions/ }),
    ).toHaveAttribute("href", "/resources/eligibility-glossary");
    expect(
      screen.getByRole("link", { name: /Start with the scholarship guide/ }),
    ).toHaveAttribute("href", "/resources/scholarship-guide");
  });

  test("labels fallback journeys as illustrative instead of testimonials", async () => {
    const { container } = render(<StudentStoriesSection />);
    const stories = within(container.querySelector("#stories")!);

    expect(stories.getByText("Example journeys")).toBeVisible();
    expect(
      stories.getByText(/Illustrative scenarios—not testimonials/i),
    ).toBeVisible();
    expect(await stories.findByText("Illustrative scenario")).toBeVisible();
    expect(stories.queryByText(/testimonial/i)).not.toHaveTextContent(
      /student said|award won|accepted at/i,
    );
    expect(
      stories.getByRole("link", { name: /Compare student pathways/ }),
    ).toHaveAttribute("href", "#use-cases");
  });

  test("shows profile creation and sign in to signed-out visitors", () => {
    render(<ClosingSection />);

    expect(
      screen.getByRole("link", { name: "Create my profile" }),
    ).toHaveAttribute("href", "/sign-up?next=/onboarding");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  test("shows matches and dashboard actions to signed-in visitors", () => {
    render(<ClosingSection authenticated />);

    expect(
      screen.getByRole("link", { name: "View my matches" }),
    ).toHaveAttribute("href", "/matches");
    expect(
      screen.getByRole("link", { name: "Return to dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
