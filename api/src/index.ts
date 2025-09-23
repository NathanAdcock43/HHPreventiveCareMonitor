import express from "express";
const app = express();
const port = process.env.PORT || 3001;

app.get("/health", (_req, res) => res.json({ ok: true, service: "hh-preventive-care-monitor" }));
app.listen(port, () => console.log(`API running on ${port}`));
