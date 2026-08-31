import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatMonth } from "@/lib/format";

describe("display formatting", () => {
  it("keeps decimal strings intact while adding presentation separators", () => {
    expect(formatMoney("35000.00")).toBe("35,000.00");
    expect(formatMoney("-5000.5")).toBe("−5,000.50");
    expect(formatMoney(null)).toBe("—");
    expect(formatMonth("2026-08")).toContain("สิงหาคม");
    expect(formatDate("2026-08-31")).toContain("31");
    expect(formatMonth("unknown")).toBe("unknown");
    expect(formatDate(null)).toBe("—");
  });
});
