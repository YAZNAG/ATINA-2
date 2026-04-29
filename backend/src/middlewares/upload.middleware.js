const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ALLOWED_TYPES = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

const createStorage = (folder) => {
  const uploadDir = path.join(process.cwd(), 'uploads', folder);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
    },
  });
};

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_TYPES.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Format non autorisé. Utilisez jpg, jpeg, png ou webp.'), false);
  }
};

const createUpload = (folder, fields) => {
  const upload = multer({
    storage: createStorage(folder),
    fileFilter,
    limits: { fileSize: MAX_SIZE },
  });

  return (req, res, next) => {
    upload.fields(fields)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }
      next();
    });
  };
};

module.exports = { createUpload };
