import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const requiredRoutes = [
  "/how-it-works",
  "/resources/scholarship-guide",
  "/resources/application-checklist",
  "/resources/eligibility-glossary",
  "/faq",
  "/about",
  "/contact",
  "/accessibility",
  "/privacy",
] as const;

test("editorial destinations expose metadata, hierarchy, and a next step", async ({
  page,
}) => {
  for (const route of requiredRoutes) {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${route.replaceAll("/", "\\/")}$`),
    );
    await expect(
      page.getByRole("navigation", { name: "Breadcrumb" }),
    ).toBeVisible();
    await expect(
      page.getByRole("complementary", { name: /related resources/i }),
    ).toBeVisible();
  }
});

test("application checklist is interactive, explicit about locality, and resets on reload", async ({
  page,
}) => {
  await page.goto("/resources/application-checklist");
  const item = page.getByRole("checkbox", {
    name: "Official requirements and current cycle checked",
  });
  await item.check();
  await expect(item).toBeChecked();
  await expect(
    page.getByRole("progressbar", { name: "Checklist progress" }),
  ).toHaveAttribute("value", "1");
  await page.reload();
  await expect(item).not.toBeChecked();
  await expect(
    page.getByText(/Nothing here is saved to an account/),
  ).toBeVisible();
});

test("contact page has no fake submission control without a configured endpoint", async ({
  page,
}) => {
  await page.goto("/contact");
  await expect(page.getByRole("form")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /submit|send/i })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", {
      name: "No public support inbox is configured yet.",
    }),
  ).toBeVisible();
});

test("editorial routes reflow cleanly and have no automated A/AA violations", async ({
  page,
}) => {
  const representativeRoutes = [
    "/how-it-works",
    "/resources/application-checklist",
    "/resources/eligibility-glossary",
    "/faq",
    "/contact",
  ] as const;

  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of representativeRoutes) {
      await page.goto(route);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.scrollWidth,
        `${route} at ${width}px`,
      ).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }

  await page.setViewportSize({ width: 1280, height: 900 });
  for (const route of representativeRoutes) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations, route).toEqual([]);
  }
});

test("crawler finds no internal 404s or broken same-page fragments", async ({
  request,
  baseURL,
}) => {
  const origin = new URL(baseURL!);
  const queued = ["/"];
  const crawled = new Set<string>();
  const checked = new Set<string>();
  const marketingRoutes = new Set([
    ...requiredRoutes,
    "/about/data-verification",
    "/data-controls",
    "/deadline-tracking",
    "/document-readiness",
    "/eligibility-checks",
    "/explainable-matches",
    "/terms",
    "/for-students/undergraduate",
    "/for-students/postgraduate",
    "/for-students/international",
    "/for-students/stem",
    "/for-students/research",
    "/for-students/community",
  ]);

  while (queued.length > 0) {
    const route = queued.shift()!;
    if (crawled.has(route)) continue;
    crawled.add(route);

    const response = await request.get(route);
    expect(response.status(), route).toBeLessThan(400);
    checked.add(route);
    const html = await response.text();

    const hrefs = Array.from(
      html.matchAll(/href=["']([^"']+)["']/g),
      (match) => match[1],
    );

    for (const href of hrefs) {
      if (href.startsWith("mailto:") || href.startsWith("tel:")) continue;
      const destination = new URL(href.replaceAll("&amp;", "&"), origin);
      if (destination.origin !== origin.origin) continue;

      const routeWithQuery = `${destination.pathname}${destination.search}`;
      if (!checked.has(routeWithQuery)) {
        const targetResponse = await request.get(routeWithQuery);
        expect(targetResponse.status(), `${route} -> ${href}`).toBeLessThan(
          400,
        );
        checked.add(routeWithQuery);
      }

      if (
        destination.hash &&
        destination.pathname === new URL(route, origin).pathname
      ) {
        const id = decodeURIComponent(destination.hash.slice(1));
        expect(
          html.includes(`id="${id}"`) || html.includes(`id='${id}'`),
          `${route} -> ${href}`,
        ).toBe(true);
      }

      if (
        !crawled.has(destination.pathname) &&
        marketingRoutes.has(destination.pathname)
      ) {
        queued.push(destination.pathname);
      }
    }
  }

  expect(crawled.size).toBeGreaterThanOrEqual(20);
});
