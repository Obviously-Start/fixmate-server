import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { isObjectId } from "./helpers.js";


export async function savePaidSession(session) {
  const { payments, bookings } = await getCollections();

  const bookingId = session.metadata?.bookingId;
  if (!isObjectId(bookingId)) {
    throw new Error("Payment session has no valid booking");
  }

  let payment = await payments.findOne({
    $or: [{ stripeSessionId: session.id }, { bookingId }],
  });

  if (!payment) {
    const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });
    if (!booking) throw new Error("Booking not found for this payment");

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
      payment = { ...doc, _id: result.insertedId };
    } catch (err) {
    
      if (err.code !== 11000) throw err;
      payment = await payments.findOne({ $or: [{ stripeSessionId: session.id }, { bookingId }] });
    }
  }

  
  await bookings.updateOne(
    { _id: new ObjectId(bookingId), paymentStatus: "unpaid" },
    {
      $set: { paymentStatus: "paid" },
      $push: { statusHistory: { status: "paid", changedAt: new Date() } },
    }
  );

  return payment;
}