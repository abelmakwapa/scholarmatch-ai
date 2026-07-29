import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.replace,
    refresh: mocks.refresh,
    push: mocks.push,
  }),
  useSearchParams: () => mocks.searchParams,
}));

import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.refresh.mockReset();
  mocks.searchParams = new URLSearchParams();
});

describe("SignInForm", () => {
  test("validates required fields before calling the action", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn();
    render(<SignInForm actions={{ signIn }} />);

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Enter your email address."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  test("shows a server failure and preserves typed input", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({
      ok: false,
      kind: "invalid_credentials",
      message: "That email and password combination is not correct.",
    });
    render(<SignInForm actions={{ signIn }} />);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "That email and password combination is not correct.",
      ),
    ).toBeInTheDocument();
    // Input is preserved so the user can correct it.
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  test("on success signs in with a trimmed email and navigates to next", async () => {
    const user = userEvent.setup();
    mocks.searchParams = new URLSearchParams("next=/onboarding%3Fstep%3Dgoals");
    const signIn = vi.fn().mockResolvedValue({ ok: true });
    render(<SignInForm actions={{ signIn }} />);

    await user.type(screen.getByLabelText("Email"), "  ada@example.com  ");
    await user.type(screen.getByLabelText("Password"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signIn).toHaveBeenCalledWith({
      email: "ada@example.com",
      password: "correct-horse",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/onboarding?step=goals");
  });

  test("surfaces the session-expired reason from the query string", () => {
    mocks.searchParams = new URLSearchParams("reason=session-expired");
    render(<SignInForm actions={{ signIn: vi.fn() }} />);
    expect(
      screen.getByText(
        "Your session expired. Please sign in again to continue.",
      ),
    ).toBeInTheDocument();
  });
});
