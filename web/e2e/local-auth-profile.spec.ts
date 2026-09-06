import { test, expect } from "@playwright/test";

test("local User logs in with one email-or-phone field", async ({ page }) => {
  let submitted = "";
  await page.route("**/api/auth/mode", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { environment: "local" } }) }));
  await page.route("**/api/auth/login", async (route) => { submitted = (await route.request().postDataJSON()).identifier; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { authenticated: true } }) }); });
  await page.route("**/api/bootstrap", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { state: "onboarding_required", month: null } }) }));
  await page.goto("/login");
  await page.getByLabel("อีเมลหรือเบอร์โทร").fill("081-234-5678");
  await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
  await expect.poll(() => submitted).toBe("081-234-5678");
  await expect(page).toHaveURL(/\/start$/);
});

test("profile shows contacts and saves local phone and optional birthday", async ({ page }) => {
  let saved: Record<string, string | null> | undefined;
  await page.route("**/api/auth/mode", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { environment: "local" } }) }));
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PATCH") { saved = (await route.request().postDataJSON()) as Record<string, string | null>; await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { email: "user@example.com", phone: "+66812345678", dateOfBirth: "1990-01-02" } }) }); return; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { email: "user@example.com", phone: null, dateOfBirth: null } }) });
  });
  await page.goto("/profile");
  await expect(page.getByLabel("อีเมล")).toHaveValue("user@example.com");
  await expect(page.getByLabel("เบอร์โทร")).toHaveValue("");
  await page.getByLabel("เบอร์โทร").fill("0812345678");
  await page.getByLabel("วันเดือนปีเกิด").fill("1990-01-02");
  await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
  await expect.poll(() => saved).toEqual({ email: "user@example.com", phone: "0812345678", dateOfBirth: "1990-01-02" });
  await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลแล้ว");
});

test("clears a populated profile when the local session expires", async ({ page }) => {
  let profileCalls = 0;
  await page.route("**/api/auth/mode", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { environment: "local" } }) }));
  await page.route("**/api/profile", async (route) => {
    profileCalls += 1;
    if (profileCalls <= 2) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { email: "populated@example.com", phone: "+66812345678", dateOfBirth: "1990-01-02" } }) });
      return;
    }
    await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "SESSION_INVALID", message: "ต้องเข้าสู่ระบบก่อน", field: null, current: null } }) });
  });
  await page.goto("/profile");
  await expect(page.getByLabel("อีเมล")).toHaveValue("populated@example.com");
  await expect(page.getByLabel("เบอร์โทร")).toHaveValue("+66812345678");
  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
});

test("direct lifecycle navigation sends an unauthenticated local User to login", async ({ page }) => {
  await page.route("**/api/auth/mode", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { environment: "local" } }) }));
  await page.route("**/api/bootstrap", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "SESSION_INVALID", message: "ต้องเข้าสู่ระบบก่อน", field: null, current: null } }) }));
  await page.goto("/start");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
});
