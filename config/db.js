import { MongoClient } from "mongodb";

let client;
let db;


export async function connectDB() {
  if (db) return db;

  client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  db = client.db(process.env.DB_NAME);
  console.log("MongoDB connected successfully");
  return db;
}


export async function getCollections() {
  const database = await connectDB();
  return {
    users: database.collection("user"), // BetterAuth er user collection
    services: database.collection("services"),
    bookings: database.collection("bookings"),
    payments: database.collection("payments"),
  };
}