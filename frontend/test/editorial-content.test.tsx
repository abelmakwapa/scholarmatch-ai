import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { ApplicationPlanner } from "@/app/components/marketing/application-planner";
import { ContactOptions } from "@/app/components/marketing/contact-options";
import {
  Callout,
  DefinitionList,
  RelatedResources,
  Steps,
} from "@/app/components/marketing/editorial";
import {
  footerUtilityLinks,
  marketingNavGroups,
} from "@/app/components/marketing/navigation-data";
import { marketingContentPages } from "@/app/lib/marketing/content";
import { editorialPages } from "@/app/lib/marketing/editorial-content";

describe("marketing editorial content", () => {
  test("covers every requested destination with substantive editorial content", () => {
    for (const path of [
      "how-it-works",
      "resources/scholarship-guide",
      "resources/application-checklist",
      "resources/eligibility-glossary",
      "faq",
      "about",
      "contact",
      "accessibility",
      "privacy",
    ]) {
      const page = editorialPages[path as keyof typeof editorialPages];
      expect(page, path).toBeDefined();
      expect(page.metaDescription.length, path).toBeGreaterThan(80);
      expect(page.sections.length, path).toBeGreaterThan(0);
      expect(page.related.length, path).toBeGreaterThanOrEqual(3);
    }
  });

  test("all shared and related marketing links target implemented routes", () => {
    const marketingRoutes = new Set(
      marketingContentPages.map((page) => `/${page.path}`),
    );
    const knownApplicationRoutes = new Set([
      "/",
      "/matches",
      "/onboarding",
      "/sign-in",
      "/sign-up",
    ]);
    const hrefs = [
      ...marketingNavGroups.flatMap((group) =>
        group.links.map((link) => link.href),
      ),
      ...footerUtilityLinks.map((link) => link.href),
      ...marketingContentPages.map((page) => page.nextHref),
      ...Object.values(editorialPages).flatMap((page) =>
        page.related.map((resource) => resource.href),
      ),
    ];

    for (const href of hrefs) {
      expect(href, "links must not be decorative").not.toBe("#");
      const pathname = href.split(/[?#]/, 1)[0] || "/";
      expect(
        marketingRoutes.has(pathname) || knownApplicationRoutes.has(pathname),
        href,
      ).toBe(true);
    }
  });

  test("renders reusable editorial primitives with semantic structures", () => {
    render(
      <>
        <Callout body="Confirm the source." title="Review note" />
        <DefinitionList
          definitions={[{ term: "Residency", description: "Where you live." }]}
        />
        <Steps steps={[{ title: "Verify", description: "Open the source." }]} />
        <RelatedResources
          resources={[
            {
              href: "/faq",
              label: "FAQ",
              description: "Read common questions.",
            },
          ]}
        />
      </>,
    );

    expect(screen.getByRole("heading", { name: "Review note" })).toBeVisible();
    expect(screen.getByText("Residency").tagName).toBe("DT");
    expect(screen.getAllByRole("list")).toHaveLength(2);
    expect(screen.getByRole("link", { name: /FAQ/ })).toHaveAttribute(
      "href",
      "/faq",
    );
  });

  test("keeps checklist progress in local component state and supports reset", async () => {
    const user = userEvent.setup();
    render(<ApplicationPlanner />);

    const item = screen.getByRole("checkbox", {
      name: "Official requirements and current cycle checked",
    });
    await user.click(item);
    expect(item).toBeChecked();
    expect(
      screen.getByRole("progressbar", { name: "Checklist progress" }),
    ).toHaveAttribute("value", "1");

    await user.click(
      screen.getByRole("button", { name: "Reset local checklist" }),
    );
    expect(item).not.toBeChecked();
    expect(
      screen.getByRole("progressbar", { name: "Checklist progress" }),
    ).toHaveAttribute("value", "0");
  });

  test("never renders a fake contact form when support is unconfigured", () => {
    const { rerender } = render(<ContactOptions />);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "No public support inbox is configured yet.",
      }),
    ).toBeVisible();

    rerender(<ContactOptions supportEmail="help@example.test" />);
    expect(
      screen.getByRole("link", { name: "Email help@example.test" }),
    ).toHaveAttribute("href", "mailto:help@example.test");
  });
});
