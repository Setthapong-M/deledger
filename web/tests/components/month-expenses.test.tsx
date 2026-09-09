import { useState } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseChips } from "@/components/expense-chips";
import { api, ApiClientError, type MonthView } from "@/lib/api-client";
import { LocaleProvider } from "@/lib/i18n";
import userEvent from "@testing-library/user-event";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function StatefulChips() {
  const [view, setView] = useState(viewWithSetup());
  return <ExpenseChips view={view} onChange={setView} />;
}

function paidView(): MonthView {
  const view = viewWithSetup();
  view.revision = "1";
  view.setup[0]!.detail = { confirmedName: "ค่าเช่า", confirmedKind: "fixed", confirmedAmount: "6000.00", confirmedAt: "2026-08-01T00:00:00Z" };
  return view;
}

function viewWithSetup(): MonthView {
  return {
    month: "2026-08", lifecycle: "open", closedBy: null, openingSource: "supplied", trackedFrom: "2026-08-01", isPartial: false, revision: "0",
    summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: null, latestSnapshot: null, referenceKind: null, referenceAmount: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null },
    reconciliation: { state: "draft", issueCodes: [] }, allowedActions: { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false }, affectedMonthKeys: [],
    setup: [{ id: "00000000-0000-4000-8000-000000000001", position: 1, name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000.00", isPaused: false, detail: null }, { id: "00000000-0000-4000-8000-000000000002", position: 2, name: "ของใช้", kind: "variable", fixedAmount: null, isPaused: false, detail: null }],
  };
}

describe("ExpenseChips", () => {
  it("keeps focus in the variable amount field while typing continuously", async () => {
    const user = userEvent.setup();
    render(<StatefulChips />);
    const chip = screen.getByRole("button", { name: /ของใช้/ });
    await user.click(chip);
    const input = screen.getByLabelText("ยอดที่จ่าย");
    await user.click(input);
    await user.keyboard("1234.50");
    expect(input).toHaveValue("1234.50");
    expect(input).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(chip).toHaveFocus();
  });

  it("confirms fixed immediately and asks for an amount for variable", async () => {
    const next = viewWithSetup();
    next.revision = "1";
    next.setup[0]!.detail = { confirmedName: "ค่าเช่า", confirmedKind: "fixed", confirmedAmount: "6000.00", confirmedAt: "2026-08-01T00:00:00Z" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: next }), { status: 200, headers: { "content-type": "application/json" } })));
    const onChange = vi.fn();
    render(<ExpenseChips view={viewWithSetup()} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /ค่าเช่า/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /ของใช้/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("กรอกยอดที่จ่ายจริง");
  });

  it.each([
    { locale: "th" as const, title: "เปลี่ยนเป็นยังไม่จ่าย?", cancel: "ยกเลิก", confirm: "เปลี่ยนเป็นยังไม่จ่าย" },
    { locale: "en" as const, title: "Mark as unpaid?", cancel: "Cancel", confirm: "Mark as unpaid" },
  ])("asks only before undoing a fixed payment in $locale", async ({ locale, title, cancel, confirm }) => {
    const save = vi.spyOn(api, "confirmDetail").mockResolvedValue(paidView());
    const unpaid = viewWithSetup();
    unpaid.revision = "2";
    const undo = vi.spyOn(api, "cancelDetail").mockResolvedValue(unpaid);
    render(<LocaleProvider initialLocale={locale}><StatefulChips /></LocaleProvider>);
    const chip = screen.getByRole("button", { name: /ค่าเช่า/ });
    fireEvent.click(chip);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(save).toHaveBeenCalledWith("2026-08", unpaid.setup[0]!.id, undefined, "0", undefined);
    await waitFor(() => expect(chip).toHaveAttribute("aria-pressed", "true"));
    fireEvent.click(chip);
    const dialog = screen.getByRole("dialog", { name: title });
    expect(dialog).toHaveTextContent("ค่าเช่า");
    expect(undo).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: cancel }));
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(undo).not.toHaveBeenCalled();
    fireEvent.click(chip);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: confirm }));
    await waitFor(() => expect(chip).toHaveAttribute("aria-pressed", "false"));
    expect(undo).toHaveBeenCalledWith("2026-08", unpaid.setup[0]!.id, "1", undefined);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("blocks repeated clicks while the payment is being saved", async () => {
    let finish!: (view: MonthView) => void;
    const save = vi.spyOn(api, "confirmDetail").mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<StatefulChips />);
    const chip = screen.getByRole("button", { name: /ค่าเช่า/ });
    fireEvent.click(chip);
    fireEvent.click(chip);
    expect(chip).toBeDisabled();
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => finish(paidView()));
    expect(chip).toBeEnabled();
    expect(chip).toHaveAttribute("aria-pressed", "true");
  });

  it("shows an inline failure and keeps the unpaid status when saving fails", async () => {
    vi.spyOn(api, "confirmDetail").mockRejectedValue(new Error("offline"));
    render(<StatefulChips />);
    const chip = screen.getByRole("button", { name: /ค่าเช่า/ });
    fireEvent.click(chip);
    expect(await screen.findByRole("status")).toHaveTextContent("เชื่อมต่อไม่ได้");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-pressed", "false");
    expect(chip).toBeEnabled();
  });

  it("uses current server state on a conflict without replaying the payment", async () => {
    const save = vi.spyOn(api, "confirmDetail").mockRejectedValue(new ApiClientError(409, {
      code: "REVISION_CONFLICT", message: "conflict", current: paidView(),
    }));
    render(<StatefulChips />);
    fireEvent.click(screen.getByRole("button", { name: /ค่าเช่า/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("ข้อมูลเปลี่ยนจากอีกหน้าจอแล้ว");
    expect(screen.getByRole("button", { name: /ค่าเช่า/ })).toHaveAttribute("aria-pressed", "true");
    expect(save).toHaveBeenCalledTimes(1);
  });
});
