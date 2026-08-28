const prisma = require('../../config/database');

// ── Shared includes ───────────────────────────────────────────────────────────
const PICKING_SESSION_SUMMARY = {
  where: { status: { code: { not: 'CANCELLED' } } },
  orderBy: { created_at: 'desc' },
  take: 1,
  select: {
    id: true,
    created_at: true,
    started_at: true,
    completed_at: true,
    picker: { select: { id: true, name: true, phone_number: true } },
    status: { select: { id: true, code: true, name_fr: true } },
    items: { select: { id: true, status: { select: { code: true, name_fr: true } } } },
  },
};

const LIST_INCLUDE = {
  customer:      { select: { id: true, name: true, phone_country: true, phone_number: true } },
  status:        { select: { id: true, code: true, name_fr: true, color: true, is_terminal: true, sort_order: true } },
  delivery_type: { select: { id: true, code: true, name_fr: true } },
  node:          { select: { id: true, code: true, name_fr: true } },
  _count:        { select: { items: true } },
  picking_sessions: PICKING_SESSION_SUMMARY,
  confirmed_slot: {
   select: {
     id: true,
    name_fr: true,
    slot_start: true,
  slot_end: true,
    day_of_week: true,
   },
 },
 payments: {
  include: {
    status: {
      select: {
        code: true,
        name_fr: true,
      },
    },
    payment_method: {
      select: {
        code: true,
        name_fr: true,
      },
    },
  },
  orderBy: {
    created_at: 'desc',
  },
},
 };

const DETAIL_INCLUDE = {
  customer: { select: { id: true, name: true, phone_country: true, phone_number: true, wallet_balance: true, points_balance: true } },
  address:  true,
  status:   true,
  delivery_type: true,
  node:     { select: { id: true, code: true, name_fr: true } },
  confirmed_slot: { select: { id: true, name_fr: true, slot_start: true, slot_end: true, day_of_week: true } },
  items: {
    where: { status: { code: { not: 'CANCELLED' } } },
    include: {
      status: { select: { code: true, name_fr: true, color: true } },
      sku:    { select: { id: true, name_fr: true, sku_code: true, price: true } },
    },
    orderBy: { unit_price_sold: 'desc' },
  },
  payments: {
    include: {
      status:         { select: { code: true, name_fr: true } },
      payment_method: { select: { code: true, name_fr: true } },
    },
    orderBy: { created_at: 'desc' },
  },
  picking_sessions: PICKING_SESSION_SUMMARY,
};

// ── Build WHERE clause ────────────────────────────────────────────────────────
function buildWhere({
  search,
  status_code,
  delivery_type_code,
  node_id,
  customer_id,
  date,
  slot_id,
} = {}) {
  const where = {
    is_deleted: false,
  };

  if (search?.trim()) {
    const s = search.trim();

    where.OR = [
      {
        id: {
          contains: s,
          mode: 'insensitive',
        },
      },
      {
        customer: {
          name: {
            contains: s,
            mode: 'insensitive',
          },
        },
      },
      {
        customer: {
          phone_number: {
            contains: s,
            mode: 'insensitive',
          },
        },
      },
    ];
  }

  if (status_code) {
    where.status = {
      code: status_code,
    };
  }

  if (delivery_type_code) {
    where.delivery_type = {
      code: delivery_type_code,
    };
  }

  if (node_id) {
    where.node_id = node_id;
  }

  if (customer_id) {
    where.customer_id = customer_id;
  }

  if (date) {
    const startDate = new Date(`${date}T00:00:00.000Z`);
    const endDate = new Date(`${date}T00:00:00.000Z`);

    endDate.setUTCDate(endDate.getUTCDate() + 1);

    where.created_at = {
      gte: startDate,
      lt: endDate,
    };
  }

  // Filtre par créneau récupéré depuis la base
  if (slot_id) {
    where.confirmed_slot = {
      is: {
        id: slot_id,
      },
    };
  }

  return where;
}

// ── Queries ───────────────────────────────────────────────────────────────────
const findAll = async ({ page = 1, limit = 25, ...filters } = {}) => {
  const where = buildWhere(filters);
  const [data, total] = await Promise.all([
    prisma.order.findMany({ where, include: LIST_INCLUDE, orderBy: { created_at: 'desc' }, skip: (Number(page) - 1) * Number(limit), take: Number(limit) }),
    prisma.order.count({ where }),
  ]);
  return { data, total };
};

const findById = (id) => prisma.order.findFirst({ where: { id, is_deleted: false }, include: DETAIL_INCLUDE });

const getStatusByCode = (code) => prisma.orderStatus.findFirst({ where: { code } });

const updateStatus = async (id, status_id, changed_by = null, note = null) => {
  const order = await prisma.order.update({ where: { id }, data: { status_id }, include: DETAIL_INCLUDE });
  // Write history entry
  await prisma.orderHistory.create({ data: { order_id: id, status_id, changed_by, note } });
  return order;
};

const getHistory = (order_id) =>
  prisma.orderHistory.findMany({
    where:   { order_id },
    include: { status: { select: { id: true, code: true, name_fr: true, color: true } } },
    orderBy: { created_at: 'asc' },
  });

const addHistory = (order_id, status_id, changed_by = null, note = null) =>
  prisma.orderHistory.create({ data: { order_id, status_id, changed_by, note } });

const softDelete = (id) =>
  prisma.order.update({ where: { id }, data: { is_deleted: true, deleted_at: new Date() } });

const countByStatus = async () => {
  const rows = await prisma.orderStatus.findMany({
    where: {},

    select: {
      code: true,
      name_fr: true,
      color: true,
      sort_order: true,
      _count: {
        select: {
          orders: {
            where: {
              is_deleted: false,
            },
          },
        },
      },
    },

    orderBy: {
      sort_order: 'asc',
    },
  });

  return rows.map((status) => ({
    code: status.code,
    name_fr: status.name_fr,
    color: status.color,
    count: status._count.orders,
  }));
};

const getNodes = () =>
  prisma.node.findMany({ where: { is_active: true, is_deleted: false }, select: { id: true, code: true, name_fr: true }, orderBy: { name_fr: 'asc' } });

const getDeliveryTypes = () =>
  prisma.deliveryType.findMany({ select: { id: true, code: true, name_fr: true }, orderBy: { code: 'asc' } });

const getSlots = () =>
  prisma.deliverySlot.findMany({
    select: {
      id: true,
      name_fr: true,
      slot_start: true,
      slot_end: true,
      day_of_week: true,
    },
    orderBy: [
      {
        day_of_week: 'asc',
      },
      {
        slot_start: 'asc',
      },
    ],
  });

module.exports = { findAll, findById, getStatusByCode, updateStatus, getHistory, addHistory, softDelete, countByStatus, getNodes, getDeliveryTypes, DETAIL_INCLUDE, getSlots,};