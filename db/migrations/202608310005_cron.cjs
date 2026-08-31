exports.up = (pgm) => {
  pgm.sql(`
    DO $do$
    BEGIN
      IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deledger-catch-up') THEN
        PERFORM cron.unschedule('deledger-catch-up');
      END IF;
    END
    $do$;
    SELECT cron.schedule('deledger-catch-up', '5 0 * * *', $$SELECT public.catch_up_reporting_months();$$);
  `);
};

exports.down = (pgm) => {
  pgm.sql("SELECT cron.unschedule('deledger-catch-up') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deledger-catch-up');");
};
