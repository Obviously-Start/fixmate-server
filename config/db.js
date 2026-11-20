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


      try {
        await db.collection("services").createIndex({ approvalStatus: 1, isAvailable: 1, createdAt: -1 });
        await db.collection("services").createIndex({ technicianEmail: 1 });
        await db.collection("bookings").createIndex({ customerEmail: 1, createdAt: -1 });
        await db.collection("bookings").createIndex({ technicianEmail: 1, createdAt: -1 });
        await db.collection("bookings").createIndex({ serviceId: 1, customerEmail: 1, status: 1 });
      } catch (err) {
        console.warn("Index creation skipped:", err.message);
      }

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
    users: db.collection("user"), // BetterAuth  user collection
    services: db.collection("services"),
    bookings: db.collection("bookings"),
    payments: db.collection("payments"),
  };
}