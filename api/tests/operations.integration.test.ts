import { randomUUID, createDecipheriv } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { invite, archive, restore, transferEmail, exportUser, exportFacts, run } from "../src/operator.js";
import { identityPrisma, disconnectDatabase } from "../src/server/db/pool.js";
import { runScheduledCatchUp, schedulerReadiness } from "../src/scheduler.js";
import { readReadiness } from "../src/server/services/readiness.js";
import { setBusinessClock } from "../src/server/domain/clock.js";

const enabled = Boolean(process.env.DATABASE_URL && process.env.IDENTITY_DATABASE_URL);
afterAll(disconnectDatabase);
afterEach(() => setBusinessClock(() => new Date()));
describe.skipIf(!enabled)("operator lifecycle", () => {
  it("reports ready only after successful restart catch-up and migration validation", async () => {
    process.env.BACKUP_MODE = "disabled";
    await runScheduledCatchUp();
    expect(schedulerReadiness()).toBe(true);
    expect(await identityPrisma.$transaction(client => readReadiness(client))).toEqual({status: "ready"});
  });
  it("serializes repeated invitations and archive calls and restores within the same Bangkok month without a gap", async () => {
    setBusinessClock(() => new Date("2026-09-10T00:00:00Z"));
    const address = `${randomUUID()}@example.com`;
    const owners = await Promise.all([invite(address), invite(address)]);
    expect(owners[0]).toBe(owners[1]);
    const periods = await Promise.all([archive(owners[0]!), archive(owners[0]!)]);
    expect(periods[0]).toBe(periods[1]);
    expect(await restore(owners[0]!)).toBe(false);
  });
  it("requires resume when archive crosses the Bangkok month boundary and keeps encrypted phone identities without sessions", async () => {
    setBusinessClock(() => new Date("2026-09-30T16:59:00Z"));
    const owner = await invite(`${randomUUID()}@example.com`);
    await identityPrisma.user_identity_phone.create({ data: { owner_id: owner, normalized_phone: `+668${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}` } });
    await archive(owner);
    setBusinessClock(() => new Date("2026-09-30T17:00:00Z"));
    expect(await restore(owner)).toBe(true);
    const directory = await mkdtemp(join(tmpdir(), "deledger-operator-test-"));
    const previousKey = process.env.DELEDGER_EXPORT_KEY;
    process.env.DELEDGER_EXPORT_KEY = Buffer.alloc(32, 7).toString("base64");
    try {
      const data = await readFile(await exportUser(owner, directory));
      const headerLength = Buffer.byteLength("DELEDGER-EXPORT-1\n");
      expect(data.subarray(0, headerLength).toString()).toBe("DELEDGER-EXPORT-1\n");
      const decipher = createDecipheriv("aes-256-gcm", Buffer.alloc(32, 7), data.subarray(headerLength, headerLength + 12));
      decipher.setAuthTag(data.subarray(headerLength + 12, headerLength + 28));
      const payload = JSON.parse(Buffer.concat([decipher.update(data.subarray(headerLength + 28)), decipher.final()]).toString());
      expect(payload.phones).toHaveLength(1);
      expect(payload.owner.resume_required_at).toBe("2026-09-30T17:00:00.000Z");
      expect(payload).not.toHaveProperty("sessions");
    } finally {
      if (previousKey === undefined) delete process.env.DELEDGER_EXPORT_KEY; else process.env.DELEDGER_EXPORT_KEY = previousKey;
      await rm(directory, { recursive: true, force: true });
    }
  });
  it("keeps the old identity when transfer conflicts and refuses noninteractive destructive commands", async () => {
    const old = `${randomUUID()}@example.com`, occupied = `${randomUUID()}@example.com`;
    const owner = await invite(old);
    await invite(occupied);
    await expect(transferEmail(old, occupied)).rejects.toThrow("another user");
    const payload = await exportFacts(owner) as { emails: Array<{ normalized_email: string; unlinked_at: Date | null }> };
    expect(payload.emails).toEqual([expect.objectContaining({ normalized_email: old, unlinked_at: null })]);
    await expect(run(["archive", "--owner-id", owner])).rejects.toThrow("TTY");
  });
});
