import type { PoolClient } from "pg";

export async function catchUpCurrentOwner(client: PoolClient): Promise<number> {
  const result = await client.query<{ catch_up_current_owner_reporting_months: number }>("SELECT public.catch_up_current_owner_reporting_months() AS catch_up_current_owner_reporting_months");
  return Number(result.rows[0]?.catch_up_current_owner_reporting_months ?? 0);
}

export async function catchUpAll(client: PoolClient): Promise<number> {
  const result = await client.query<{ catch_up_reporting_months: number }>("SELECT public.catch_up_reporting_months() AS catch_up_reporting_months");
  return Number(result.rows[0]?.catch_up_reporting_months ?? 0);
}
