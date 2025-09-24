-- db/migrations/V004__recompute_alerts_for_public_id.sql
DROP FUNCTION IF EXISTS app.recompute_alerts_for_public_id(text);

CREATE OR REPLACE FUNCTION app.recompute_alerts_for_public_id(p_public_id text)
RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE mid uuid;
BEGIN
SELECT member_id INTO mid
FROM app.member
WHERE public_id = p_public_id;

IF mid IS NULL THEN
    RETURN false;
END IF;

  PERFORM app.recompute_alerts_for_member(mid);
RETURN true;
END;
$$;
