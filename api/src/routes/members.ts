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
    const { publicId } = req.params;   // keep this exactly as-is

    try {
        // 1️⃣ Verify member exists
        const memberCheck = await pool.query(
            "SELECT 1 FROM app.member WHERE public_id = $1",
            [publicId]
        );
        if (memberCheck.rowCount === 0) {
            return res.status(404).json({
                error: "not_found",
                message: `member ${publicId} not found`
            });
        }

        // 2️⃣ Fetch alerts if member exists
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

        return res.json(rows);
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: "server_error" });
    }
});

export default router;
