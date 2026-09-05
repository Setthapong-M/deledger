exports.up = (pgm) => {
  pgm.sql(`
    DO $do$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint
        WHERE conname = 'user_identity_email_format_ck'
          AND conrelid = 'public.user_identity_email'::pg_catalog.regclass
      ) THEN
        ALTER TABLE public.user_identity_email
          ADD CONSTRAINT user_identity_email_format_ck
          CHECK (normalized_email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$') NOT VALID;
      END IF;
    END
    $do$;
  `);
};

exports.down = () => {};
