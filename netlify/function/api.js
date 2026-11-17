import serverless from "serverless-http";
import express from "express";
import app from "../../app.js";
import { connectDB } from "../../config/db.js";


const server = express();
server.use("/.netlify/functions/api", app);
server.use("/", app);

const handler = serverless(server);

export const netlifyHandler = async (event, context) => {

  await connectDB();
  return handler(event, context);
};

export { netlifyHandler as handler };