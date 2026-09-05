import pg from "pg";
import { beforeAll, afterAll } from "vitest";

const { Pool } = pg;
const testAdminDatabaseUrl = process.env.TEST_ADMIN_DATABASE_URL;

if (testAdminDatabaseUrl) {
  const admin = new Pool({ connectionString: testAdminDatabaseUrl, max: 1, connectionTimeoutMillis: 3_000 });

  beforeAll(async () => {
    await admin.query(`
      CREATE OR REPLACE FUNCTION public.current_business_date()
      RETURNS date
      LANGUAGE sql
      STABLE
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $$ SELECT DATE '2026-08-31' $$;

      CREATE OR REPLACE FUNCTION public.catch_up_reporting_months()
      RETURNS integer
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $function$
      DECLARE business_date date := public.current_business_date(); user_row record; changed integer := 0;
      BEGIN
        FOR user_row IN SELECT u.id FROM public.app_user AS u ORDER BY u.id LOOP
          changed := changed + public.catch_up_owner_reporting_months(user_row.id, business_date);
        END LOOP;
        RETURN changed;
      END
      $function$;

      CREATE OR REPLACE FUNCTION public.catch_up_current_owner_reporting_months()
      RETURNS integer
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = pg_catalog, public
      AS $function$
      DECLARE owner_id uuid := NULLIF(current_setting('deledger.user_id', true), '')::uuid; result integer;
      BEGIN
        IF owner_id IS NULL THEN RAISE EXCEPTION 'deledger.user_id is required' USING ERRCODE = '22023'; END IF;
        SELECT public.catch_up_owner_reporting_months(owner_id, public.current_business_date()) INTO result;
        RETURN result;
      END
      $function$;
    `);
  });

  afterAll(async () => {
    await admin.end();
  });
}
