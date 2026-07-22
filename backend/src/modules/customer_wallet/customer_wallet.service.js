const prisma = require('../../config/database');

// get customer wallet balance
async function getMyWallet(customer_id) {
  const [customer, transactions] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customer_id },
      select: { id: true, name: true, wallet_balance: true },
    }),
    prisma.walletTransaction.findMany({
      where:   { customer_id },
      include: { txn_type: { select: { code: true, name_fr: true, name_ar: true, direction: true } } },
      orderBy: { created_at: 'desc' },
      take:    50,
    }),
  ]);
  if (!customer) throw { statusCode: 404, message: 'Client introuvable' };
  return { customer, transactions };
}

// lister les transactions
async function getMyTransactions(customer_id, { page = 1, limit = 25 } = {}) {
  const [data, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where:   { customer_id },
      include: { txn_type: { select: { code: true, name_fr: true, name_ar: true, direction: true } } },
      orderBy: { created_at: 'desc' },
      skip:    (Number(page) - 1) * Number(limit),
      take:    Number(limit),
    }),
    prisma.walletTransaction.count({ where: { customer_id } }),
  ]);
  return { data, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
}

module.exports = { getMyWallet, getMyTransactions };