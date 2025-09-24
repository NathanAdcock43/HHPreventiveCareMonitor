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

// Alternating member sequence without shared state: compute next from DB
async function nextPublicId(client: any): Promise<string> {
    const r = await client.query(`
        SELECT 'M' || LPAD((COALESCE(MAX(substring(public_id from 2)::int), 0) + 1)::text, 4, '0') AS next_id
        FROM app.member
    `);
    return r.rows[0].next_id as string;
}

function pickSexByIndex(n: number) {
    return n % 2 === 0 ? "F" : "M";
}

function daysAgo(d: number) {
    const dt = new Date();
    dt.setUTCDate(dt.getUTCDate() - d);
    return dt.toISOString();
}

router.post("/", async (req, res) => {
    const action = String((req.query.action || req.body?.action || "")).trim();
    const publicIdInput = req.query.publicId ? String(req.query.publicId) : null;

    if (!action) {
        return res.status(400).json({
            error: "bad_request",
            message: "action is required (member|lab_recent|lab_old|flu_recent|flu_old)",
        });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        if (action === "member") {
            const nextId = await nextPublicId(client);
            const num = parseInt(nextId.slice(1), 10);
            const sex = pickSexByIndex(num);

            await client.query(
                `INSERT INTO app.member (public_id, sex)
                 VALUES ($1, $2)
                     ON CONFLICT (public_id) DO UPDATE SET sex = EXCLUDED.sex, updated_at = now()`,
                [nextId, sex]
            );

            await client.query("COMMIT");
            return res.json({ ok: true, action, public_id: nextId });
        }

        // All other actions require a publicId
        if (!publicIdInput) {
            await client.query("ROLLBACK");
            return res
                .status(400)
                .json({ error: "bad_request", message: "publicId is required for this action" });
        }

        if (action === "lab_recent" || action === "lab_old") {
            const collected_at = action === "lab_recent" ? daysAgo(90) : daysAgo(250);
            const value = 7.2; // fixed demo value

            // Insert via public_id → member_id lookup inside SQL
            const ins = await client.query(
                `
        INSERT INTO app.lab_result (member_id, code, value_num, unit, collected_at)
        SELECT m.member_id, '4548-4', $2::numeric, '%', $3::timestamptz
        FROM app.member m
        WHERE m.public_id = $1
        ON CONFLICT (member_id, code, collected_at)
        DO UPDATE SET value_num = EXCLUDED.value_num, unit = EXCLUDED.unit
        `,
                [publicIdInput, value, collected_at]
            );

            if (ins.rowCount === 0) {
                await client.query("ROLLBACK");
                return res
                    .status(404)
                    .json({ error: "not_found", message: `member ${publicIdInput} not found` });
            }

            // Recompute via public_id
            const r = await client.query(
                "SELECT app.recompute_alerts_for_public_id($1) AS ok",
                [publicIdInput]
            );
            if (!r.rows[0]?.ok) {
                await client.query("ROLLBACK");
                return res
                    .status(404)
                    .json({ error: "not_found", message: `member ${publicIdInput} not found` });
            }

            await client.query("COMMIT");
            return res.json({ ok: true, action, public_id: publicIdInput, collected_at });
        }

        if (action === "flu_recent" || action === "flu_old") {
            const administered_at = action === "flu_recent" ? daysAgo(200) : daysAgo(400);

            const ins = await client.query(
                `
        INSERT INTO app.immunization (member_id, code, administered_at)
        SELECT m.member_id, 'FLU', $2::timestamptz
        FROM app.member m
        WHERE m.public_id = $1
        ON CONFLICT (member_id, code, administered_at) DO NOTHING
        `,
                [publicIdInput, administered_at]
            );

            if (ins.rowCount === 0) {
                await client.query("ROLLBACK");
                return res
                    .status(404)
                    .json({ error: "not_found", message: `member ${publicIdInput} not found` });
            }

            const r = await client.query(
                "SELECT app.recompute_alerts_for_public_id($1) AS ok",
                [publicIdInput]
            );
            if (!r.rows[0]?.ok) {
                await client.query("ROLLBACK");
                return res
                    .status(404)
                    .json({ error: "not_found", message: `member ${publicIdInput} not found` });
            }

            await client.query("COMMIT");
            return res.json({ ok: true, action, public_id: publicIdInput, administered_at });
        }

        await client.query("ROLLBACK");
        return res.status(400).json({ error: "bad_request", message: "unknown action" });
    } catch (e) {
        try { await client.query("ROLLBACK"); } catch {}
        console.error(e);
        return res.status(500).json({ error: "server_error" });
    } finally {
        client.release();
    }
});

export default router;
