import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("theme preference, keyboard focus and accessibility remain available", async ({ page }) => {
  await page.goto("/start");
  await page.getByLabel("ยอดตั้งต้นที่รู้ตอนนี้").fill("1000");
  await page.getByLabel("รายรับของเดือนนี้").fill("1000");
  const primaryAction = page.getByRole("button", { name: "เริ่มเดือนแรก" });
  await expect(primaryAction).toHaveCSS("background-color", "rgb(181, 198, 156)");
  await expect(primaryAction).toHaveCSS("color", "rgb(38, 38, 38)");
  const theme = page.getByRole("button", { name: /ธีม/ });
  await theme.click();
  await page.getByRole("menuitemradio", { name: "มืด" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await primaryAction.hover();
  await expect(primaryAction).toHaveCSS("background-color", "rgb(181, 198, 156)");
  await expect(primaryAction).toHaveCSS("color", "rgb(38, 38, 38)");
  await primaryAction.focus();
  await expect(primaryAction).toHaveCSS("background-color", "rgb(181, 198, 156)");
  await expect(primaryAction).toHaveCSS("color", "rgb(38, 38, 38)");
  await theme.focus();
  await expect(theme).toBeFocused();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
