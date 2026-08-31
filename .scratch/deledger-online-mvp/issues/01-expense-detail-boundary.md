# Define the MVP expense-detail boundary

Type: grilling
Status: resolved
Blocked by:

## Question

What may become a Monthly Expense Detail in the MVP: only a Monthly Recurring Expense selected from the month's ordered setup, or also an ad-hoc one-off item? Resolve whether one setup item may produce only one confirmed detail per Reporting Month, how multiple real payments are represented, whether a configured item may be permanently removed or only paused, and how an exceptional Fixed Expense amount should affect the current detail versus the setup copied to the next month. The result must preserve the invariant that details explain Monthly Spending without changing its derived total.

## Answer

The MVP creates Monthly Expense Details only from Monthly Recurring Expenses in that Reporting Month's ordered Monthly Expense Setup; ad-hoc and one-off Expenses remain Unitemized Spending. Each Monthly Recurring Expense may produce one aggregate Monthly Expense Detail per Reporting Month, so multiple real payments are entered as one summed amount rather than transaction rows. Setup items are paused, never permanently deleted, and paused state/order are copied when the next month takes its one-time setup snapshot.

A Fixed Expense confirms exactly the normal amount in its current Monthly Recurring Expense. If that amount is wrong, the User cancels any existing confirmation, edits the current month's setup, and confirms again; frequent variation means the item should be Variable. Confirmation snapshots the name, type, and amount into the Monthly Expense Detail, so later setup edits never rewrite the already-confirmed fact.
