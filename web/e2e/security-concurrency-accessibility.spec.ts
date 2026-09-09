import { test, expect } from "@playwright/test";
import { ui } from "../src/components/ui-styles";
import AxeBuilder from "@axe-core/playwright";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/mode", route => route.fulfill({ json: { data: { environment: "local" } } }));
  await page.route("**/api/calendar", route => route.fulfill({ json: { data: { businessDate: "2026-08-31", realDate: "2026-08-31", mode: "real", canSimulate: true, clockRevision: "e2e-calendar-0", minDate: "2024-08-31", maxDate: "2028-08-31" } } }));
  await page.route("**/api/tracking/options", route => route.fulfill({ json: { data: {
      "businessDate": "2026-08-31",
      "earliestMonth": null,
      "earliestRevision": null,
      "prepend": {
        "allowed": false,
        "reason": "ONBOARDING_REQUIRED",
        "minDate": null,
        "maxDate": null
      },
      "restart": {
        "allowed": false,
        "reason": "MONTH_NOT_FOUND",
        "month": null,
        "expectedRevision": null,
        "minDate": null,
        "maxDate": null
      }
    } } }));
});


test("theme preference, keyboard focus and accessibility remain available", async ({ page }) => {
  await page.route("**/api/bootstrap", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { state: "onboarding_required", businessDate: "2026-08-31", month: null } }) }));
  await page.goto("/start");
  await page.evaluate((primaryButton) => {
    const probe = document.createElement("button");
    probe.className = primaryButton;
    probe.dataset.colorProbe = "true";
    probe.textContent = "color probe";
    document.body.append(probe);
  }, ui.primaryButton);
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
