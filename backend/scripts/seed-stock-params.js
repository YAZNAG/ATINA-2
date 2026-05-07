/**
 * seed-stock-params.js
 * Seeds stock parameter lookup tables:
 *   StockStatus, InventoryType
 *
 * Run: node scripts/seed-stock-params.js
 * Safe to re-run (upsert on code).
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const upCode = (model, data) =>
  prisma[model].upsert({ where: { code: data.code }, update: {}, create: data });

// ── StockStatus ───────────────────────────────────────────────────────────────

const STOCK_STATUSES = [
  { code: 'AVAILABLE',  name_fr: 'Disponible',         name_ar: 'متاح',                  color: '#10b981', is_sellable: true,  is_active: true,  sort_order: 1 },
  { code: 'RESERVED',   name_fr: 'Réservé',            name_ar: 'محجوز',                  color: '#3b82f6', is_sellable: false, is_active: true,  sort_order: 2 },
  { code: 'BLOCKED',    name_fr: 'Bloqué',             name_ar: 'محظور',                  color: '#f59e0b', is_sellable: false, is_active: true,  sort_order: 3 },
  { code: 'DAMAGED',    name_fr: 'Endommagé',          name_ar: 'تالف',                   color: '#ef4444', is_sellable: false, is_active: true,  sort_order: 4 },
  { code: 'EXPIRED',    name_fr: 'Périmé / Expiré',   name_ar: 'منتهي الصلاحية',         color: '#dc2626', is_sellable: false, is_active: true,  sort_order: 5 },
  { code: 'QUARANTINE', name_fr: 'En quarantaine',     name_ar: 'في الحجر الصحي',         color: '#8b5cf6', is_sellable: false, is_active: true,  sort_order: 6 },
  { code: 'IN_TRANSIT', name_fr: 'En transit',         name_ar: 'في الطريق',              color: '#6366f1', is_sellable: false, is_active: true,  sort_order: 7 },
  { code: 'RETURNED',   name_fr: 'Retourné',           name_ar: 'مُرجع',                  color: '#f97316', is_sellable: false, is_active: true,  sort_order: 8 },
  { code: 'TO_DESTROY', name_fr: 'À détruire',         name_ar: 'للإتلاف',                color: '#78716c', is_sellable: false, is_active: true,  sort_order: 9 },
];

// ── InventoryType ─────────────────────────────────────────────────────────────

const INVENTORY_TYPES = [
  {
    code: 'INV_GLOBAL',      name_fr: 'Inventaire Global',          name_ar: 'جرد شامل',
    scope: 'GLOBAL',   color: '#6366f1',
    description_fr: 'Comptage complet de tous les articles sur l\'ensemble du stock.',
    is_active: true, sort_order: 1,
  },
  {
    code: 'INV_NODE',        name_fr: 'Inventaire par Node',        name_ar: 'جرد حسب الفرع',
    scope: 'NODE',     color: '#3b82f6',
    description_fr: 'Inventaire limité à un nœud logistique (dark store, hub, etc.).',
    is_active: true, sort_order: 2,
  },
  {
    code: 'INV_EMPLACEMENT', name_fr: 'Inventaire par Emplacement', name_ar: 'جرد حسب الموضع',
    scope: 'LOCATION', color: '#10b981',
    description_fr: 'Comptage ciblé sur un emplacement de stockage précis (rack, étagère).',
    is_active: true, sort_order: 3,
  },
  {
    code: 'INV_ZONE',        name_fr: 'Inventaire par Zone',        name_ar: 'جرد حسب المنطقة',
    scope: 'ZONE',     color: '#f59e0b',
    description_fr: 'Inventaire d\'une zone entière (zone sèche, zone frais, etc.).',
    is_active: true, sort_order: 4,
  },
  {
    code: 'INV_CATEGORIE',   name_fr: 'Inventaire par Catégorie',   name_ar: 'جرد حسب الفئة',
    scope: 'CATEGORY', color: '#8b5cf6',
    description_fr: 'Inventaire filtré par famille ou catégorie de produits.',
    is_active: true, sort_order: 5,
  },
  {
    code: 'INV_PARTIEL',     name_fr: 'Inventaire Partiel',         name_ar: 'جرد جزئي',
    scope: 'PARTIAL',  color: '#ef4444',
    description_fr: 'Contrôle portant sur un sous-ensemble d\'articles sélectionnés.',
    is_active: true, sort_order: 6,
  },
  {
    code: 'INV_TOURNANT',    name_fr: 'Inventaire Tournant',        name_ar: 'جرد دوري',
    scope: 'PARTIAL',  color: '#f97316',
    description_fr: 'Comptages cycliques continus — chaque article est compté périodiquement.',
    is_active: true, sort_order: 7,
  },
  {
    code: 'INV_FLASH',       name_fr: 'Inventaire Flash',           name_ar: 'جرد سريع',
    scope: 'PARTIAL',  color: '#dc2626',
    description_fr: 'Vérification rapide et ponctuelle sur un petit périmètre ciblé.',
    is_active: true, sort_order: 8,
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n⚙️  Seed Stock Parameters — démarrage…\n');

  process.stdout.write('📊 StockStatuses… ');
  for (const d of STOCK_STATUSES) await upCode('stockStatus', d);
  console.log(`✓ ${STOCK_STATUSES.length}`);

  process.stdout.write('📋 InventoryTypes… ');
  for (const d of INVENTORY_TYPES) await upCode('inventoryType', d);
  console.log(`✓ ${INVENTORY_TYPES.length}`);

  console.log('\n✅  Seed terminé!');
  console.log(`   StockStatuses:   ${STOCK_STATUSES.length}`);
  console.log(`   InventoryTypes:  ${INVENTORY_TYPES.length}\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
