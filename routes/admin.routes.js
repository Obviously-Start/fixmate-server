import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken, verifyAdmin } from "../middlewares/auth.js";
import { isObjectId } from "../utils/helpers.js";

const router = Router();
router.use(verifyToken, verifyAdmin); 

const toChart = (rows) => rows.map((r) => ({ name: r._id, value: r.count }));

router.get("/stats", async (req, res, next) => {
  try {
    const { users, services, bookings, payments } = await getCollections();
    const [totalUsers, totalTechnicians, pendingServices, totalBookings, revenue, byStatus, byCategory] =
      await Promise.all([
        users.countDocuments(),
        users.countDocuments({ role: "technician" }),
        services.countDocuments({ approvalStatus: "pending" }),
        bookings.countDocuments(),
        payments.aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }]).toArray(),
        bookings.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]).toArray(),
        services.aggregate([{ $group: { _id: "$category", count: { $sum: 1 } } }]).toArray(),
      ]);
    res.json({
      success: true,
      data: {
        totalUsers,
        totalTechnicians,
        pendingServices,
        totalBookings,
        totalRevenue: revenue[0]?.total || 0,
        bookingsByStatus: toChart(byStatus),
        servicesByCategory: toChart(byCategory),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const { users } = await getCollections();

    const data = await users
      .find(
        {},
        {
          projection: {
            name: 1,
            email: 1,
            role: 1,
            image: 1,
            phone: 1,
            area: 1,
            bio: 1,
            createdAt: 1,
            updatedAt: 1,
          },
        }
      )
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.patch("/users/:id/role", async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["customer", "technician", "admin"].includes(role)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }
    if (!isObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: "You cannot change your own role" });
    }
    const { users } = await getCollections();
    const result = await users.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { role } });
    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, message: `Role updated to ${role}` });
  } catch (err) {
    next(err);
  }
});

router.get("/services", async (req, res, next) => {
  try {
    const filter = {};
    if (["pending", "approved", "rejected"].includes(req.query.approvalStatus)) {
      filter.approvalStatus = req.query.approvalStatus;
    }
    const { services } = await getCollections();
    const data = await services.find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.patch("/services/:id/approval", async (req, res, next) => {
  try {
    const { approvalStatus } = req.body;
    if (!["approved", "rejected"].includes(approvalStatus)) {
      return res.status(400).json({ success: false, message: "approvalStatus must be approved or rejected" });
    }
    if (!isObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    const { services } = await getCollections();
    const result = await services.updateOne({ _id: new ObjectId(req.params.id) }, { $set: { approvalStatus } });
    if (!result.matchedCount) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    res.json({ success: true, message: `Service ${approvalStatus}` });
  } catch (err) {
    next(err);
  }
});

router.get("/bookings", async (req, res, next) => {
  try {
    const filter = req.query.status ? { status: String(req.query.status) } : {};
    const { bookings } = await getCollections();
    const data = await bookings.find(filter).sort({ createdAt: -1 }).toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

router.get("/payments", async (req, res, next) => {
  try {
    const { payments } = await getCollections();
    const data = await payments.find({}).sort({ paidAt: -1 }).toArray();
    const totalRevenue = data.reduce((sum, p) => sum + (p.amount || 0), 0);
    res.json({ success: true, data, totalRevenue });
  } catch (err) {
    next(err);
  }
});

export default router;