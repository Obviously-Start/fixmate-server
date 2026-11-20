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
export const BOOKING_STATUSES = [
  "requested",
  "accepted",
  "rejected",
  "in-progress",
  "completed",
  "cancelled",
];
export const ACTIVE_STATUSES = ["requested", "accepted", "in-progress"];

export const STATUS_FLOW = {
  requested: ["accepted", "rejected"],
  accepted: ["in-progress"],
  "in-progress": ["completed"],
};

export const isObjectId = (id) => /^[a-f\d]{24}$/i.test(String(id));
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Pagination: ?page=2&limit=12 -> safe numbers
export function getPaging(query, defaultLimit = 12, maxLimit = 24) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}