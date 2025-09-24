-- UUIDs for primary keys
CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- provides gen_random_uuid()

CREATE SCHEMA IF NOT EXISTS app;

-- Members: no PHI;
CREATE TABLE IF NOT EXISTS app.member (
    member_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id    TEXT UNIQUE NOT NULL,
    sex          TEXT CHECK (sex IN ('F','M','U') OR sex IS NULL),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_member_public_id ON app.member(public_id);

-- Labs (Keep codes as text to allow for flexibilty in inputs from providers)
CREATE TABLE IF NOT EXISTS app.lab_result (
    lab_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id    UUID NOT NULL REFERENCES app.member(member_id) ON DELETE CASCADE,
    code         TEXT NOT NULL CHECK (length(code) > 0), -- lab type code
    value_num    NUMERIC(10,3),
    unit         TEXT,
    collected_at TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, code, collected_at) -- upserts from seeder
);
CREATE INDEX IF NOT EXISTS ix_lab_member_code_time ON app.lab_result(member_id, code, collected_at DESC);
CREATE INDEX IF NOT EXISTS ix_lab_member ON app.lab_result(member_id);

-- Immunizations Really just flu shots for MVP
CREATE TABLE IF NOT EXISTS app.immunization (
    imm_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id       UUID NOT NULL REFERENCES app.member(member_id) ON DELETE CASCADE,
    code            TEXT NOT NULL CHECK (length(code) > 0),
    administered_at TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (member_id, code, administered_at)
);
CREATE INDEX IF NOT EXISTS ix_imm_member_code_time ON app.immunization(member_id, code, administered_at DESC);

-- Care alerts: “health concerns”
-- Types for this demo: 'A1C_OVERDUE', 'FLU_OVERDUE'
CREATE TABLE IF NOT EXISTS app.care_alert (
    care_alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id     UUID NOT NULL REFERENCES app.member(member_id) ON DELETE CASCADE,
    type          TEXT NOT NULL CHECK (length(type) > 0),
    status        TEXT NOT NULL CHECK (status IN ('OPEN','CLOSED')),
    detected_at   TIMESTAMPTZ NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    detail_json   JSONB,
    UNIQUE (member_id, type)
);
CREATE INDEX IF NOT EXISTS ix_care_alert_type    ON app.care_alert(type);
CREATE INDEX IF NOT EXISTS ix_care_alert_status  ON app.care_alert(status);
CREATE INDEX IF NOT EXISTS ix_care_alert_updated ON app.care_alert(updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_care_alert_member ON app.care_alert(member_id);

CREATE OR REPLACE FUNCTION app.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_member_touch ON app.member;
CREATE TRIGGER trg_member_touch BEFORE UPDATE ON app.member
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();

DROP TRIGGER IF EXISTS trg_care_alert_touch ON app.care_alert;
CREATE TRIGGER trg_care_alert_touch BEFORE UPDATE ON app.care_alert
    FOR EACH ROW EXECUTE FUNCTION app.touch_updated_at();