#!/usr/bin/env python3
import argparse, json, os, sys
from datetime import datetime
from typing import List, Dict, Any, Optional

# psycopg v3
try:
    import psycopg
except ImportError:
    print("psycopg not installed. Run:  pip install 'psycopg[binary]'", file=sys.stderr)
    sys.exit(1)

def get_conn():
    dsn = {
        "host": os.getenv("DB_HOST", "localhost"),
        "port": int(os.getenv("DB_PORT", "5432")),
        "dbname": os.getenv("DB_NAME", "hhprevcaredemo"),
        "user": os.getenv("DB_USER", "hh_demo_user"),
        "password": os.getenv("DB_PASSWORD", "demopp"),
    }
    return psycopg.connect(**dsn)

def load_json(path: str) -> List[Dict[str, Any]]:
    with open(path, "r") as f:
        data = json.load(f)
    if isinstance(data, dict):
        # allow single-object file
        return [data]
    return data

def ensure_members(conn, rows: List[Dict[str, Any]]) -> int:
    """
    rows: [{"public_id":"M0001","sex":"F"}, ...]
    Upsert by public_id (unique)
    """
    if not rows:
        return 0
    sql = """
    INSERT INTO app.member (public_id, sex)
    VALUES (%s, %s)
    ON CONFLICT (public_id) DO UPDATE SET
    sex = EXCLUDED.sex,
    updated_at = now();
    """
    with conn.cursor() as cur:
        cur.executemany(sql, [(r["public_id"], r.get("sex")) for r in rows])
    return len(rows)

def _member_id_map(conn, public_ids: List[str]) -> Dict[str, str]:
    if not public_ids:
        return {}
    with conn.cursor() as cur:
        cur.execute(
            "SELECT public_id, member_id FROM app.member WHERE public_id = ANY(%s)",
            (public_ids,),
        )
        return {row[0]: str(row[1]) for row in cur.fetchall()}

def ensure_labs(conn, rows: List[Dict[str, Any]]) -> int:
    """
    rows: [{"public_id":"M0001","code":"4548-4","value_num":7.1,"unit":"%","collected_at":"2025-01-10T09:15:00Z"}, ...]
    Upsert by (member_id, code, collected_at)
    """
    if not rows:
        return 0
    # resolve member_ids
    ids = _member_id_map(conn, list({r["public_id"] for r in rows}))
    missing = [pid for pid in {r["public_id"] for r in rows} if pid not in ids]
    if missing:
        raise ValueError(f"Missing members for labs: {missing}. Seed members first.")

    # normalize timestamps to ISO 8601
    sql = """
    INSERT INTO app.lab_result (member_id, code, value_num, unit, collected_at)
    VALUES (%s, %s, %s, %s, %s)
    ON CONFLICT (member_id, code, collected_at) DO UPDATE SET
    value_num = EXCLUDED.value_num,
    unit = EXCLUDED.unit,
    created_at = app.lab_result.created_at;  -- keep original created_at
    """
    params = []
    for r in rows:
        params.append((
            ids[r["public_id"]],
            r["code"],
            r.get("value_num"),
            r.get("unit"),
            r["collected_at"],
        ))
    with conn.cursor() as cur:
        cur.executemany(sql, params)
    return len(rows)

def ensure_immunizations(conn, rows: List[Dict[str, Any]]) -> int:
    """
    rows: [{"public_id":"M0001","code":"FLU","administered_at":"2024-10-15T00:00:00Z"}, ...]
    Upsert by (member_id, code, administered_at)
    """
    if not rows:
        return 0
    ids = _member_id_map(conn, list({r["public_id"] for r in rows}))
    missing = [pid for pid in {r["public_id"] for r in rows} if pid not in ids]
    if missing:
        raise ValueError(f"Missing members for immunizations: {missing}. Seed members first.")

    sql = """
    INSERT INTO app.immunization (member_id, code, administered_at)
    VALUES (%s, %s, %s)
    ON CONFLICT (member_id, code, administered_at) DO UPDATE SET
    created_at = app.immunization.created_at;
    """
    params = []
    for r in rows:
        params.append((
            ids[r["public_id"]],
            r["code"],
            r["administered_at"],
        ))
    with conn.cursor() as cur:
        cur.executemany(sql, params)
    return len(rows)

def main():
    parser = argparse.ArgumentParser(description="Seed members, labs, immunizations (idempotent).")
    parser.add_argument("--members", "-m", help="Path to members.json")
    parser.add_argument("--labs", "-l", help="Path to labs.json")
    parser.add_argument("--immunizations", "-i", help="Path to immunizations.json")
    args = parser.parse_args()

    if not (args.members or args.labs or args.immunizations):
        print("Nothing to do. Provide at least one of --members/--labs/--immunizations.", file=sys.stderr)
        sys.exit(2)

    with get_conn() as conn:
        conn.execute("SET SESSION TIME ZONE 'UTC';")
        total = 0
        if args.members:
            members = load_json(args.members)
            n = ensure_members(conn, members)
            print(f"[seed] members upserted: {n}")
            total += n
        if args.labs:
            labs = load_json(args.labs)
            n = ensure_labs(conn, labs)
            print(f"[seed] labs upserted: {n}")
            total += n
        if args.immunizations:
            imms = load_json(args.immunizations)
            n = ensure_immunizations(conn, imms)
            print(f"[seed] immunizations upserted: {n}")
            total += n

        conn.commit()
        print(f"[seed] done. total rows considered: {total}")

if __name__ == "__main__":
    main()
