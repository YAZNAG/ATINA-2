/**
 * Validations métier article : taxonomie et référentiels actifs.
 * Utilise les repositories des modules catalogue (pas de service catalogue monolithique).
 */
const familyRepo = require('../families/family.repository');
const categoryRepo = require('../categories/category.repository');
const subCategoryRepo = require('../subCategories/subCategory.repository');
const brandRepo = require('../brands/brand.repository');
const unitRepo = require('../units/unit.repository');
const packagingTypeRepo = require('../packagingTypes/packagingType.repository');
const conservationTypeRepo = require('../conservationTypes/conservationType.repository');
const articleTypeRepo = require('../articleTypes/articleType.repository');
const articleStatusRepo = require('../articleStatuses/articleStatus.repository');
const taxRepo = require('../taxes/tax.repository');

const bad = (message) => {
  throw { statusCode: 400, message };
};

const isActive = (row, statusField = 'status') => row && row[statusField] === 'active';

async function assertFamilyRef(id) {
  if (id == null) return;
  const row = await familyRepo.findById(Number(id));
  if (!row) bad('Famille inexistante ou supprimée');
  if (!isActive(row)) bad('La famille n’est pas active');
}

/**
 * Normalise et valide family_id, category_id, sub_category_id (cohérence hiérarchique).
 * Met à jour data pour refléter la chaîne canonique lorsque des IDs partiels sont fournis.
 */
async function validateTaxonomy(data) {
  let { family_id: famId, category_id: catId, sub_category_id: subId } = data;

  if (subId != null) {
    const sub = await subCategoryRepo.findById(Number(subId));
    if (!sub) bad('Sous-catégorie inexistante ou supprimée');
    if (!isActive(sub)) bad('La sous-catégorie n’est pas active');
    const cat = await categoryRepo.findById(sub.category_id);
    if (!cat) bad('Catégorie liée à la sous-catégorie introuvable');
    if (!isActive(cat)) bad('La catégorie liée n’est pas active');
    if (catId != null && Number(catId) !== cat.id) {
      bad('La sous-catégorie n’appartient pas à la catégorie indiquée');
    }
    if (famId != null && Number(famId) !== cat.family_id) {
      bad('La sous-catégorie n’appartient pas à la famille indiquée');
    }
    data.category_id = cat.id;
    data.family_id = cat.family_id;
    return;
  }

  if (catId != null) {
    const cat = await categoryRepo.findById(Number(catId));
    if (!cat) bad('Catégorie inexistante ou supprimée');
    if (!isActive(cat)) bad('La catégorie n’est pas active');
    if (famId != null && Number(famId) !== cat.family_id) {
      bad('La catégorie n’appartient pas à la famille indiquée');
    }
    data.family_id = cat.family_id;
    return;
  }

  if (famId != null) await assertFamilyRef(famId);
}

const OPTIONAL_REF = [
  { key: 'brand_id', repo: brandRepo, label: 'Marque' },
  { key: 'unit_id', repo: unitRepo, label: 'Unité' },
  { key: 'purchase_unit_id', repo: unitRepo, label: 'Unité d’achat' },
  { key: 'sale_unit_id', repo: unitRepo, label: 'Unité de vente' },
  { key: 'packaging_type_id', repo: packagingTypeRepo, label: 'Conditionnement' },
  { key: 'conservation_type_id', repo: conservationTypeRepo, label: 'Type de conservation' },
  { key: 'article_type_id', repo: articleTypeRepo, label: 'Type d’article' },
  { key: 'tax_id', repo: taxRepo, label: 'Taxe' },
];

async function validateOptionalRefs(data) {
  for (const { key, repo, label } of OPTIONAL_REF) {
    const id = data[key];
    if (id == null) continue;
    const row = await repo.findById(Number(id));
    if (!row) bad(`${label} : référence invalide ou supprimée`);
    if (!isActive(row)) bad(`${label} : le référentiel n’est pas actif`);
  }

  if (data.article_status_id != null) {
    const row = await articleStatusRepo.findById(Number(data.article_status_id));
    if (!row) bad('Statut article : référence invalide');
  }
}

module.exports = {
  validateTaxonomy,
  validateOptionalRefs,
};
