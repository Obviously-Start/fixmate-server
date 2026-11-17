import serverless from "serverless-http";
import express from "express";
import app from "../../app.js";
import { connectDB } from "../../config/db.js";

// Netlify path ta function-er prefix soho pathay, tai duto path-i handle kora hoyeche
const server = express();
server.use("/.netlify/functions/api", app);
server.use("/", app);

const handler = serverless(server);

export const netlifyHandler = async (event, context) => {
  // Cold start e DB connect ensure kora (cached, tai bar bar connect hobe na)
  await connectDB();
  return handler(event, context);
};

export { netlifyHandler as handler };