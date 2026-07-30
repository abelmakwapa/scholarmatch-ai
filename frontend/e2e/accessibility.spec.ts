import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("marketing page has no WCAG 2.2 A/AA violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();

  expect(results.violations).toEqual([]);
});

test("authentication entry has no WCAG 2.2 A/AA violations", async ({
  page,
}) => {
  await page.goto("/sign-in");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

for (const route of ["/", "/sign-in"]) {
  test(`${route} does not emit hydration, page, or console errors`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`console: ${message.text()}`);
    });

    await page.goto(route);
    await page.waitForTimeout(150);
    expect(errors).toEqual([]);
  });
}

test("unknown routes render the checked-in recovery state", async ({
  page,
}) => {
  const response = await page.goto("/missing-opportunity");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This opportunity isn’t here." }),
  ).toBeVisible();
});

test("marketing page retains its landmarks and heading hierarchy", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("banner")).toHaveCount(1);
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("contentinfo")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  const levels = await page
    .locator("h1, h2, h3, h4, h5, h6")
    .evaluateAll((headings) =>
      headings.map((heading) => Number(heading.tagName.slice(1))),
    );
  expect(levels[0]).toBe(1);
  for (let index = 1; index < levels.length; index += 1) {
    expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1);
  }
});

test("interactive targets meet the WCAG 2.2 minimum target size", async ({
  page,
}) => {
  await page.goto("/");
  const undersized = await page
    .locator('a[href], button, input:not([type="hidden"]), select, textarea')
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          rect.width === 0 ||
          rect.height === 0 ||
          (rect.width >= 24 && rect.height >= 24)
        ) {
          return [];
        }
        return [
          `${element.tagName.toLowerCase()} ${element.getAttribute("aria-label") ?? element.textContent?.trim().slice(0, 40) ?? "unlabelled"} (${Math.round(rect.width)}×${Math.round(rect.height)})`,
        ];
      }),
    );
  expect(undersized).toEqual([]);
});

test("mobile menu and tabs are keyboard operable", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");

  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  const closeMenu = page.getByRole("button", { name: "Close navigation menu" });
  await expect(closeMenu).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open navigation menu" }),
  ).toBeFocused();

  const undergraduate = page.getByRole("tab", { name: "Undergraduate" });
  await undergraduate.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Postgraduate" })).toBeFocused();
  await expect(
    page.getByRole("tabpanel", { name: "Postgraduate" }),
  ).toBeVisible();
});

test("reflows without page overflow at a 200% zoom equivalent", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.goto("/");
  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
});

test("reduced motion keeps all marketing content available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("hero-matcher")).toHaveAttribute(
    "data-motion",
    "system",
  );
  const animation = await page
    .locator(".hero-matcher__rail > i")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        duration: Number.parseFloat(style.animationDuration) || 0,
        iterations: style.animationIterationCount,
      };
    });
  expect(animation.duration).toBeLessThanOrEqual(0.001);
  expect(animation.iterations).toBe("1");
  await expect(
    page.getByRole("heading", { name: "Matching is more than a score." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Your next opportunity could already fit.",
    }),
  ).toBeVisible();
});

test("forced colors preserves visible controls and focus", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Open navigation menu" });
  await menu.focus();
  await expect(menu).toBeFocused();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: "Find scholarships" }).last(),
  ).toBeVisible();
});
