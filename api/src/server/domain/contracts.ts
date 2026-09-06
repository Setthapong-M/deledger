export type Money = string;
export type MonthKey = `${number}-${string}`;
export type ReconciliationState =
  | "draft"
  | "needs_information"
  | "inconsistent"
  | "reconciled";

export type SetupKind = "fixed" | "variable";

export type MonthView = {
  month: MonthKey;
  lifecycle: "open" | "closed";
  closedBy: "manual" | "automatic" | null;
  trackedFrom: string;
  isPartial: boolean;
  revision: string;
  summary: {
    startingBalance: Money | null;
    income: Money | null;
    endingBalance: Money | null;
    latestSnapshot: { id: string; observedOn: string; amount: Money } | null;
    referenceKind: "ending_balance" | "snapshot" | null;
    referenceAmount: Money | null;
    monthlySpending: Money | null;
    provisionalSpending: Money | null;
    detailTotal: Money;
    unitemizedSpending: Money | null;
  };
  reconciliation: {
    state: ReconciliationState;
    issueCodes: string[];
  };
  setup: Array<{
    id: string;
    position: number;
    name: string;
    kind: SetupKind;
    fixedAmount: Money | null;
    isPaused: boolean;
    detail: {
      confirmedName: string;
      confirmedKind: SetupKind;
      confirmedAmount: Money;
      confirmedAt: string;
    } | null;
  }>;
  allowedActions: {
    editIncome: boolean;
    recordSnapshot: boolean;
    editEndingBalance: boolean;
    manageSetup: boolean;
    confirmDetails: boolean;
    manualClose: boolean;
  };
  affectedMonthKeys: MonthKey[];
};

export type LifecycleState =
  | "onboarding_required"
  | "resume_required"
  | "ready"
  | "closed_until_boundary";
