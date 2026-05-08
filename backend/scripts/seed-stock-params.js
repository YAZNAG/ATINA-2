/**
 * seed-stock-params.js
 * Seeds stock parameter lookup tables:
 *   StockStatus, InventoryType, InventoryStatus
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

// ── InventoryStatus ───────────────────────────────────────────────────────────

const INVENTORY_STATUSES = [
  { code: 'DRAFT',       name_fr: 'Brouillon',    name_ar: 'مسودة',           color: '#94a3b8', description_fr: 'Inventaire créé mais pas encore démarré.',                   is_active: true, sort_order: 1 },
  { code: 'IN_PROGRESS', name_fr: 'En cours',     name_ar: 'قيد التنفيذ',     color: '#3b82f6', description_fr: 'Comptage en cours — agents en train de scanner.',            is_active: true, sort_order: 2 },
  { code: 'PAUSED',      name_fr: 'En pause',     name_ar: 'معلّق',           color: '#f59e0b', description_fr: 'Inventaire temporairement suspendu.',                        is_active: true, sort_order: 3 },
  { code: 'COMPLETED',   name_fr: 'Terminé',      name_ar: 'مكتمل',           color: '#10b981', description_fr: 'Comptage terminé, en attente de validation.',               is_active: true, sort_order: 4 },
  { code: 'VALIDATED',   name_fr: 'Validé',       name_ar: 'مُعتمد',          color: '#059669', description_fr: 'Résultats validés et ajustements de stock appliqués.',       is_active: true, sort_order: 5 },
  { code: 'CANCELLED',   name_fr: 'Annulé',       name_ar: 'ملغى',            color: '#ef4444', description_fr: 'Inventaire annulé — aucun ajustement appliqué.',             is_active: true, sort_order: 6 },
  { code: 'PARTIAL',     name_fr: 'Partiel',      name_ar: 'جزئي',            color: '#8b5cf6', description_fr: 'Seule une partie du périmètre a été comptée.',               is_active: true, sort_order: 7 },
];

// ── InventoryGapType ──────────────────────────────────────────────────────────

const INVENTORY_GAP_TYPES = [
  { code: 'MISSING',      name_fr: 'Article manquant',        name_ar: 'مادة مفقودة',          description_fr: 'Article compté en moins par rapport au stock théorique.',           color: '#ef4444', impact_stock: 'NEGATIVE', requires_validation: false, is_active: true, sort_order: 1  },
  { code: 'SURPLUS',      name_fr: 'Surplus / Excédent',      name_ar: 'فائض',                  description_fr: 'Article compté en plus par rapport au stock théorique.',             color: '#10b981', impact_stock: 'POSITIVE', requires_validation: true,  is_active: true, sort_order: 2  },
  { code: 'DAMAGE',       name_fr: 'Avarie / Casse',          name_ar: 'تلف',                   description_fr: 'Article endommagé détecté lors du comptage.',                        color: '#f97316', impact_stock: 'NEGATIVE', requires_validation: false, is_active: true, sort_order: 3  },
  { code: 'INPUT_ERROR',  name_fr: 'Erreur de saisie',        name_ar: 'خطأ في الإدخال',        description_fr: 'Écart dû à une erreur de saisie ou de scan corrigée.',              color: '#6366f1', impact_stock: 'NEUTRAL',  requires_validation: false, is_active: true, sort_order: 4  },
  { code: 'EXPIRED',      name_fr: 'Péremption',              name_ar: 'انتهاء الصلاحية',       description_fr: 'Article détecté périmé et retiré du stock vendable.',                color: '#dc2626', impact_stock: 'NEGATIVE', requires_validation: false, is_active: true, sort_order: 5  },
  { code: 'DAMAGED',      name_fr: 'Produit détérioré',       name_ar: 'منتج تالف',             description_fr: 'Produit inutilisable suite à mauvaises conditions de stockage.',      color: '#b91c1c', impact_stock: 'NEGATIVE', requires_validation: true,  is_active: true, sort_order: 6  },
  { code: 'THEFT',        name_fr: 'Vol / Perte inexpliquée', name_ar: 'سرقة / فقدان',          description_fr: 'Disparition d\'articles sans explication logistique identifiée.',    color: '#7f1d1d', impact_stock: 'NEGATIVE', requires_validation: true,  is_active: true, sort_order: 7  },
  { code: 'MISPLACE',     name_fr: 'Mauvais emplacement',     name_ar: 'خطأ في الموضع',         description_fr: 'Article rangé au mauvais endroit — non perdu, juste mal localisé.',  color: '#f59e0b', impact_stock: 'NEUTRAL',  requires_validation: false, is_active: true, sort_order: 8  },
  { code: 'COUNT_DIFF',   name_fr: 'Différence de comptage',  name_ar: 'فارق العد',             description_fr: 'Écart entre deux comptages successifs, sans cause claire.',           color: '#8b5cf6', impact_stock: 'NEUTRAL',  requires_validation: true,  is_active: true, sort_order: 9  },
  { code: 'TRANSFER_GAP', name_fr: 'Écart de transfert',      name_ar: 'فارق النقل',            description_fr: 'Différence entre quantité expédiée et quantité reçue lors d\'un transfert.', color: '#3b82f6', impact_stock: 'NEGATIVE', requires_validation: true, is_active: true, sort_order: 10 },
  { code: 'RECEIPT_GAP',  name_fr: 'Écart de réception',      name_ar: 'فارق الاستلام',         description_fr: 'Différence entre quantité commandée fournisseur et quantité effectivement reçue.', color: '#0891b2', impact_stock: 'NEGATIVE', requires_validation: true, is_active: true, sort_order: 11 },
  { code: 'PREP_GAP',     name_fr: 'Écart de préparation',    name_ar: 'فارق التحضير',          description_fr: 'Différence constatée lors de la préparation de commandes clients.',   color: '#059669', impact_stock: 'NEGATIVE', requires_validation: false, is_active: true, sort_order: 12 },
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

  process.stdout.write('🗂️  InventoryStatuses… ');
  for (const d of INVENTORY_STATUSES) await upCode('inventoryStatus', d);
  console.log(`✓ ${INVENTORY_STATUSES.length}`);

  process.stdout.write('⚡ InventoryGapTypes… ');
  for (const d of INVENTORY_GAP_TYPES) await upCode('inventoryGapType', d);
  console.log(`✓ ${INVENTORY_GAP_TYPES.length}`);

  console.log('\n✅  Seed terminé!');
  console.log(`   StockStatuses:       ${STOCK_STATUSES.length}`);
  console.log(`   InventoryTypes:      ${INVENTORY_TYPES.length}`);
  console.log(`   InventoryStatuses:   ${INVENTORY_STATUSES.length}`);
  console.log(`   InventoryGapTypes:   ${INVENTORY_GAP_TYPES.length}\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
