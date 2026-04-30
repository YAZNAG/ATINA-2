const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const CATALOG_PERMISSIONS = [
  // Families
  { name: 'Voir les familles', code: 'families.view', module: 'catalog', description: 'Voir la liste des familles' },
  { name: 'Créer des familles', code: 'families.create', module: 'catalog', description: 'Créer de nouvelles familles' },
  { name: 'Modifier les familles', code: 'families.update', module: 'catalog', description: 'Modifier les familles' },
  { name: 'Supprimer les familles', code: 'families.delete', module: 'catalog', description: 'Supprimer les familles' },
  // Categories
  { name: 'Voir les catégories', code: 'categories.view', module: 'catalog', description: '' },
  { name: 'Créer des catégories', code: 'categories.create', module: 'catalog', description: '' },
  { name: 'Modifier les catégories', code: 'categories.update', module: 'catalog', description: '' },
  { name: 'Supprimer les catégories', code: 'categories.delete', module: 'catalog', description: '' },
  // Sub-categories
  { name: 'Voir les sous-catégories', code: 'sub_categories.view', module: 'catalog', description: '' },
  { name: 'Créer des sous-catégories', code: 'sub_categories.create', module: 'catalog', description: '' },
  { name: 'Modifier les sous-catégories', code: 'sub_categories.update', module: 'catalog', description: '' },
  { name: 'Supprimer les sous-catégories', code: 'sub_categories.delete', module: 'catalog', description: '' },
  // Brands
  { name: 'Voir les marques', code: 'brands.view', module: 'catalog', description: '' },
  { name: 'Créer des marques', code: 'brands.create', module: 'catalog', description: '' },
  { name: 'Modifier les marques', code: 'brands.update', module: 'catalog', description: '' },
  { name: 'Supprimer les marques', code: 'brands.delete', module: 'catalog', description: '' },
  // Units
  { name: 'Voir les unités', code: 'units.view', module: 'catalog', description: '' },
  { name: 'Créer des unités', code: 'units.create', module: 'catalog', description: '' },
  { name: 'Modifier les unités', code: 'units.update', module: 'catalog', description: '' },
  { name: 'Supprimer les unités', code: 'units.delete', module: 'catalog', description: '' },
  // Packaging
  { name: 'Voir les conditionnements', code: 'packaging_types.view', module: 'catalog', description: '' },
  { name: 'Créer des conditionnements', code: 'packaging_types.create', module: 'catalog', description: '' },
  { name: 'Modifier les conditionnements', code: 'packaging_types.update', module: 'catalog', description: '' },
  { name: 'Supprimer les conditionnements', code: 'packaging_types.delete', module: 'catalog', description: '' },
  // Conservation
  { name: 'Voir les types de conservation', code: 'conservation_types.view', module: 'catalog', description: '' },
  { name: 'Créer des types de conservation', code: 'conservation_types.create', module: 'catalog', description: '' },
  { name: 'Modifier les types de conservation', code: 'conservation_types.update', module: 'catalog', description: '' },
  { name: 'Supprimer les types de conservation', code: 'conservation_types.delete', module: 'catalog', description: '' },
  // Article types
  { name: "Voir les types d'articles", code: 'article_types.view', module: 'catalog', description: '' },
  { name: "Créer des types d'articles", code: 'article_types.create', module: 'catalog', description: '' },
  { name: "Modifier les types d'articles", code: 'article_types.update', module: 'catalog', description: '' },
  { name: "Supprimer les types d'articles", code: 'article_types.delete', module: 'catalog', description: '' },
  // Article statuses
  { name: "Voir les statuts d'articles", code: 'article_statuses.view', module: 'catalog', description: '' },
  { name: "Créer des statuts d'articles", code: 'article_statuses.create', module: 'catalog', description: '' },
  { name: "Modifier les statuts d'articles", code: 'article_statuses.update', module: 'catalog', description: '' },
  { name: "Supprimer les statuts d'articles", code: 'article_statuses.delete', module: 'catalog', description: '' },
  // Taxes
  { name: 'Voir les TVA', code: 'taxes.view', module: 'catalog', description: '' },
  { name: 'Créer des TVA', code: 'taxes.create', module: 'catalog', description: '' },
  { name: 'Modifier les TVA', code: 'taxes.update', module: 'catalog', description: '' },
  { name: 'Supprimer les TVA', code: 'taxes.delete', module: 'catalog', description: '' },
  // Articles
  { name: 'Voir les articles', code: 'articles.view', module: 'catalog', description: '' },
  { name: 'Créer des articles', code: 'articles.create', module: 'catalog', description: '' },
  { name: 'Modifier les articles', code: 'articles.update', module: 'catalog', description: '' },
  { name: 'Supprimer les articles', code: 'articles.delete', module: 'catalog', description: '' },
  { name: "Gérer les images d'articles", code: 'article_images.manage', module: 'catalog', description: '' },
];

