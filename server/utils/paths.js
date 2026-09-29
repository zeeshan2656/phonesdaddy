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

// Check if an external persistent media directory exists or can be created
function resolveMediaBase() {
  // 1. Explicit env var (highest priority)
  if (process.env.MEDIA_DIR && process.env.MEDIA_DIR.trim()) {
    const customPath = path.resolve(PROJECT_ROOT, process.env.MEDIA_DIR.trim());
    try {
      if (!fs.existsSync(customPath)) fs.mkdirSync(customPath, { recursive: true });
      return customPath;
    } catch (_) {
      return customPath;
    }
  }

  // 2. Candidate A: Hostinger Cloud Build environment (hbuilds detection)
  // When running inside Hostinger's build system, PROJECT_ROOT is:
  //   /home/uXXXX/hbuilds/current/public_html
  // Or /home/uXXXX/hbuilds/versions/<hash>/public_html
  // Any files stored inside hbuilds/ get wiped on the next build!
  // We MUST store media in the user home directory OUTSIDE hbuilds: /home/uXXXX/phonesdaddy_media
  const normalized = PROJECT_ROOT.replace(/\\/g, '/');
  const hbuildsIdx = normalized.indexOf('/hbuilds');
  if (hbuildsIdx !== -1) {
    const hostingerUserRoot = normalized.substring(0, hbuildsIdx);
    const hbuildsRoot = normalized.substring(0, hbuildsIdx + 8); // includes /hbuilds

    // Candidate 1: In top-level Home (/home/uXXXX/phonesdaddy_media)
    const homeMediaDir = path.join(hostingerUserRoot, 'phonesdaddy_media');
    if (fs.existsSync(homeMediaDir)) return homeMediaDir;

    // Candidate 2: In hbuilds (/home/uXXXX/hbuilds/phonesdaddy_media - where you just copied it!)
    const hbuildsMediaDir = path.join(hbuildsRoot, 'phonesdaddy_media');
    if (fs.existsSync(hbuildsMediaDir)) return hbuildsMediaDir;

    // Default to creating in Home (safest location)
    try {
      if (!fs.existsSync(homeMediaDir)) fs.mkdirSync(homeMediaDir, { recursive: true });
      return homeMediaDir;
    } catch (_) {
      return hbuildsMediaDir;
    }
  }

  // 3. Candidate B: Linux user home directory (~/phonesdaddy_media)
  // On Hostinger / cPanel / Ubuntu, process.env.HOME is /home/username (outside public_html and outside hbuilds)
  if (process.env.HOME && fs.existsSync(process.env.HOME)) {
    const homeCandidate = path.resolve(process.env.HOME, 'phonesdaddy_media');
    if (fs.existsSync(homeCandidate)) {
      return homeCandidate;
    }
    try {
      fs.mkdirSync(homeCandidate, { recursive: true });
      fs.accessSync(homeCandidate, fs.constants.W_OK);
      return homeCandidate;
    } catch (_) {}
  }

  // 4. Candidate C: One level above project root (standard non-hbuilds cPanel or local dev)
  const parentCandidate = path.resolve(PROJECT_ROOT, '..', 'phonesdaddy_media');
  if (fs.existsSync(parentCandidate)) {
    return parentCandidate;
  }

  try {
    fs.mkdirSync(parentCandidate, { recursive: true });
    fs.accessSync(parentCandidate, fs.constants.W_OK);
    return parentCandidate;
  } catch (_) {}

  // 5. Production fallback
  if (process.env.NODE_ENV === 'production') {
    return parentCandidate;
  }

  return null;
}

// Safely migrate any media trapped inside Hostinger's temporary hbuilds directories
function migrateTrappedHbuildsMedia(targetBase) {
  if (!targetBase) return;
  try {
    const normalized = PROJECT_ROOT.replace(/\\/g, '/');
    const hbuildsIdx = normalized.indexOf('/hbuilds');
    if (hbuildsIdx === -1) return;

    // Check hbuilds/current/phonesdaddy_media (from Image 2)
    const trappedCurrent = path.resolve(PROJECT_ROOT, '..', 'phonesdaddy_media');
    if (fs.existsSync(trappedCurrent) && path.resolve(trappedCurrent) !== path.resolve(targetBase)) {
      copyRecursiveSafe(trappedCurrent, targetBase);
    }

    // Check all hbuilds/versions/*/phonesdaddy_media
    const hbuildsRoot = normalized.substring(0, hbuildsIdx + 8);
    const versionsDir = path.join(hbuildsRoot, 'versions');
    if (fs.existsSync(versionsDir)) {
      const versions = fs.readdirSync(versionsDir);
      for (const ver of versions) {
        const verMedia = path.join(versionsDir, ver, 'phonesdaddy_media');
        if (fs.existsSync(verMedia) && path.resolve(verMedia) !== path.resolve(targetBase)) {
          copyRecursiveSafe(verMedia, targetBase);
        }
      }
    }
  } catch (_) {}
}

function copyRecursiveSafe(src, dest) {
  if (!fs.existsSync(src)) return;
  try {
    const items = fs.readdirSync(src);
    for (const item of items) {
      const s = path.join(src, item);
      const d = path.join(dest, item);
      const stat = fs.statSync(s);
      if (stat.isDirectory()) {
        if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
        copyRecursiveSafe(s, d);
      } else {
        if (!fs.existsSync(d)) fs.copyFileSync(s, d);
      }
    }
  } catch (_) {}
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

  // Automatically migrate any images trapped in Hostinger's temporary hbuilds directories
  if (MEDIA_BASE) {
    migrateTrappedHbuildsMedia(MEDIA_BASE);
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

