import serverless from "serverless-http";
import { app } from "./index";

// Accepts /prod from api gateway as well now
const basePath = process.env.LAMBDA_BASE_PATH || "/prod";

export const handler = serverless(app, { basePath });