const LOCATION_NODE_PERMISSIONS = [
  { name: 'Voir les régions', code: 'regions.view', module: 'location', description: '' },
  { name: 'Créer des régions', code: 'regions.create', module: 'location', description: '' },
  { name: 'Modifier les régions', code: 'regions.update', module: 'location', description: '' },
  { name: 'Supprimer les régions', code: 'regions.delete', module: 'location', description: '' },
  { name: 'Voir les provinces', code: 'provinces.view', module: 'location', description: '' },
  { name: 'Créer des provinces', code: 'provinces.create', module: 'location', description: '' },
  { name: 'Modifier les provinces', code: 'provinces.update', module: 'location', description: '' },
  { name: 'Voir les villes', code: 'cities.view', module: 'location', description: '' },
  { name: 'Créer des villes', code: 'cities.create', module: 'location', description: '' },
  { name: 'Modifier les villes', code: 'cities.update', module: 'location', description: '' },
  { name: 'Voir les types node', code: 'node_types.view', module: 'node', description: '' },
  { name: 'Créer des types node', code: 'node_types.create', module: 'node', description: '' },
  { name: 'Voir les nodes', code: 'nodes.view', module: 'node', description: '' },
  { name: 'Créer des nodes', code: 'nodes.create', module: 'node', description: '' },
  { name: 'Modifier les nodes', code: 'nodes.update', module: 'node', description: '' },
  { name: 'Supprimer les nodes', code: 'nodes.delete', module: 'node', description: '' },
  { name: 'Voir les créneaux', code: 'delivery_slots.view', module: 'node', description: '' },
  { name: 'Créer des créneaux', code: 'delivery_slots.create', module: 'node', description: '' },
  { name: 'Modifier les créneaux', code: 'delivery_slots.update', module: 'node', description: '' },
  { name: 'Supprimer les créneaux', code: 'delivery_slots.delete', module: 'node', description: '' },
];

async function seedCatalogPermissions() {
  console.log('Seeding catalog permissions...');
  for (const perm of [...CATALOG_PERMISSIONS, ...LOCATION_NODE_PERMISSIONS]) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  // Assign all new permissions to Super Admin
  const superAdmin = await prisma.role.findUnique({ where: { code: 'super_admin' } });
  if (superAdmin) {
    const allPerms = await prisma.permission.findMany();
    for (const perm of allPerms) {
      await prisma.rolePermission.upsert({
        where: { role_id_permission_id: { role_id: superAdmin.id, permission_id: perm.id } },
        update: {},
        create: { role_id: superAdmin.id, permission_id: perm.id },
      });
    }
  }
  console.log(`${CATALOG_PERMISSIONS.length + LOCATION_NODE_PERMISSIONS.length} permissions created.`);
}

