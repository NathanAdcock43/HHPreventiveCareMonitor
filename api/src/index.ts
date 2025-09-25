import express from "express";
import members from "./routes/members";
import alerts from "./routes/alerts";
import simulate from "./routes/simulate";
import openAlerts from "./routes/openAlerts";
import dbPing from "./routes/dbPing";
import { adminInit } from "./routes/adminInit";

export const app = express();
const port = process.env.PORT || 3001;

// Needed for /simulate to accept POST bodies
app.use(express.json());
app.get("/health", (_req, res) =>
    res.json({ ok: true, service: "hh-preventive-care-monitor" })
);
app.get("/version", (_req, res) =>
    res.json({ version: "0.1.0", git_sha: process.env.GIT_SHA || "dev" })
);
app.use("/members", members);
app.use("/alerts", alerts);
app.use("/simulate", simulate);
app.use("/alerts/open", openAlerts);
app.use("/db-ping", dbPing);
app.use("/admin/init-db", adminInit);

// Only start an HTTP server when not running in Lambda
const runningInLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
if (!runningInLambda) {
    app.listen(port, () => console.log(`API running on ${port}`));
}