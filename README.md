# HHPreventiveCareMonitor

Small demo for Harbor Health Interview:
- React (TypeScript) frontend
- Node.js (TypeScript + Express) API with `/health` and `/version`
- Expands to ETL Lambdas (Python), RDS Postgres, and simple dashboards

## Dev
- API: `cd api && npm run dev` -> http://localhost:3001/health
- Web: `npm start` (from React app folder) -> http://localhost:3000
- Dev proxy: React calls `/health` which proxies to `http://localhost:3001`
