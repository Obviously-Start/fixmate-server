export const CATEGORIES = [
  "Smartphone",
  "Laptop & PC",
  "AC",
  "Refrigerator",
  "TV",
  "Washing Machine",
  "Electrical",
];
export const SERVICE_MODES = ["Home Visit", "Shop Drop-off"];
export const ACTIVE_STATUSES = ["requested", "accepted", "in-progress"];

// Kon status theke kon status e jawa jabe
export const STATUS_FLOW = {
  requested: ["accepted", "rejected"],
  accepted: ["in-progress"],
  "in-progress": ["completed"],
};

export const isObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id));
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");