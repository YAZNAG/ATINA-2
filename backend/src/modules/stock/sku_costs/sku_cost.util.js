/**
 * Coût moyen unitaire pondéré (CUMP) par SKU × node — US-047, WF #2 (étape 11).
 *
 * sku_cost_snapshots est alimenté par l'application après chaque réception de marchandises
 * qui modifie le coût moyen (Schema V3) :
 *   nouveau CUMP = (qté en stock avant × CUMP précédent + qté reçue × coût unitaire)
 *                  ÷ (qté avant + qté reçue)
 *   CUMP précédent = dernier snapshot du couple ; à défaut, coût moyen pondéré des lots
 *   restants (stock_lots.qty_remaining > 0) ; à défaut, coût du lot reçu.
 *
 * Méthode de valorisation (reorder_rules.costing_method_id du couple) : un snapshot est
 * inséré si la méthode est CUMP ou si aucune règle n'existe ; en FIFO, seul le lot
 * (stock_lots.cost_unit) porte la valorisation (« recalcul CUMP ou lot FIFO »).
 *
 * Quantités et coûts exprimés en UNITÉ DE VENTE (même base que stock_levels / stock_lots).
 */
const prisma = require('../../../config/database');

const N = (v) => Number(v ?? 0);
const r4 = (v) => Math.round((Number(v) + Number.EPSILON) * 10000) / 10000;
const r2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;

/** Dernier snapshot CUMP du couple (ou null). */
function latestSnapshot(client, sku_id, node_id) {
  return client.skuCostSnapshot.findFirst({
    where: { sku_id, node_id },
    orderBy: { computed_at: 'desc' },
  });
}

/** Coût moyen pondéré des lots restants du couple (null si aucun lot en stock). */
async function lotsAverageCost(client, sku_id, node_id, excludeLotId = null) {
  const lots = await client.stockLot.findMany({
    where: {
      sku_id, node_id, is_deleted: false, qty_remaining: { gt: 0 },
      ...(excludeLotId ? { id: { not: excludeLotId } } : {}),
    },
    select: { qty_remaining: true, cost_unit: true },
  });
  const qty = lots.reduce((s, l) => s + N(l.qty_remaining), 0);
  if (qty <= 0) return null;
  return r4(lots.reduce((s, l) => s + N(l.qty_remaining) * N(l.cost_unit), 0) / qty);
}

/** Code de la méthode de valorisation du couple (CUMP / FIFO) ou null si aucune règle. */
async function costingMethodOf(client, sku_id, node_id) {
  const rule = await client.reorderRule.findUnique({
    where: { node_id_sku_id: { node_id, sku_id } },
    select: { costing_method: { select: { code: true, name_fr: true } } },
  });
  return rule?.costing_method?.code ? String(rule.costing_method.code).toUpperCase() : null;
}

/** CUMP courant du couple : dernier snapshot, sinon moyenne des lots restants. */
async function currentCump(client, sku_id, node_id) {
  const snap = await latestSnapshot(client, sku_id, node_id);
  if (snap) return { cump: N(snap.cump), source: 'snapshot', computed_at: snap.computed_at };
  const avg = await lotsAverageCost(client, sku_id, node_id);
  if (avg !== null) return { cump: avg, source: 'lots', computed_at: null };
  return { cump: null, source: null, computed_at: null };
}

/**
 * Recalcule le CUMP après une réception (à appeler dans la transaction de réception,
 * APRÈS création du lot et du mouvement).
 * @returns {{ method, cump_before, cump, snapshot_id }}
 */
