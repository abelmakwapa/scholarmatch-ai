import { expect, test, type Page } from "@playwright/test";

test("sign-up submits to the identity service and reaches email verification", async ({
  page,
}) => {
  await page.route("**/auth/v1/signup**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: null,
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: null,
        user: {
          id: "27f6a650-1e91-4c92-b631-1fc311a44a1e",
          aud: "authenticated",
          role: "authenticated",
          email: "new.student@example.test",
          email_confirmed_at: null,
          phone: "",
          confirmation_sent_at: "2026-07-29T08:00:00Z",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          identities: [
            {
              identity_id: "45415a62-a7eb-46ca-b1ed-16f175b90803",
              id: "27f6a650-1e91-4c92-b631-1fc311a44a1e",
              user_id: "27f6a650-1e91-4c92-b631-1fc311a44a1e",
              identity_data: { email: "new.student@example.test" },
              provider: "email",
              created_at: "2026-07-29T08:00:00Z",
              updated_at: "2026-07-29T08:00:00Z",
            },
          ],
          created_at: "2026-07-29T08:00:00Z",
          updated_at: "2026-07-29T08:00:00Z",
        },
      }),
    });
  });

  await page.goto("/sign-up");
  await page.getByLabel("Email").fill("new.student@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill("correct-horse-battery-staple");
  await page
    .getByLabel("Confirm password")
    .fill("correct-horse-battery-staple");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email\?email=/);
  await expect(
    page.getByRole("heading", { name: "Confirm your email" }),
  ).toBeVisible();
});

test("private and administrative routes reject an anonymous visitor", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fadmin$/);
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
});

test("authentication remains understandable while offline", async ({
  context,
  page,
}) => {
  await page.goto("/sign-in");
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await expect(
    page.getByText("You’re offline. Reconnect to sign in."),
  ).toBeVisible();
  await context.setOffline(false);
});

const liveApi = process.env.E2E_LIVE_API === "1";

async function signInLive(page: Page) {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password)
    throw new Error("Live E2E credentials are not configured.");
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("live authenticated data journeys", () => {
  test.skip(
    !liveApi,
    "Requires the implemented API, test tenant, and isolated storage bucket.",
  );

  test("onboarding, profile completion, and discovery", async ({ page }) => {
    await signInLive(page);
    await page.goto("/onboarding");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.goto("/profile");
    await expect(
      page.getByRole("heading", { name: "Your matching profile." }),
    ).toBeVisible();
    await page.goto("/scholarships");
    await expect(
      page.getByRole("heading", { name: "Find scholarships that fit." }),
    ).toBeVisible();
  });

  test("match review, save, and application start", async ({ page }) => {
    await signInLive(page);
    await page.goto("/matches");
    await expect(
      page.getByRole("heading", { name: "Your scholarship matches." }),
    ).toBeVisible();
    await page.goto("/applications");
    await expect(
      page.getByRole("heading", { name: "Your application workspace." }),
    ).toBeVisible();
  });

  test("private document upload and admin authorization", async ({ page }) => {
    await signInLive(page);
    await page.goto("/documents");
    await expect(
      page.getByRole("heading", { name: "Your private documents." }),
    ).toBeVisible();
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/(admin|access-denied)$/);
  });
});
