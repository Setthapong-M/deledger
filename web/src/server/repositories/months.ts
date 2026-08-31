import type { PoolClient } from "pg";
import type { RawMonthProjection } from "../domain/month-view";

type MonthRow = {
  month_start: string;
  lifecycle: "open" | "closed";
  closed_by: "manual" | "automatic" | null;
  tracked_from: string;
  revision: string;
  starting_balance: string | null;
  income: string | null;
  ending_balance: string | null;
  snapshot_id: string | null;
  snapshot_observed_on: string | null;
  snapshot_amount: string | null;
  monthly_spending: string | null;
  provisional_spending: string | null;
  detail_total: string;
  unitemized_spending: string | null;
  setup_id: string | null;
  setup_position: number | null;
  setup_name: string | null;
  setup_kind: "fixed" | "variable" | null;
  setup_fixed_amount: string | null;
  setup_paused: boolean | null;
  detail_name: string | null;
  detail_kind: "fixed" | "variable" | null;
  detail_amount: string | null;
  detail_confirmed_at: string | null;
  is_final_day: boolean;
  is_archived: boolean;
};

const projectionQuery = `
  WITH selected AS (
    SELECT
      m.*,
      CASE WHEN m.opening_source = 'supplied' THEN m.opening_balance_input ELSE previous.ending_balance_amount END AS starting_balance,
      snapshot.id AS snapshot_id,
      snapshot.observed_on AS snapshot_observed_on,
      snapshot.amount AS snapshot_amount,
      COALESCE(detail_totals.detail_total, 0::numeric) AS detail_total
    FROM public.reporting_month AS m
    LEFT JOIN public.reporting_month AS previous
      ON previous.owner_id = m.owner_id
      AND previous.month_start = (m.month_start - interval '1 month')::date
    LEFT JOIN LATERAL (
      SELECT s.id, s.observed_on, s.amount
      FROM public.balance_snapshot AS s
      WHERE s.owner_id = m.owner_id AND s.month_start = m.month_start
      ORDER BY s.observed_on DESC, s.recorded_at DESC, s.id DESC
      LIMIT 1
    ) AS snapshot ON true
    LEFT JOIN LATERAL (
      SELECT sum(d.confirmed_amount)::numeric(15,2) AS detail_total
      FROM public.monthly_expense_detail AS d
      WHERE d.owner_id = m.owner_id AND d.month_start = m.month_start
    ) AS detail_totals ON true
    WHERE m.owner_id = $1 AND m.month_start = $2
  ), derived AS (
    SELECT
      selected.*,
      CASE WHEN starting_balance IS NOT NULL AND income_amount IS NOT NULL AND ending_balance_amount IS NOT NULL
        THEN starting_balance + income_amount - ending_balance_amount END AS monthly_spending,
      CASE WHEN closed_at IS NULL AND starting_balance IS NOT NULL AND income_amount IS NOT NULL AND ending_balance_amount IS NULL AND snapshot_amount IS NOT NULL
        THEN starting_balance + income_amount - snapshot_amount END AS provisional_spending
    FROM selected
  )
  SELECT
    derived.month_start::text AS month_start,
    CASE WHEN derived.closed_at IS NULL THEN 'open' ELSE 'closed' END AS lifecycle,
    derived.closed_by,
    derived.tracked_from::text AS tracked_from,
    derived.revision::text,
    derived.starting_balance::text,
    derived.income_amount::text AS income,
    derived.ending_balance_amount::text AS ending_balance,
    derived.snapshot_id::text,
    derived.snapshot_observed_on::text AS snapshot_observed_on,
    derived.snapshot_amount::text,
    derived.monthly_spending::text,
    derived.provisional_spending::text,
    derived.detail_total::text,
    CASE WHEN derived.monthly_spending IS NULL THEN NULL ELSE (derived.monthly_spending - derived.detail_total)::text END AS unitemized_spending,
    public.current_business_date() = ((derived.month_start + interval '1 month')::date - 1) AS is_final_day,
    EXISTS (SELECT 1 FROM public.user_archive_period AS archive WHERE archive.owner_id = derived.owner_id AND archive.restored_at IS NULL) AS is_archived,
    setup.id::text AS setup_id,
    setup.position AS setup_position,
    setup.name AS setup_name,
    setup.kind AS setup_kind,
    setup.fixed_amount::text AS setup_fixed_amount,
    setup.is_paused AS setup_paused,
    detail.confirmed_name AS detail_name,
    detail.confirmed_kind AS detail_kind,
    detail.confirmed_amount::text AS detail_amount,
    detail.confirmed_at AS detail_confirmed_at
  FROM derived
  LEFT JOIN public.monthly_recurring_expense AS setup
    ON setup.owner_id = derived.owner_id AND setup.month_start = derived.month_start
  LEFT JOIN public.monthly_expense_detail AS detail
    ON detail.owner_id = setup.owner_id AND detail.month_start = setup.month_start AND detail.setup_item_id = setup.id
  ORDER BY setup.position NULLS LAST, setup.id
`;

export async function getMonthProjection(client: PoolClient, ownerId: string, monthStart: string): Promise<RawMonthProjection | null> {
  const result = await client.query<MonthRow>(projectionQuery, [ownerId, monthStart]);
  const first = result.rows[0];
  if (!first) return null;
  return {
    monthStart: first.month_start,
    lifecycle: first.lifecycle,
    closedBy: first.closed_by,
    trackedFrom: first.tracked_from,
    revision: first.revision,
    startingBalance: first.starting_balance,
    income: first.income,
    endingBalance: first.ending_balance,
    latestSnapshot: first.snapshot_id
      ? { id: first.snapshot_id, observedOn: first.snapshot_observed_on!, amount: first.snapshot_amount! }
      : null,
    monthlySpending: first.monthly_spending,
    provisionalSpending: first.provisional_spending,
    detailTotal: first.detail_total,
    unitemizedSpending: first.unitemized_spending,
    setup: result.rows
      .filter((row) => row.setup_id !== null)
      .map((row) => ({
        id: row.setup_id!,
        position: row.setup_position!,
        name: row.setup_name!,
        kind: row.setup_kind!,
        fixedAmount: row.setup_fixed_amount,
        isPaused: row.setup_paused!,
        detail: row.detail_amount !== null
          ? {
              confirmedName: row.detail_name!,
              confirmedKind: row.detail_kind!,
              confirmedAmount: row.detail_amount,
              confirmedAt: row.detail_confirmed_at!,
            }
          : null,
      })),
    isFinalDay: first.is_final_day,
    isArchived: first.is_archived,
  };
}

export async function listMonthKeys(client: PoolClient, ownerId: string): Promise<string[]> {
  const result = await client.query<{ month_start: string }>(
    "SELECT month_start::text FROM public.reporting_month WHERE owner_id = $1 ORDER BY month_start DESC",
    [ownerId],
  );
  return result.rows.map((row) => row.month_start);
}
