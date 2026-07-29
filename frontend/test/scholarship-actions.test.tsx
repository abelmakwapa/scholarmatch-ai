import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ScholarshipActions } from "@/app/components/scholarships/scholarship-actions";
import { scholarshipFixture } from "@/test/fixtures";

describe("scholarship detail actions", () => {
  it("does not make an expired scholarship actionable", () => {
    render(
      <ScholarshipActions
        scholarship={scholarshipFixture}
        actionable={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Applications closed" }),
    ).toBeDisabled();
    expect(screen.getByText(/deadline has passed/i)).toBeInTheDocument();
  });

  it("starts an application through the supplied API action", async () => {
    const user = userEvent.setup();
    const start = vi.fn(async () => undefined);
    render(
      <ScholarshipActions
        scholarship={scholarshipFixture}
        actionable
        actions={{ start }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Start application" }));
    expect(start).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("Application added to your tracker."),
    ).toBeInTheDocument();
  });

  it("submits an accuracy report", async () => {
    const user = userEvent.setup();
    const report = vi.fn(async () => undefined);
    render(
      <ScholarshipActions
        scholarship={scholarshipFixture}
        actionable
        actions={{ report }}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Report inaccurate information" }),
    );
    await user.selectOptions(
      screen.getByLabelText("What looks inaccurate?"),
      "incorrect_deadline",
    );
    await user.type(
      screen.getByLabelText(/Details/),
      "Provider lists a different date.",
    );
    await user.click(screen.getByRole("button", { name: "Send report" }));
    expect(report).toHaveBeenCalledWith({
      reason: "incorrect_deadline",
      details: "Provider lists a different date.",
    });
  });
});
