#!/usr/bin/env node
/**
 * Données de démonstration ATINA-2 — script unique, relançable (idempotent).
 *
 *   cd backend && node scripts/seed-demo/index.js [--only=etape[,etape]] [--dry-run] [--force-images]
 *
 * Variables : DATABASE_URL, BASE_URL (lues dans l'environnement ou backend/.env).
 * Toutes les opérations qui touchent au stock, aux points, aux compteurs ou aux statuts
 * passent par les services métier de l'application (voir steps/*.js).
 */
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL manquante'); process.exit(1); }
if (!process.env.BASE_URL) { console.error('BASE_URL manquante (ex. https://atina2.atina.ma)'); process.exit(1); }

const STEPS = [
  require('./steps/referentiels'),
  require('./steps/geographie'),
  require('./steps/acces'),
  require('./steps/catalogue'),
  require('./steps/images'),
  require('./steps/entrepot'),
  require('./steps/fournisseurs'),
  require('./steps/vente'),
  require('./steps/achats'),
  require('./steps/creneaux'),
  require('./steps/staff'),
  require('./steps/fidelite'),
  require('./steps/clients'),
  require('./steps/offres'),
  require('./steps/stock'),
  require('./steps/commandes'),
  require('./steps/extras'),
  require('./steps/parametres'),
];

/** Tables affichées dans le résumé final : [libellé, modèle Prisma]. */
const SUMMARY = [
  ['users', 'user'], ['roles', 'role'], ['permissions', 'permission'], ['role_permissions', 'rolePermission'], ['backoffice_admins', 'backofficeAdmin'],
  ['regions', 'region'], ['cities', 'city'], ['node_types', 'nodeType'], ['nodes', 'node'],
  ['units', 'unit'], ['taxes', 'tax'], ['conservation_types', 'conservationType'], ['packaging_types', 'packagingType'],
  ['sku_families', 'skuFamily'], ['sku_subfamilies', 'skuSubFamily'], ['categories', 'category'], ['brands', 'brand'],
  ['skus', 'sku'], ['sku_images', 'skuImage'],
  ['zones', 'zone'], ['levels', 'level'], ['locations', 'warehouseLocation'], ['sku_node_locations', 'skuNodeLocation'],
  ['selling_rules', 'sellingRule'], ['reorder_rules', 'reorderRule'], ['stock_threshold_rules', 'stockThresholdRule'],
  ['suppliers', 'supplier'], ['supplier_prices', 'supplierPrice'], ['purchase_orders', 'purchaseOrder'], ['purchase_order_items', 'purchaseOrderItem'],
  ['stock_levels', 'stockLevel'], ['stock_lots', 'stockLot'], ['stock_moves', 'stockMove'], ['sku_cost_snapshots', 'skuCostSnapshot'],
  ['stock_count_sessions', 'stockCountSession'], ['stock_count_lines', 'stockCountLine'],
  ['delivery_slots', 'deliverySlot'], ['pickers', 'picker'], ['drivers', 'driver'],
  ['customers', 'customer'], ['addresses', 'address'], ['referral_config', 'referralConfig'], ['referrals', 'referral'],
  ['packs', 'pack'], ['pack_items', 'packItem'], ['flash_sales', 'flashSale'], ['promotions (codes promo)', 'promotion'], ['coupon_redemptions', 'couponRedemption'],
  ['points_rules', 'pointsRule'], ['points_transactions', 'pointsTransaction'], ['points_exchange_skus', 'pointsExchangeSku'],
  ['gamification_games', 'gamificationGame'], ['gamification_prizes', 'gamificationPrize'], ['gamification_plays', 'gamificationPlay'],
  ['orders', 'order'], ['order_items', 'orderItem'], ['order_histories', 'orderHistory'], ['order_slot_preferences', 'orderSlotPreference'], ['payments', 'payment'],
  ['picking_sessions', 'pickingSession'], ['picking_session_items', 'pickingSessionItem'], ['quality_checks', 'qualityCheck'],
  ['tours', 'tour'], ['tour_stops', 'tourStop'], ['notifications', 'notification'],
  ['faq_categories', 'faqCategory'], ['faq_items', 'faqItem'], ['article_reviews', 'articleReview'], ['wishlists', 'wishlist'], ['claims', 'claim'],
  ['support_conversations', 'supportConversation'], ['support_messages', 'supportMessage'],
  ['app_configs', 'appConfig'], ['audit_logs', 'auditLog'],
];

