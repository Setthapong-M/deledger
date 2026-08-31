# Deledger

Deledger is personal income-and-expense accounting that calculates monthly financial totals without requiring the user to reconstruct individual transactions.

## Language

**Financial Boundary**:
The complete pool of money a User tracks as one aggregate balance; each User has one Financial Boundary, and underlying bank accounts are not modeled.
_Avoid_: Expense category, bank account

**User**:
A person who owns one private Deledger financial record and its Financial Boundary.
_Avoid_: Account, ledger owner

**Archived User**:
A User whose access and monthly tracking are suspended while all financial records remain preserved and may be restored by the operator.
_Avoid_: Deleted User, removed user, soft-deleted account

**Balance Snapshot**:
The observed total balance inside the Financial Boundary at a specific point in time; it is provisional evidence and never becomes an Ending Balance without explicit confirmation.
_Avoid_: Ending balance, transaction, account entry

**Ending Balance**:
The explicitly confirmed balance of a Financial Boundary at the end of a Reporting Month.
_Avoid_: Latest balance snapshot, current balance

**Reporting Month**:
The calendar month whose income, expenses, and balance change are summarized together; MVP calendar boundaries always use Asia/Bangkok regardless of device location.
_Avoid_: Spending cycle, card cycle

**Partial Month**:
A Reporting Month whose tracked interval begins after the first calendar day, either when tracking starts for the first time or resumes after a Tracking Gap.
_Avoid_: Incomplete month, backfilled month

**Tracking Gap**:
An interval while a User remains archived across a calendar boundary; no Reporting Months are created and no balance continuity is inferred across it.
_Avoid_: Empty month, missing month, closed month

**Open Month**:
The Reporting Month currently receiving financial inputs; it has not yet been ended manually or by the calendar boundary.
_Avoid_: Draft transaction, unreconciled month

**Closed Month**:
A Reporting Month that has ended manually or automatically and is no longer the current period; it remains correctable, and changes may revise downstream Reporting Months.
_Avoid_: Reconciled month, immutable month

**Manual Close**:
The User's deliberate completion of a Reporting Month on its final calendar day after confirming all required Summary Inputs and a coherent Monthly Reconciliation.
_Avoid_: Early close, automatic close

**Automatic Close**:
The system's calendar-boundary closure of a Reporting Month regardless of whether its required Summary Inputs are complete.
_Avoid_: Manual close, reconciliation

**Reconciled Month**:
A Closed Month whose required Summary Inputs are present and whose Monthly Spending and Monthly Expense Details are coherent.
_Avoid_: Closed month, complete transaction list

**Needs Information**:
The state of a Closed Month that lacks a required Summary Input; dependent Reporting Months remain uncalculable until the missing value is supplied.
_Avoid_: Inconsistent month, open month

**Inconsistent Month**:
A Reporting Month whose available inputs imply impossible Monthly Spending or whose Monthly Expense Details exceed that spending.
_Avoid_: Needs information, unitemized spending

**Income**:
The single aggregate amount of money received from outside the Financial Boundary during a Reporting Month.
_Avoid_: Internal transfer, balance increase

**Expense**:
Money that leaves the Financial Boundary because it was spent or an obligation was paid.
_Avoid_: Internal transfer, balance decrease

**Internal Transfer**:
Movement of money between accounts inside the Financial Boundary; it is neither Income nor an Expense.
_Avoid_: Income, expense

**Monthly Spending**:
The total Expense for a Reporting Month derived from its balance and Income summary values; Monthly Expense Details never assemble or increase it.
_Avoid_: Itemized spending, spending allowance

**Recurring Expense**:
An Expense expected to occur repeatedly; its amount may be fixed or may vary between Reporting Months.
_Avoid_: Fixed cost, subscription

**Fixed Expense**:
A Recurring Expense whose amount is known and stable before it is paid.
_Avoid_: Utility bill, all recurring expenses

**Variable Recurring Expense**:
A Recurring Expense whose actual amount must be supplied separately for each Reporting Month.
_Avoid_: Unitemized spending, fixed expense

**Monthly Expense Setup**:
The ordered set of Recurring Expense definitions belonging to one Reporting Month; it begins as a one-time snapshot of the preceding month's setup, including paused items, and remains independent after creation.
_Avoid_: Global expense master, live template

**Monthly Recurring Expense**:
A month-owned Recurring Expense definition with a name, type, and—for a Fixed Expense—its normal amount for that Reporting Month.
_Avoid_: Expense master, monthly expense detail

**Monthly Expense Detail**:
A single aggregate confirmation that one Monthly Recurring Expense was paid during its Reporting Month; it preserves the confirmed name, type, and amount while explaining Monthly Spending without changing its calculated total.
_Avoid_: Monthly expense setup, additional expense, transaction detail

**Unitemized Spending**:
The portion of Monthly Spending left after all Monthly Expense Details for the Reporting Month are deducted, including one-off Expenses that the MVP does not itemize separately.
_Avoid_: Unknown transaction, variable expense

**Summary Input**:
A value needed to reconcile a Reporting Month without identifying individual transactions, such as Income or Ending Balance.
_Avoid_: Balance snapshot, transaction entry, expense item

**Transaction Detail**:
An individual dated record describing what was received or purchased and for how much; it is not required to calculate Monthly Spending.
_Avoid_: Summary Input, balance snapshot

**Monthly Reconciliation**:
The process of deriving Monthly Spending from Summary Inputs, then checking that the resulting monthly totals and Monthly Expense Details are coherent.
_Avoid_: Transaction logging, spending forecast
