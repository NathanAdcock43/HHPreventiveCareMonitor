import express from "express";
import members from "./routes/members";
import alerts from "./routes/alerts";

const app = express();
const port = process.env.PORT || 3001;

app.get("/health", (_req, res) => res.json({ ok: true, service: "hh-preventive-care-monitor" }));
app.use("/members", members);
app.use("/alerts", alerts);


app.listen(port, () => console.log(`API running on ${port}`));
