const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getUploadPath } = require('../utils/paths');

// Storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let dest;
    if (req.baseUrl.includes('settings') || req.path.includes('branding') || req.path.includes('logo') || req.path.includes('favicon')) {
      dest = getUploadPath('branding');
    } else if (req.baseUrl.includes('brands') || req.path.includes('brand')) {
      dest = getUploadPath('brands');
    } else if (req.baseUrl.includes('news') || req.path.includes('news')) {
      dest = getUploadPath('news');
    } else if (req.baseUrl.includes('reviews') || req.baseUrl.includes('comments') || req.path.includes('review') || req.path.includes('comment')) {
      dest = getUploadPath('reviews');
    } else {
      dest = getUploadPath('phones');
    }
    cb(null, dest);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// File filter for image and icon MIME types
const fileFilter = (req, file, cb) => {
  // If no file was selected or file is empty, skip without throwing error
  if (!file || !file.originalname || file.originalname.trim() === '') {
    return cb(null, false);
  }

  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/svg+xml',
    'image/gif',
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'image/ico'
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif', '.ico'];

  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file type. Only JPEG, PNG, WebP, SVG, GIF, and ICO are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max for file uploads
    fieldSize: 50 * 1024 * 1024  // 50 MB max for text fields (rich HTML content from Quill editor)
  },
  fileFilter: fileFilter
});

module.exports = upload;
