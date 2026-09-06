REVOKE ALL ON app_user, reporting_month, balance_snapshot, monthly_recurring_expense, monthly_expense_detail, user_identity_email, user_identity_phone, local_session, user_archive_period FROM deledger_web;
REVOKE ALL ON SEQUENCE user_archive_period_id_seq FROM deledger_web;
GRANT SELECT, UPDATE ON app_user TO deledger_web;
GRANT SELECT, INSERT, UPDATE ON reporting_month, monthly_recurring_expense, user_identity_email, user_identity_phone TO deledger_web;
GRANT SELECT, INSERT ON balance_snapshot TO deledger_web;
GRANT SELECT, INSERT, DELETE ON monthly_expense_detail TO deledger_web;
GRANT SELECT ON local_session, user_archive_period TO deledger_web;
