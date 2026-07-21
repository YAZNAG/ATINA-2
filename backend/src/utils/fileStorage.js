const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL;
if (!BASE_URL) {
  throw new Error('BASE_URL non configurée dans .env');
}

const deleteFile = (filePath) => {
  if (!filePath) return;
  const fullPath = path.join(process.cwd(), filePath.startsWith('/') ? filePath.slice(1) : filePath);
  try {
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  } catch (err) {
    console.error('Error deleting file:', fullPath, err.message);
  }
};

const getFilePath = (file, folder) => {
  if (!file) return null;
  return `/uploads/${folder}/${file.filename}`;
};

const toPublicUrl = (relativePath) => {
  if (!relativePath) return null;
  if (relativePath.startsWith('http')) return relativePath;
  let clean = relativePath.replace(/\\/g, '/');
  const idx = clean.indexOf('storage/');
  if (idx >= 0) clean = '/' + clean.slice(idx);
  return `${BASE_URL}${clean.startsWith('/') ? '' : '/'}${clean}`;
};
const getCategoryImagePublicUrl = (filename) => {
  if (!filename) return null;
  return toPublicUrl(`/storage/categories/images/${filename}`);
};

/** URL publique (static `app.use('/storage', ...)`) après upload multer dans `storage/image/article/{id}/`. */
const getArticleSkuImagePublicUrl = (articleId, filename) => {
  if (!filename) return null;
  return `/storage/image/article/${Number(articleId)}/${filename}`;
};

module.exports = { deleteFile, getFilePath, getArticleSkuImagePublicUrl, toPublicUrl, getCategoryImagePublicUrl };
