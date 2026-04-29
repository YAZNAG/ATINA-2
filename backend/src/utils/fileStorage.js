const fs = require('fs');
const path = require('path');

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

module.exports = { deleteFile, getFilePath };
