import express from "express";
import members from "./routes/members";
import alerts from "./routes/alerts";
import simulate from "./routes/simulate";

const app = express();
const port = process.env.PORT || 3001;

app.get("/health", (_req, res) => res.json({ ok: true, service: "hh-preventive-care-monitor" }));
app.get("/version", (_req, res) =>
    res.json({ version: "0.1.0", git_sha: process.env.GIT_SHA || "dev" })
);

app.use("/members", members);
app.use("/alerts", alerts);
app.use("/simulate", simulate);

app.listen(port, () => console.log(`API running on ${port}`));
