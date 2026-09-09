import { afterEach, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { setBusinessClock, now } from "../../src/server/domain/clock.js";
import { currentBusinessDate } from "../../src/server/domain/calendar.js";
import { assertClockRevision, changeLocalDate, readCalendarContext, withCalendarGate } from "../../src/server/domain/local-calendar.js";

afterEach(async () => {
  await withCalendarGate(true, async () => { changeLocalDate(null, readCalendarContext(true).clockRevision!); });
  setBusinessClock(() => new Date());
});

describe("local accounting calendar", () => {
  it("starts a fresh process in real mode with a different boot token", () => {
    const execute = (simulate: boolean) => JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", `
      import { setBusinessClock } from './src/server/domain/clock.ts';
      import { changeLocalDate, readCalendarContext, withCalendarGate } from './src/server/domain/local-calendar.ts';
      setBusinessClock(() => new Date('2026-09-29T10:00:00Z'));
      if (${simulate}) await withCalendarGate(true, async () => changeLocalDate('2026-10-01', readCalendarContext(true).clockRevision));
      console.log(JSON.stringify(readCalendarContext(true)));
    `], { encoding: "utf8" }));
    const before = execute(true);
    const restarted = execute(false);
    expect(before).toMatchObject({ mode: "simulated", businessDate: "2026-10-01" });
    expect(restarted).toMatchObject({ mode: "real", businessDate: "2026-09-29" });
    expect(restarted.clockRevision).not.toBe(before.clockRevision);
  });

  it("keeps the admitted date and token through nested work crossing midnight", async () => {
    setBusinessClock(() => new Date("2026-09-30T16:59:00Z"));
    const token = readCalendarContext(true).clockRevision!;
    await withCalendarGate(true, async () => {
      assertClockRevision(token);
      setBusinessClock(() => new Date("2026-09-30T17:01:00Z"));
      await withCalendarGate(true, async () => {
        expect(currentBusinessDate()).toBe("2026-09-30");
        expect(() => assertClockRevision(token)).not.toThrow();
      });
    });
    await withCalendarGate(true, async () => { expect(() => assertClockRevision(token)).toThrow(); });
  });

  it("changes accounting dates without changing timestamps and resets without stale tokens", async () => {
    setBusinessClock(() => new Date("2026-09-09T03:00:00Z"));
    await withCalendarGate(true, async () => {
      const original = readCalendarContext(true);
      changeLocalDate("2026-09-30", original.clockRevision!);
    });
    await withCalendarGate(true, async () => {
      expect(currentBusinessDate()).toBe("2026-09-30");
      expect(now().toISOString()).toBe("2026-09-09T03:00:00.000Z");
      expect(readCalendarContext(false).businessDate).toBe("2026-09-09");
      expect(() => changeLocalDate("2026-10-01", "stale")).toThrow();
    });
  });

  it("serializes date changes behind an in-flight financial operation", async () => {
    setBusinessClock(() => new Date("2026-09-09T03:00:00Z"));
    let release!: () => void;
    const waiting = new Promise<void>(resolve => { release = resolve; });
    const events: string[] = [];
    const first = withCalendarGate(true, async () => { events.push(currentBusinessDate()); await waiting; events.push(currentBusinessDate()); });
    const second = withCalendarGate(true, async () => { changeLocalDate("2026-10-01", readCalendarContext(true).clockRevision!); events.push("changed"); });
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(["2026-09-09", "2026-09-09", "changed"]);
  });

  it("invalidates a real-mode token across Bangkok midnight", async () => {
    setBusinessClock(() => new Date("2026-09-30T16:59:00Z"));
    const first = await withCalendarGate(true, async () => readCalendarContext(true));
    setBusinessClock(() => new Date("2026-09-30T17:01:00Z"));
    await withCalendarGate(true, async () => {
      expect(readCalendarContext(true).businessDate).toBe("2026-10-01");
      expect(readCalendarContext(true).clockRevision).not.toBe(first.clockRevision);
    });
  });
});
