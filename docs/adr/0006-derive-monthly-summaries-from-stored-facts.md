# Derive monthly summaries from stored facts

Deledger persists Summary Inputs, closure facts, Balance Snapshots, month-owned setup rows, and confirmation snapshots, but derives Starting Balance, Monthly Spending, detail totals, Unitemized Spending, Partial and reconciliation states, and Tracking Gaps on read. This avoids fragile cached propagation when Closed Months are corrected and makes each displayed result traceable to the smallest set of User-confirmed facts.
