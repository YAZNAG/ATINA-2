/**
 * seedInitialStock.js — Initialise le stock pour tous les nodes × SKUs actifs
 *
 * Usage:
 *   node scripts/seedInitialStock.js                  # Seed tous les nodes
 *   node scripts/seedInitialStock.js --node=DS-RBA-01 # Un seul node
 *   node scripts/seedInitialStock.js --qty=50          # Quantité par défaut
 *   node scripts/seedInitialStock.js --force           # Recréer même si existe
 */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// ── CLI arguments ──────────────────────────────────────────────────────────────
const args   = process.argv.slice(2);
const FORCE  = args.includes('--force');
const QTY    = parseInt(args.find(a => a.startsWith('--qty='))?.split('=')[1] ?? '100');
const NODE_CODE = args.find(a => a.startsWith('--node='))?.split('=')[1] ?? null;

// ── Counters ───────────────────────────────────────────────────────────────────
const C = { nodes:0, skus:0, levels:0, moves:0, lots:0, selling:0, reorder:0, threshold:0, locations:0, skipped:0, errors:0 };

function qty(base = QTY) {
  // Slight variation so each node doesn't look identical
  return base + Math.floor(Math.random() * 20);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═'.repeat(60));
  console.log('🏭  SEED STOCK INITIAL');
  console.log(`    qty=${QTY} | force=${FORCE} | node=${NODE_CODE ?? 'ALL'}`);
  console.log('═'.repeat(60));

  // ── Load references ──────────────────────────────────────────────────────────
  const nodeFilter = NODE_CODE
    ? { code: NODE_CODE, is_active: true, is_deleted: false }
    : { is_active: true, is_deleted: false };

  const [nodes, skus, moveTypeRow, fifo] = await Promise.all([
    p.node.findMany({ where: nodeFilter, select: { id: true, code: true, name_fr: true }, orderBy: { code: 'asc' } }),
    p.sku.findMany({
      where: { article: { is_active: true, is_deleted: false } },
      select: { id: true, article: { select: { sku_code: true, name_fr: true, price: true } } },
    }),
    p.moveType.findFirst({ where: { code: 'RECEP_FOURN' } }),
    p.costingMethod.findFirst({ where: { code: 'FIFO' } }),
  ]);

  if (!nodes.length) { console.log('\n❌ Aucun node trouvé'); return; }
  if (!skus.length)  { console.log('\n❌ Aucun SKU actif trouvé'); return; }
  if (!moveTypeRow)  { console.log('\n⚠  MoveType RECEP_FOURN introuvable — stock_moves ignorés'); }
  if (!fifo)         { console.log('\n⚠  Méthode FIFO introuvable'); }

  console.log(`\n📦 Nodes    : ${nodes.length}`);
  console.log(`📋 SKUs     : ${skus.length}`);
  console.log(`   Total combinaisons : ${nodes.length * skus.length}\n`);

  // ── Per node ─────────────────────────────────────────────────────────────────
  for (const node of nodes) {
    console.log(`\n─── ${node.name_fr} (${node.code}) ${'─'.repeat(40 - node.code.length)}`);
    C.nodes++;

    // Check for warehouse locations (for SkuNodeLocation)
    const locations = await p.warehouseLocation.findMany({
      where: { node_id: node.id, is_active: true },
      select: { id: true, code: true },
      take: 5,
    }).catch(() => []);

    if (!locations.length) {
      console.log(`   ℹ  Aucun emplacement entrepôt — sku_node_locations ignorés`);
    }

    // Load existing records to avoid duplicates
    const [existingLevels, existingSelling, existingReorder, existingThreshold] = await Promise.all([
      p.stockLevel.findMany({ where: { node_id: node.id }, select: { sku_id: true } }),
      p.sellingRule.findMany({ where: { node_id: node.id }, select: { sku_id: true } }),
      p.reorderRule.findMany({ where: { node_id: node.id }, select: { sku_id: true } }),
      p.stockThresholdRule.findMany({ where: { node_id: node.id }, select: { sku_id: true } }),
    ]);

    const existLevelSet    = new Set(existingLevels.map(r => r.sku_id));
    const existSellingSet  = new Set(existingSelling.map(r => r.sku_id));
    const existReorderSet  = new Set(existingReorder.map(r => r.sku_id));
    const existThreshSet   = new Set(existingThreshold.map(r => r.sku_id));

    // If --force, delete all existing for this node
    if (FORCE) {
      await Promise.all([
        p.stockLevel.deleteMany({ where: { node_id: node.id } }),
        p.sellingRule.deleteMany({ where: { node_id: node.id } }),
        p.reorderRule.deleteMany({ where: { node_id: node.id } }),
        p.stockThresholdRule.deleteMany({ where: { node_id: node.id } }),
        p.stockLot.deleteMany({ where: { node_id: node.id } }),
      ]);
      existLevelSet.clear(); existSellingSet.clear();
      existReorderSet.clear(); existThreshSet.clear();
      console.log(`   🗑  --force: données existantes supprimées`);
    }

    let nodeSkusDone = 0;

    for (const sku of skus) {
      C.skus++;
      const skuCode   = sku.article?.sku_code ?? sku.id.slice(0, 8);
      const skuPrice  = Number(sku.article?.price ?? 10);
      const costUnit  = parseFloat((skuPrice * 0.7).toFixed(4));
      const qtyPhys   = qty(QTY);
      const lotNumber = `INIT-${node.code}-${skuCode}`;

      try {
        // ── 1. Stock Level ─────────────────────────────────────────────────────
        let lastMoveId = null;

        if (!existLevelSet.has(sku.id)) {
          // ── 1a. Stock Lot (FIFO) ────────────────────────────────────────────
          const lot = await p.stockLot.create({
            data: {
              sku_id:       sku.id,
              node_id:      node.id,
              qty_initial:  qtyPhys,
              qty_remaining: qtyPhys,
              cost_unit:    costUnit,
              lot_number:   lotNumber,
              received_at:  new Date(),
              expiry_date:  null,
            },
          });
          C.lots++;

          // ── 1b. Stock Move ──────────────────────────────────────────────────
          if (moveTypeRow) {
            const move = await p.stockMove.create({
              data: {
                node_id:      node.id,
                sku_id:       sku.id,
                move_type_id: moveTypeRow.id,
                lot_id:       lot.id,
                qty_delta:    qtyPhys,
                reference:    lotNumber,
                reason:       'Initialisation stock — seed de test',
              },
            });
            lastMoveId = move.id;
            C.moves++;
          }

          // ── 1c. Stock Level ─────────────────────────────────────────────────
          await p.stockLevel.create({
            data: {
              node_id:         node.id,
              sku_id:          sku.id,
              qty_physical:    qtyPhys,
              qty_reserved:    0,
              qty_available:   qtyPhys,
              qty_backordered: 0,
              qty_incoming:    0,
              qty_floating_cod: 0,
              last_move_id:    lastMoveId,
            },
          });
          C.levels++;
          nodeSkusDone++;
        } else {
          C.skipped++;
        }

        // ── 2. Selling Rule ──────────────────────────────────────────────────
        if (!existSellingSet.has(sku.id)) {
          await p.sellingRule.create({
            data: {
              node_id:               node.id,
              sku_id:                sku.id,
              is_backorderable:      true,
              backorder_limit:       0,
              backordered_quantity:  0,
              estimated_restock_days: 2,
            },
          });
          C.selling++;
        }

        // ── 3. Reorder Rule ──────────────────────────────────────────────────
        if (!existReorderSet.has(sku.id) && fifo) {
          await p.reorderRule.create({
            data: {
              node_id:           node.id,
              sku_id:            sku.id,
              safety_stock:      10,
              reorder_point:     20,
              economic_qty:      100,
              max_stock:         300,
              lead_time_days:    2,
              costing_method_id: fifo.id,
              is_active:         true,
            },
          });
          C.reorder++;
        }

        // ── 4. Stock Threshold Rule ──────────────────────────────────────────
        if (!existThreshSet.has(sku.id)) {
          await p.stockThresholdRule.create({
            data: {
              node_id:               node.id,
              sku_id:                sku.id,
              stock_minimum:         10,
              stock_alert_threshold: 20,
              stock_maximum:         300,
              reorder_quantity:      100,
              auto_restock_enabled:  false,
              is_active:             true,
            },
          });
          C.threshold++;
        }

        // ── 5. Sku Node Location (si emplacement disponible) ─────────────────
        if (locations.length > 0) {
          const loc = locations[C.skus % locations.length]; // distribute across locations
          const existing = await p.skuNodeLocation.findFirst({
            where: { sku_id: sku.id, node_id: node.id, location_id: loc.id },
          });
          if (!existing) {
            await p.skuNodeLocation.create({
              data: {
                sku_id:              sku.id,
                node_id:             node.id,
                location_id:         loc.id,
                qty_physical:        qtyPhys,
                is_primary_location: true,
                is_active:           true,
              },
            });
            C.locations++;
          }
        }

      } catch (err) {
        console.error(`   ❌ Erreur ${skuCode}: ${err.message?.slice(0, 80)}`);
        C.errors++;
      }
    }

    if (nodeSkusDone > 0) {
      console.log(`   ✓ ${nodeSkusDone} SKUs initialisés (${skus.length - nodeSkusDone} déjà existants)`);
    } else {
      console.log(`   ℹ  Tous les SKUs existent déjà (utilisez --force pour recréer)`);
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`   Nodes traités      : ${C.nodes}`);
  console.log(`   SKUs traités       : ${C.skus}`);
  console.log(`   stock_levels créés : ${C.levels}`);
  console.log(`   stock_moves créés  : ${C.moves}`);
  console.log(`   stock_lots créés   : ${C.lots}`);
  console.log(`   selling_rules      : ${C.selling}`);
  console.log(`   reorder_rules      : ${C.reorder}`);
  console.log(`   seuils stock       : ${C.threshold}`);
  console.log(`   emplacements SKU   : ${C.locations}`);
  console.log(`   déjà existants     : ${C.skipped}`);
  if (C.errors) console.log(`   ❌ erreurs         : ${C.errors}`);
  console.log('═'.repeat(60));

  // ── Quick validation ─────────────────────────────────────────────────────────
  if (C.levels > 0) {
    const sample = await p.stockLevel.findFirst({
      include: {
        node: { select: { code: true } },
        sku:  { select: { article: { select: { sku_code: true } } } },
      },
    });
    if (sample) {
      console.log('\n✅ Validation — premier stock_level :');
      console.log(`   Node : ${sample.node?.code}`);
      console.log(`   SKU  : ${sample.sku?.article?.sku_code}`);
      console.log(`   qty_physical  = ${sample.qty_physical}`);
      console.log(`   qty_reserved  = ${sample.qty_reserved}`);
      console.log(`   qty_available = ${sample.qty_available}`);
    }
    const total = await p.stockLevel.count();
    console.log(`\n   Total stock_levels en base : ${total}`);
  }

  console.log('\n🎉 Stock initialisé avec succès!\n');
}

main().catch(e => {
  console.error('\n❌ Erreur fatale:', e.message);
  process.exit(1);
}).finally(() => p.$disconnect());
