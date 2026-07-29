import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EligibilitySignal } from "@/app/components/scholarships/eligibility-signal";
import { ScholarshipCard } from "@/app/components/scholarships/scholarship-card";
import { ScholarshipResults } from "@/app/components/scholarships/scholarship-results";
import type { ScholarshipPage } from "@/app/lib/api/client";
import { deadlineState, formatDate } from "@/app/lib/scholarships/format";
import { scholarshipFixture } from "@/test/fixtures";

describe("scholarship discovery", () => {
  it("loads the next real cursor page and appends it", async () => {
    const user = userEvent.setup();
    const next = {
      ...scholarshipFixture,
      id: "2a06722f-15f4-4f12-8cd5-d6e7625a4dce",
      title: "Second scholarship",
    };
    const initialPage: ScholarshipPage = {
      data: [scholarshipFixture],
      pagination: { has_more: true, next_cursor: "opaque-next", limit: 1 },
    };
    const loadPage = vi.fn(async () => ({
      data: [next],
      pagination: { has_more: false, next_cursor: null, limit: 1 },
    }));
    render(
      <ScholarshipResults
        initialPage={initialPage}
        filters={{ limit: 1, sort: "relevance" }}
        loadPage={loadPage}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(loadPage).toHaveBeenCalledWith("opaque-next");
    expect(await screen.findByText("Second scholarship")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Load more" }),
    ).not.toBeInTheDocument();
  });

  it("updates saved state only after the API action succeeds", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn(async () => undefined);
    render(
      <ScholarshipCard scholarship={scholarshipFixture} onSave={onSave} />,
    );
    const button = screen.getByRole("button", {
      name: `Save ${scholarshipFixture.title}`,
    });
    await user.click(button);
    expect(onSave).toHaveBeenCalledWith(true);
    expect(
      screen.getByRole("button", {
        name: `Remove ${scholarshipFixture.title} from saved scholarships`,
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("renders a consistent UTC deadline and detects expiry at day end", () => {
    expect(formatDate("2026-08-05")).toBe("5 Aug 2026");
    expect(
      deadlineState(
        "2026-08-05",
        "published",
        new Date("2026-08-05T12:00:00Z"),
      ),
    ).toBe("open");
    expect(
      deadlineState(
        "2026-08-05",
        "published",
        new Date("2026-08-06T00:00:00Z"),
      ),
    ).toBe("expired");
    expect(deadlineState(null, "published")).toBe("unknown");
  });

  it.each([
    ["eligible", "Eligible"],
    ["potentially_eligible", "Potentially eligible"],
    ["ineligible", "Ineligible"],
    ["unknown", "Unknown — profile data missing"],
  ] as const)(
    "labels the %s state without relying on color",
    (status, label) => {
      render(<EligibilitySignal status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
    },
  );
});
