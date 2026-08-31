import { describe, expect, it } from "vitest";
import { deriveReconciliation, toMonthView, type RawMonthProjection } from "@/server/domain/month-view";

describe("deriveReconciliation", () => {
  it("keeps an open month in Draft even when inputs are present", () => {
    expect(deriveReconciliation({ lifecycle: "open", startingBalance: "20000.00", income: "30000.00", endingBalance: null, monthlySpending: null, detailTotal: "0.00" })).toEqual({ state: "draft", issueCodes: [] });
  });

  it("uses Needs Information before inconsistency when a closed input is missing", () => {
    expect(deriveReconciliation({ lifecycle: "closed", startingBalance: null, income: "30000.00", endingBalance: "35000.00", monthlySpending: null, detailTotal: "0.00" })).toEqual({ state: "needs_information", issueCodes: ["STARTING_BALANCE_MISSING"] });
  });

  it("uses literal reconciliation arithmetic supplied by SQL", () => {
    expect(deriveReconciliation({ lifecycle: "closed", startingBalance: "20000.00", income: "30000.00", endingBalance: "35000.00", monthlySpending: "15000.00", detailTotal: "5000.00" })).toEqual({ state: "reconciled", issueCodes: [] });
  });

  it("prioritizes negative spending before detail overflow", () => {
    expect(deriveReconciliation({ lifecycle: "closed", startingBalance: "20000.00", income: "0.00", endingBalance: "25000.00", monthlySpending: "-5000.00", detailTotal: "6000.00" })).toEqual({ state: "inconsistent", issueCodes: ["NEGATIVE_SPENDING"] });
  });

  it("detects details above coherent monthly spending", () => {
    expect(deriveReconciliation({ lifecycle: "closed", startingBalance: "20000.00", income: "30000.00", endingBalance: "35000.00", monthlySpending: "15000.00", detailTotal: "15000.01" })).toEqual({ state: "inconsistent", issueCodes: ["DETAILS_EXCEED_SPENDING"] });
  });

  it("preserves a negative derived value for diagnostics without treating it as Money input", () => {
    const projection: RawMonthProjection = {
      monthStart: "2026-08-01", lifecycle: "closed", closedBy: "automatic", trackedFrom: "2026-08-01", revision: "2",
      startingBalance: "20000.00", income: "0.00", endingBalance: "25000.00", latestSnapshot: null, monthlySpending: "-5000.00", provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: "-5000.00", setup: [], isFinalDay: false, isArchived: false,
    };
    const view = toMonthView(projection, { editIncome: false, recordSnapshot: false, editEndingBalance: false, manageSetup: false, confirmDetails: false, manualClose: false });
    expect(view.summary.monthlySpending).toBe("-5000.00");
    expect(view.summary.unitemizedSpending).toBe("-5000.00");
  });

  it("maps an empty closed projection and a confirmed detail without inventing values", () => {
    const projection: RawMonthProjection = {
      monthStart: "2026-08-01", lifecycle: "closed", closedBy: "manual", trackedFrom: "2026-08-01", revision: "3",
      startingBalance: null, income: null, endingBalance: null, latestSnapshot: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null,
      setup: [{ id: "00000000-0000-4000-8000-000000000012", position: 1, name: "Internet", kind: "variable", fixedAmount: null, isPaused: true, detail: { confirmedName: "Internet", confirmedKind: "variable", confirmedAmount: "500.00", confirmedAt: "2026-08-20T00:00:00Z" } }], isFinalDay: true, isArchived: false,
    };
    const view = toMonthView(projection, { editIncome: true, recordSnapshot: false, editEndingBalance: true, manageSetup: false, confirmDetails: false, manualClose: false });
    expect(view.reconciliation.state).toBe("needs_information");
    expect(view.summary.latestSnapshot).toBeNull();
    expect(view.setup[0]?.detail?.confirmedAmount).toBe("500.00");
    expect(view.setup[0]?.isPaused).toBe(true);
  });
});

describe("toMonthView", () => {
  it("maps numeric and bigint transport values to the complete Month View", () => {
    const projection: RawMonthProjection = {
      monthStart: "2026-08-01",
      lifecycle: "open",
      closedBy: null,
      trackedFrom: "2026-08-03",
      revision: "7",
      startingBalance: "20000.00",
      income: "30000.00",
      endingBalance: null,
      latestSnapshot: { id: "00000000-0000-4000-8000-000000000010", observedOn: "2026-08-15", amount: "41000.00" },
      monthlySpending: null,
      provisionalSpending: "9000.00",
      detailTotal: "5000.00",
      unitemizedSpending: null,
      setup: [{ id: "00000000-0000-4000-8000-000000000011", position: 1, name: "Rent", kind: "fixed", fixedAmount: "6000.00", isPaused: false, detail: null }],
      isFinalDay: false,
      isArchived: false,
    };
    const view = toMonthView(projection, { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false });
    expect(view.month).toBe("2026-08");
    expect(view.isPartial).toBe(true);
    expect(view.revision).toBe("7");
    expect(view.summary.latestSnapshot?.amount).toBe("41000.00");
    expect(view.setup[0]?.fixedAmount).toBe("6000.00");
  });
});