async function recordReceiptCump(tx, {
  sku_id, node_id, qty_before, qty_received, cost_unit, move_id, lot_id,
}) {
  const method = await costingMethodOf(tx, sku_id, node_id);
  const snap = await latestSnapshot(tx, sku_id, node_id);
  let cumpBefore = snap ? N(snap.cump) : await lotsAverageCost(tx, sku_id, node_id, lot_id);
  if (cumpBefore === null) cumpBefore = N(cost_unit);

  const before = Math.max(0, N(qty_before));
  const received = N(qty_received);
  const total = before + received;
  const cump = total > 0 ? r4((before * cumpBefore + received * N(cost_unit)) / total) : r4(cost_unit);

  let snapshot_id = null;
  if (method === null || method === 'CUMP') {
    const created = await tx.skuCostSnapshot.create({
      data: { sku_id, node_id, cump, computed_at: new Date(), triggered_by_move_id: move_id || null },
    });
    snapshot_id = created.id;
  }
  return { method: method || 'CUMP', method_source: method ? 'reorder_rule' : 'defaut', cump_before: r4(cumpBefore), cump, snapshot_id };
}

/** Historique CUMP d'un couple (plus récent d'abord). */
async function history(client, sku_id, node_id, limit = 20) {
  const rows = await client.skuCostSnapshot.findMany({
    where: { sku_id, node_id },
    orderBy: { computed_at: 'desc' },
    take: Math.min(200, Math.max(1, Number(limit) || 20)),
    include: {
      triggered_by_move: {
        select: {
          id: true, qty_delta: true, reference: true, created_at: true,
          lot: { select: { id: true, lot_number: true, cost_unit: true } },
          po_item: { select: { id: true, po: { select: { id: true, reference: true } } } },
        },
      },
    },
  });
  return rows.map((s) => ({
    id: s.id,
    cump: N(s.cump),
    computed_at: s.computed_at,
    triggered_by_move_id: s.triggered_by_move_id,
    move: s.triggered_by_move ? {
      id: s.triggered_by_move.id,
      qty_delta: N(s.triggered_by_move.qty_delta),
      reference: s.triggered_by_move.reference,
      created_at: s.triggered_by_move.created_at,
      lot_number: s.triggered_by_move.lot?.lot_number ?? null,
      cost_unit: s.triggered_by_move.lot ? N(s.triggered_by_move.lot.cost_unit) : null,
      po: s.triggered_by_move.po_item?.po ?? null,
    } : null,
  }));
}

/** Synthèse valorisation d'un couple SKU × node (fiche Détail SKU×Node). */
async function costSummary({ sku_id, node_id, limit = 20 } = {}, client = prisma) {
  const [cur, method, level, snapshots] = await Promise.all([
    currentCump(client, sku_id, node_id),
    costingMethodOf(client, sku_id, node_id),
    client.stockLevel.findUnique({ where: { node_id_sku_id: { node_id, sku_id } }, select: { qty_physical: true } }),
    history(client, sku_id, node_id, limit),
  ]);
  const qty = N(level?.qty_physical);
  return {
    sku_id,
    node_id,
    costing_method: method || 'CUMP',
    costing_method_source: method ? 'reorder_rule' : 'defaut',
    cump: cur.cump,
    cump_source: cur.source,
    cump_computed_at: cur.computed_at,
    qty_physical: qty,
    stock_value: cur.cump === null ? null : r2(qty * cur.cump),
    snapshots,
  };
}

/** CUMP courant de plusieurs SKU d'un node : { [sku_id]: { cump, computed_at } }. */
async function latestBySkus(client, node_id, skuIds) {
  const ids = [...new Set(skuIds)].filter(Boolean);
  if (!ids.length) return {};
  const rows = await client.skuCostSnapshot.findMany({
    where: { node_id, sku_id: { in: ids } },
    orderBy: { computed_at: 'desc' },
    select: { sku_id: true, cump: true, computed_at: true },
  });
  const out = {};
  for (const r of rows) if (!out[r.sku_id]) out[r.sku_id] = { cump: N(r.cump), computed_at: r.computed_at };
  return out;
}

module.exports = {
  latestSnapshot, lotsAverageCost, costingMethodOf, currentCump, recordReceiptCump, history, costSummary, latestBySkus,
};
