# Define manual month-close semantics

Type: grilling
Status: resolved
Blocked by:

## Question

When may a User close an Open Month manually, especially before the calendar month has ended? Decide whether manual closure requires an explicitly confirmed Ending Balance, whether an incomplete month may be closed into Needs Information, what happens to later snapshots or income within the same calendar month after an early close, and which corrections remain available without reopening. The answer must coexist with automatic closure at the calendar boundary and downstream recalculation.

## Answer

Manual Close is available only on the final calendar day of the Reporting Month. It requires explicitly confirmed Income and Ending Balance plus a coherent Monthly Reconciliation: Monthly Spending cannot be negative and confirmed Monthly Expense Details cannot exceed it. Details may remain incomplete and Unitemized Spending may be positive. Before the final day, the User may record Balance Snapshots and other current-month information but cannot close the month.

Automatic Close remains the unconditional calendar-boundary gate. It closes the month even when Summary Inputs are missing or inconsistent, producing Needs Information or Inconsistent rather than pretending the month reconciled. A Closed Month is never reopened: the User may correct Income, Ending Balance, Monthly Expense Setup, and Monthly Expense Details, after which the month and dependent months recalculate. Balance Snapshots cannot be added after closure because they are provisional observations belonging only to an Open Month.
