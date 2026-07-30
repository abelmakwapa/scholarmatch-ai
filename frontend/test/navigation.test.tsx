import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const navigationState = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigationState.pathname,
}));

vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("motion/react")>();
  return { ...actual, useReducedMotion: () => true };
});

import { Navigation } from "@/app/components/marketing/navigation";
import {
  footerUtilityLinks,
  marketingNavGroups,
} from "@/app/components/marketing/navigation-data";
import { marketingContentPages } from "@/app/lib/marketing/content";

beforeEach(() => {
  navigationState.pathname = "/";
  document.body.style.overflow = "";
});

describe("Navigation", () => {
  test("opens a desktop dropdown with click, Enter, and ArrowDown", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const product = screen.getByRole("button", { name: "Product" });
    product.focus();
    await user.keyboard("{Enter}");

    expect(product).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: /How matching works/ }),
    ).toHaveAttribute("href", "/how-it-works");

    await user.keyboard("{Escape}");
    expect(product).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(product).toHaveFocus());

    await user.keyboard("{ArrowDown}");
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: /How matching works/ }),
      ).toHaveFocus(),
    );
  });

  test("dismisses a desktop dropdown after an outside pointer interaction", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Navigation />
        <button data-testid="outside" type="button">
          Outside
        </button>
      </>,
    );

    const resources = screen.getByRole("button", { name: "Resources" });
    await user.click(resources);
    expect(resources).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(screen.getByTestId("outside"));
    expect(resources).toHaveAttribute("aria-expanded", "false");
  });

  test("opens the mobile sheet, locks scroll, and exposes every accordion group", async () => {
    const user = userEvent.setup();
    render(<Navigation />);

    const open = screen.getByRole("button", { name: "Open navigation menu" });
    await user.click(open);

    const sheet = screen.getByRole("dialog", { name: "Mobile navigation" });
    await waitFor(() => expect(document.body.style.overflow).toBe("hidden"));
    expect(
      within(sheet).getByRole("link", { name: "Sign in" }),
    ).toHaveAttribute("href", "/sign-in");
    expect(
      within(sheet).getByRole("link", { name: "Find scholarships" }),
    ).toHaveAttribute("href", "/sign-up?next=/onboarding");

    for (const group of marketingNavGroups) {
      expect(
        within(sheet).getByRole("button", { name: group.label }),
      ).toBeInTheDocument();
    }

    const product = within(sheet).getByRole("button", { name: "Product" });
    await user.click(product);
    expect(product).toHaveAttribute("aria-expanded", "true");
    expect(
      within(sheet).getByRole("link", { name: /Document readiness/ }),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Mobile navigation" }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(open).toHaveFocus());
    expect(document.body.style.overflow).toBe("");
  });

  test("marks the current destination and its parent group", async () => {
    const user = userEvent.setup();
    navigationState.pathname = "/privacy";
    render(<Navigation />);

    const about = screen.getByRole("button", { name: "About" });
    expect(about.closest(".site-nav__group")).toHaveAttribute(
      "data-active",
      "true",
    );
    await user.click(about);
    expect(
      screen.getByRole("link", { name: /Privacy approach/ }),
    ).toHaveAttribute("aria-current", "page");
  });

  test("routes the primary CTA according to session state", () => {
    const { rerender } = render(<Navigation />);
    expect(
      screen.getByRole("link", { name: "Find scholarships" }),
    ).toHaveAttribute("href", "/sign-up?next=/onboarding");

    rerender(<Navigation authenticated />);
    expect(
      screen.getByRole("link", { name: "Find scholarships" }),
    ).toHaveAttribute("href", "/matches");
  });

  test("all shared navigation destinations resolve to implemented content", () => {
    const implemented = new Set(
      marketingContentPages.map((page) => `/${page.path}`),
    );
    const sharedHrefs: string[] = [];
    for (const group of marketingNavGroups) {
      for (const link of group.links) sharedHrefs.push(link.href);
    }
    for (const link of footerUtilityLinks) sharedHrefs.push(link.href);

    for (const href of sharedHrefs) {
      expect(implemented.has(href), href).toBe(true);
    }
  });
});
