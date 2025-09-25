import { Router } from "express";
import { Pool } from "pg";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const router = Router();
const sm = new SecretsManagerClient({ region: "us-east-1" });
let pool: Pool;

async function getPool() {
    if (!pool) {
        const { SecretString } = await sm.send(
            new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN! })
        );
        const s = JSON.parse(SecretString!);
        pool = new Pool({
            host: s.host,
            port: s.port || 5432,
            user: s.username,
            password: s.password,
            database: s.dbname || "postgres",
            ssl: { rejectUnauthorized: false }
        });
    }
    return pool;
}

router.get("/", async (_req, res) => {
    try {
        const r = await (await getPool()).query("SELECT 1 as ok");
        res.json(r.rows[0]);           // -> { "ok": 1 }
    } catch (e: any) {
        console.error("db-ping error", e);
        res.status(500).json({ error: e.message });
    }
});

export default router;
