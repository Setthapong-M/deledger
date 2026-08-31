import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("theme preference, keyboard focus and accessibility remain available", async ({ page }) => {
  await page.goto("/start");
  const theme = page.getByRole("button", { name: /ธีม/ });
  await theme.click();
  await page.getByRole("menuitemradio", { name: "มืด" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toBeVisible();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
