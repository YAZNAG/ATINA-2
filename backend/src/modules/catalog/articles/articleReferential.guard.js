/**
 * Validations métier article : taxonomie et références optionnelles.
 */
const familyRepo = require('../families/family.repository');
const categoryRepo = require('../categories/category.repository');
const subCategoryRepo = require('../subCategories/subCategory.repository');
const brandRepo = require('../brands/brand.repository');
const articleTypeRepo = require('../articleTypes/articleType.repository');
const articleStatusRepo = require('../articleStatuses/articleStatus.repository');
const conservationTypeRepo = require('../conservationTypes/conservationType.repository');
const taxRepo = require('../taxes/tax.repository');

const bad = (message) => {
  throw { statusCode: 400, message };
};

const isActive = (row, statusField = 'status') => row && row[statusField] === 'active';

async function assertFamilyRef(id) {
  if (id == null) return;
  const row = await familyRepo.findById(Number(id));
  if (!row) bad('Famille inexistante ou supprimée');
  if (!isActive(row)) bad('La famille n\'est pas active');
}

/**
 * Normalise et valide family_id, category_id, sub_category_id (cohérence hiérarchique).
 */
async function validateTaxonomy(data) {
  let { family_id: famId, category_id: catId, sub_category_id: subId } = data;

  if (subId != null) {
    const sub = await subCategoryRepo.findById(Number(subId));
    if (!sub) bad('Sous-catégorie inexistante ou supprimée');
    if (!isActive(sub)) bad('La sous-catégorie n\'est pas active');
    const cat = await categoryRepo.findById(sub.category_id);
    if (!cat) bad('Catégorie liée à la sous-catégorie introuvable');
    if (!isActive(cat)) bad('La catégorie liée n\'est pas active');
    if (catId != null && Number(catId) !== cat.id) {
      bad('La sous-catégorie n\'appartient pas à la catégorie indiquée');
    }
    if (famId != null && Number(famId) !== cat.family_id) {
      bad('La sous-catégorie n\'appartient pas à la famille indiquée');
    }
    data.category_id = cat.id;
    data.family_id = cat.family_id;
    return;
  }

  if (catId != null) {
    const cat = await categoryRepo.findById(Number(catId));
    if (!cat) bad('Catégorie inexistante ou supprimée');
    if (!isActive(cat)) bad('La catégorie n\'est pas active');
    if (famId != null && Number(famId) !== cat.family_id) {
      bad('La catégorie n\'appartient pas à la famille indiquée');
    }
    data.family_id = cat.family_id;
    return;
  }

  if (famId != null) await assertFamilyRef(famId);
}

const OPTIONAL_REFS = [
  { key: 'brand_id', repo: brandRepo, label: 'Marque' },
  { key: 'article_type_id', repo: articleTypeRepo, label: 'Type d\'article' },
  { key: 'conservation_type_id', repo: conservationTypeRepo, label: 'Type de conservation' },
  { key: 'tax_id', repo: taxRepo, label: 'Taxe' },
];

const EXISTENCE_ONLY_REFS = [
  { key: 'article_status_id', repo: articleStatusRepo, label: 'Statut article' },
];

async function validateOptionalRefs(data) {
  for (const { key, repo, label } of OPTIONAL_REFS) {
    const id = data[key];
    if (id == null) continue;
    const row = await repo.findById(Number(id));
    if (!row) bad(`${label} : référence invalide ou supprimée`);
    if (!isActive(row)) bad(`${label} : le référentiel n\'est pas actif`);
  }

  for (const { key, repo, label } of EXISTENCE_ONLY_REFS) {
    const id = data[key];
    if (id == null) continue;
    const row = await repo.findById(Number(id));
    if (!row) bad(`${label} : référence invalide ou supprimée`);
  }
}

module.exports = {
  validateTaxonomy,
  validateOptionalRefs,
};
