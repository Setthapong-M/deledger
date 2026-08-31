exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE app_user (
      id uuid PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      resume_required_at timestamptz
    );

    CREATE TABLE user_identity_email (
      normalized_email text PRIMARY KEY,
      owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
      linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      unlinked_at timestamptz,
      CONSTRAINT user_identity_email_normalized_ck CHECK (normalized_email = lower(btrim(normalized_email)) AND btrim(normalized_email) <> ''),
      CONSTRAINT user_identity_email_dates_ck CHECK (unlinked_at IS NULL OR unlinked_at > linked_at)
    );
    CREATE UNIQUE INDEX user_identity_email_current_owner_uq ON user_identity_email(owner_id) WHERE unlinked_at IS NULL;

    CREATE TABLE user_archive_period (
      id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
      archived_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      restored_at timestamptz,
      CONSTRAINT user_archive_period_dates_ck CHECK (restored_at IS NULL OR restored_at > archived_at)
    );
    CREATE UNIQUE INDEX user_archive_period_open_uq ON user_archive_period(owner_id) WHERE restored_at IS NULL;

    CREATE TABLE reporting_month (
      owner_id uuid NOT NULL REFERENCES app_user(id) ON DELETE RESTRICT,
      month_start date NOT NULL,
      tracked_from date NOT NULL,
      opening_source text NOT NULL,
      opening_balance_input numeric(15,2),
      income_amount numeric(15,2),
      ending_balance_amount numeric(15,2),
      closed_at timestamptz,
      closed_by text,
      revision bigint NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (owner_id, month_start),
      CONSTRAINT reporting_month_first_day_ck CHECK (month_start = date_trunc('month', month_start)::date),
      CONSTRAINT reporting_month_tracked_range_ck CHECK (month_start <= tracked_from AND tracked_from < (month_start + interval '1 month')::date),
      CONSTRAINT reporting_month_opening_ck CHECK ((opening_source = 'supplied' AND opening_balance_input IS NOT NULL) OR (opening_source = 'prior_ending' AND opening_balance_input IS NULL AND tracked_from = month_start)),
      CONSTRAINT reporting_month_source_ck CHECK (opening_source IN ('supplied', 'prior_ending')),
      CONSTRAINT reporting_month_close_ck CHECK ((closed_at IS NULL AND closed_by IS NULL) OR (closed_at IS NOT NULL AND closed_by IN ('manual', 'automatic'))),
      CONSTRAINT reporting_month_revision_ck CHECK (revision >= 0),
      CONSTRAINT reporting_month_money_ck CHECK ((opening_balance_input IS NULL OR opening_balance_input >= 0) AND (income_amount IS NULL OR income_amount >= 0) AND (ending_balance_amount IS NULL OR ending_balance_amount >= 0))
    );

    CREATE TABLE balance_snapshot (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id uuid NOT NULL,
      month_start date NOT NULL,
      observed_on date NOT NULL,
      amount numeric(15,2) NOT NULL,
      recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      CONSTRAINT balance_snapshot_month_fk FOREIGN KEY (owner_id, month_start) REFERENCES reporting_month(owner_id, month_start) ON DELETE RESTRICT,
      CONSTRAINT balance_snapshot_amount_ck CHECK (amount >= 0)
    );

    CREATE TABLE monthly_recurring_expense (
      owner_id uuid NOT NULL,
      month_start date NOT NULL,
      id uuid NOT NULL DEFAULT gen_random_uuid(),
      position integer NOT NULL,
      name text NOT NULL,
      kind text NOT NULL,
      fixed_amount numeric(15,2),
      is_paused boolean NOT NULL DEFAULT false,
      PRIMARY KEY (owner_id, month_start, id),
      CONSTRAINT monthly_recurring_expense_month_fk FOREIGN KEY (owner_id, month_start) REFERENCES reporting_month(owner_id, month_start) ON DELETE RESTRICT,
      CONSTRAINT monthly_recurring_expense_position_ck CHECK (position > 0),
      CONSTRAINT monthly_recurring_expense_name_ck CHECK (btrim(name) <> '' AND length(btrim(name)) <= 200),
      CONSTRAINT monthly_recurring_expense_kind_ck CHECK (kind IN ('fixed', 'variable')),
      CONSTRAINT monthly_recurring_expense_amount_ck CHECK ((kind = 'fixed' AND fixed_amount IS NOT NULL AND fixed_amount >= 0) OR (kind = 'variable' AND fixed_amount IS NULL)),
      CONSTRAINT monthly_recurring_expense_position_uq UNIQUE (owner_id, month_start, position) DEFERRABLE INITIALLY DEFERRED
    );

    CREATE TABLE monthly_expense_detail (
      owner_id uuid NOT NULL,
      month_start date NOT NULL,
      setup_item_id uuid NOT NULL,
      confirmed_name text NOT NULL,
      confirmed_kind text NOT NULL,
      confirmed_amount numeric(15,2) NOT NULL,
      confirmed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
      PRIMARY KEY (owner_id, month_start, setup_item_id),
      CONSTRAINT monthly_expense_detail_setup_fk FOREIGN KEY (owner_id, month_start, setup_item_id) REFERENCES monthly_recurring_expense(owner_id, month_start, id) ON DELETE RESTRICT,
      CONSTRAINT monthly_expense_detail_name_ck CHECK (btrim(confirmed_name) <> ''),
      CONSTRAINT monthly_expense_detail_kind_ck CHECK (confirmed_kind IN ('fixed', 'variable')),
      CONSTRAINT monthly_expense_detail_amount_ck CHECK (confirmed_amount >= 0)
    );

    CREATE INDEX reporting_month_owner_idx ON reporting_month(owner_id, month_start DESC);
    CREATE INDEX balance_snapshot_month_order_idx ON balance_snapshot(owner_id, month_start, observed_on DESC, recorded_at DESC, id DESC);
    CREATE INDEX monthly_expense_detail_month_idx ON monthly_expense_detail(owner_id, month_start);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS monthly_expense_detail;
    DROP TABLE IF EXISTS monthly_recurring_expense;
    DROP TABLE IF EXISTS balance_snapshot;
    DROP TABLE IF EXISTS reporting_month;
    DROP TABLE IF EXISTS user_archive_period;
    DROP TABLE IF EXISTS user_identity_email;
    DROP TABLE IF EXISTS app_user;
  `);
};
