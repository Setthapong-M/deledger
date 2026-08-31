exports.up = (pgm) => {
  pgm.sql(`
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public TO deledger_web, deledger_maintenance, deledger_operator;

    GRANT SELECT, UPDATE ON app_user TO deledger_web;
    GRANT SELECT, INSERT, UPDATE ON reporting_month TO deledger_web;
    GRANT SELECT, INSERT ON balance_snapshot TO deledger_web;
    GRANT SELECT, INSERT, UPDATE ON monthly_recurring_expense TO deledger_web;
    GRANT SELECT, INSERT, DELETE ON monthly_expense_detail TO deledger_web;

    ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
    ALTER TABLE app_user FORCE ROW LEVEL SECURITY;
    ALTER TABLE user_identity_email ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_identity_email FORCE ROW LEVEL SECURITY;
    ALTER TABLE user_archive_period ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_archive_period FORCE ROW LEVEL SECURITY;
    ALTER TABLE reporting_month ENABLE ROW LEVEL SECURITY;
    ALTER TABLE reporting_month FORCE ROW LEVEL SECURITY;
    ALTER TABLE balance_snapshot ENABLE ROW LEVEL SECURITY;
    ALTER TABLE balance_snapshot FORCE ROW LEVEL SECURITY;
    ALTER TABLE monthly_recurring_expense ENABLE ROW LEVEL SECURITY;
    ALTER TABLE monthly_recurring_expense FORCE ROW LEVEL SECURITY;
    ALTER TABLE monthly_expense_detail ENABLE ROW LEVEL SECURITY;
    ALTER TABLE monthly_expense_detail FORCE ROW LEVEL SECURITY;

    CREATE POLICY app_user_owner_policy ON app_user
      USING (id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
    CREATE POLICY identity_owner_policy ON user_identity_email
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
    CREATE POLICY archive_owner_policy ON user_archive_period
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
    CREATE POLICY reporting_month_owner_policy ON reporting_month
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
    CREATE POLICY snapshot_owner_policy ON balance_snapshot
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
    CREATE POLICY recurring_owner_policy ON monthly_recurring_expense
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
    CREATE POLICY detail_owner_policy ON monthly_expense_detail
      USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid)
      WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP POLICY IF EXISTS detail_owner_policy ON monthly_expense_detail;
    DROP POLICY IF EXISTS recurring_owner_policy ON monthly_recurring_expense;
    DROP POLICY IF EXISTS snapshot_owner_policy ON balance_snapshot;
    DROP POLICY IF EXISTS reporting_month_owner_policy ON reporting_month;
    DROP POLICY IF EXISTS archive_owner_policy ON user_archive_period;
    DROP POLICY IF EXISTS identity_owner_policy ON user_identity_email;
    DROP POLICY IF EXISTS app_user_owner_policy ON app_user;
    ALTER TABLE monthly_expense_detail NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE monthly_expense_detail NO ROW LEVEL SECURITY;
    ALTER TABLE monthly_recurring_expense NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE monthly_recurring_expense NO ROW LEVEL SECURITY;
    ALTER TABLE balance_snapshot NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE balance_snapshot NO ROW LEVEL SECURITY;
    ALTER TABLE reporting_month NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE reporting_month NO ROW LEVEL SECURITY;
    ALTER TABLE user_archive_period NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE user_archive_period NO ROW LEVEL SECURITY;
    ALTER TABLE user_identity_email NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE user_identity_email NO ROW LEVEL SECURITY;
    ALTER TABLE app_user NO FORCE ROW LEVEL SECURITY;
    ALTER TABLE app_user NO ROW LEVEL SECURITY;
  `);
};
