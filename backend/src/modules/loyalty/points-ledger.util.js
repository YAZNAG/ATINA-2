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
 * Depuis la migration 20260911120000, les références Schema_V3 (txn_type_id,
 * points_rule_id, referral_id, game_play_id, reason) sont des colonnes. Les balises
 * « [rule:<uuid>] », « [ref:<uuid>] », « [play:<uuid>] » restent écrites dans le
 * libellé pour compatibilité ; parseLabel() ne sert plus qu'aux anciennes lignes.
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

/** Filtre SQL/Prisma : transactions dont le libellé référence l'objet donné (anciennes lignes uniquement). */
const labelTagFilter = (key, id) => ({ label: { contains: `[${TAGS[key]}:${id}]`, mode: 'insensitive' } });

/**
 * Filtre Prisma sur une référence (points_rule_id, referral_id, game_play_id) :
 * la colonne fait foi ; la balise du libellé n'est lue que pour les anciennes
 * lignes dont la colonne est vide.
 */
const refFilter = (key, id) => ({ OR: [{ [key]: id }, { [key]: null, ...labelTagFilter(key, id) }] });

/** Filtre Prisma sur le type (code de points_txn_types), anciennes lignes sans txn_type_id comprises. */
const txnTypeFilter = (codes) => {
  const list = [].concat(codes).map(String);
  return { OR: [{ txn_type: { code: { in: list } } }, { txn_type_id: null, type: { in: list } }] };
};

/** Référentiel points_txn_types (FR/AR) lu en base, avec repli sur la liste statique. */
async function loadTxnTypes(db) {
  try {
    const rows = await db.pointsTxnType.findMany({ select: { id: true, code: true, name_fr: true, name_ar: true } });
    if (rows.length) {
      const order = TXN_TYPES.map((t) => t.code);
      return rows.sort((a, b) => {
        const ia = order.indexOf(a.code); const ib = order.indexOf(b.code);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.code.localeCompare(b.code);
      });
    }
  } catch (_) { /* référentiel indisponible : repli */ }
  return TXN_TYPES.filter((t) => !t.legacy).map((t) => ({ id: null, code: t.code, name_fr: t.name_fr, name_ar: null }));
}

/** Violation d'unicité (P2002 Prisma / 23505 PostgreSQL). */
const isUniqueViolation = (err) => err?.code === 'P2002' || err?.meta?.code === '23505'
  || /unique constraint|23505/i.test(String(err?.message ?? ''));

let savepointSeq = 0;

/**
 * recordPointsTxn « au plus une fois » : si l'index unique du livre
 * ((order_id, points_rule_id) ou (referral_id, customer_id)) refuse la ligne,
 * l'écriture (solde compris) est annulée via un SAVEPOINT et la fonction renvoie
 * null (« déjà attribué ») sans faire échouer la transaction appelante.
 */
async function recordPointsTxnOnce(tx, args) {
  if (typeof tx.$transaction === 'function') {
    // Client global (hors transaction) : une transaction dédiée par écriture.
    try {
      return await tx.$transaction((t) => recordPointsTxn(t, args));
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }
  savepointSeq = (savepointSeq + 1) % 1000000;
  const sp = `points_txn_once_${savepointSeq}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
  try {
    const res = await recordPointsTxn(tx, args);
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
    return res;
  } catch (err) {
    if (isUniqueViolation(err)) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      return null;
    }
    throw err;
  }
}

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

  // Type du classeur (points_txn_types) résolu par son code.
  const txnType = await tx.pointsTxnType.findUnique({ where: { code: String(type) }, select: { id: true } });

  const txn = await tx.pointsTransaction.create({
    data: {
      customer_id,
      order_id,
      type: String(type).slice(0, 20),
      txn_type_id: txnType?.id ?? null,
      points,
      // Colonne héritée NOT NULL : renseignée pour compatibilité, jamais affichée (US-086 : pas de solde par ligne).
      balance_after: after.points_balance,
      // Références Schema_V3 en colonnes ; le libellé garde aussi les balises pour les anciens lecteurs.
      points_rule_id,
      referral_id,
      game_play_id,
      reason: reason != null ? String(reason) : null,
      label: buildLabel(reason, { points_rule_id, referral_id, game_play_id }),
    },
  });

  return { txn, points_balance: after.points_balance, points_lifetime: after.points_lifetime };
}

module.exports = {
  TXN_TYPES, txnTypeLabel, buildLabel, parseLabel, labelTagFilter, refFilter, txnTypeFilter, loadTxnTypes,
  isUniqueViolation, recordPointsTxn, recordPointsTxnOnce,
};
