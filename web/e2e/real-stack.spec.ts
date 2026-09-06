import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";

test("local User completes an unmocked journey through Next, Nest and PostgreSQL", async ({ page }) => {
  const email = `${randomUUID()}@example.com`;
  await page.goto("/login");
  await page.getByLabel("อีเมลหรือเบอร์โทร").fill(email);
  await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
  await expect(page).toHaveURL(/\/start$/);
  await page.getByLabel("ยอดตั้งต้นที่รู้ตอนนี้").fill("1000.01");
  await page.getByLabel("รายรับของเดือนนี้").fill("200.02");
  await page.getByRole("button", { name: "เริ่มเดือนแรก" }).click();
  await expect(page).toHaveURL(/\/month$/);
  await expect(page.getByRole("heading", { name: "เดือนของคุณ" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "เดือนของคุณ" })).toBeVisible();
  await page.goto("/profile");
  await expect(page.getByLabel("อีเมล")).toHaveValue(email);
  const replacement = `${randomUUID()}@example.com`;
  await page.getByLabel("อีเมล").fill(replacement);
  await page.getByLabel("วันเดือนปีเกิด").fill("1990-01-02");
  await page.getByRole("button", { name: "บันทึกข้อมูล" }).click();
  await expect(page.getByRole("status")).toContainText("บันทึกข้อมูลแล้ว");
  await page.reload();
  await expect(page.getByLabel("อีเมล")).toHaveValue(replacement);
  await expect(page.getByLabel("วันเดือนปีเกิด")).toHaveValue("1990-01-02");
});
