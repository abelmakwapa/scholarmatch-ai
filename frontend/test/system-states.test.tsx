import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, test, vi } from "vitest";

import RootError from "@/app/error";
import NotFound from "@/app/not-found";

const { reportClientFault } = vi.hoisted(() => ({
  reportClientFault: vi.fn(),
}));

vi.mock("@/app/lib/observability/client", () => ({ reportClientFault }));

beforeEach(() => reportClientFault.mockClear());

test("the root error boundary offers an explicit retry without exposing errors", async () => {
  const user = userEvent.setup();
  const reset = vi.fn();
  render(
    <RootError
      error={new Error("private profile answer must never render")}
      reset={reset}
    />,
  );

  expect(
    screen.getByRole("heading", {
      name: "ScholarMatch couldn’t load this page",
    }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/private profile answer/i)).not.toBeInTheDocument();
  expect(reportClientFault).toHaveBeenCalledWith("error_boundary");
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(reset).toHaveBeenCalledOnce();
});

test("the not-found state gives safe recovery destinations", () => {
  render(<NotFound />);
  expect(
    screen.getByRole("heading", { name: "This opportunity isn’t here." }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "ScholarMatch home" }),
  ).toHaveAttribute("href", "/");
  expect(
    screen.getByRole("link", { name: "Explore scholarships" }),
  ).toHaveAttribute("href", "/scholarships");
});
