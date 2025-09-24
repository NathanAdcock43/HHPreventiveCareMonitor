import {Router} from "express";
import {Pool} from "pg";

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
    const type = typeof req.query.type === "string" ? req.query.type : null;
    const limit = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    try {
        const client = await pool.connect();
        try {
            // Count distinct members with at least one OPEN alert (optionally filter by type)
            const totalQ = await client.query(
                `
                    WITH filtered AS (SELECT m.public_id
                                      FROM app.care_alert ca
                                               JOIN app.member m ON m.member_id = ca.member_id
                                      WHERE ca.status = 'OPEN'
                                        AND ($1::text IS NULL OR ca.type = $1::text)
                                      GROUP BY m.public_id)
                    SELECT COUNT(*) ::int AS total
                    FROM filtered;
                `,
                [type]
            );

            const total: number = totalQ.rows[0]?.total ?? 0;

            // Get members and their alert types
            const itemsQ = await client.query(
                `
                    SELECT m.public_id,
                           m.sex,
                           ARRAY_AGG(DISTINCT ca.type ORDER BY ca.type) AS alert_types,
                           MAX(ca.updated_at)                           AS last_updated
                    FROM app.care_alert ca
                             JOIN app.member m ON m.member_id = ca.member_id
                    WHERE ca.status = 'OPEN'
                      AND ($1::text IS NULL OR ca.type = $1::text)
                    GROUP BY m.public_id, m.sex
                    ORDER BY last_updated DESC, m.public_id
                        LIMIT $2
                    OFFSET $3;
                `,
                [type, limit, offset]
            );

            res.json({total, items: itemsQ.rows});
        } finally {
            client.release();
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({error: "server_error"});
    }
});

export default router;