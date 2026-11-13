import { expect, test, type Page } from "@playwright/test";

/**
 * Mobile layout guard: every main page must fit the screen at the narrowest
 * common phone width (320px) and a typical one (390px) — no sideways
 * scrolling. Signs in to the demo organization for the app pages.
 */
const PUBLIC = ["/", "/login", "/signup", "/forgot-password", "/legal/terms"];
const APP = [
  "/hq",
  "/executives",
  "/executives/chief-financial-officer?tab=conversation",
  "/executives/chief-financial-officer?tab=reports",
  "/executives/chief-financial-officer?tab=library",
  "/executives/chief-financial-officer?tab=learning",
  "/crm",
  "/crm/contacts",
  "/crm/transfer",
  "/crm/deals/new",
  "/crm/contacts/new",
  "/comms",
  "/sessions",
  "/sessions/new",
  "/memory",
  "/studio",
  "/decisions",
  "/reports",
  "/files",
  "/projects",
  "/settings/team",
  "/settings/ai-models",
  "/settings/c-level/chief-financial-officer",
  "/tutorials",
  "/tutorials/executive-votes",
];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const width of [320, 390]) {
  test(`pages fit a ${width}px phone screen`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 760 });
    for (const url of PUBLIC) {
      await page.goto(url);
      expect(await horizontalOverflow(page), `${url} at ${width}px`).toBeLessThanOrEqual(0);
    }
    await page.goto("/login?demo=1");
    await page.getByRole("button", { name: "Enter the demo C-Level" }).click();
    await page.waitForURL(/\/hq/);
    for (const url of APP) {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      expect(await horizontalOverflow(page), `${url} at ${width}px`).toBeLessThanOrEqual(0);
    }
  });
}
