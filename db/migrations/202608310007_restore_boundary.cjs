exports.up = (pgm) => {
  pgm.sql(`
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
      crossed := date_trunc('month', archived_at_value AT TIME ZONE 'Asia/Bangkok')::date < date_trunc('month', public.current_business_date())::date;
      UPDATE public.user_archive_period SET restored_at = clock_timestamp() WHERE owner_id = p_owner_id AND restored_at IS NULL;
      IF crossed THEN UPDATE public.app_user SET resume_required_at = clock_timestamp() WHERE id = p_owner_id; END IF;
      RETURN crossed;
    END
    $function$;
    GRANT SELECT ON public.user_archive_period TO deledger_web;
  `);
};

exports.down = () => {};
