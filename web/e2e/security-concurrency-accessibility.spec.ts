import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("theme preference, keyboard focus and accessibility remain available", async ({ page }) => {
  await page.route("**/api/bootstrap", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { state: "onboarding_required", month: null } }) }));
  await page.goto("/start");
  await page.evaluate(() => {
    const probe = document.createElement("button");
    probe.className = "primary-button";
    probe.dataset.colorProbe = "true";
    probe.textContent = "color probe";
    document.body.append(probe);
  });
  const primaryProbe = page.locator("[data-color-probe='true']");
  await expect(primaryProbe).toHaveCSS("background-color", "rgb(181, 198, 156)");
  await expect(primaryProbe).toHaveCSS("color", "rgb(38, 38, 38)");
  const theme = page.getByRole("button", { name: /ธีม/ });
  await theme.click();
  await page.getByRole("menuitemradio", { name: "มืด" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await primaryProbe.hover({ force: true });
  await expect(primaryProbe).toHaveCSS("background-color", "rgb(187, 204, 166)");
  await expect(primaryProbe).toHaveCSS("color", "rgb(36, 41, 31)");
  await primaryProbe.focus();
  await expect(primaryProbe).toHaveCSS("background-color", "rgb(187, 204, 166)");
  await expect(primaryProbe).toHaveCSS("color", "rgb(36, 41, 31)");
  await theme.focus();
  await expect(theme).toBeFocused();
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations).toEqual([]);
});
