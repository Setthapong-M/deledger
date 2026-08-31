import { describe, expect, it } from "vitest";
import { assertIsoDate, assertMonthKey, isFinalDay, monthKeyFromStart, nextMonthStart, monthStartFromDate } from "@/server/domain/calendar";
import { deriveAllowedActions } from "@/server/domain/allowed-actions";
import { isMoney, parseMoney } from "@/server/domain/money";
import { DomainError } from "@/server/domain/errors";

describe("money boundaries", () => {
  it("normalizes only canonical non-negative decimal strings", () => {
    expect(parseMoney("0.5")).toBe("0.50");
    expect(parseMoney("20")).toBe("20.00");
    expect(isMoney("1234567890123.45")).toBe(true);
    expect(isMoney("-1.00")).toBe(false);
    expect(isMoney("1.234")).toBe(false);
    expect(() => parseMoney("1,000.00")).toThrow();
  });
});

describe("calendar boundaries", () => {
  it("accepts real dates and rejects impossible dates", () => {
    expect(monthStartFromDate("2026-08-31")).toBe("2026-08-01");
    expect(nextMonthStart("2026-08-01")).toBe("2026-09-01");
    expect(monthKeyFromStart("2026-08-01")).toBe("2026-08");
    expect(isFinalDay("2026-08-01", "2026-08-31")).toBe(true);
    expect(() => assertIsoDate("2026-02-30")).toThrow();
    expect(() => assertIsoDate("2026-08")).toThrow();
    expect(() => assertMonthKey("2026-13")).toThrow();
    expect(() => nextMonthStart("2026-08")).toThrow();
  });
});

describe("server allowed actions", () => {
  it("opens only the actions that match lifecycle, date and archive state", () => {
    expect(deriveAllowedActions({ lifecycle: "open", hasStartingBalance: true, hasIncome: true, hasEndingBalance: true, isFinalDay: true, isArchived: false }).manualClose).toBe(true);
    expect(deriveAllowedActions({ lifecycle: "open", hasStartingBalance: true, hasIncome: true, hasEndingBalance: true, isFinalDay: false, isArchived: false }).manualClose).toBe(false);
    const archived = deriveAllowedActions({ lifecycle: "closed", hasStartingBalance: true, hasIncome: true, hasEndingBalance: true, isFinalDay: true, isArchived: true });
    expect(archived).toEqual({ editIncome: false, recordSnapshot: false, editEndingBalance: false, manageSetup: false, confirmDetails: false, manualClose: false });
  });
});

describe("domain error envelope data", () => {
  it("keeps a safe field and current view payload", () => {
    const error = new DomainError("INVALID_INPUT", "ไม่ถูกต้อง", "amount");
    expect(error.code).toBe("INVALID_INPUT");
    expect(error.field).toBe("amount");
    expect(error.current).toBeNull();
  });
});
