/**
 * Grand-livre des points (table points_transactions, APPEND-ONLY : un trigger PG
 * interdit UPDATE et DELETE).
 *
 * Règles (classeur WF#25 / WF#38 / WF#40, US-013 / US-086) :
 *  - une écriture = un INSERT dans points_transactions + la mise à jour du cache
 *    customers.points_balance DANS LA MÊME TRANSACTION ;
 *  - le sens est porté uniquement par le signe du montant (points) ;
 *  - points_lifetime n'augmente que sur un crédit ;
 *  - un débit qui rendrait le solde négatif est refusé.
 *
 * Limite du schéma actuel : la table ne possède pas encore les colonnes
 * points_rule_id / referral_id / game_play_id / reason du Schema V3. En attendant
 * la migration, ces références sont encodées à la fin du libellé (label) sous la
 * forme de balises « [rule:<uuid>] », « [ref:<uuid>] », « [play:<uuid>] ».
 * parseLabel() les relit ; le motif lisible est le libellé sans les balises.
 */

const TAGS = { points_rule_id: 'rule', referral_id: 'ref', game_play_id: 'play' };
const TAG_RE = /\s*\[(rule|ref|play):([0-9a-fA-F-]{36})\]/g;
const LABEL_MAX = 255;

/** Types de transaction (points_txn_types du classeur) + anciens codes encore présents en base. */
const TXN_TYPES = [
  { code: 'order_payment',     name_fr: 'Gain commande' },
  { code: 'refund',            name_fr: 'Remboursement' },
  { code: 'referral_reward',   name_fr: 'Récompense parrainage' },
  { code: 'promo_credit',      name_fr: 'Crédit promotionnel' },
  { code: 'prize_award',       name_fr: 'Gain jeu' },
  { code: 'sku_exchange',      name_fr: 'Échange produit' },
  { code: 'exchange_revert',   name_fr: 'Annulation échange' },
  { code: 'manual_adjustment', name_fr: 'Ajustement manuel' },
  { code: 'earn',              name_fr: 'Gain commande (ancien format)', legacy: true },
  { code: 'redeem',            name_fr: 'Rachat de points (ancien format)', legacy: true },
];

const txnTypeLabel = (code) => TXN_TYPES.find((t) => t.code === code)?.name_fr ?? code;

function buildLabel(reason, refs = {}) {
  const tags = Object.entries(TAGS)
    .filter(([key]) => refs[key])
    .map(([key, tag]) => `[${tag}:${refs[key]}]`)
    .join(' ');
  const clean = String(reason ?? '').replace(TAG_RE, '').trim() || '—';
  const room = LABEL_MAX - (tags ? tags.length + 1 : 0);
  const text = clean.length > room ? `${clean.slice(0, Math.max(0, room - 1))}…` : clean;
  return tags ? `${text} ${tags}` : text;
}

function parseLabel(label) {
  const out = { reason: null, points_rule_id: null, referral_id: null, game_play_id: null };
  if (!label) return out;
  const byTag = { rule: 'points_rule_id', ref: 'referral_id', play: 'game_play_id' };
  for (const m of String(label).matchAll(TAG_RE)) out[byTag[m[1]]] = m[2].toLowerCase();
  out.reason = String(label).replace(TAG_RE, '').trim() || null;
  return out;
}

/** Filtre SQL/Prisma : transactions dont le libellé référence l'objet donné. */
const labelTagFilter = (key, id) => ({ label: { contains: `[${TAGS[key]}:${id}]`, mode: 'insensitive' } });

/**
 * Écrit une transaction de points et met à jour le cache de solde.
 * À appeler dans une transaction Prisma (tx) : tout échoue ou tout réussit.
 */
async function recordPointsTxn(tx, {
  customer_id, amount, type, reason,
  order_id = null, points_rule_id = null, referral_id = null, game_play_id = null,
}) {
  const points = Number(amount);
  if (!Number.isInteger(points) || points === 0) {
    throw { statusCode: 400, message: 'Le nombre de points doit être un entier non nul.' };
  }
  if (!type) throw { statusCode: 400, message: 'Type de transaction de points manquant.' };

  if (points < 0) {
    // Contrôle bloquant : points_balance + amount >= 0 (mise à jour conditionnelle atomique)
    const res = await tx.customer.updateMany({
      where: { id: customer_id, points_balance: { gte: -points } },
      data: { points_balance: { increment: points } },
    });
    if (res.count === 0) {
      const exists = await tx.customer.findUnique({ where: { id: customer_id }, select: { points_balance: true } });
      if (!exists) throw { statusCode: 404, message: 'Client introuvable.' };
      throw {
        statusCode: 400,
        message: `Solde de points insuffisant : le client dispose de ${exists.points_balance} point(s), débit demandé ${-points}.`,
      };
    }
  } else {
    await tx.customer.update({
      where: { id: customer_id },
      data: { points_balance: { increment: points }, points_lifetime: { increment: points } },
    });
  }

  const after = await tx.customer.findUnique({ where: { id: customer_id }, select: { points_balance: true, points_lifetime: true } });

  const txn = await tx.pointsTransaction.create({
    data: {
      customer_id,
      order_id,
      type: String(type).slice(0, 20),
      points,
      // Colonne héritée NOT NULL : renseignée pour compatibilité, jamais affichée (US-086 : pas de solde par ligne).
      balance_after: after.points_balance,
      label: buildLabel(reason, { points_rule_id, referral_id, game_play_id }),
    },
  });

  return { txn, points_balance: after.points_balance, points_lifetime: after.points_lifetime };
}

module.exports = { TXN_TYPES, txnTypeLabel, buildLabel, parseLabel, labelTagFilter, recordPointsTxn };