function parseArgs(argv) {
  const out = { only: null, dry: false, forceImages: false };
  for (const a of argv) {
    if (a === '--dry-run') out.dry = true;
    else if (a === '--force-images') out.forceImages = true;
    else if (a.startsWith('--only=')) out.only = a.slice(7).split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--help' || a === '-h') out.help = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(`Étapes : ${STEPS.map((s) => s.name).join(', ')}\nOptions : --only=etape[,etape]  --dry-run  --force-images`);
    return;
  }
  const unknown = (args.only || []).filter((n) => !STEPS.some((s) => s.name === n));
  if (unknown.length) { console.error(`Étape(s) inconnue(s) : ${unknown.join(', ')}. Étapes : ${STEPS.map((s) => s.name).join(', ')}`); process.exit(1); }

  const prisma = require('../../src/config/database');
  const { createCtx } = require('./lib/ctx');
  const ctx = createCtx(prisma, { dry: args.dry });
  const started = Date.now();
  const errors = [];

  console.log(`\n=== Données de démonstration ATINA-2 ${args.dry ? '(DRY-RUN : aucune écriture)' : ''} ===`);
  console.log(`Base : ${process.env.DATABASE_URL.replace(/\/\/[^@]*@/, '//***@')} · BASE_URL : ${process.env.BASE_URL}\n`);

  for (const step of STEPS) {
    if (args.only && !args.only.includes(step.name)) continue;
    ctx.step = step.name;
    const t = Date.now();
    console.log(`▶ ${step.name} — ${step.label}`);
    try {
      await step.run(ctx, { force: args.forceImages });
      console.log(`  ✓ ${step.name} (${((Date.now() - t) / 1000).toFixed(1)} s)`);
    } catch (err) {
      const msg = err?.message || JSON.stringify(err);
      console.error(`  ✗ ${step.name} : ${msg}`);
      if (process.env.SEED_DEBUG) console.error(err);
      errors.push(`${step.name} : ${msg}`);
    }
  }

  const bucket = args.dry ? ctx.planned : ctx.created;
  console.log(`\n=== ${args.dry ? 'Ce qui serait créé' : 'Créé par ce lancement'} ===`);
  const keys = Object.keys(bucket).filter((k) => bucket[k] > 0).sort();
  if (!keys.length) console.log('  (rien : données déjà présentes)');
  for (const k of keys) console.log(`  ${k.padEnd(34)} ${bucket[k]}`);

  if (!args.dry) {
    console.log('\n=== Comptage par table (total en base) ===');
    for (const [label, model] of SUMMARY) {
      try { console.log(`  ${label.padEnd(34)} ${await prisma[model].count()}`); } catch { /* table absente */ }
    }
    const byStatus = await prisma.order.groupBy({ by: ['status_id'], _count: { _all: true } });
    const st = Object.fromEntries((await prisma.orderStatus.findMany()).map((s) => [s.id, s.code]));
    console.log(`  commandes par statut               ${byStatus.map((b) => `${st[b.status_id]}=${b._count._all}`).join(', ')}`);
  }
  if (ctx.notes.length) { console.log('\n=== Avertissements ==='); ctx.notes.forEach((n) => console.log(`  - ${n}`)); }
  if (errors.length) { console.log('\n=== Étapes en erreur ==='); errors.forEach((e) => console.log(`  - ${e}`)); }
  console.log(`\nTerminé en ${((Date.now() - started) / 1000).toFixed(1)} s.`);
  await prisma.$disconnect();
  process.exit(errors.length ? 2 : 0);
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
