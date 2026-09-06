-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "resume_required_at" TIMESTAMPTZ,
    "date_of_birth" DATE,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identity_email" (
    "normalized_email" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "unlinked_at" TIMESTAMPTZ,

    CONSTRAINT "user_identity_email_pkey" PRIMARY KEY ("normalized_email")
);

-- CreateTable
CREATE TABLE "user_identity_phone" (
    "normalized_phone" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "unlinked_at" TIMESTAMPTZ,

    CONSTRAINT "user_identity_phone_pkey" PRIMARY KEY ("normalized_phone")
);

-- CreateTable
CREATE TABLE "local_session" (
    "token_digest" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ,

    CONSTRAINT "local_session_pkey" PRIMARY KEY ("token_digest")
);

-- CreateTable
CREATE TABLE "user_archive_period" (
    "id" BIGSERIAL NOT NULL,
    "owner_id" UUID NOT NULL,
    "archived_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "restored_at" TIMESTAMPTZ,

    CONSTRAINT "user_archive_period_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_month" (
    "owner_id" UUID NOT NULL,
    "month_start" DATE NOT NULL,
    "tracked_from" DATE NOT NULL,
    "opening_source" TEXT NOT NULL,
    "opening_balance_input" DECIMAL(15,2),
    "income_amount" DECIMAL(15,2),
    "ending_balance_amount" DECIMAL(15,2),
    "closed_at" TIMESTAMPTZ,
    "closed_by" TEXT,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "reporting_month_pkey" PRIMARY KEY ("owner_id","month_start")
);

-- CreateTable
CREATE TABLE "balance_snapshot" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "month_start" DATE NOT NULL,
    "observed_on" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "balance_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_recurring_expense" (
    "owner_id" UUID NOT NULL,
    "month_start" DATE NOT NULL,
    "id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "fixed_amount" DECIMAL(15,2),
    "is_paused" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "monthly_recurring_expense_pkey" PRIMARY KEY ("owner_id","month_start","id")
);

-- CreateTable
CREATE TABLE "monthly_expense_detail" (
    "owner_id" UUID NOT NULL,
    "month_start" DATE NOT NULL,
    "setup_item_id" UUID NOT NULL,
    "confirmed_name" TEXT NOT NULL,
    "confirmed_kind" TEXT NOT NULL,
    "confirmed_amount" DECIMAL(15,2) NOT NULL,
    "confirmed_at" TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),

    CONSTRAINT "monthly_expense_detail_pkey" PRIMARY KEY ("owner_id","month_start","setup_item_id")
);

-- CreateIndex
CREATE INDEX "local_session_owner_idx" ON "local_session"("owner_id", "expires_at" DESC);

-- CreateIndex
CREATE INDEX "reporting_month_owner_idx" ON "reporting_month"("owner_id", "month_start" DESC);

-- CreateIndex
CREATE INDEX "balance_snapshot_month_order_idx" ON "balance_snapshot"("owner_id", "month_start", "observed_on" DESC, "recorded_at" DESC, "id" DESC);

-- CreateIndex
CREATE INDEX "monthly_expense_detail_month_idx" ON "monthly_expense_detail"("owner_id", "month_start");

-- AddForeignKey
ALTER TABLE "user_identity_email" ADD CONSTRAINT "user_identity_email_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identity_phone" ADD CONSTRAINT "user_identity_phone_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "local_session" ADD CONSTRAINT "local_session_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_archive_period" ADD CONSTRAINT "user_archive_period_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_month" ADD CONSTRAINT "reporting_month_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "balance_snapshot" ADD CONSTRAINT "balance_snapshot_month_fk" FOREIGN KEY ("owner_id", "month_start") REFERENCES "reporting_month"("owner_id", "month_start") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_recurring_expense" ADD CONSTRAINT "monthly_recurring_expense_month_fk" FOREIGN KEY ("owner_id", "month_start") REFERENCES "reporting_month"("owner_id", "month_start") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_expense_detail" ADD CONSTRAINT "monthly_expense_detail_setup_fk" FOREIGN KEY ("owner_id", "month_start", "setup_item_id") REFERENCES "monthly_recurring_expense"("owner_id", "month_start", "id") ON DELETE RESTRICT ON UPDATE CASCADE;


ALTER TABLE user_identity_email ADD CONSTRAINT user_identity_email_normalized_ck CHECK (normalized_email = lower(btrim(normalized_email)) AND btrim(normalized_email) <> '');

ALTER TABLE user_identity_email ADD CONSTRAINT user_identity_email_dates_ck CHECK (unlinked_at IS NULL OR unlinked_at > linked_at);

ALTER TABLE user_archive_period ADD CONSTRAINT user_archive_period_dates_ck CHECK (restored_at IS NULL OR restored_at > archived_at);

ALTER TABLE reporting_month ADD CONSTRAINT reporting_month_first_day_ck CHECK (month_start = date_trunc('month', month_start)::date);

ALTER TABLE reporting_month ADD CONSTRAINT reporting_month_tracked_range_ck CHECK (month_start <= tracked_from AND tracked_from < (month_start + interval '1 month')::date);

