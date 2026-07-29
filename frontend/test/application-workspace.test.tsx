import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  ApplicationWorkspace,
  type ApplicationApi,
} from "@/app/components/applications/application-workspace";
import type {
  ApplicationDeadlinePage,
  ApplicationPage,
  ApplicationResponse,
} from "@/app/lib/api/client";
import { applicationFixture } from "@/test/fixtures";

const page: ApplicationPage = {
  data: [applicationFixture],
  pagination: { has_more: false, next_cursor: null, limit: 100 },
};

const deadlines: ApplicationDeadlinePage = {
  data: [
    {
      application_id: applicationFixture.id,
      scholarship_id: applicationFixture.scholarship_id,
      title: applicationFixture.scholarship.title,
      provider: applicationFixture.scholarship.provider,
      status: applicationFixture.status,
      deadline_date: applicationFixture.scholarship.deadline,
      deadline_at: "2026-08-05T17:00:00Z",
      source_timezone: "UTC",
      source_url: applicationFixture.scholarship.source_url,
    },
  ],
  pagination: { has_more: false, next_cursor: null, limit: 100 },
};

function api(overrides: Partial<ApplicationApi> = {}): ApplicationApi {
  return {
    updateApplication: vi.fn(async (_id, body) => ({
      ...applicationFixture,
      ...body,
      allowed_transitions:
        body.status === "ready"
          ? ["preparing", "submitted", "withdrawn"]
          : applicationFixture.allowed_transitions,
    })),
    updateApplicationChecklistItem: vi.fn(async () => applicationFixture),
    setApplicationReminder: vi.fn(async () => applicationFixture),
    deleteApplicationReminder: vi.fn(async () => applicationFixture),
    ...overrides,
  };
}

describe("application workspace", () => {
  it("offers only server-authorized state transitions", () => {
    render(
      <ApplicationWorkspace
        initialPage={page}
        deadlines={deadlines}
        api={api()}
      />,
    );
    const status = screen.getByRole("combobox", {
      name: `Status for ${applicationFixture.scholarship.title}`,
    });
    expect(
      within(status).getByRole("option", { name: "Move to Ready" }),
    ).toBeInTheDocument();
    expect(
      within(status).queryByRole("option", { name: "Move to Awarded" }),
    ).not.toBeInTheDocument();
  });

  it("applies a transition once and replaces allowed transitions from the response", async () => {
    const user = userEvent.setup();
    let resolve!: (value: ApplicationResponse) => void;
    const updateApplication = vi.fn(
      () =>
        new Promise<ApplicationResponse>((done) => {
          resolve = done;
        }),
    );
    render(
      <ApplicationWorkspace
        initialPage={page}
        deadlines={deadlines}
        api={api({ updateApplication })}
      />,
    );
    const status = screen.getByRole("combobox", {
      name: `Status for ${applicationFixture.scholarship.title}`,
    });
    await user.selectOptions(status, "ready");
    expect(status).toBeDisabled();
    expect(updateApplication).toHaveBeenCalledOnce();
    resolve({
      ...applicationFixture,
      status: "ready",
      allowed_transitions: ["preparing", "submitted"],
    });
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", {
          name: `Status for ${applicationFixture.scholarship.title}`,
        }),
      ).toHaveValue("ready"),
    );
  });

  it("reuses the idempotency key when a failed transition is retried", async () => {
    const user = userEvent.setup();
    const updateApplication = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValueOnce({
        ...applicationFixture,
        status: "ready",
        allowed_transitions: ["preparing", "submitted"],
      });
    render(
      <ApplicationWorkspace
        initialPage={page}
        deadlines={deadlines}
        api={api({ updateApplication })}
      />,
    );
    const status = screen.getByRole("combobox", {
      name: `Status for ${applicationFixture.scholarship.title}`,
    });
    await user.selectOptions(status, "ready");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Connection interrupted",
    );
    await user.selectOptions(status, "ready");
    await waitFor(() => expect(updateApplication).toHaveBeenCalledTimes(2));
    expect(updateApplication.mock.calls[0]?.[2]).toBe(
      updateApplication.mock.calls[1]?.[2],
    );
  });

  it("keeps all controls available in the keyboard-selectable list view", async () => {
    const user = userEvent.setup();
    render(
      <ApplicationWorkspace
        initialPage={page}
        deadlines={deadlines}
        api={api()}
      />,
    );
    const listButton = screen.getByRole("button", { name: "List" });
    listButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByTestId("application-list")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: `Status for ${applicationFixture.scholarship.title}`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Checklist 0\/1/)).toBeInTheDocument();
    expect(screen.getByText("Notes and reminder")).toBeInTheDocument();
    expect(screen.getByText("Status history")).toBeInTheDocument();
  });

  it("renders an honest first-use state", () => {
    render(
      <ApplicationWorkspace
        initialPage={{ ...page, data: [] }}
        deadlines={{ ...deadlines, data: [] }}
        api={api()}
      />,
    );
    expect(screen.getByText("No applications tracked yet")).toBeInTheDocument();
    expect(screen.getByText(/never submits anything/i)).toBeInTheDocument();
  });
});
