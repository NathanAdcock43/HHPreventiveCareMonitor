-- transform (For simplicity it is a fixed 180d range)

WITH last_a1c AS (
    SELECT member_id, max(collected_at) AS last_dt
    FROM app.lab_result
    WHERE code = '4548-4'
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
         WHERE a.last_dt IS NULL OR a.last_dt < now() - interval '180 days'
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
    WHERE code='4548-4' AND collected_at >= now() - interval '180 days'
GROUP BY member_id
    )
UPDATE app.care_alert ca
SET status='CLOSED',
    updated_at=now(),
    detail_json = coalesce(ca.detail_json,'{}'::jsonb) || jsonb_build_object('closed_by','recent_a1c')
WHERE ca.type='A1C_OVERDUE'
  AND ca.member_id IN (SELECT member_id FROM recent);
