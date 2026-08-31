import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HistoryExplorer } from "@/components/history-explorer";
import type { HistoryEntry, MonthView } from "@/lib/api-client";

function month(id: string): MonthView {
  return { month: id, lifecycle: "closed", closedBy: "automatic", trackedFrom: `${id}-01`, isPartial: false, revision: "1", summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: "15000.00", latestSnapshot: null, referenceKind: "ending_balance", referenceAmount: "15000.00", monthlySpending: "35000.00", provisionalSpending: null, detailTotal: "10000.00", unitemizedSpending: "25000.00" }, reconciliation: { state: "reconciled", issueCodes: [] }, setup: [], allowedActions: { editIncome: true, recordSnapshot: false, editEndingBalance: true, manageSetup: false, confirmDetails: false, manualClose: false }, affectedMonthKeys: [] };
}

describe("HistoryExplorer", () => {
  it("keeps filmstrip and centered cover on the same month identity", () => {
    const entries: HistoryEntry[] = [{ kind: "month", id: "2026-08", view: month("2026-08") }, { kind: "month", id: "2026-07", view: month("2026-07") }, { kind: "tracking_gap", id: "gap:1", archivedAt: "2026-06-03T00:00:00Z", restoredAt: "2026-08-01T00:00:00Z" }];
    render(<HistoryExplorer initialEntries={entries} />);
    expect(screen.getByRole("heading", { name: "สิงหาคม 2569" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /กรกฎาคม/ }));
    expect(screen.getByRole("heading", { name: "กรกฎาคม 2569" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
    expect(screen.getByRole("heading", { name: "ช่วงข้อมูลขาด" })).toBeInTheDocument();
  });
});
