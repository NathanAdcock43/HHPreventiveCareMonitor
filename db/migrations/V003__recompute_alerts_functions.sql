CREATE SCHEMA IF NOT EXISTS app;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Core (uuid) function
CREATE OR REPLACE FUNCTION app.recompute_alerts_for_member(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  -- A1C_OVERDUE (180d)
WITH last_a1c AS (
    SELECT member_id, max(collected_at) AS last_dt
    FROM app.lab_result
    WHERE member_id = p_member_id AND code = '4548-4'
    GROUP BY 1
),
     overdue AS (
         SELECT m.member_id,
                'A1C_OVERDUE'::text AS type,
             now() AS detected_at,
                now() AS updated_at,
                jsonb_build_object('window_days', 180, 'last_a1c', a.last_dt) AS detail_json
         FROM app.member m
                  LEFT JOIN last_a1c a ON a.member_id = m.member_id
         WHERE m.member_id = p_member_id
           AND (a.last_dt IS NULL OR a.last_dt < now() - interval '180 days')
     )
INSERT INTO app.care_alert AS ca
    (care_alert_id, member_id, type, status, detected_at, updated_at, detail_json)
SELECT gen_random_uuid(), o.member_id, o.type, 'OPEN', o.detected_at, o.updated_at, o.detail_json
FROM overdue o
    ON CONFLICT (member_id, type)
  DO UPDATE SET
    status='OPEN',
             updated_at=EXCLUDED.updated_at,
             detail_json=EXCLUDED.detail_json;

WITH recent AS (
    SELECT member_id
    FROM app.lab_result
    WHERE member_id = p_member_id AND code='4548-4'
      AND collected_at >= now() - interval '180 days'
GROUP BY 1
    )
UPDATE app.care_alert ca
SET status='CLOSED',
    updated_at=now(),
    detail_json = coalesce(ca.detail_json,'{}'::jsonb) || jsonb_build_object('closed_by','recent_a1c')
WHERE ca.type='A1C_OVERDUE'
  AND ca.member_id IN (SELECT member_id FROM recent);

-- FLU_OVERDUE (365d)
WITH last_flu AS (
    SELECT member_id, max(administered_at) AS last_dt
    FROM app.immunization
    WHERE member_id = p_member_id AND code = 'FLU'
    GROUP BY 1
),
     flu_overdue AS (
         SELECT m.member_id,
                'FLU_OVERDUE'::text AS type,
             now() AS detected_at,
                now() AS updated_at,
                jsonb_build_object('window_days', 365, 'last_flu', f.last_dt) AS detail_json
         FROM app.member m
                  LEFT JOIN last_flu f ON f.member_id = m.member_id
         WHERE m.member_id = p_member_id
           AND (f.last_dt IS NULL OR f.last_dt < now() - interval '365 days')
     )
INSERT INTO app.care_alert AS ca
    (care_alert_id, member_id, type, status, detected_at, updated_at, detail_json)
SELECT gen_random_uuid(), o.member_id, o.type, 'OPEN', o.detected_at, o.updated_at, o.detail_json
FROM flu_overdue o
    ON CONFLICT (member_id, type)
  DO UPDATE SET
    status='OPEN',
             updated_at=EXCLUDED.updated_at,
             detail_json=EXCLUDED.detail_json;

WITH flu_recent AS (
    SELECT member_id
    FROM app.immunization
    WHERE member_id = p_member_id AND code='FLU'
      AND administered_at >= now() - interval '365 days'
GROUP BY 1
    )
UPDATE app.care_alert ca
SET status='CLOSED',
    updated_at=now(),
    detail_json = coalesce(ca.detail_json,'{}'::jsonb) || jsonb_build_object('closed_by','recent_flu')
WHERE ca.type='FLU_OVERDUE'
  AND ca.member_id IN (SELECT member_id FROM flu_recent);
END;
$$;

-- Wrapper (public_id)
CREATE OR REPLACE FUNCTION app.recompute_alerts_for_public_id(p_public_id text)
RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE mid uuid;
BEGIN
SELECT member_id INTO mid FROM app.member WHERE public_id = p_public_id;
IF mid IS NULL THEN
    RETURN false;
END IF;

  PERFORM app.recompute_alerts_for_member(mid);
RETURN true;
END;
$$;
