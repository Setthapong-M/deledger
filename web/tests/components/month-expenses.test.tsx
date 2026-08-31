import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExpenseChips } from "@/components/expense-chips";
import type { MonthView } from "@/lib/api-client";

function viewWithSetup(): MonthView {
  return {
    month: "2026-08", lifecycle: "open", closedBy: null, trackedFrom: "2026-08-01", isPartial: false, revision: "0",
    summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: null, latestSnapshot: null, referenceKind: null, referenceAmount: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null },
    reconciliation: { state: "draft", issueCodes: [] }, allowedActions: { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false }, affectedMonthKeys: [],
    setup: [{ id: "00000000-0000-4000-8000-000000000001", position: 1, name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000.00", isPaused: false, detail: null }, { id: "00000000-0000-4000-8000-000000000002", position: 2, name: "ของใช้", kind: "variable", fixedAmount: null, isPaused: false, detail: null }],
  };
}

describe("ExpenseChips", () => {
  it("confirms fixed immediately and asks for an amount for variable", async () => {
    const next = viewWithSetup();
    next.revision = "1";
    next.setup[0]!.detail = { confirmedName: "ค่าเช่า", confirmedKind: "fixed", confirmedAmount: "6000.00", confirmedAt: "2026-08-01T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: next }), { status: 200, headers: { "content-type": "application/json" } })));
    const onChange = vi.fn();
    render(<ExpenseChips view={viewWithSetup()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /ค่าเช่า/ }));
    fireEvent.click(screen.getByRole("button", { name: "ยืนยันว่าจ่ายแล้ว" }));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /ของใช้/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("กรอกยอดที่จ่ายจริง");
  });
});
