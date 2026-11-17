import { MongoClient } from "mongodb";

let dbPromise;

export function connectDB() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const client = new MongoClient(process.env.MONGODB_URI);
      await client.connect();
      const db = client.db(process.env.DB_NAME);
   
      await db.collection("payments").createIndex({ stripeSessionId: 1 }, { unique: true });
      await db.collection("payments").createIndex({ bookingId: 1 }, { unique: true });
      console.log("MongoDB connected successfully");
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

export async function getCollections() {
  const db = await connectDB();
  return {
    users: db.collection("user"), // BetterAuth er user collection
    services: db.collection("services"),
    bookings: db.collection("bookings"),
    payments: db.collection("payments"),
  };
}