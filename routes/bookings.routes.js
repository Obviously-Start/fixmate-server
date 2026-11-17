import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken, verifyCustomer, verifyTechnician } from "../middlewares/auth.js";
import { ACTIVE_STATUSES, STATUS_FLOW, isObjectId } from "../utils/helpers.js";

const router = Router();

// CUSTOMER: repair request 
router.post("/", verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { serviceId, customerPhone, address, preferredDate, problemDescription } = req.body;

    if (!isObjectId(serviceId)) {
      return res.status(400).json({ success: false, message: "Invalid service" });
    }
    const phone = String(customerPhone || "").trim();
    const addr = String(address || "").trim();
    const problem = String(problemDescription || "").trim();
    const date = new Date(preferredDate);

    if (!/^[+\d][\d\s-]{7,}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Enter a valid phone number" });
    }
    if (addr.length < 5) {
      return res.status(400).json({ success: false, message: "Address is required" });
    }
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ success: false, message: "Preferred date is required" });
    }
    const limit = new Date();
    limit.setUTCHours(0, 0, 0, 0);
    limit.setUTCDate(limit.getUTCDate() - 1); // timezone er jonno ek din chhar
    if (date < limit) {
      return res.status(400).json({ success: false, message: "Preferred date cannot be in the past" });
    }
    if (problem.length < 20) {
      return res.status(400).json({ success: false, message: "Problem description must be at least 20 characters" });
    }

    const { services, bookings } = await getCollections();
    const service = await services.findOne({
      _id: new ObjectId(serviceId),
      approvalStatus: "approved",
      isAvailable: true,
    });
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found or unavailable" });
    }
    if (service.technicianEmail === req.user.email) {
      return res.status(403).json({ success: false, message: "You cannot request your own service" });
    }

   
    const duplicate = await bookings.findOne({
      serviceId,
      customerEmail: req.user.email,
      status: { $in: ACTIVE_STATUSES },
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: "You already have an active request for this service" });
    }

    const doc = {
      serviceId,
      serviceTitle: service.title,
      serviceImage: service.image,
      category: service.category,
      basePrice: service.basePrice,
      technicianName: service.technicianName,
      technicianEmail: service.technicianEmail,
      customerName: req.user.name,
      customerEmail: req.user.email,
      customerPhone: phone,
      address: addr,
      preferredDate: date,
      problemDescription: problem,
      status: "requested",
      finalAmount: service.basePrice,
      paymentStatus: "unpaid",
      createdAt: new Date(),
    };
    const result = await bookings.insertOne(doc);
    res.status(201).json({ success: true, message: "Repair request sent", data: { ...doc, _id: result.insertedId } });
  } catch (err) {
    next(err);
  }
});

// CUSTOMER: booking
router.get("/my", verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    const { bookings } = await getCollections();
    const data = await bookings.find({ customerEmail: req.user.email }).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// CUSTOMER: "requested" 
router.patch("/:id/cancel", verifyToken, verifyCustomer, async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    const { bookings } = await getCollections();
    const booking = await bookings.findOne({ _id: new ObjectId(req.params.id) });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });
    if (booking.customerEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "Forbidden: not your booking" });
    }
    if (booking.status !== "requested") {
      return res.status(400).json({ success: false, message: "Only a requested job can be cancelled" });
    }
    await bookings.updateOne({ _id: booking._id }, { $set: { status: "cancelled" } });
    res.json({ success: true, message: "Booking cancelled" });
  } catch (err) {
    next(err);
  }
});


router.get("/technician", verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const filter = { technicianEmail: req.user.email };
    if (req.query.status) filter.status = String(req.query.status);
    const { bookings } = await getCollections();
    const data = await bookings.find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});


router.patch("/:id/status", verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { status, finalAmount } = req.body;
    if (!isObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    const { bookings } = await getCollections();
    const booking = await bookings.findOne({ _id: new ObjectId(req.params.id) });
    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (booking.technicianEmail !== req.user.email) {
      return res.status(403).json({ success: false, message: "Forbidden: this job belongs to another technician" });
    }

    const allowed = STATUS_FLOW[booking.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot change status from "${booking.status}" to "${status}"`,
      });
    }

    const update = { status };
    if (status === "completed") {
      const amount = Number(finalAmount);
      if (!(amount > 0)) {
        return res.status(400).json({ success: false, message: "finalAmount must be a number greater than 0" });
      }
      update.finalAmount = amount;
    }

    await bookings.updateOne({ _id: booking._id }, { $set: update });
    res.json({ success: true, message: `Job marked as ${status}` });
  } catch (err) {
    next(err);
  }
});

export default router;