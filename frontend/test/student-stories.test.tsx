import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { StudentStories } from "@/app/components/marketing/student-stories";

const approvedFixture = [
  {
    id: "one",
    quote: "First approved story",
    name: "Student One",
    context: "Approved fixture",
  },
  {
    id: "two",
    quote: "Second approved story",
    name: "Student Two",
    context: "Approved fixture",
  },
];

describe("StudentStories", () => {
  test("shows an honest empty state when no approved content exists", () => {
    render(<StudentStories stories={[]} />);
    expect(screen.getByText("No published student stories yet.")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Next student story" }),
    ).not.toBeInTheDocument();
  });

  test("provides keyboard-operable previous and next controls", async () => {
    const user = userEvent.setup();
    render(<StudentStories stories={approvedFixture} />);

    expect(screen.getByText(/First approved story/)).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Next student story" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/Second approved story/)).toBeVisible(),
    );
    await user.click(
      screen.getByRole("button", { name: "Previous student story" }),
    );
    await waitFor(() =>
      expect(screen.getByText(/First approved story/)).toBeVisible(),
    );
  });
});
