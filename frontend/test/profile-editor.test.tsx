import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

import { ProfileEditor } from "@/app/(app)/profile/profile-editor";
import { profileFixture } from "@/test/fixtures";

beforeEach(() => {
  mocks.refresh.mockReset();
  mocks.replace.mockReset();
});

describe("ProfileEditor", () => {
  test("round-trips an academic edit and refreshes derived completeness", async () => {
    const user = userEvent.setup();
    const updated = {
      ...profileFixture,
      gpa: 3.75,
      updated_at: "2026-07-29T11:45:00Z",
    };
    const saveProfile = vi.fn().mockResolvedValue(updated);
    render(
      <ProfileEditor
        initialProfile={profileFixture}
        saveProfile={saveProfile}
      />,
    );

    expect(screen.getByText("86% complete")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Edit Academic profile" }),
    );
    await user.type(screen.getByLabelText("GPA"), "3.75");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(saveProfile).toHaveBeenCalledOnce());
    expect(saveProfile).toHaveBeenCalledWith(
      expect.objectContaining({ gpa: 3.75 }),
    );
    expect(await screen.findByText("100% complete")).toBeInTheDocument();
    expect(
      screen.getByText("Profile saved. Completeness is up to date."),
    ).toBeInTheDocument();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  test("keeps the confirmed profile visible when an edit fails", async () => {
    const user = userEvent.setup();
    const saveProfile = vi.fn().mockRejectedValue(new Error("network"));
    render(
      <ProfileEditor
        initialProfile={profileFixture}
        saveProfile={saveProfile}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Edit Identity and location" }),
    );
    await user.clear(screen.getByLabelText("Full name"));
    await user.type(screen.getByLabelText("Full name"), "Grace Hopper");
    await user.click(screen.getByRole("button", { name: "Save profile" }));

    expect(
      await screen.findByText(
        "Your changes couldn’t be saved. The previous profile is still active.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Grace Hopper")).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
