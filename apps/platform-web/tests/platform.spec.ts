import { expect, test } from "@playwright/test";

test("renders API-backed listening shell and playback controls", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Public archive and listening" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ya Nabi Salam Alayka/i })).toBeVisible();
  await expect(page.getByRole("region", { name: "Playback controls" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play or pause" })).toBeVisible();
});

test("navigates to companion lyrics with RTL and LTR lines", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Companion" }).first().click();
  await expect(page.getByRole("heading", { name: "Companion workflow" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Synchronized lyrics" })).toBeVisible();
  await expect(page.locator('[lang="ur"][dir="rtl"]')).toBeVisible();
  await expect(page.locator('[lang="en"][dir="ltr"]')).toBeVisible();
  await expect(page.getByRole("slider", { name: "Position" })).toHaveAttribute("aria-valuetext", /elapsed/);
});

test("renders archive responsively", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Archive" }).first().click();
  await expect(page.getByRole("heading", { name: "Records, citations, and provenance" })).toBeVisible();
  await expect(page.getByText("River recording provenance")).toBeVisible();
  if (isMobile) {
    await expect(page.locator(".grid-row").first()).toHaveCSS("display", "grid");
  }
});

test("submission form keeps keyboard-focusable controls", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Contribution creation requires authentication")).toBeVisible();
  await page.getByLabel("Title").focus();
  await expect(page.getByLabel("Title")).toBeFocused();
});

test("community and protected admin states render from API", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Community" }).click();
  await expect(page.getByText("Submitted Naat")).toBeVisible();
  await expect(page.getByRole("button", { name: /Upvote Missing qawwali/i })).toBeVisible();
  await page.getByRole("button", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Preservation queue" })).toBeVisible();
  await expect(page.getByText("No records are available from the API.")).toBeVisible();
});
