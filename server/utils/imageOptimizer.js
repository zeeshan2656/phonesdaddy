const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Dedicated web-accessible image root
const WEBFILES_ROOT = path.join(__dirname, '../../public/webfiles');
const DIRS = {
  phones: path.join(WEBFILES_ROOT, 'phones'),
  brands: path.join(WEBFILES_ROOT, 'brands'),
  news: path.join(WEBFILES_ROOT, 'news'),
  branding: path.join(WEBFILES_ROOT, 'branding')
};

// Ensure all webfiles directories exist
for (const dir of Object.values(DIRS)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Clean filename slug
 */
function sanitizeFilename(name = 'image') {
  return String(name)
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // remove extension
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'image';
}

/**
 * Optimize phone image: produces full-size WebP and card thumbnail WebP
 * @param {string|Buffer} input - File path or buffer
 * @param {string} baseName - Base name (e.g. phone slug)
 * @returns {Promise<{ url: string, thumbUrl: string }>}
 */
async function optimizePhoneImage(input, baseName = 'phone') {
  const cleanName = sanitizeFilename(baseName);
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e4);
  const fullFileName = `${cleanName}-${uniqueId}.webp`;
  const thumbFileName = `${cleanName}-${uniqueId}-thumb.webp`;

  const fullPath = path.join(DIRS.phones, fullFileName);
  const thumbPath = path.join(DIRS.phones, thumbFileName);

  try {
    // 1. Full-size optimized WebP (max 800x1000, 82% quality)
    await sharp(input)
      .rotate() // auto-orient from EXIF
      .resize({ width: 800, height: 1000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(fullPath);

    // 2. Listing card thumbnail WebP (max 360x450, 80% quality)
    await sharp(input)
      .rotate()
      .resize({ width: 360, height: 450, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toFile(thumbPath);

    return {
      url: `/webfiles/phones/${fullFileName}`,
      thumbUrl: `/webfiles/phones/${thumbFileName}`
    };
  } catch (err) {
    console.error('Phone image optimization error:', err.message);
    throw err;
  }
}

/**
 * Optimize brand logo: converts to optimized WebP
 * @param {string|Buffer} input
 * @param {string} baseName
 */
async function optimizeBrandLogo(input, baseName = 'brand') {
  const cleanName = sanitizeFilename(baseName);
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e4);
  const fileName = `${cleanName}-${uniqueId}.webp`;
  const destPath = path.join(DIRS.brands, fileName);

  try {
    await sharp(input)
      .rotate()
      .resize({ width: 280, height: 140, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toFile(destPath);

    return {
      url: `/webfiles/brands/${fileName}`
    };
  } catch (err) {
    console.error('Brand logo optimization error:', err.message);
    throw err;
  }
}

/**
 * Optimize news/blog image
 * @param {string|Buffer} input
 * @param {string} baseName
 */
async function optimizeNewsImage(input, baseName = 'news') {
  const cleanName = sanitizeFilename(baseName);
  const uniqueId = Date.now() + '-' + Math.round(Math.random() * 1e4);
  const fileName = `${cleanName}-${uniqueId}.webp`;
  const destPath = path.join(DIRS.news, fileName);

  try {
    await sharp(input)
      .rotate()
      .resize({ width: 960, height: 600, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80, effort: 4 })
      .toFile(destPath);

    return {
      url: `/webfiles/news/${fileName}`
    };
  } catch (err) {
    console.error('News image optimization error:', err.message);
    throw err;
  }
}

module.exports = {
  WEBFILES_ROOT,
  DIRS,
  optimizePhoneImage,
  optimizeBrandLogo,
  optimizeNewsImage
};
