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

router.get("/:publicId/alerts", async (req, res) => {
    const { publicId } = req.params;
    try {
        const { rows } = await pool.query(
            `
      SELECT ca.type, ca.status, ca.detected_at, ca.updated_at
      FROM app.care_alert ca
      JOIN app.member m ON m.member_id = ca.member_id
      WHERE m.public_id = $1
      ORDER BY ca.type
      `,
            [publicId]
        );
        if (!rows.length) return res.json([]); // no active alerts
        return res.json(rows);
    } catch (e: any) {
        console.error("GET /members/:publicId/alerts", e);
        return res.status(500).json({ error: "server_error" });
    }
});

export default router;
