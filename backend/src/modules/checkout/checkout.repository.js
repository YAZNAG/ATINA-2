const prisma = require('../../config/database');

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLon = toRad(Number(lon2) - Number(lon1));
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Address ───────────────────────────────────────────────────────────────────
const getAddress = (id) =>
  prisma.address.findFirst({ where: { id, is_deleted: false } });

// ── Delivery type ─────────────────────────────────────────────────────────────
const getDeliveryType  = (id)   => prisma.deliveryType.findUnique({ where: { id } });
const getDeliveryTypeByCode = (code) => prisma.deliveryType.findFirst({ where: { code } });
const getAllDeliveryTypes = () => prisma.deliveryType.findMany({ orderBy: { code: 'asc' } });

// ── Nodes ─────────────────────────────────────────────────────────────────────
const getActiveNodesInCity = async (cityName) => {
  // Match by City.name_fr → get city UUID → filter nodes
  const city = cityName
    ? await prisma.city.findFirst({ where: { name_fr: cityName, is_active: true, is_deleted: false }, select: { id: true } })
    : null;

  return prisma.node.findMany({
    where: {
      is_active:  true,
      is_deleted: false,
      ...(city ? { city_id: city.id } : {}),
    },
    include: {
      city:           { select: { id: true, name_fr: true, name_ar: true } },
      delivery_slots: { where: { is_active: true }, orderBy: [{ day_of_week: 'asc' }, { slot_start: 'asc' }] },
    },
  });
};

const getAllActiveNodes = () =>
  prisma.node.findMany({
    where: { is_active: true, is_deleted: false },
    include: {
      city:           { select: { id: true, name_fr: true, name_ar: true } },
      delivery_slots: { where: { is_active: true }, orderBy: [{ day_of_week: 'asc' }, { slot_start: 'asc' }] },
    },
    orderBy: { name_fr: 'asc' },
  });

// ── Slot capacity ─────────────────────────────────────────────────────────────
function dayBounds(date) {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  return { start, end };
}

const countOrdersForNodeDay = (node_id, date) => {
  const { start, end } = dayBounds(date);
  return prisma.order.count({ where: { node_id, is_deleted: false, created_at: { gte: start, lte: end } } });
};

const countOrdersForSlotDay = (confirmed_slot_id, date) => {
  const { start, end } = dayBounds(date);
  return prisma.order.count({ where: { confirmed_slot_id, is_deleted: false, created_at: { gte: start, lte: end } } });
};

// ── Stock & selling rules ─────────────────────────────────────────────────────
const getStockLevels = (node_id, sku_ids) =>
  prisma.stockLevel.findMany({ where: { node_id, sku_id: { in: sku_ids } } });

const getSellingRules = (node_id, sku_ids) =>
  prisma.sellingRule.findMany({ where: { node_id, sku_id: { in: sku_ids } } });

// ── Lookup statuses ───────────────────────────────────────────────────────────
const getOrderStatusByCode     = (code) => prisma.orderStatus.findFirst({ where: { code } });
const getOrderItemStatusByCode = (code) => prisma.orderItemStatus.findFirst({ where: { code } });
const getPaymentStatusByCode   = (code) => prisma.paymentStatus.findFirst({ where: { code } });
const getPaymentMethod         = (id)   => prisma.paymentMethod.findUnique({ where: { id } });
const getAllPaymentMethods      = ()     => prisma.paymentMethod.findMany({ where: { is_active: true }, orderBy: { code: 'asc' } });

// ── Customer & SKUs ───────────────────────────────────────────────────────────
const getCustomer = (id) => prisma.customer.findFirst({ where: { id, is_deleted: false }, select: { id: true, name: true, wallet_balance: true, is_active: true } });

module.exports = {
  haversineKm, getAddress, getDeliveryType, getDeliveryTypeByCode, getAllDeliveryTypes,
  getActiveNodesInCity, getAllActiveNodes,
  countOrdersForNodeDay, countOrdersForSlotDay,
  getStockLevels, getSellingRules,
  getOrderStatusByCode, getOrderItemStatusByCode, getPaymentStatusByCode,
  getPaymentMethod, getAllPaymentMethods, getCustomer,
};
