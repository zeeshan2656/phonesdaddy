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

const sharp = require('sharp');

/**
 * Automatic Sharp image optimization middleware for uploaded images.
 * Resizes, compresses, and generates WebP thumbnails according to upload category.
 */
async function optimizeUploadedImages(req, res, next) {
  if (!req.file && (!req.files || req.files.length === 0)) {
    return next();
  }

  const filesToProcess = req.file ? [req.file] : (Array.isArray(req.files) ? req.files : Object.values(req.files).flat());

  for (const file of filesToProcess) {
    if (!file || !file.path || !fs.existsSync(file.path)) continue;
    const ext = path.extname(file.path).toLowerCase();
    if (ext === '.svg' || ext === '.ico' || ext === '.gif') continue;

    try {
      const isFavicon = file.fieldname === 'site_favicon' || file.path.includes('favicon');
      const isLogo = file.fieldname === 'site_logo' || file.path.includes('logo');
      const isPhone = file.path.includes('phones');

      if (isFavicon) {
        // Generate crisp 32x32, 180x180 and 192x192 icons in public/ and upload dest
        const inBuf = fs.readFileSync(file.path);
        const optBuf = await sharp(inBuf).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9, palette: true }).toBuffer();
        fs.writeFileSync(file.path, optBuf);
        // Also update public root favicons
        await sharp(inBuf).resize(32, 32).png().toFile(path.join(__dirname, '../../public/favicon.ico')).catch(() => {});
        await sharp(inBuf).resize(32, 32).png().toFile(path.join(__dirname, '../../public/favicon-32x32.png')).catch(() => {});
        await sharp(inBuf).resize(180, 180).png({ quality: 80, palette: true }).toFile(path.join(__dirname, '../../public/apple-touch-icon.png')).catch(() => {});
        await sharp(inBuf).resize(192, 192).png({ quality: 80, palette: true }).toFile(path.join(__dirname, '../../public/favicon-192x192.png')).catch(() => {});
      } else if (isLogo) {
        // Resize logo to max 360px wide for 2x retina display (under 15KB)
        const inBuf = fs.readFileSync(file.path);
        const optBuf = await sharp(inBuf).resize({ width: 360, withoutEnlargement: true }).png({ compressionLevel: 9, palette: true }).toBuffer();
        fs.writeFileSync(file.path, optBuf);
      } else if (isPhone) {
        // Automatically generate WebP thumbnail (320x424 max, quality 70) alongside image
        const inBuf = fs.readFileSync(file.path);
        const thumbPath = file.path.replace(/\.[^.]+$/, '') + '-thumb.webp';
        await sharp(inBuf)
          .resize(320, 424, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 70, effort: 4 })
          .toFile(thumbPath);
      } else {
        // General images: resize if > 1200px, compress to efficient WebP/JPEG
        const inBuf = fs.readFileSync(file.path);
        const meta = await sharp(inBuf).metadata();
        if (meta.width && meta.width > 1200) {
          const optBuf = await sharp(inBuf).resize({ width: 1200, withoutEnlargement: true }).toBuffer();
          fs.writeFileSync(file.path, optBuf);
        }
      }
    } catch (err) {
      console.warn('Sharp optimization warning on upload:', err.message);
    }
  }

  next();
}

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB max for file uploads
    fieldSize: 50 * 1024 * 1024  // 50 MB max for text fields
  },
  fileFilter: fileFilter
});

upload.optimizeUploadedImages = optimizeUploadedImages;

module.exports = upload;