async function seedFamilies() {
  const families = [
    { name_fr: 'Épicerie', name_ar: 'بقالة', code: 'FAM001', status: 'active', sort_order: 1 },
    { name_fr: 'Boissons', name_ar: 'مشروبات', code: 'FAM002', status: 'active', sort_order: 2 },
    { name_fr: 'Produits frais', name_ar: 'منتجات طازجة', code: 'FAM003', status: 'active', sort_order: 3 },
    { name_fr: 'Hygiène', name_ar: 'النظافة', code: 'FAM004', status: 'active', sort_order: 4 },
    { name_fr: 'Entretien maison', name_ar: 'تنظيف المنزل', code: 'FAM005', status: 'active', sort_order: 5 },
  ];
  const created = {};
  for (const f of families) {
    const fam = await prisma.family.upsert({ where: { code: f.code }, update: {}, create: f });
    created[f.code] = fam.id;
  }

  const categories = [
    { family_code: 'FAM001', name_fr: 'Sucre', name_ar: 'سكر', code: 'CAT001', sort_order: 1 },
    { family_code: 'FAM001', name_fr: 'Farine', name_ar: 'دقيق', code: 'CAT002', sort_order: 2 },
    { family_code: 'FAM001', name_fr: 'Huiles', name_ar: 'زيوت', code: 'CAT003', sort_order: 3 },
    { family_code: 'FAM001', name_fr: 'Pâtes alimentaires', name_ar: 'معجنات غذائية', code: 'CAT004', sort_order: 4 },
    { family_code: 'FAM002', name_fr: 'Eau', name_ar: 'ماء', code: 'CAT005', sort_order: 1 },
    { family_code: 'FAM002', name_fr: 'Jus', name_ar: 'عصائر', code: 'CAT006', sort_order: 2 },
    { family_code: 'FAM002', name_fr: 'Sodas', name_ar: 'مشروبات غازية', code: 'CAT007', sort_order: 3 },
  ];
  const catCreated = {};
  for (const c of categories) {
    const cat = await prisma.category.upsert({
      where: { code: c.code },
      update: {},
      create: { name_fr: c.name_fr, name_ar: c.name_ar, code: c.code, family_id: created[c.family_code], sort_order: c.sort_order, status: 'active' },
    });
    catCreated[c.code] = cat.id;
  }

  const subCategories = [
    { cat_code: 'CAT001', name_fr: 'Sucre en poudre', name_ar: 'سكر سنيدة', code: 'SUB001' },
    { cat_code: 'CAT001', name_fr: 'Sucre en morceaux', name_ar: 'سكر قوالب', code: 'SUB002' },
    { cat_code: 'CAT001', name_fr: 'Sucre carton', name_ar: 'سكر كرتون', code: 'SUB003' },
    { cat_code: 'CAT005', name_fr: 'Eau minérale', name_ar: 'ماء معدني', code: 'SUB004' },
    { cat_code: 'CAT005', name_fr: 'Eau de table', name_ar: 'ماء المائدة', code: 'SUB005' },
  ];
  for (const s of subCategories) {
    await prisma.subCategory.upsert({
      where: { code: s.code },
      update: {},
      create: { name_fr: s.name_fr, name_ar: s.name_ar, code: s.code, category_id: catCreated[s.cat_code], sort_order: 0, status: 'active' },
    });
  }
  console.log('Families, categories, sub-categories created.');
}

async function seedBrands() {
  const brands = [
    { name_fr: 'Sidi Ali', name_ar: 'سيدي علي', code: 'BRD001' },
    { name_fr: 'Aïn Saïss', name_ar: 'عين سايس', code: 'BRD002' },
    { name_fr: 'Centrale Danone', name_ar: 'سنطرال دانون', code: 'BRD003' },
    { name_fr: 'Aïcha', name_ar: 'عائشة', code: 'BRD004' },
    { name_fr: 'Dari', name_ar: 'داري', code: 'BRD005' },
  ];
  for (const b of brands) {
    await prisma.brand.upsert({ where: { code: b.code }, update: {}, create: { ...b, status: 'active' } });
  }
  console.log('Brands created.');
}

async function seedUnits() {
  const units = [
    { name_fr: 'Pièce', name_ar: 'قطعة', short_name_fr: 'Pce', short_name_ar: 'قطعة', code: 'UNT001' },
    { name_fr: 'Kilogramme', name_ar: 'كيلوغرام', short_name_fr: 'Kg', short_name_ar: 'كغ', code: 'UNT002' },
    { name_fr: 'Gramme', name_ar: 'غرام', short_name_fr: 'g', short_name_ar: 'غ', code: 'UNT003' },
    { name_fr: 'Litre', name_ar: 'لتر', short_name_fr: 'L', short_name_ar: 'ل', code: 'UNT004' },
    { name_fr: 'Carton', name_ar: 'كرتون', short_name_fr: 'Ctn', short_name_ar: 'كرتون', code: 'UNT005' },
    { name_fr: 'Pack', name_ar: 'حزمة', short_name_fr: 'Pack', short_name_ar: 'حزمة', code: 'UNT006' },
  ];
  for (const u of units) {
    await prisma.unit.upsert({ where: { code: u.code }, update: {}, create: { ...u, status: 'active' } });
  }
  console.log('Units created.');
}

