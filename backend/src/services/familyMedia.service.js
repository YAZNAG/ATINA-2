const fs = require('fs');
const path = require('path');
const { deleteFile } = require('../utils/fileStorage');

const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];

function safeExt(originalname) {
  const ext = path.extname(originalname || '').toLowerCase();
  return ALLOWED_EXT.includes(ext) ? ext : '.png';
}

function persistPair(storageFolder, entityId, files, existing) {
  const id = String(entityId);
  const baseDir = path.join(process.cwd(), 'storage', 'image', storageFolder, id);
  const out = {};

  if (files?.image?.[0]?.buffer) {
    if (existing?.image_path) deleteFile(existing.image_path);
    fs.mkdirSync(baseDir, { recursive: true });
    const ext = safeExt(files.image[0].originalname);
    const filename = `image${ext}`;
    fs.writeFileSync(path.join(baseDir, filename), files.image[0].buffer);
    out.image_path = `/storage/image/${storageFolder}/${id}/${filename}`;
  }

  if (files?.icon?.[0]?.buffer) {
    if (existing?.icon_path) deleteFile(existing.icon_path);
    fs.mkdirSync(baseDir, { recursive: true });
    const ext = safeExt(files.icon[0].originalname);
    const filename = `icon${ext}`;
    fs.writeFileSync(path.join(baseDir, filename), files.icon[0].buffer);
    out.icon_path = `/storage/image/${storageFolder}/${id}/${filename}`;
  }

  return out;
}

function removeFolder(storageFolder, entityId) {
  const dir = path.join(process.cwd(), 'storage', 'image', storageFolder, String(entityId));
  try {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch (err) {
    console.error('removeFolder', dir, err.message);
  }
}

/** Famille */
function persistFamilyFiles(familyId, files, existing) {
  return persistPair('famille', familyId, files, existing);
}

function removeFamilyMediaFolder(familyId) {
  removeFolder('famille', familyId);
}

/** Catégorie */
function persistCategoryFiles(categoryId, files, existing) {
  return persistPair('categorie', categoryId, files, existing);
}

function removeCategoryMediaFolder(categoryId) {
  removeFolder('categorie', categoryId);
}

/** Sous-catégorie */
function persistSubCategoryFiles(subCategoryId, files, existing) {
  return persistPair('sous-categorie', subCategoryId, files, existing);
}

function removeSubCategoryMediaFolder(subCategoryId) {
  removeFolder('sous-categorie', subCategoryId);
}

/** Marque : logo seul */
function persistBrandLogo(brandId, files, existing) {
  if (!files?.logo?.[0]?.buffer) return {};
  const id = String(brandId);
  if (existing?.logo) deleteFile(existing.logo);
  const baseDir = path.join(process.cwd(), 'storage', 'image', 'marque', id);
  fs.mkdirSync(baseDir, { recursive: true });
  const ext = safeExt(files.logo[0].originalname);
  const filename = `logo${ext}`;
  fs.writeFileSync(path.join(baseDir, filename), files.logo[0].buffer);
  return { logo: `/storage/image/marque/${id}/${filename}` };
}

function removeBrandMediaFolder(brandId) {
  removeFolder('marque', brandId);
}

module.exports = {
  persistFamilyFiles,
  removeFamilyMediaFolder,
  persistCategoryFiles,
  removeCategoryMediaFolder,
  persistSubCategoryFiles,
  removeSubCategoryMediaFolder,
  persistBrandLogo,
  removeBrandMediaFolder,
};
