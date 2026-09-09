import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HistoryExplorer } from "@/components/history-explorer";
import type { HistoryEntry, MonthView } from "@/lib/api-client";
import { LocaleProvider } from "@/lib/i18n";

afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, "", "/"); });

function month(id: string): MonthView {
  return { month: id, lifecycle: "closed", closedBy: "automatic", openingSource: "supplied", trackedFrom: `${id}-01`, isPartial: false, revision: "1", summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: "15000.00", latestSnapshot: null, referenceKind: "ending_balance", referenceAmount: "15000.00", monthlySpending: "35000.00", provisionalSpending: null, detailTotal: "10000.00", unitemizedSpending: "25000.00" }, reconciliation: { state: "reconciled", issueCodes: [] }, setup: [], allowedActions: { editIncome: true, recordSnapshot: false, editEndingBalance: true, manageSetup: false, confirmDetails: false, manualClose: false }, affectedMonthKeys: [] };
}

describe("HistoryExplorer", () => {
  it("releases a discarded page request after an overlapping correction and allows retry", async () => {
    let finishPage!: (response: Response) => void;
    const original = month("2026-08");
    const corrected = { ...original, revision: "2", summary: { ...original.summary, income: "123.45" } };
    let pages = 0;
    const fetchMock = vi.fn((path: string) => {
      if (path.endsWith("/income")) return Promise.resolve(Response.json({ data: corrected }));
      if (++pages === 1) return new Promise<Response>(resolve => { finishPage = resolve; });
      return Promise.resolve(Response.json({ data: [{ kind: "month", id: "2026-07", view: month("2026-07") }] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LocaleProvider initialLocale="en"><HistoryExplorer initialEntries={[{ kind: "month", id: original.month, view: original }]} /></LocaleProvider>);
    const more = screen.getByRole("button", { name: "Load earlier months" });
    fireEvent.click(more);
    expect(more).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Edit income" }));
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "123.45" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await act(async () => { finishPage(Response.json({ data: [{ kind: "month", id: "2026-07", view: month("2026-07") }] })); });
    expect(more).toBeEnabled();
    expect(screen.getByRole("tabpanel")).toHaveTextContent("123.45");
    fireEvent.click(more);
    await screen.findByRole("tab", { name: /July 2026/ });
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/months?before=2026-08")).toHaveLength(2);
    expect(screen.getByRole("tabpanel")).toHaveTextContent("123.45");
  });
  it("keeps the page cursor independent from an older directly selected month and orders gaps by Bangkok date", async () => {
    window.history.replaceState(null, "", "/history?month=2025-01");
    const fetchMock = vi.fn((path: string) => Promise.resolve(Response.json({ data:
      path === "/api/months/2025-01" ? month("2025-01") :
      path === "/api/months?before=2026-07" ? [{ kind: "month", id: "2026-06", view: month("2026-06") }] :
      [{ kind: "month", id: "2026-08", view: month("2026-08") }, { kind: "tracking_gap", id: "gap:uuid", archivedAt: "2026-07-31T18:00:00Z", restoredAt: null }, { kind: "month", id: "2026-07", view: month("2026-07") }]
    })));
    vi.stubGlobal("fetch", fetchMock);
    render(<LocaleProvider initialLocale="en"><HistoryExplorer /></LocaleProvider>);
    await screen.findByRole("heading", { name: "January 2025" });
    expect(screen.getAllByRole("tab").map(tab => tab.textContent)).toEqual(["August 2026Balances match", "Tracking gapTracking paused", "July 2026Balances match", "January 2025Balances match"]);
    fireEvent.click(screen.getByRole("button", { name: "Load earlier months" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/months?before=2026-07", expect.anything()));
    await screen.findByRole("tab", { name: /June 2026/ });
    expect(screen.getByRole("heading", { name: "January 2025" })).toBeInTheDocument();
  });
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
