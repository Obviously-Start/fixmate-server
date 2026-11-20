import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { getStripe } from "../config/stripe.js";
import { verifyToken, verifyCustomer } from "../middlewares/auth.js";
import { isObjectId } from "../utils/helpers.js";
import { savePaidSession } from "../utils/savePayment.js";

const router = Router();


router.post("/create-checkout-session", verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!isObjectId(bookingId)) {
      return res.status(400).json({ success: false, message: "Invalid booking" });
    }
    const { bookings } = await getCollections();
    const booking = await bookings.findOne({ _id: new ObjectId(bookingId) });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "Forbidden: not your booking" });
    }
    if (booking.status !== "completed" || booking.paymentStatus !== "unpaid") {
      return res.status(400).json({ success: false, message: "Only a completed and unpaid job can be paid" });
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer_email: req.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(booking.finalAmount * 100),
            product_data: { name: booking.serviceTitle },
          },
        },
      ],
      metadata: { bookingId: booking._id.toString(), customerEmail: req.user.email },
      success_url: `${process.env.SITE_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/payment/cancel`,
    });

    res.json({ success: true, url: session.url });
  } catch (err) {
    next(err);
  }
});


router.get("/verify", verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const sessionId = String(req.query.session_id || "");
    if (!sessionId) return res.status(400).json({ success: false, message: "session_id is required" });

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.customerEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "Forbidden: this payment is not yours" });
    }
    if (session.payment_status !== "paid") {
      return res.status(400).json({ success: false, message: "Payment is not completed" });
    }
    const payment = await savePaidSession(session);
    res.json({ success: true, data: payment });
  } catch (err) {
    next(err);
  }
});


router.get("/my", verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { payments } = await getCollections();
    const data = await payments.find({ customerEmail: req.user.email }).sort({ paidAt: -1 }).toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;