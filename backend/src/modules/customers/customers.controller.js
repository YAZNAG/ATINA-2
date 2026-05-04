const prisma = require('../../config/database');
const response = require('../../utils/response');

const PRISMA_CUSTOMER_STALE =
  'Client Prisma obsolète (modèle Customer absent). Arrête le serveur Node, puis dans le dossier backend exécute : npx prisma generate';

function customerDb() {
  const d = prisma.customer;
  if (!d || typeof d.findMany !== 'function') return null;
  return d;
}

const MISSING_CUSTOMERS_TABLE_HINT =
  'La table SQL « customers » est absente. Dans le dossier backend : npx prisma db execute --file prisma/sql/ensure_customers_table.sql — ou corrige les erreurs Prisma puis npx prisma db push.';

function handleCustomerTableError(err, res, next) {
  if (err?.code === 'P2021') {
    return response.error(res, MISSING_CUSTOMERS_TABLE_HINT, 503);
  }
  if (typeof err?.message === 'string' && err.message.includes('does not exist in the current database')) {
    return response.error(res, MISSING_CUSTOMERS_TABLE_HINT, 503);
  }
  return next(err);
}

const LIST_SELECT = {
  id: true,
  phone_country: true,
  phone_number: true,
  phone_verified_at: true,
  name: true,
  preferred_lang: true,
  referral_code: true,
  referred_by_id: true,
  wallet_balance: true,
  points_balance: true,
  points_lifetime: true,
  city: true,
  lat: true,
  lng: true,
  is_active: true,
  is_deleted: true,
  deleted_at: true,
  created_at: true,
  updated_at: true,
};

exports.list = async (req, res, next) => {
  try {
    const db = customerDb();
    if (!db) return response.error(res, PRISMA_CUSTOMER_STALE, 503);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const skip = (page - 1) * limit;
    const q = (req.query.q || '').trim();
    const includeDeleted = req.query.includeDeleted === '1';

    const where = {};
    if (!includeDeleted) where.is_deleted = false;
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone_number: { contains: q } },
        { referral_code: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      db.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
        select: LIST_SELECT,
      }),
      db.count({ where }),
    ]);

    return response.success(res, {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    });
  } catch (err) {
    return handleCustomerTableError(err, res, next);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const db = customerDb();
    if (!db) return response.error(res, PRISMA_CUSTOMER_STALE, 503);

    const customer = await db.findUnique({
      where: { id: req.params.id },
      include: {
        referred_by: { select: { id: true, name: true, referral_code: true, phone_number: true } },
        _count: { select: { orders: true, addresses: true } },
      },
    });
    if (!customer) {
      return response.error(res, 'Client introuvable', 404);
    }
    return response.success(res, customer);
  } catch (err) {
    return handleCustomerTableError(err, res, next);
  }
};
