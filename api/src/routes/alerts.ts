import { Router } from "express";
import { Pool } from "pg";

const router = Router();
const pool = new Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || "hhprevcaredemo",
    user: process.env.DB_USER || "hh_demo_user",
    password: process.env.DB_PASSWORD || "demopp",
    ssl: false,
});

router.get("/", async (req, res) => {
    const type = (req.query.type as string) || "A1C_OVERDUE";
    try {
        const { rows } = await pool.query(
            `SELECT status, count(*)::int AS count
       FROM app.care_alert
       WHERE type = $1
       GROUP BY status
       ORDER BY status`,
            [type]
        );
        res.json({ type, summary: rows });
    } catch (e: any) {
        console.error("GET /alerts", e);
        res.status(500).json({ error: "server_error" });
    }
});

export default router;
