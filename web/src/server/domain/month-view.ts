import { monthKeyFromStart } from "./calendar";
import type { MonthView, ReconciliationState, SetupKind } from "./contracts";
import { parseMoney } from "./money";

export type RawMonthProjection = {
  monthStart: string;
  lifecycle: "open" | "closed";
  closedBy: "manual" | "automatic" | null;
  trackedFrom: string;
  revision: string;
  startingBalance: string | null;
  income: string | null;
  endingBalance: string | null;
  latestSnapshot: { id: string; observedOn: string; amount: string } | null;
  monthlySpending: string | null;
  provisionalSpending: string | null;
  detailTotal: string;
  unitemizedSpending: string | null;
  setup: Array<{
    id: string;
    position: number;
    name: string;
    kind: SetupKind;
    fixedAmount: string | null;
    isPaused: boolean;
    detail: {
      confirmedName: string;
      confirmedKind: SetupKind;
      confirmedAmount: string;
      confirmedAt: string;
    } | null;
  }>;
  isFinalDay: boolean;
  isArchived: boolean;
  affectedMonthKeys?: string[];
};

export function deriveReconciliation(input: {
  lifecycle: "open" | "closed";
  startingBalance: string | null;
  income: string | null;
  endingBalance: string | null;
  monthlySpending: string | null;
  detailTotal: string;
}): { state: ReconciliationState; issueCodes: string[] } {
  if (input.lifecycle === "open") return { state: "draft", issueCodes: [] };
  const missing: string[] = [];
  if (input.startingBalance === null) missing.push("STARTING_BALANCE_MISSING");
  if (input.income === null) missing.push("INCOME_MISSING");
  if (input.endingBalance === null) missing.push("ENDING_BALANCE_MISSING");
  if (missing.length > 0) return { state: "needs_information", issueCodes: missing };
  if (input.monthlySpending === null) return { state: "needs_information", issueCodes: ["SPENDING_UNAVAILABLE"] };
  if (input.monthlySpending.startsWith("-")) return { state: "inconsistent", issueCodes: ["NEGATIVE_SPENDING"] };
  if (compareMoney(input.detailTotal, input.monthlySpending) > 0) {
    return { state: "inconsistent", issueCodes: ["DETAILS_EXCEED_SPENDING"] };
  }
  return { state: "reconciled", issueCodes: [] };
}

export function toMonthView(projection: RawMonthProjection, allowedActions: MonthView["allowedActions"]): MonthView {
  const reconciliation = deriveReconciliation(projection);
  return {
    month: monthKeyFromStart(projection.monthStart) as MonthView["month"],
    lifecycle: projection.lifecycle,
    closedBy: projection.closedBy,
    trackedFrom: projection.trackedFrom,
    isPartial: projection.trackedFrom !== projection.monthStart,
    revision: projection.revision,
    summary: {
      startingBalance: mapMoney(projection.startingBalance),
      income: mapMoney(projection.income),
      endingBalance: mapMoney(projection.endingBalance),
      latestSnapshot: projection.latestSnapshot
        ? { ...projection.latestSnapshot, amount: parseMoney(projection.latestSnapshot.amount) }
        : null,
      referenceKind: projection.endingBalance !== null ? "ending_balance" : projection.latestSnapshot ? "snapshot" : null,
      referenceAmount: projection.endingBalance !== null ? parseMoney(projection.endingBalance) : projection.latestSnapshot ? parseMoney(projection.latestSnapshot.amount) : null,
      monthlySpending: mapDerivedMoney(projection.monthlySpending),
      provisionalSpending: mapDerivedMoney(projection.provisionalSpending),
      detailTotal: parseMoney(projection.detailTotal),
      unitemizedSpending: mapDerivedMoney(projection.unitemizedSpending),
    },
    reconciliation,
    setup: projection.setup.map((item) => ({
      ...item,
      fixedAmount: mapMoney(item.fixedAmount),
      detail: item.detail
        ? { ...item.detail, confirmedAmount: parseMoney(item.detail.confirmedAmount) }
        : null,
    })),
    allowedActions,
    affectedMonthKeys: (projection.affectedMonthKeys ?? []) as MonthView["affectedMonthKeys"],
  };
}

function mapMoney(value: string | null): string | null {
  return value === null ? null : parseMoney(value);
}

function mapDerivedMoney(value: string | null): string | null {
  if (value === null) return null;
  if (value.startsWith("-")) {
    return `-${parseMoney(value.slice(1))}`;
  }
  return parseMoney(value);
}

function compareMoney(left: string, right: string): number {
  const [leftWhole, leftFraction] = parseMoney(left).split(".");
  const [rightWhole, rightFraction] = parseMoney(right).split(".");
  if (leftWhole.length !== rightWhole.length) return leftWhole.length > rightWhole.length ? 1 : -1;
  if (leftWhole !== rightWhole) return leftWhole > rightWhole ? 1 : -1;
  if (leftFraction === rightFraction) return 0;
  return leftFraction > rightFraction ? 1 : -1;
}
