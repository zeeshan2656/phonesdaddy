/**
 * PhonesDaddy — Persistent Storage Path Configuration
 *
 * WHY THIS EXISTS:
 * When deploying via GitHub (git pull / git clone), uploaded images stored
 * inside the project folder (server/uploads/) are lost because:
 *   - git pull on a fresh clone doesn't restore gitignored files
 *   - Some hosting panels wipe the directory before pulling
 *
 * THE FIX:
 * Set UPLOADS_DIR in your server's .env to a folder OUTSIDE the git repo.
 * Git can never touch that folder, so images are 100% safe on every deploy.
 *
 * HOW TO SET UP ON YOUR SERVER:
 *   In your server's .env file, add:
 *     UPLOADS_DIR=/home/yourusername/phonesdaddy_uploads
 *
 *   Then create that folder once on the server:
 *     mkdir -p /home/yourusername/phonesdaddy_uploads/phones
 *     mkdir -p /home/yourusername/phonesdaddy_uploads/brands
 *     mkdir -p /home/yourusername/phonesdaddy_uploads/branding
 *     mkdir -p /home/yourusername/phonesdaddy_uploads/news
 *     mkdir -p /home/yourusername/phonesdaddy_uploads/reviews
 *
 *   If UPLOADS_DIR is not set, it falls back to server/uploads/ (local dev default).
 */

const path = require('path');
const fs   = require('fs');

// Root of the project (one level above /server)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// Persistent uploads directory — outside git repo on production, inside on dev
const UPLOADS_BASE = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(PROJECT_ROOT, 'server', 'uploads');

// Webfiles base (scraped/processed gallery images stored in public/webfiles)
// These also live inside the project, so we protect them the same way via WEBFILES_DIR
const WEBFILES_BASE = process.env.WEBFILES_DIR
  ? path.resolve(process.env.WEBFILES_DIR)
  : path.join(PROJECT_ROOT, 'public', 'webfiles');

/**
 * Get the absolute path for a specific upload subdirectory.
 * Creates the directory automatically if it doesn't exist.
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
 * Creates the directory automatically if it doesn't exist.
 * @param {'phones'|'brands'|'news'} type
 * @returns {string} absolute path
 */
function getWebfilePath(type) {
  const dir = path.join(WEBFILES_BASE, type);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

module.exports = {
  UPLOADS_BASE,
  WEBFILES_BASE,
  getUploadPath,
  getWebfilePath,
};
