exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE app_user ADD COLUMN IF NOT EXISTS date_of_birth date;

    CREATE TABLE IF NOT EXISTS user_identity_phone (
      normalized_phone text PRIMARY KEY,
      owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
      linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      unlinked_at timestamptz,
      CONSTRAINT user_identity_phone_normalized_ck CHECK (normalized_phone ~ '^\\+66[689][0-9]{8}$'),
      CONSTRAINT user_identity_phone_dates_ck CHECK (unlinked_at IS NULL OR unlinked_at > linked_at)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS user_identity_phone_current_owner_uq ON user_identity_phone(owner_id) WHERE unlinked_at IS NULL;

    CREATE TABLE IF NOT EXISTS local_session (
      token_digest text PRIMARY KEY,
      owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
      issued_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      expires_at timestamptz NOT NULL,
      revoked_at timestamptz,
      CONSTRAINT local_session_digest_ck CHECK (token_digest ~ '^[a-f0-9]{64}$'),
      CONSTRAINT local_session_expiry_ck CHECK (expires_at > issued_at)
    );
    CREATE INDEX IF NOT EXISTS local_session_owner_idx ON local_session(owner_id, expires_at DESC);

    ALTER TABLE user_identity_phone ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_identity_phone FORCE ROW LEVEL SECURITY;
    ALTER TABLE local_session ENABLE ROW LEVEL SECURITY;
    ALTER TABLE local_session FORCE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS phone_owner_policy ON user_identity_phone;
    CREATE POLICY phone_owner_policy ON user_identity_phone
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
    DROP POLICY IF EXISTS local_session_owner_policy ON local_session;
    CREATE POLICY local_session_owner_policy ON local_session
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);

    GRANT SELECT ON public.user_identity_email, public.user_identity_phone TO deledger_web;

    CREATE OR REPLACE FUNCTION public.local_login(p_kind text, p_value text, p_token_digest text, p_expires_at timestamptz)
    RETURNS TABLE (owner_id uuid, identity_state text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE
      normalized text := btrim(p_value);
      mapped_owner uuid;
      archived boolean;
    BEGIN
      IF p_kind NOT IN ('email', 'phone') OR normalized = '' OR p_token_digest !~ '^[a-f0-9]{64}$' OR p_expires_at <= clock_timestamp() THEN
        RAISE EXCEPTION 'invalid local login' USING ERRCODE = '22023';
      END IF;
      IF p_kind = 'email' THEN normalized := lower(normalized); END IF;
      PERFORM pg_advisory_xact_lock(hashtextextended(p_kind || ':' || normalized, 0));
      IF p_kind = 'email' THEN
        SELECT e.owner_id INTO mapped_owner FROM public.user_identity_email AS e WHERE e.normalized_email = normalized AND e.unlinked_at IS NULL;
        IF mapped_owner IS NULL AND EXISTS (SELECT 1 FROM public.user_identity_email AS e WHERE e.normalized_email = normalized) THEN
          RETURN QUERY SELECT NULL::uuid, 'reserved'::text;
          RETURN;
        END IF;
      ELSE
        SELECT p.owner_id INTO mapped_owner FROM public.user_identity_phone AS p WHERE p.normalized_phone = normalized AND p.unlinked_at IS NULL;
        IF mapped_owner IS NULL AND EXISTS (SELECT 1 FROM public.user_identity_phone AS p WHERE p.normalized_phone = normalized) THEN
          RETURN QUERY SELECT NULL::uuid, 'reserved'::text;
          RETURN;
        END IF;
      END IF;
      IF mapped_owner IS NULL THEN
        mapped_owner := gen_random_uuid();
        INSERT INTO public.app_user (id) VALUES (mapped_owner);
        IF p_kind = 'email' THEN
          INSERT INTO public.user_identity_email (normalized_email, owner_id) VALUES (normalized, mapped_owner);
        ELSE
          INSERT INTO public.user_identity_phone (normalized_phone, owner_id) VALUES (normalized, mapped_owner);
        END IF;
      END IF;
      SELECT EXISTS (SELECT 1 FROM public.user_archive_period AS a WHERE a.owner_id = mapped_owner AND a.restored_at IS NULL) INTO archived;
      IF archived THEN
        RETURN QUERY SELECT mapped_owner, 'archived'::text;
        RETURN;
      END IF;
      INSERT INTO public.local_session (token_digest, owner_id, expires_at) VALUES (p_token_digest, mapped_owner, p_expires_at);
      RETURN QUERY SELECT mapped_owner, 'active'::text;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.resolve_local_session(p_token_digest text)
    RETURNS TABLE (owner_id uuid, session_state text)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE mapped_owner uuid; archived boolean;
    BEGIN
      SELECT s.owner_id INTO mapped_owner
      FROM public.local_session AS s
      WHERE s.token_digest = p_token_digest AND s.revoked_at IS NULL AND s.expires_at > clock_timestamp();
      IF mapped_owner IS NULL THEN RETURN QUERY SELECT NULL::uuid, 'invalid'::text; RETURN; END IF;
      SELECT EXISTS (SELECT 1 FROM public.user_archive_period AS a WHERE a.owner_id = mapped_owner AND a.restored_at IS NULL) INTO archived;
      IF archived THEN RETURN QUERY SELECT mapped_owner, 'archived'::text; RETURN; END IF;
      RETURN QUERY SELECT mapped_owner, 'active'::text;
    END
    $function$;

    CREATE OR REPLACE FUNCTION public.revoke_local_session(p_token_digest text)
    RETURNS boolean
    LANGUAGE sql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $$
      UPDATE public.local_session SET revoked_at = clock_timestamp()
      WHERE token_digest = p_token_digest AND revoked_at IS NULL
      RETURNING true
    $$;

    CREATE OR REPLACE FUNCTION public.update_current_profile(
      p_owner_id uuid,
      p_email text,
      p_phone text,
      p_date_of_birth date,
      p_change_email boolean,
      p_change_phone boolean,
      p_change_date_of_birth boolean
    )
    RETURNS TABLE (email text, phone text, date_of_birth date)
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = pg_catalog, public
    AS $function$
    DECLARE
      current_email text;
      current_phone text;
      next_email text;
      next_phone text;
      existing_owner uuid;
    BEGIN
      IF NULLIF(current_setting('deledger.user_id', true), '')::uuid IS DISTINCT FROM p_owner_id THEN
        RAISE EXCEPTION 'profile owner mismatch' USING ERRCODE = '42501';
      END IF;
      PERFORM 1 FROM public.app_user WHERE id = p_owner_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'user not found' USING ERRCODE = 'P0002'; END IF;
      SELECT e.normalized_email INTO current_email FROM public.user_identity_email AS e WHERE e.owner_id = p_owner_id AND e.unlinked_at IS NULL;
      SELECT p.normalized_phone INTO current_phone FROM public.user_identity_phone AS p WHERE p.owner_id = p_owner_id AND p.unlinked_at IS NULL;
      next_email := CASE WHEN p_change_email THEN NULLIF(lower(btrim(p_email)), '') ELSE current_email END;
      next_phone := CASE WHEN p_change_phone THEN NULLIF(btrim(p_phone), '') ELSE current_phone END;
      IF next_email IS NULL AND next_phone IS NULL THEN RAISE EXCEPTION 'at least one login contact is required' USING ERRCODE = '22023'; END IF;
      IF p_change_date_of_birth AND p_date_of_birth > (clock_timestamp() AT TIME ZONE 'Asia/Bangkok')::date THEN RAISE EXCEPTION 'date of birth cannot be in the future' USING ERRCODE = '22023'; END IF;
      IF p_change_email AND next_email IS DISTINCT FROM current_email THEN
        IF next_email IS NULL THEN
          UPDATE public.user_identity_email SET unlinked_at = clock_timestamp() WHERE owner_id = p_owner_id AND unlinked_at IS NULL;
        ELSE
          SELECT e.owner_id INTO existing_owner FROM public.user_identity_email AS e WHERE e.normalized_email = next_email;
          IF existing_owner IS NOT NULL THEN RAISE EXCEPTION 'email belongs to another or historical user' USING ERRCODE = '23505'; END IF;
          INSERT INTO public.user_identity_email (normalized_email, owner_id) VALUES (next_email, p_owner_id);
          UPDATE public.user_identity_email SET unlinked_at = clock_timestamp() WHERE owner_id = p_owner_id AND normalized_email <> next_email AND unlinked_at IS NULL;
        END IF;
      END IF;
      IF p_change_phone AND next_phone IS DISTINCT FROM current_phone THEN
        IF next_phone IS NULL THEN
          UPDATE public.user_identity_phone SET unlinked_at = clock_timestamp() WHERE owner_id = p_owner_id AND unlinked_at IS NULL;
        ELSE
          SELECT p.owner_id INTO existing_owner FROM public.user_identity_phone AS p WHERE p.normalized_phone = next_phone;
          IF existing_owner IS NOT NULL THEN RAISE EXCEPTION 'phone belongs to another or historical user' USING ERRCODE = '23505'; END IF;
          INSERT INTO public.user_identity_phone (normalized_phone, owner_id) VALUES (next_phone, p_owner_id);
          UPDATE public.user_identity_phone SET unlinked_at = clock_timestamp() WHERE owner_id = p_owner_id AND normalized_phone <> next_phone AND unlinked_at IS NULL;
        END IF;
      END IF;
      IF p_change_date_of_birth THEN UPDATE public.app_user SET date_of_birth = p_date_of_birth WHERE id = p_owner_id; END IF;
      RETURN QUERY SELECT
        (SELECT e.normalized_email FROM public.user_identity_email AS e WHERE e.owner_id = p_owner_id AND e.unlinked_at IS NULL),
        (SELECT p.normalized_phone FROM public.user_identity_phone AS p WHERE p.owner_id = p_owner_id AND p.unlinked_at IS NULL),
        (SELECT u.date_of_birth FROM public.app_user AS u WHERE u.id = p_owner_id);
    END
    $function$;

    REVOKE ALL ON FUNCTION public.local_login(text, text, text, timestamptz) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.resolve_local_session(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.revoke_local_session(text) FROM PUBLIC;
    REVOKE ALL ON FUNCTION public.update_current_profile(uuid, text, text, date, boolean, boolean, boolean) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.local_login(text, text, text, timestamptz), public.resolve_local_session(text), public.revoke_local_session(text), public.update_current_profile(uuid, text, text, date, boolean, boolean, boolean) TO deledger_web;
  `);
};

exports.down = () => {};
