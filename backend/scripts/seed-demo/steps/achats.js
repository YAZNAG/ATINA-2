/**
 * Étape « achats » : alimente le stock de chaque node par des bons de commande
 * RÉELLEMENT réceptionnés via le service purchasing (lots, DLC, emplacements, CUMP),
 * plus des BC dans tous les statuts. Repère d'idempotence : « [DEMO:PO:…] » en notes.
 */
const { RUPTURE, LOW, suppliersFor, SUPPLIERS } = require('../data/scenario.data');
const { unitCost } = require('./fournisseurs');
const { dateOnly, daysAgo, addDays, seedOf, rng } = require('../lib/util');

const poService = () => require('../../../src/modules/purchasing/purchase_orders.service');

function qtyFor(s, low) {
  if (low) return s.coeff > 1 ? 1 : 4;
  if (s.coeff >= 20) return 2;
  if (s.coeff > 1) return 3;
  return ['VIA-AGN-COT', 'VOL-POU-FER', 'COU-PAM-T3', 'COU-PAM-T4', 'HUI-LES-5L', 'LES-TID-3KG', 'OEU-ATI-30'].includes(s.code) ? 15 : 30;
}

function expiryFor(s, r) {
  const fam = s.sub.split('-')[0];
  if (s.cons === 'SURG') return dateOnly(addDays(new Date(), 150 + r.int(0, 60)));
  if (fam === 'BOU') return dateOnly(addDays(new Date(), 4 + r.int(0, 3)));
  if (fam === 'BLG') return dateOnly(addDays(new Date(), 3 + r.int(0, 3)));
  if (fam === 'FRL') return dateOnly(addDays(new Date(), 6 + r.int(0, 6)));
  if (s.cons === 'FRAIS') return dateOnly(addDays(new Date(), 10 + r.int(0, 12)));
  return dateOnly(addDays(new Date(), 240 + r.int(0, 300)));
}

async function findPo(prisma, marker) {
  return prisma.purchaseOrder.findFirst({ where: { notes: { startsWith: marker } }, include: { status: true, items: true } });
}

