#!/usr/bin/env node
/**
 * Stock d'ouverture des SKU qui n'en ont pas encore.
 *
 * Après l'ajout de nouveaux articles au catalogue (seed-demo, étapes « catalogue » et
 * « vente »), chaque couple node × SKU vendable existe mais sans stock : les produits
 * restent invisibles dans l'app. Ce script pose une quantité de départ en passant par
 * le service de stock, donc avec un mouvement tracé (stock_moves), comme une réception.
 *
 *   node scripts/stock-ouverture.js [--dry-run] [--nodes=CODE,CODE] [--qty=30]
 *
 * Idempotent : un couple qui a déjà un mouvement « OUVERTURE-<node>-<sku> » est ignoré.
 */
const prisma = require('../src/config/database');
const levelSvc = require('../src/modules/stock/stock_levels/stock_level.service');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const only = (args.find((a) => a.startsWith('--nodes=')) || '').slice(8).split(',').filter(Boolean);
const QTY = Number((args.find((a) => a.startsWith('--qty=')) || '--qty=30').slice(6));

/** Quantité d'ouverture selon le conditionnement (les gros formats partent plus bas). */
function qtyFor(sku) {
  const weight = Number(sku.weight_g || 0);
  if (weight >= 3000) return Math.max(6, Math.round(QTY / 5));
  if (weight >= 1000) return Math.max(10, Math.round(QTY / 2));
  return QTY;
}

async function main() {
  const nodes = await prisma.node.findMany({
    where: { is_deleted: false, is_active: true, ...(only.length ? { code: { in: only } } : {}) },
    select: { id: true, code: true },
    orderBy: { code: 'asc' },
  });
  if (!nodes.length) throw new Error('Aucun node actif');

  let created = 0;
  let skipped = 0;
  for (const node of nodes) {
    const rules = await prisma.sellingRule.findMany({
      where: { node_id: node.id, is_sellable: true },
      select: { sku_id: true, sku: { select: { sku_code: true, name_fr: true, weight_g: true, is_active: true, is_deleted: true } } },
    });
    for (const rule of rules) {
      const sku = rule.sku;
      if (!sku || !sku.is_active || sku.is_deleted) continue;
      const level = await prisma.stockLevel.findUnique({
        where: { node_id_sku_id: { node_id: node.id, sku_id: rule.sku_id } },
        select: { qty_physical: true },
      });
      if (level && Number(level.qty_physical) > 0) { skipped += 1; continue; }

      const reference = `OUVERTURE-${node.code}-${sku.sku_code}`;
      if (await prisma.stockMove.findFirst({ where: { reference } })) { skipped += 1; continue; }

      const qty = qtyFor(sku);
      console.log(`${DRY ? '[à faire]' : '[ok]'} ${node.code} ${sku.sku_code} -> ${qty}`);
      if (!DRY) {
        await levelSvc.adjust({
          node_id: node.id, sku_id: rule.sku_id, qty_physical: qty,
          reason: "Stock d'ouverture (nouveaux articles)", reference,
        });
      }
      created += 1;
    }
  }
  console.log(`${created} stock(s) d'ouverture${DRY ? ' à créer' : ' créés'}, ${skipped} déjà approvisionnés.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
