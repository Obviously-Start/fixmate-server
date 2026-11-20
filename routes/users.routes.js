import { Router } from "express";
import { getCollections } from "../config/db.js";
import { verifyToken } from "../middlewares/auth.js";

const router = Router();


router.patch("/profile", verifyToken, async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (name.length < 2) {
      return res.status(400).json({ success: false, message: "Name must be at least 2 characters" });
    }
    const update = {
      name,
      phone: String(req.body.phone || "").trim(),
      area: String(req.body.area || "").trim(),
      bio: String(req.body.bio || "").trim().slice(0, 500),
      updatedAt: new Date(),
    };
    if (req.body.image) update.image = String(req.body.image);

    const { users } = await getCollections();
    await users.updateOne({ email: req.user.email }, { $set: update });
    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    next(err);
  }
});

export default router;