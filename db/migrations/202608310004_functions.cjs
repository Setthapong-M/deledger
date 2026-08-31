exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.resolve_current_identity(p_email text)
    RETURNS TABLE (owner_id uuid, identity_state text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE
      normalized text := lower(btrim(p_email));
      mapped_owner uuid;
    BEGIN
      IF normalized = '' THEN
        RETURN QUERY SELECT NULL::uuid, 'not_invited'::text;
        RETURN;
      END IF;
      SELECT e.owner_id INTO mapped_owner
      FROM public.user_identity_email AS e
      WHERE e.normalized_email = normalized AND e.unlinked_at IS NULL;
      IF mapped_owner IS NULL THEN
        RETURN QUERY SELECT NULL::uuid, 'not_invited'::text;
      ELSIF EXISTS (
        SELECT 1 FROM public.user_archive_period AS a
        WHERE a.owner_id = mapped_owner AND a.restored_at IS NULL
      ) THEN
        RETURN QUERY SELECT mapped_owner, 'archived'::text;
      ELSE
        RETURN QUERY SELECT mapped_owner, 'active'::text;
      END IF;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.current_business_date()
    RETURNS date
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$ SELECT (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date $$;

    CREATE OR REPLACE FUNCTION public.current_owner_id()
    RETURNS uuid
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$ SELECT NULLIF(current_setting('deledger.user_id', true), '')::uuid $$;

    CREATE OR REPLACE FUNCTION public.catch_up_owner_reporting_months(p_owner_id uuid, p_business_date date)
    RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE
      current_month date := date_trunc('month', p_business_date)::date;
      user_row record;
      month_row record;
      last_month date;
      next_month date;
      changed integer := 0;
      is_archived boolean;
    BEGIN
      SELECT u.id, u.resume_required_at INTO user_row
      FROM public.app_user AS u
      WHERE u.id = p_owner_id
      FOR UPDATE;
      IF NOT FOUND THEN RETURN 0; END IF;
      PERFORM pg_advisory_xact_lock(hashtextextended(p_owner_id::text, 0));
      SELECT EXISTS (
        SELECT 1 FROM public.user_archive_period AS a
        WHERE a.owner_id = p_owner_id AND a.restored_at IS NULL
      ) INTO is_archived;

      IF is_archived THEN
        SELECT rm.* INTO month_row
        FROM public.reporting_month AS rm
        WHERE rm.owner_id = p_owner_id AND rm.closed_at IS NULL
          AND (rm.month_start + interval '1 month')::date <= p_business_date
        ORDER BY rm.month_start DESC
        LIMIT 1
        FOR UPDATE;
        IF FOUND THEN
          UPDATE public.reporting_month
          SET closed_at = clock_timestamp(), closed_by = 'automatic', updated_at = clock_timestamp(), revision = revision + 1
          WHERE owner_id = month_row.owner_id AND month_start = month_row.month_start AND closed_at IS NULL;
          changed := changed + 1;
        END IF;
        RETURN changed;
      END IF;

      FOR month_row IN
        SELECT rm.owner_id, rm.month_start
        FROM public.reporting_month AS rm
        WHERE rm.owner_id = p_owner_id AND rm.closed_at IS NULL
          AND (rm.month_start + interval '1 month')::date <= p_business_date
        ORDER BY rm.month_start
        FOR UPDATE
      LOOP
        UPDATE public.reporting_month
        SET closed_at = clock_timestamp(), closed_by = 'automatic', updated_at = clock_timestamp(), revision = revision + 1
        WHERE owner_id = month_row.owner_id AND month_start = month_row.month_start AND closed_at IS NULL;
        changed := changed + 1;
      END LOOP;

      IF user_row.resume_required_at IS NOT NULL THEN
        RETURN changed;
      END IF;

      SELECT max(rm.month_start) INTO last_month
      FROM public.reporting_month AS rm WHERE rm.owner_id = p_owner_id;
      IF last_month IS NULL THEN RETURN changed; END IF;
      next_month := (last_month + interval '1 month')::date;
      WHILE next_month <= current_month LOOP
        INSERT INTO public.reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount, ending_balance_amount)
        VALUES (p_owner_id, next_month, next_month, 'prior_ending', NULL, NULL, NULL)
        ON CONFLICT (owner_id, month_start) DO NOTHING;
        INSERT INTO public.monthly_recurring_expense (owner_id, month_start, id, position, name, kind, fixed_amount, is_paused)
        SELECT owner_id, next_month, id, position, name, kind, fixed_amount, is_paused
        FROM public.monthly_recurring_expense
        WHERE owner_id = p_owner_id AND month_start = last_month
        ON CONFLICT (owner_id, month_start, id) DO NOTHING;
        next_month := (next_month + interval '1 month')::date;
        last_month := (last_month + interval '1 month')::date;
        changed := changed + 1;
      END LOOP;
      RETURN changed;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.catch_up_reporting_months()
    RETURNS integer
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE
      business_date date := (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date;
      user_row record;
      changed integer := 0;
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
      SELECT public.catch_up_owner_reporting_months(owner_id, (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date) INTO result;
      RETURN result;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.operator_invite(p_email text)
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE normalized text := lower(btrim(p_email)); owner_id uuid;
    BEGIN
      IF normalized = '' OR normalized !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' THEN RAISE EXCEPTION 'invalid email' USING ERRCODE = '22023'; END IF;
      SELECT e.owner_id INTO owner_id FROM public.user_identity_email AS e WHERE e.normalized_email = normalized;
      IF owner_id IS NULL THEN
        owner_id := gen_random_uuid();
        INSERT INTO public.app_user (id) VALUES (owner_id);
        INSERT INTO public.user_identity_email (normalized_email, owner_id) VALUES (normalized, owner_id);
      END IF;
      RETURN owner_id;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.operator_archive(p_owner_id uuid)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE archive_id bigint;
    BEGIN
      PERFORM 1 FROM public.app_user WHERE id = p_owner_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;
      INSERT INTO public.user_archive_period (owner_id) VALUES (p_owner_id)
      ON CONFLICT (owner_id) WHERE restored_at IS NULL DO NOTHING
      RETURNING id INTO archive_id;
      IF archive_id IS NULL THEN SELECT id INTO archive_id FROM public.user_archive_period WHERE owner_id = p_owner_id AND restored_at IS NULL; END IF;
      RETURN archive_id;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.operator_restore(p_owner_id uuid)
    RETURNS boolean
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE archived_at_value timestamptz; crossed boolean := false;
    BEGIN
      PERFORM 1 FROM public.app_user WHERE id = p_owner_id FOR UPDATE;
      SELECT archived_at INTO archived_at_value FROM public.user_archive_period WHERE owner_id = p_owner_id AND restored_at IS NULL FOR UPDATE;
      IF archived_at_value IS NULL THEN RAISE EXCEPTION 'archive not open' USING ERRCODE = 'P0002'; END IF;
      crossed := date_trunc('month', archived_at_value AT TIME ZONE 'Asia/Bangkok')::date < public.current_business_date();
      UPDATE public.user_archive_period SET restored_at = clock_timestamp() WHERE owner_id = p_owner_id AND restored_at IS NULL;
      IF crossed THEN UPDATE public.app_user SET resume_required_at = clock_timestamp() WHERE id = p_owner_id; END IF;
      RETURN crossed;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.operator_transfer_email(p_old_email text, p_new_email text)
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE old_normalized text := lower(btrim(p_old_email)); new_normalized text := lower(btrim(p_new_email)); owner_id uuid; existing_owner uuid;
    BEGIN
      SELECT e.owner_id INTO owner_id FROM public.user_identity_email AS e WHERE e.normalized_email = old_normalized AND e.unlinked_at IS NULL FOR UPDATE;
      IF owner_id IS NULL THEN RAISE EXCEPTION 'old email not found' USING ERRCODE = 'P0002'; END IF;
      SELECT e.owner_id INTO existing_owner FROM public.user_identity_email AS e WHERE e.normalized_email = new_normalized;
      IF existing_owner IS NOT NULL AND existing_owner <> owner_id THEN RAISE EXCEPTION 'email belongs to another user' USING ERRCODE = '23505'; END IF;
      UPDATE public.user_identity_email SET unlinked_at = clock_timestamp() WHERE normalized_email = old_normalized AND unlinked_at IS NULL;
      INSERT INTO public.user_identity_email (normalized_email, owner_id) VALUES (new_normalized, owner_id)
      ON CONFLICT (normalized_email) DO UPDATE SET owner_id = EXCLUDED.owner_id, linked_at = clock_timestamp(), unlinked_at = NULL;
      RETURN owner_id;
    END
    $function$;

    REVOKE ALL ON FUNCTION public.resolve_current_identity(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.current_business_date() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.current_owner_id() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.catch_up_reporting_months() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.catch_up_owner_reporting_months(uuid, date) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.catch_up_current_owner_reporting_months() FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.operator_invite(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.operator_archive(uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.operator_restore(uuid) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.operator_transfer_email(text, text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.resolve_current_identity(text), public.current_business_date(), public.current_owner_id(), public.catch_up_current_owner_reporting_months() TO deledger_web;
    GRANT EXECUTE ON FUNCTION public.catch_up_reporting_months() TO deledger_maintenance;
    GRANT EXECUTE ON FUNCTION public.catch_up_owner_reporting_months(uuid, date) TO deledger_maintenance, deledger_operator;
    GRANT EXECUTE ON FUNCTION public.operator_invite(text), public.operator_archive(uuid), public.operator_restore(uuid), public.operator_transfer_email(text, text), public.catch_up_reporting_months() TO deledger_operator;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP FUNCTION IF EXISTS public.operator_transfer_email(text, text);
    DROP FUNCTION IF EXISTS public.operator_restore(uuid);
    DROP FUNCTION IF EXISTS public.operator_archive(uuid);
    DROP FUNCTION IF EXISTS public.operator_invite(text);
    DROP FUNCTION IF EXISTS public.catch_up_current_owner_reporting_months();
    DROP FUNCTION IF EXISTS public.catch_up_owner_reporting_months(uuid, date);
    DROP FUNCTION IF EXISTS public.catch_up_reporting_months();
    DROP FUNCTION IF EXISTS public.current_owner_id();
    DROP FUNCTION IF EXISTS public.current_business_date();
    DROP FUNCTION IF EXISTS public.resolve_current_identity(text);
  `);
};
