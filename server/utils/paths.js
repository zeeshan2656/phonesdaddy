/**
 * PhonesDaddy — Persistent Media Storage Configuration
 *
 * WHY THIS EXISTS:
 * When deploying via GitHub (git pull / webhooks) or ZIP extraction,
 * media files (uploads, crawled phone photos, brand logos) stored INSIDE
 * the deployment directory get wiped or replaced by the incoming code.
 *
 * THE ARCHITECTURAL FIX:
 * All media is stored OUTSIDE the deployment directory (e.g. ../phonesdaddy_media or ~/phonesdaddy_media).
 * Deployments (Git or ZIP) only update code. They can NEVER touch or overwrite the external media folder.
 *
 * ENV VARIABLES (all optional with smart auto-detection):
 *   MEDIA_DIR     Unified base directory outside project (e.g., ../phonesdaddy_media or ~/phonesdaddy_media)
 *   UPLOADS_DIR   Explicit uploads directory (overrides MEDIA_DIR/uploads)
 *   WEBFILES_DIR  Explicit webfiles directory (overrides MEDIA_DIR/webfiles)
 *   IMAGES_DIR    Explicit custom images directory (overrides MEDIA_DIR/images)
 */

const path = require('path');
const fs   = require('fs');

// Root of the deployed project (one level above /server)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Check if an external persistent media directory exists or is configured
function resolveMediaBase() {
  if (process.env.MEDIA_DIR && process.env.MEDIA_DIR.trim()) {
    return path.resolve(PROJECT_ROOT, process.env.MEDIA_DIR.trim());
  }

  // Default outside-repo candidate: one level above deployment root (e.g., ../phonesdaddy_media)
  const defaultOutsideDir = path.resolve(PROJECT_ROOT, '..', 'phonesdaddy_media');

  // On production or if the external folder already exists, use it automatically
  if (process.env.NODE_ENV === 'production' || fs.existsSync(defaultOutsideDir)) {
    return defaultOutsideDir;
  }

  return null;
}

const MEDIA_BASE = resolveMediaBase();

// 1. Uploads directory (user-uploaded images: branding, phones, brands, news, reviews)
const UPLOADS_BASE = process.env.UPLOADS_DIR && process.env.UPLOADS_DIR.trim()
  ? path.resolve(PROJECT_ROOT, process.env.UPLOADS_DIR.trim())
  : (MEDIA_BASE ? path.join(MEDIA_BASE, 'uploads') : path.join(PROJECT_ROOT, 'server', 'uploads'));

// 2. Webfiles directory (scraped & optimized WebP phone photos, gallery images, news cards)
const WEBFILES_BASE = process.env.WEBFILES_DIR && process.env.WEBFILES_DIR.trim()
  ? path.resolve(PROJECT_ROOT, process.env.WEBFILES_DIR.trim())
  : (MEDIA_BASE ? path.join(MEDIA_BASE, 'webfiles') : path.join(PROJECT_ROOT, 'public', 'webfiles'));

// 3. Optional persistent custom images directory
const IMAGES_BASE = process.env.IMAGES_DIR && process.env.IMAGES_DIR.trim()
  ? path.resolve(PROJECT_ROOT, process.env.IMAGES_DIR.trim())
  : (MEDIA_BASE ? path.join(MEDIA_BASE, 'images') : path.join(PROJECT_ROOT, 'public', 'images'));

// Check if media is safely located outside the deployment repository
function isPathOutsideProject(targetPath) {
  const rel = path.relative(PROJECT_ROOT, targetPath);
  return rel.startsWith('..') || path.isAbsolute(rel);
}

const isMediaOutsideProject = isPathOutsideProject(UPLOADS_BASE) && isPathOutsideProject(WEBFILES_BASE);

/**
 * Get the absolute path for a specific upload subdirectory.
 * Automatically ensures the directory exists.
 * @param {'phones'|'brands'|'branding'|'news'|'reviews'} type
 * @returns {string} absolute path
 */
function getUploadPath(type) {
  const dir = path.join(UPLOADS_BASE, type);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Get the absolute path for a specific webfiles subdirectory.
 * Automatically ensures the directory exists.
 * @param {'phones'|'brands'|'news'|'branding'} type
 * @returns {string} absolute path
 */
function getWebfilePath(type) {
  const dir = path.join(WEBFILES_BASE, type);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Ensure all standard subdirectories exist in uploads and webfiles.
 * Safe to call at any time (idempotent).
 */
function ensureMediaDirectories() {
  const uploadSubdirs = ['phones', 'brands', 'branding', 'news', 'reviews'];
  const webfileSubdirs = ['phones', 'brands', 'news', 'branding'];

  for (const sub of uploadSubdirs) {
    getUploadPath(sub);
  }
  for (const sub of webfileSubdirs) {
    getWebfilePath(sub);
  }
  if (IMAGES_BASE && !fs.existsSync(IMAGES_BASE)) {
    try { fs.mkdirSync(IMAGES_BASE, { recursive: true }); } catch (_) {}
  }
}

// Automatically ensure directories exist on module load
try {
  ensureMediaDirectories();
} catch (e) {
  console.warn('⚠️ Could not initialize media directories on startup:', e.message);
}

module.exports = {
  PROJECT_ROOT,
  MEDIA_BASE,
  UPLOADS_BASE,
  WEBFILES_BASE,
  IMAGES_BASE,
  isMediaOutsideProject,
  getUploadPath,
  getWebfilePath,
  ensureMediaDirectories
};

