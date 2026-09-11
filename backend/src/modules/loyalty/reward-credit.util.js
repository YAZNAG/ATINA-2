const { recordPointsTxn } = require('./points-ledger.util');

async function creditReward(tx, customer_id, rewardTypeCode, amount, walletTxnType, note) {
  const value = Number(amount ?? 0);
  if (value <= 0) return null;

  if (rewardTypeCode === 'WALLET' || rewardTypeCode === 'DISCOUNT') {
    const customer = await tx.customer.findUnique({
      where: { id: customer_id }, select: { wallet_balance: true },
    });
    const before = Number(customer?.wallet_balance ?? 0);
    const after  = before + value;

    await tx.customer.update({ where: { id: customer_id }, data: { wallet_balance: after } });

    if (walletTxnType) {
      await tx.walletTransaction.create({
        data: { customer_id, txn_type_id: walletTxnType.id, amount: value, balance_before: before, balance_after: after, note },
      });
    }

    return { type: 'wallet', amount: value };
  }

  if (rewardTypeCode === 'POINTS' || rewardTypeCode === 'points') {
    // Toute écriture de points passe par le grand-livre (INSERT + cache de solde dans la même transaction).
    const res = await recordPointsTxn(tx, {
      customer_id,
      amount: Math.round(value),
      type: 'promo_credit',
      reason: note || 'Crédit de points',
    });
    return { type: 'points', amount: Math.round(value), balance_after: res.points_balance };
  }

  return null;
}

module.exports = { creditReward };
