import { expect, test } from "@playwright/test";

// Smoke test for the rebuilt platform-web shell. Requires the dev server
// (and, for content, a running + seeded backend).
test("app shell renders with primary navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Dervaish").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Listen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Library" })).toBeVisible();
});

test("search route is reachable", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByPlaceholder(/search/i).or(page.getByText(/Search/i)).first()).toBeVisible();
});