async function seedConservationTypes() {
  const types = [
    { name_fr: 'Sec', name_ar: 'جاف', code: 'CON001' },
    { name_fr: 'Frais', name_ar: 'طازج', code: 'CON002', min_temperature: 0, max_temperature: 8 },
    { name_fr: 'Surgelé', name_ar: 'مجمد', code: 'CON003', min_temperature: -25, max_temperature: -18 },
    { name_fr: 'Fragile', name_ar: 'قابل للكسر', code: 'CON004' },
  ];
  for (const t of types) {
    await prisma.conservationType.upsert({ where: { code: t.code }, update: {}, create: { ...t, status: 'active' } });
  }
  console.log('Conservation types created.');
}

async function seedArticleStatuses() {
  const statuses = [
    { name_fr: 'Actif', name_ar: 'نشط', code: 'STA001', color: '#10b981' },
    { name_fr: 'Inactif', name_ar: 'غير نشط', code: 'STA002', color: '#ef4444' },
    { name_fr: 'Brouillon', name_ar: 'مسودة', code: 'STA003', color: '#f59e0b' },
    { name_fr: 'Archivé', name_ar: 'مؤرشف', code: 'STA004', color: '#6b7280' },
  ];
  for (const s of statuses) {
    await prisma.articleStatus.upsert({ where: { code: s.code }, update: {}, create: s });
  }
  console.log('Article statuses created.');
}

async function seedTaxes() {
  const taxes = [
    { name_fr: 'Exonéré', name_ar: 'معفى', code: 'TVA000', rate: 0 },
    { name_fr: 'TVA 7%', name_ar: 'ضريبة 7%', code: 'TVA007', rate: 7 },
    { name_fr: 'TVA 10%', name_ar: 'ضريبة 10%', code: 'TVA010', rate: 10 },
    { name_fr: 'TVA 14%', name_ar: 'ضريبة 14%', code: 'TVA014', rate: 14 },
    { name_fr: 'TVA 20%', name_ar: 'ضريبة 20%', code: 'TVA020', rate: 20 },
  ];
  for (const t of taxes) {
    await prisma.tax.upsert({ where: { code: t.code }, update: {}, create: { ...t, status: 'active' } });
  }
  console.log('Taxes created.');
}

async function seedArticleTypes() {
  const types = [
    { name_fr: 'Standard', name_ar: 'عادي', code: 'TYP001' },
    { name_fr: 'Promotionnel', name_ar: 'ترويجي', code: 'TYP002' },
    { name_fr: 'Consigné', name_ar: 'مُودَع', code: 'TYP003' },
    { name_fr: 'Service', name_ar: 'خدمة', code: 'TYP004' },
  ];
  for (const t of types) {
    await prisma.articleType.upsert({ where: { code: t.code }, update: {}, create: { ...t, status: 'active' } });
  }
  console.log('Article types created.');
}

async function seedNodeTypes() {
  const types = [
    { code: 'dark_store', name_fr: 'Dark Store', name_ar: 'دارك ستور' },
    { code: 'warehouse', name_fr: 'Entrepôt', name_ar: 'مستودع' },
    { code: 'relay_point', name_fr: 'Point relais', name_ar: 'نقطة تسليم' },
  ];
  for (const t of types) {
    await prisma.nodeType.upsert({ where: { code: t.code }, update: {}, create: t });
  }
  console.log('Node types created.');
}

async function main() {
  await seedCatalogPermissions();
  await seedFamilies();
  await seedBrands();
  await seedUnits();
  await seedConservationTypes();
  await seedArticleStatuses();
  await seedTaxes();
  await seedArticleTypes();
  await seedNodeTypes();
  console.log('Catalog seeding complete!');
}

module.exports = { main };

if (require.main === module) {
  require('dotenv').config();
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}
