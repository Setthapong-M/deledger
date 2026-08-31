exports.up = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION public.operator_export(p_owner_id uuid)
    RETURNS jsonb
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
      SELECT jsonb_build_object(
        'owner', (SELECT to_jsonb(u) FROM public.app_user AS u WHERE u.id = p_owner_id),
        'emails', COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.linked_at) FROM public.user_identity_email AS e WHERE e.owner_id = p_owner_id), '[]'::jsonb),
        'archives', COALESCE((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.archived_at) FROM public.user_archive_period AS a WHERE a.owner_id = p_owner_id), '[]'::jsonb),
        'months', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.month_start) FROM public.reporting_month AS m WHERE m.owner_id = p_owner_id), '[]'::jsonb),
        'snapshots', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.month_start, s.observed_on, s.recorded_at) FROM public.balance_snapshot AS s WHERE s.owner_id = p_owner_id), '[]'::jsonb),
        'setup', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.month_start, r.position) FROM public.monthly_recurring_expense AS r WHERE r.owner_id = p_owner_id), '[]'::jsonb),
        'details', COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY d.month_start, d.confirmed_at) FROM public.monthly_expense_detail AS d WHERE d.owner_id = p_owner_id), '[]'::jsonb)
      )
    $function$;
    REVOKE ALL ON FUNCTION public.operator_export(uuid) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.operator_export(uuid) TO deledger_operator;
    GRANT EXECUTE ON FUNCTION public.current_business_date() TO deledger_operator;
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP FUNCTION IF EXISTS public.operator_export(uuid);");
};
