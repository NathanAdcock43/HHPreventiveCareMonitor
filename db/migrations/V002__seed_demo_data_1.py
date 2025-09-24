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

def main():
    parser = argparse.ArgumentParser(description="Seed members, labs, immunizations (idempotent).")
    args = parser.parse_args()

    if not (args.members or args.labs or args.immunizations):
        print("Nothing to do. Provide at least one of --members/--labs/--immunizations.", file=sys.stderr)
        sys.exit(2)

    with get_conn() as conn:
        conn.execute("SET SESSION TIME ZONE 'UTC';")
        total = 0

        conn.commit()
        print(f"[seed] done. total rows considered: {total}")

if __name__ == "__main__":
    main()
