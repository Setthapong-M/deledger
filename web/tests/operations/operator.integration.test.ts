import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestPool } from "@/test/postgres";

const ownerA = "00000000-0000-4000-8000-000000000001";
const operatorEnvironment = {
  OPERATOR_DATABASE_URL: "postgresql://deledger_operator:test-operator-password@127.0.0.1:55432/deledger_test",
  DELEDGER_EXPORT_KEY: Buffer.alloc(32, 7).toString("base64"),
};
const admin = createTestPool();
let run: (argv: string[], dependencies?: Record<string, unknown>) => Promise<unknown>;

describe("operator lifecycle commands", () => {
  beforeAll(async () => {
    ({ run } = await import("../../../scripts/operator/user.mjs"));
  });

  afterAll(async () => {
    await admin.end();
  });

  it("invites idempotently and normalizes email", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    const first = await run(["invite", "--email", " User@Example.com "], { environment: operatorEnvironment });
    const second = await run(["invite", "--email", "user@example.com"], { environment: operatorEnvironment });
    expect(first).toBe(second);
    expect((await admin.query("SELECT normalized_email FROM user_identity_email")).rows).toEqual([{ normalized_email: "user@example.com" }]);
  });

  it("rejects unknown flags and destructive commands without a TTY", async () => {
    await expect(run(["invite", "--wat", "value"], { environment: operatorEnvironment })).rejects.toThrow("unknown flag");
    await expect(run(["archive", "--owner-id", ownerA], { environment: operatorEnvironment, isTTY: false })).rejects.toThrow("interactive TTY");
    await expect(run(["transfer-email", "--old-email", "a@example.com", "--new-email", "b@example.com"], { environment: operatorEnvironment, isTTY: false })).rejects.toThrow("interactive TTY");
  });

  it("archives, restores and transfers an identity only after explicit confirmation", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await run(["invite", "--email", "old@example.com"], { environment: operatorEnvironment });
    const invited = await admin.query<{ owner_id: string }>("SELECT owner_id FROM user_identity_email WHERE normalized_email = 'old@example.com'");
    const id = invited.rows[0]!.owner_id;
    const archiveId = await run(["archive", "--owner-id", id], { environment: operatorEnvironment, isTTY: true, confirm: async () => true });
    expect(archiveId).toBeTruthy();
    const crossed = await run(["restore", "--owner-id", id], { environment: operatorEnvironment, isTTY: true, confirm: async () => true });
    expect(crossed).toBe(false);
    expect(await run(["transfer-email", "--old-email", "old@example.com", "--new-email", "new@example.com"], { environment: operatorEnvironment, isTTY: true, confirm: async () => true })).toBe(id);
    expect((await admin.query("SELECT normalized_email, owner_id, unlinked_at FROM user_identity_email ORDER BY normalized_email")).rows).toHaveLength(2);
  });

  it("exports encrypted owner data without leaving plaintext", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await run(["invite", "--email", "export@example.com"], { environment: operatorEnvironment });
    const id = (await admin.query<{ owner_id: string }>("SELECT owner_id FROM user_identity_email WHERE normalized_email = 'export@example.com'")).rows[0]!.owner_id;
    const outputDir = await mkdtemp(join(tmpdir(), "deledger-operator-test-"));
    try {
      const outputPath = await run(["export", "--owner-id", id, "--output-dir", outputDir], { environment: operatorEnvironment });
      const files = await readdir(outputDir);
      expect(files).toEqual([`deledger-${id}.json.enc`]);
      const encrypted = await readFile(String(outputPath));
      expect(encrypted.subarray(0, 18).toString()).toBe("DELEDGER-EXPORT-1\n");
      expect(encrypted.toString()).not.toContain("export@example.com");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
