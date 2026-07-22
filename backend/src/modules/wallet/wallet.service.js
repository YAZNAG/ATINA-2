const prisma = require('../../config/database');
const h = require('../../utils/statusHelpers');

// ── Internal: create transaction record ───────────────────────────────────────
async function _recordTxn(tx, { customer_id, txn_type_code, order_id, amount, balance_before, balance_after, note, reference }) {
  const txnType = await h.getWalletTxnType(txn_type_code);
  if (!txnType) {
    throw { statusCode: 500, message: `Type de transaction wallet "${txn_type_code}" introuvable — vérifier le seed` };
  }
  return tx.walletTransaction.create({
    data: {
      customer_id,
      txn_type_id:    txnType.id,
      order_id:       order_id || null,
      amount:         Math.abs(amount),
      balance_before,
      balance_after,
      reference:      reference || null,
      note:           note || null,
    },
  });
}

// ── Debit wallet (during checkout or adjustment) ──────────────────────────────
async function debitWallet({ customer_id, amount, order_id, note, reference } = {}) {
  if (!customer_id || !amount || amount <= 0) throw { statusCode: 400, message: 'customer_id et amount > 0 requis' };

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customer_id }, select: { wallet_balance: true } });
    if (!customer) throw { statusCode: 404, message: 'Client introuvable' };

    const before = Number(customer.wallet_balance);
    if (before < amount) throw { statusCode: 422, message: `Solde wallet insuffisant (${before} MAD < ${amount} MAD)` };

    const after = parseFloat((before - amount).toFixed(2));
    await tx.customer.update({ where: { id: customer_id }, data: { wallet_balance: after } });
    await _recordTxn(tx, { customer_id, txn_type_code: 'debit_order', order_id, amount, balance_before: before, balance_after: after, note, reference });
    return { balance_before: before, balance_after: after };
  });
}

// ── Credit wallet (refund, recharge, points conversion) ───────────────────────
async function creditWallet({ customer_id, amount, txn_type_code = 'credit_recharge', order_id, note, reference } = {}) {
  if (!customer_id || !amount || amount <= 0) throw { statusCode: 400, message: 'customer_id et amount > 0 requis' };

  return prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customer_id }, select: { wallet_balance: true } });
    if (!customer) throw { statusCode: 404, message: 'Client introuvable' };

    const before = Number(customer.wallet_balance);
    const after  = parseFloat((before + amount).toFixed(2));
    await tx.customer.update({ where: { id: customer_id }, data: { wallet_balance: after } });
    await _recordTxn(tx, { customer_id, txn_type_code, order_id, amount, balance_before: before, balance_after: after, note, reference });
    return { balance_before: before, balance_after: after };
  });
}

// ── Refund wallet (order cancelled or returned) ────────────────────────────────
async function refundWallet({ customer_id, amount, order_id, note } = {}) {
  return creditWallet({ customer_id, amount, txn_type_code: 'refund', order_id, note: note || 'Remboursement wallet' });
}

// ── Get customer balance + last txns ──────────────────────────────────────────
async function getCustomerWallet(customer_id) {
  const [customer, txns] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: customer_id },
      select: { id: true, name: true, wallet_balance: true },
    }),
    prisma.walletTransaction.findMany({
      where:   { customer_id },
      include: { txn_type: { select: { code: true, name_fr: true, direction: true } } },
      orderBy: { created_at: 'desc' },
      take:    50,
    }),
  ]);
  if (!customer) throw { statusCode: 404, message: 'Client introuvable' };
  return { customer, transactions: txns };
}

// ── List all txns (admin) ─────────────────────────────────────────────────────
async function listTransactions({ customer_id, page = 1, limit = 25 } = {}) {
  const where = customer_id ? { customer_id } : {};
  const [data, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where, include: {
        txn_type: { select: { code: true, name_fr: true, direction: true } },
        customer: { select: { id: true, name: true, phone_number: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    }),
    prisma.walletTransaction.count({ where }),
  ]);
  return { data, pagination: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) } };
}

// ── Txn types (for admin UI) ──────────────────────────────────────────────────
async function getTxnTypes() {
  return prisma.walletTxnType.findMany({ orderBy: { code: 'asc' } });
}

module.exports = { debitWallet, creditWallet, refundWallet, getCustomerWallet, listTransactions, getTxnTypes };
