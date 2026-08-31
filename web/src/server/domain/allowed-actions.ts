import type { MonthView } from "./contracts";

export function deriveAllowedActions(input: {
  lifecycle: "open" | "closed";
  hasStartingBalance: boolean;
  hasIncome: boolean;
  hasEndingBalance: boolean;
  isFinalDay: boolean;
  isArchived: boolean;
}): MonthView["allowedActions"] {
  const open = input.lifecycle === "open";
  return {
    editIncome: !input.isArchived,
    recordSnapshot: open && !input.isArchived,
    editEndingBalance: !input.isArchived,
    manageSetup: open && !input.isArchived,
    confirmDetails: open && !input.isArchived,
    manualClose:
      open &&
      !input.isArchived &&
      input.isFinalDay &&
      input.hasStartingBalance &&
      input.hasIncome &&
      input.hasEndingBalance,
  };
}