ALTER TABLE reporting_month ADD CONSTRAINT reporting_month_opening_ck CHECK ((opening_source = 'supplied' AND opening_balance_input IS NOT NULL) OR (opening_source = 'prior_ending' AND opening_balance_input IS NULL AND tracked_from = month_start));

ALTER TABLE reporting_month ADD CONSTRAINT reporting_month_source_ck CHECK (opening_source IN ('supplied', 'prior_ending'));

ALTER TABLE reporting_month ADD CONSTRAINT reporting_month_close_ck CHECK ((closed_at IS NULL AND closed_by IS NULL) OR (closed_at IS NOT NULL AND closed_by IN ('manual', 'automatic')));

ALTER TABLE reporting_month ADD CONSTRAINT reporting_month_revision_ck CHECK (revision >= 0);

ALTER TABLE reporting_month ADD CONSTRAINT reporting_month_money_ck CHECK ((opening_balance_input IS NULL OR opening_balance_input >= 0) AND (income_amount IS NULL OR income_amount >= 0) AND (ending_balance_amount IS NULL OR ending_balance_amount >= 0));

ALTER TABLE balance_snapshot ADD CONSTRAINT balance_snapshot_amount_ck CHECK (amount >= 0);

ALTER TABLE monthly_recurring_expense ADD CONSTRAINT monthly_recurring_expense_position_ck CHECK (position > 0);

ALTER TABLE monthly_recurring_expense ADD CONSTRAINT monthly_recurring_expense_name_ck CHECK (btrim(name) <> '' AND length(btrim(name)) <= 200);

ALTER TABLE monthly_recurring_expense ADD CONSTRAINT monthly_recurring_expense_kind_ck CHECK (kind IN ('fixed', 'variable'));

ALTER TABLE monthly_recurring_expense ADD CONSTRAINT monthly_recurring_expense_amount_ck CHECK ((kind = 'fixed' AND fixed_amount IS NOT NULL AND fixed_amount >= 0) OR (kind = 'variable' AND fixed_amount IS NULL));

ALTER TABLE monthly_recurring_expense ADD CONSTRAINT monthly_recurring_expense_position_uq UNIQUE (owner_id, month_start, position) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE monthly_expense_detail ADD CONSTRAINT monthly_expense_detail_name_ck CHECK (btrim(confirmed_name) <> '');

ALTER TABLE monthly_expense_detail ADD CONSTRAINT monthly_expense_detail_kind_ck CHECK (confirmed_kind IN ('fixed', 'variable'));

ALTER TABLE monthly_expense_detail ADD CONSTRAINT monthly_expense_detail_amount_ck CHECK (confirmed_amount >= 0);

CREATE UNIQUE INDEX user_identity_email_current_owner_uq ON user_identity_email(owner_id) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX user_identity_phone_current_owner_uq ON user_identity_phone(owner_id) WHERE unlinked_at IS NULL;
CREATE UNIQUE INDEX user_archive_period_open_uq ON user_archive_period(owner_id) WHERE restored_at IS NULL;
ALTER TABLE user_identity_email ADD CONSTRAINT user_identity_email_format_ck CHECK (normalized_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');
ALTER TABLE user_identity_phone ADD CONSTRAINT user_identity_phone_normalized_ck CHECK (normalized_phone ~ '^\+66[689][0-9]{8}$');
ALTER TABLE user_identity_phone ADD CONSTRAINT user_identity_phone_dates_ck CHECK (unlinked_at IS NULL OR unlinked_at > linked_at);
ALTER TABLE local_session ADD CONSTRAINT local_session_digest_ck CHECK (token_digest ~ '^[a-f0-9]{64}$');
ALTER TABLE local_session ADD CONSTRAINT local_session_expiry_ck CHECK (expires_at > issued_at);
ALTER TABLE app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_user FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON app_user USING (id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE user_identity_email ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_identity_email FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON user_identity_email USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE user_identity_phone ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_identity_phone FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON user_identity_phone USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE local_session ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_session FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON local_session USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE user_archive_period ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_archive_period FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON user_archive_period USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE reporting_month ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting_month FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON reporting_month USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE balance_snapshot ENABLE ROW LEVEL SECURITY;
ALTER TABLE balance_snapshot FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON balance_snapshot USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE monthly_recurring_expense ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_recurring_expense FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON monthly_recurring_expense USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);
ALTER TABLE monthly_expense_detail ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_expense_detail FORCE ROW LEVEL SECURITY;
CREATE POLICY owner_policy ON monthly_expense_detail USING (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid) WITH CHECK (owner_id = NULLIF(current_setting('deledger.user_id', true), '')::uuid);

REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO deledger_web, deledger_identity;
GRANT SELECT, INSERT, UPDATE, DELETE ON app_user, user_identity_email, user_identity_phone, local_session, user_archive_period, reporting_month, balance_snapshot, monthly_recurring_expense, monthly_expense_detail TO deledger_web, deledger_identity;
GRANT USAGE, SELECT ON SEQUENCE user_archive_period_id_seq TO deledger_web, deledger_identity;
GRANT deledger_web TO deledger_identity;
