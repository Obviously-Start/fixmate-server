import express from "express";
import cors from "cors";
import { getStripe } from "./config/stripe.js";
import { savePaidSession } from "./utils/savePayment.js";
import servicesRoutes from "./routes/services.routes.js";
import bookingsRoutes from "./routes/bookings.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import usersRoutes from "./routes/users.routes.js";

const app = express();


const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
    
      if (!origin || allowedOrigins.includes(origin.replace(/\/+$/, ""))) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  })
);


app.post("/api/payments/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      req.body,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === "checkout.session.completed" && event.data.object.payment_status === "paid") {
      await savePaidSession(event.data.object);
    }
    res.json({ received: true });
  } catch (err) {
    console.error("Webhook save failed:", err.message);
    res.status(500).json({ received: false });
  }
});

app.use(express.json());

app.get("/", (req, res) => {
  res.json({ success: true, message: "FixMate server is running" });
});

app.use("/api/services", servicesRoutes);
app.use("/api/bookings", bookingsRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/users", usersRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

export default app;