import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";

export async function savePaidSession(session) {
  const { payments, bookings } = await getCollections();

  // Age thekei save thakle seta-i ferot dao
  const existing = await payments.findOne({ stripeSessionId: session.id });
  if (existing) return existing;

  const bookingId = session.metadata?.bookingId;
  const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });
  if (!booking) throw new Error("Booking not found for this payment");

  const byBooking = await payments.findOne({ bookingId });
  if (byBooking) return byBooking;

  const doc = {
    bookingId,
    serviceTitle: booking.serviceTitle,
    customerName: booking.customerName,
    customerEmail: booking.customerEmail,
    technicianName: booking.technicianName,
    technicianEmail: booking.technicianEmail,
    amount: (session.amount_total || 0) / 100,
    currency: "usd",
    transactionId: String(session.payment_intent),
    stripeSessionId: session.id,
    paymentStatus: "paid",
    paidAt: new Date(),
  };

  try {
    const result = await payments.insertOne(doc);
    doc._id = result.insertedId;
  } catch (err) {
    
    if (err.code === 11000) {
      return payments.findOne({ $or: [{ stripeSessionId: session.id }, { bookingId }] });
    }
    throw err;
  }

  await bookings.updateOne({ _id: booking._id }, { $set: { paymentStatus: "paid" } });
  return doc;
}