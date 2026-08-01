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

  await page.locator("#use-cases").scrollIntoViewIfNeeded();
  await expect(page.locator("html")).toHaveAttribute(
    "data-product-story-enhanced",
    "true",
  );
  const studentUseCases = page.getByRole("tablist", {
    name: "Student use cases",
  });
  const undergraduate = studentUseCases.getByRole("tab", {
    name: "Undergraduate",
  });
  await undergraduate.focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    studentUseCases.getByRole("tab", { name: "Postgraduate" }),
  ).toBeFocused();
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

test("marketing navigation stays inside 320, 768, and 1440 pixel viewports", async ({
  page,
}) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");

    if (width < 1000) {
      await page.getByRole("button", { name: "Open navigation menu" }).click();
      const panel = page.getByRole("dialog", { name: "Mobile navigation" });
      await expect(panel).toBeVisible();
      await expect
        .poll(async () => {
          const bounds = await panel.boundingBox();
          return bounds ? Math.ceil(bounds.x + bounds.width) : Infinity;
        })
        .toBeLessThanOrEqual(width);
      const settledBounds = await panel.boundingBox();
      expect(settledBounds).not.toBeNull();
      expect(settledBounds!.x).toBeGreaterThanOrEqual(0);
      await page.getByRole("button", { name: "Close navigation menu" }).click();
    } else {
      await page.getByRole("button", { name: "About" }).click();
      const panel = page.locator("#desktop-panel-about");
      await expect(panel).toBeVisible();
      const bounds = await panel.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }

    const dimensions = await page.evaluate(() => ({
      client: document.documentElement.clientWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  }
});

test("interactive hero remains complete and unclipped from 320 to 1440 pixels", async ({
  page,
}) => {
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.waitForTimeout(180);

    const dimensions = await page.evaluate(() => {
      const headline = document.querySelector(".hero-section h1")!;
      const demo = document.querySelector(".hero-matcher")!;
      const headlineBounds = headline.getBoundingClientRect();
      const demoBounds = demo.getBoundingClientRect();
      return {
        client: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        headlineLeft: headlineBounds.left,
        headlineRight: headlineBounds.right,
        demoLeft: demoBounds.left,
        demoRight: demoBounds.right,
      };
    });

    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
    expect(dimensions.headlineLeft).toBeGreaterThanOrEqual(0);
    expect(dimensions.headlineRight).toBeLessThanOrEqual(width);
    expect(dimensions.demoLeft).toBeGreaterThanOrEqual(0);
    expect(dimensions.demoRight).toBeLessThanOrEqual(width);
    await expect(page.locator(".hero-matcher__fact-token")).toHaveCount(3);
    await expect(page.locator(".hero-matcher__gate")).toHaveCount(3);
    await expect(page.locator(".hero-matcher__match-card")).toHaveCount(3);
  }
});

test("hero scenarios, playback, live summary, and calls to action are operable", async ({
  page,
}) => {
  await page.goto("/");
  const heroSection = page.getByRole("region", {
    name: "Don't hunt, just match.",
  });
  await expect(
    heroSection.getByRole("link", { name: "Find my scholarships" }),
  ).toHaveAttribute("href", "/sign-up?next=/onboarding");
  await expect(
    heroSection.getByRole("link", { name: "See how matching works" }),
  ).toHaveAttribute("href", "#how-it-works");

  const hero = page.getByTestId("hero-matcher");
  await hero.getByRole("tab", { name: "Postgraduate" }).click();
  await expect(hero.getByText("Public health", { exact: true })).toBeVisible();
  await expect(hero.getByRole("status")).toContainText(
    "Postgraduate profile selected",
  );
  await expect(
    page.locator('.hero-matcher__match-card[data-rank="1"] h3'),
  ).toHaveText("Research potential opportunity");

  await hero.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(hero).toHaveAttribute("data-playback", "paused");
  await hero.getByRole("button", { name: "Play", exact: true }).click();
  await expect(hero).toHaveAttribute("data-playback", "playing");
  await hero.getByRole("button", { name: "Replay", exact: true }).click();
  await expect(hero.getByText("Public health", { exact: true })).toBeVisible();

  const workspace = page.getByRole("region", {
    name: "Interactive ScholarMatch workspace",
  });
  await expect(
    workspace.getByRole("combobox", { name: "Example profile" }),
  ).toHaveValue("1");
  await expect(
    workspace.getByText("Public health", { exact: true }),
  ).toBeVisible();

  await expect(
    workspace.getByText("Research potential opportunity", { exact: true }),
  ).toBeVisible();
});

test("product story controls teach a workflow without pretending to submit", async ({
  page,
}) => {
  await page.goto("/#match-anatomy");
  await expect(page).toHaveURL(/#match-anatomy$/);
  await expect(
    page.getByRole("heading", {
      name: "Inspect the result, not just its position.",
    }),
  ).toBeVisible();

  const anatomy = page.getByRole("tablist", {
    name: "Scholarship match details",
  });
  await anatomy.getByRole("tab", { name: "Requirements" }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Requirements" }),
  ).toContainText("academic transcript");

  await page
    .getByRole("combobox", { name: "Study level" })
    .selectOption("Postgraduate");
  await page
    .getByRole("combobox", { name: "Destination type" })
    .selectOption("Home country");
  await page
    .getByRole("combobox", { name: "Funding type" })
    .selectOption("Study support");
  await expect(
    page.getByRole("heading", {
      name: "No examples match every selected filter.",
    }),
  ).toBeVisible();

  const evidence = page.getByRole("checkbox", {
    name: "Eligibility evidence",
  });
  await evidence.check();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );

  const aiDisclosure = page
    .getByText("Does AI decide whether I am eligible?")
    .locator("..");
  await aiDisclosure.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/AI may help explain relevance/i)).toBeVisible();

  await expect(
    page.getByRole("button", { name: /save|apply|contact provider/i }),
  ).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
});

test("reduced motion keeps all marketing content available", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByTestId("hero-matcher")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await expect(page.getByTestId("hero-motion-runtime")).toHaveAttribute(
    "data-motion",
    "reduced",
  );
  await expect(
    page.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".hero-matcher__match-card")).toHaveCount(3);
  await expect(
    page.getByRole("heading", {
      name: "Explore the shape of a useful shortlist.",
    }),
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