async function run(ctx) {
  const { prisma } = ctx;
  const [nodes, skus] = await Promise.all([ctx.nodes(), ctx.skus()]);
  const active = skus.filter((s) => s.status === 'active');
  const svc = poService();
  const req = ctx.dry ? null : await ctx.req();
  const suppliers = await ctx.byCode('supplier');
  const taxes = Object.fromEntries((await prisma.tax.findMany()).map((t) => [t.id, Number(t.rate)]));
  const price = (s, factor = 1) => Math.round(unitCost(s, taxes[s.row.tax_id] ?? 20) * s.coeff * factor * 100) / 100;

  /** Crée (si absent) puis amène le BC au statut visé. */
  async function ensurePo({ node, supplierCode, marker, title, lines, target, createdDays, receiveDays, partial = false, costFactor = 1 }) {
    let po = await findPo(prisma, marker);
    if (ctx.dry) { if (!po) ctx.count('purchase_orders'); return; }
    const supplier = suppliers[supplierCode];
    if (!po) {
      const created = await svc.create({
        supplier_id: supplier.id, node_id: node.id, notes: `${marker} ${title}`,
        expected_at: dateOnly(addDays(daysAgo(createdDays), SUPPLIERS.find((x) => x.code === supplierCode).lead)),
        validate: target !== 'draft' && target !== 'cancelled_draft',
        items: lines.map((l) => ({ sku_id: l.s.id, qty_ordered: l.qty, unit_price_ht: price(l.s, costFactor) })),
      }, req);
      ctx.count('purchase_orders');
      ctx.count('purchase_order_items', lines.length);
      const at = daysAgo(createdDays, 9, 30);
      await prisma.purchaseOrder.update({ where: { id: created.id }, data: { created_at: at, ...(created.ordered_at ? { ordered_at: at } : {}) } });
      po = await findPo(prisma, marker);
    }
    const code = po.status.code;
    if (target === 'draft' || code === target) return po;
    if (target === 'cancelled_draft') {
      if (code === 'draft') await svc.changeStatus(po.id, { status: 'cancelled', reason: 'Doublon avec un autre bon de commande' }, req);
      return po;
    }
    if (target === 'in_transit' && code === 'sent') { await svc.changeStatus(po.id, { status: 'in_transit', reason: 'Camion parti de l’entrepôt fournisseur' }, req); return po; }
    if (['received', 'partially_received'].includes(target) && ['sent', 'in_transit'].includes(code)) {
      const r = rng(seedOf(marker));
      const snl = await prisma.skuNodeLocation.findMany({ where: { node_id: node.id, is_primary_location: true, sku_id: { in: po.items.map((i) => i.sku_id) } } });
      const locBySku = Object.fromEntries(snl.map((x) => [x.sku_id, x.location_id]));
      const bySku = Object.fromEntries(lines.map((l) => [l.s.id, l.s]));
      const items = partial ? po.items.filter((_, i) => i % 2 === 0) : po.items;
      await svc.receive(po.id, {
        received_at: dateOnly(daysAgo(receiveDays)),
        notes: partial ? 'Livraison partielle, reliquat attendu' : 'Livraison conforme',
        lines: items.map((it) => {
          const s = bySku[it.sku_id];
          const fresh = s.cons !== 'AMB' || ['FRL', 'BLG'].includes(s.sub.split('-')[0]);
          return {
            item_id: it.id,
            qty_received: partial ? Math.max(1, Math.floor(Number(it.qty_ordered) / 2)) : Number(it.qty_ordered),
            lot_number: `L${dateOnly(daysAgo(receiveDays)).replace(/-/g, '').slice(2)}-${s.code.split('-')[0]}${r.int(100, 999)}`,
            expiry_date: fresh || r() < 0.5 ? expiryFor(s, r) : null,
            location_id: locBySku[it.sku_id] || null,
          };
        }),
      }, req);
      ctx.count('receptions');
    }
    return po;
  }

  for (const node of nodes) {
    const rupture = RUPTURE[node.code] || [];
    const low = LOW[node.code] || [];
    const bySupplier = {};
    for (const s of active) {
      if (rupture.includes(s.code)) continue;
      const sup = suppliersFor(s.sub)[0].code;
      (bySupplier[sup] = bySupplier[sup] || []).push({ s, qty: qtyFor(s, low.includes(s.code)) });
    }
    // 1. Réassort initial réceptionné (J-26 → J-24)
    for (const [i, [sup, lines]] of Object.entries(bySupplier).entries()) {
      await ensurePo({
        node, supplierCode: sup, marker: `[DEMO:PO:${node.short}:INIT:${sup}]`, title: 'Réassort initial du dark store',
        lines, target: 'received', createdDays: 28 - (i % 3), receiveDays: 25 - (i % 3),
      });
    }
    // 2. Réassorts hebdomadaires (nouveaux lots, CUMP recalculé)
    const weekly = [
      ['SUP-DISTRILAIT', 12, 10, 1.03],
      ['SUP-PRIMEURS', 8, 6, 0.97],
      ['SUP-ATLASBOISSONS', 5, 4, 1.02],
    ];
    for (const [sup, created, received, factor] of weekly) {
      const lines = (bySupplier[sup] || []).filter((l) => !low.includes(l.s.code)).slice(0, 6).map((l) => ({ s: l.s, qty: Math.max(1, Math.ceil(l.qty / 2)) }));
      if (!lines.length) continue;
      await ensurePo({ node, supplierCode: sup, marker: `[DEMO:PO:${node.short}:HEBDO:${sup}]`, title: 'Réassort hebdomadaire', lines, target: 'received', createdDays: created, receiveDays: received, costFactor: factor });
    }
    // 3. Ruptures : BC ouverts (envoyé / en transit) → qty_incoming
    const ruptBySup = {};
    for (const code of rupture) {
      const s = active.find((x) => x.code === code);
      if (!s) continue;
      const sup = suppliersFor(s.sub)[0].code;
      (ruptBySup[sup] = ruptBySup[sup] || []).push({ s, qty: qtyFor(s, false) });
    }
    for (const [i, [sup, lines]] of Object.entries(ruptBySup).entries()) {
      await ensurePo({ node, supplierCode: sup, marker: `[DEMO:PO:${node.short}:RUPT:${sup}]`, title: 'Réappro urgente (rupture)', lines, target: i % 2 ? 'in_transit' : 'sent', createdDays: 2 });
    }
    // 4. Autres statuts : brouillon, partiellement reçu, annulé
    const pick = (sup, n) => (bySupplier[sup] || []).filter((l) => !low.includes(l.s.code)).slice(0, n);
    const draftLines = pick('SUP-HYGIPRO', 3);
    if (draftLines.length) await ensurePo({ node, supplierCode: 'SUP-HYGIPRO', marker: `[DEMO:PO:${node.short}:DRAFT]`, title: 'Proposition de commande (à valider)', lines: draftLines, target: 'draft', createdDays: 1 });
    const partLines = pick('SUP-DOUCEURS', 4).map((l) => ({ s: l.s, qty: l.qty + 1 }));
    if (partLines.length) await ensurePo({ node, supplierCode: 'SUP-DOUCEURS', marker: `[DEMO:PO:${node.short}:PARTIEL]`, title: 'Commande épicerie sucrée', lines: partLines, target: 'partially_received', createdDays: 5, receiveDays: 3, partial: true });
    const cancLines = pick('SUP-GRANDNORD', 2);
    if (cancLines.length) await ensurePo({ node, supplierCode: 'SUP-GRANDNORD', marker: `[DEMO:PO:${node.short}:ANNULE]`, title: 'Commande saisie en double', lines: cancLines, target: 'cancelled_draft', createdDays: 9 });
  }
}

module.exports = { name: 'achats', label: 'Bons de commande et réceptions (stock)', run };
