import { Router } from "express";
import { ObjectId } from "mongodb";
import { getCollections } from "../config/db.js";
import { verifyToken, verifyTechnician } from "../middlewares/auth.js";
import { CATEGORIES, SERVICE_MODES, escapeRegex, isObjectId } from "../utils/helpers.js";

const router = Router();

function cleanServiceBody(body) {
  const data = {
    title: String(body.title || "").trim(),
    category: String(body.category || ""),
    description: String(body.description || "").trim(),
    image: String(body.image || "").trim(),
    basePrice: Number(body.basePrice),
    estimatedDuration: String(body.estimatedDuration || "").trim(),
    serviceMode: String(body.serviceMode || ""),
    serviceArea: String(body.serviceArea || "").trim(),
  };
  let error = null;
  if (data.title.length < 3) error = "Title must be at least 3 characters";
  else if (!CATEGORIES.includes(data.category)) error = "Invalid category";
  else if (data.description.length < 20) error = "Description must be at least 20 characters";
  else if (!data.image) error = "Service image is required";
  else if (!(data.basePrice > 0)) error = "Base price must be a positive number";
  else if (!data.estimatedDuration) error = "Estimated duration is required";
  else if (!SERVICE_MODES.includes(data.serviceMode)) error = "Invalid service mode";
  else if (!data.serviceArea) error = "Service area is required";
  return { data, error };
}


async function getOwnedService(req, res) {
  if (!isObjectId(req.params.id)) {
    res.status(404).json({ success: false, message: "Service not found" });
    return null;
  }
  const { services } = await getCollections();
  const service = await services.findOne({ _id: new ObjectId(req.params.id) });
  if (!service) {
    res.status(404).json({ success: false, message: "Service not found" });
    return null;
  }
  if (service.technicianEmail !== req.user.email) {
    res.status(403).json({ success: false, message: "Forbidden: this is not your service" });
    return null;
  }
  return service;
}


router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const category = String(req.query.category || "");
    const mode = String(req.query.mode || "");
    const sort = String(req.query.sort || "newest");

    const filter = { approvalStatus: "approved", isAvailable: true };
    if (CATEGORIES.includes(category)) filter.category = category;
    if (SERVICE_MODES.includes(mode)) filter.serviceMode = mode;
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ title: rx }, { category: rx }];
    }

    const sortMap = {
      "price-asc": { basePrice: 1 },
      "price-desc": { basePrice: -1 },
      newest: { createdAt: -1 },
    };

    const { services } = await getCollections();
    const data = await services.find(filter).sort(sortMap[sort] || sortMap.newest).toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});


router.get("/featured", async (req, res, next) => {
  try {
    const { services } = await getCollections();
    const data = await services
      .find({ approvalStatus: "approved", isAvailable: true })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});


router.get("/my", verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { services } = await getCollections();
    const data = await services
      .find({ technicianEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});


router.get("/:id", async (req, res, next) => {
  try {
    if (!isObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    const { services, users } = await getCollections();
    const service = await services.findOne({
      _id: new ObjectId(req.params.id),
      approvalStatus: "approved",
      isAvailable: true,
    });
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    const tech = await users.findOne({ email: service.technicianEmail });
    res.json({
      success: true,
      data: {
        ...service,
        technician: tech
          ? { name: tech.name, image: tech.image || "", area: tech.area || "", bio: tech.bio || "" }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
});


router.post("/", verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const { data, error } = cleanServiceBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { services } = await getCollections();
    const doc = {
      ...data,
      technicianName: req.user.name,
      technicianEmail: req.user.email,
      approvalStatus: "pending",
      isAvailable: true,
      createdAt: new Date(),
    };
    const result = await services.insertOne(doc);
    res.status(201).json({ success: true, message: "Service submitted for admin approval", data: { ...doc, _id: result.insertedId } });
  } catch (err) {
    next(err);
  }
});


router.patch("/:id", verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const service = await getOwnedService(req, res);
    if (!service) return;
    const { data, error } = cleanServiceBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const { services } = await getCollections();
    await services.updateOne({ _id: service._id }, { $set: { ...data, approvalStatus: "pending" } });
    res.json({ success: true, message: "Service updated and sent for re-approval" });
  } catch (err) {
    next(err);
  }
});


router.patch("/:id/availability", verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const service = await getOwnedService(req, res);
    if (!service) return;
    const { services } = await getCollections();
    const isAvailable = !service.isAvailable;
    await services.updateOne({ _id: service._id }, { $set: { isAvailable } });
    res.json({ success: true, message: isAvailable ? "Service is now available" : "Service is now unavailable", isAvailable });
  } catch (err) {
    next(err);
  }
});

// TECHNICIAN: delete
router.delete("/:id", verifyToken, verifyTechnician, async (req, res, next) => {
  try {
    const service = await getOwnedService(req, res);
    if (!service) return;
    const { services } = await getCollections();
    await services.deleteOne({ _id: service._id });
    res.json({ success: true, message: "Service deleted" });
  } catch (err) {
    next(err);
  }
});

export default router;