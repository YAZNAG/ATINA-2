/**
 * Validations métier SKU : taxonomie (SkuFamily/SkuSubFamily) et références optionnelles.
 */
const skuFamilyRepo = require('../families/family.repository');
const skuSubFamilyRepo = require('../subFamily/subfamily.repository');
const categoryRepo = require('../categories/category.repository');
const brandRepo = require('../brands/brand.repository');
const conservationTypeRepo = require('../conservationTypes/conservationType.repository');
const taxRepo = require('../taxes/tax.repository');

const bad = (message) => {
  throw { statusCode: 400, message };
};

const isActive = (row, statusField = 'status') => row && (row.is_active === true || row[statusField] === 'active');

async function assertSkuFamilyRef(id) {
  if (id == null) return;
  const row = await skuFamilyRepo.findById(String(id));
  if (!row) bad('Famille SKU inexistante ou supprimée');
  if (!row.is_active) bad("La famille SKU n'est pas active");
}

/**
 * Normalise et valide sku_family_id / sku_subfamily_id (cohérence hiérarchique).
 * category_id est un axe indépendant, validé séparément dans validateOptionalRefs.
 */
async function validateTaxonomy(data) {
  let { sku_family_id: familyId, sku_subfamily_id: subFamilyId } = data;

  if (subFamilyId != null) {
    const sub = await skuSubFamilyRepo.findById(String(subFamilyId));
    if (!sub) bad('Sous-famille SKU inexistante ou supprimée');
    if (!sub.is_active) bad("La sous-famille SKU n'est pas active");
    if (familyId != null && String(familyId) !== String(sub.family_id)) {
      bad("La sous-famille n'appartient pas à la famille indiquée");
    }
    data.sku_family_id = sub.family_id;
    return;
  }

  if (familyId != null) await assertSkuFamilyRef(familyId);
}

const OPTIONAL_REFS = [
  { key: 'brand_id', repo: brandRepo, label: 'Marque' },
  { key: 'category_id', repo: categoryRepo, label: 'Catégorie' },
  { key: 'conservation_type_id', repo: conservationTypeRepo, label: 'Type de conservation' },
  { key: 'tax_id', repo: taxRepo, label: 'Taxe' },
];

async function validateOptionalRefs(data) {
  for (const { key, repo, label } of OPTIONAL_REFS) {
    const id = data[key];
    if (id == null) continue;
    const row = await repo.findById(typeof id === 'number' ? id : String(id));
    if (!row) bad(`${label} : référence invalide ou supprimée`);
    if (!isActive(row)) bad(`${label} : le référentiel n'est pas actif`);
  }
}

module.exports = {
  validateTaxonomy,
  validateOptionalRefs,
};