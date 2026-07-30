import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { expect, test, vi } from "vitest";

import { AuditList } from "@/app/components/admin/audit-list";
import { ExactConfirmation } from "@/app/components/admin/exact-confirmation";
import { safeExternalSource } from "@/app/lib/admin/safe-source";

test.each([
  ["javascript:alert(1)", null],
  ["http://example.com", null],
  ["https://user:password@example.com", null],
  ["https://example.com/source", "https://example.com/source"],
] as const)("constrains external source %s", (input, expected) => {
  expect(safeExternalSource(input)).toBe(expected);
});

test("renders audit summaries as text rather than imported HTML", () => {
  const { container } = render(
    <AuditList
      page={{
        data: [
          {
            id: "2c418b24-273d-405e-a88e-0217c5ef19cf",
            actor_id: "715d5f0f-cde4-4376-895e-2227b37843c2",
            action: "updated",
            target_type: "scholarship",
            target_id: "a44c529b-2302-402e-bd72-9402229d0890",
            target_name: "Fixture grant",
            summary: "<img src=x onerror=alert(1)> was rejected",
            created_at: "2026-07-29T08:00:00Z",
          },
        ],
        pagination: { has_more: false, next_cursor: null, limit: 100 },
      }}
    />,
  );
  expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
  expect(container.querySelector("img")).toBeNull();
});

test("exact-name confirmation has no automated accessibility violations", async () => {
  const { container } = render(
    <main>
      <h1>Scholarship administration</h1>
      <h2>Catalogue records</h2>
      <ExactConfirmation
        action="publish"
        targetName="Fixture grant"
        description="Makes this record visible."
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    </main>,
  );
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
});

test("exact-name confirmation traps focus and closes with Escape", async () => {
  const user = userEvent.setup();
  const onCancel = vi.fn();
  render(
    <ExactConfirmation
      action="archive"
      targetName="Fixture grant"
      description="Archives this record."
      onCancel={onCancel}
      onConfirm={vi.fn()}
    />,
  );

  const input = screen.getByRole("textbox");
  expect(input).toHaveFocus();
  await user.tab();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.tab();
  expect(input).toHaveFocus();
  await user.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalledOnce();
});
