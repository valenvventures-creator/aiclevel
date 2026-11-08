import { expect, test } from "@playwright/test";

/**
 * Critical path in demo mode (no Supabase / no provider keys):
 * sign up → onboarding → C-Level HQ → executive conversation → Studio →
 * Executive Comms → Memory → sign out.
 */
test("a new client can convene their C-Level", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Work email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("analytical-engine-1843");
  await page.getByLabel("Confirm password").fill("analytical-engine-1843");
  await page.getByLabel(/Terms of Service/).check();
  await page.getByLabel(/Privacy Policy/).check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/onboarding/);

  await page.getByRole("button", { name: /Save & continue/ }).click();
  await page.getByLabel(/Organization name/).fill("Analytical Engines Ltd");
  await page.getByRole("button", { name: /Save & continue/ }).click();
  await page.getByLabel("Mission").fill("Make computation universal.");
  for (let i = 0; i < 4; i++) await page.getByRole("button", { name: /Save & continue/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Enter C-Level HQ", exact: true }).click();
  await expect(page).toHaveURL(/\/hq/);
  await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening), Ada\./ })).toBeVisible();

  await page.goto("/executives");
  await expect(page.getByRole("link", { name: "Chief Impact Officer", exact: true })).toBeVisible();

  await page.goto("/executives/chief-executive-officer?tab=conversation");
  await page.getByLabel(/Message the Chief Executive Officer/).fill("What should we focus on first?");
  await page.keyboard.press("Enter");
  await expect(page.getByText("Simulated response — demo mode.").first()).toBeVisible({ timeout: 30_000 });

  await page.goto("/studio");
  await page.getByLabel("Describe the work you need").fill("Create a three-year financial model.");
  await expect(page.getByText(/Chief Financial Officer/).first()).toBeVisible();
  await page.getByRole("button", { name: /Assign to the C-Level/ }).click();
  await expect(page.getByText("VERSION 1")).toBeVisible({ timeout: 30_000 });

  await page.goto("/memory");
  await page.getByLabel("Title").fill("First principle");
  await page.getByLabel("Content").fill("Computation should be universal.");
  await page.getByRole("button", { name: "Add to Memory" }).click();
  await expect(page.getByText("Saved to C-Level Memory.")).toBeVisible();

  // On phones the user menu lives in the navigation drawer.
  const openNav = page.getByRole("button", { name: "Open navigation" });
  if (await openNav.isVisible()) await openNav.click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("protected routes redirect to login", async ({ page }) => {
  await page.goto("/hq");
  await expect(page).toHaveURL(/\/login\?next=%2Fhq/);
});
