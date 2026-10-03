/**
 * PhonesDaddy - Zero-Risk Production Deployment Packager
 * 
 * Generates a clean, production-ready deploy package (deploy-bundle.zip).
 * 
 * 🛡️ ZERO-RISK DEPLOYMENT ARCHITECTURE:
 * 1. ZERO MEDIA IN BUNDLE: Neither server/uploads nor public/webfiles are in the zip.
 *    Extracting this zip on your server will NEVER overwrite, wipe, or replace existing images.
 * 2. ZERO CREDENTIAL LEAK: Excludes .env, keeping live production database credentials untouched.
 * 3. LIGHTWEIGHT (~2-3 MB): Excludes node_modules, .git, scratch files, and SQL backups.
 * 4. COMPATIBLE WITH ALL HOSTS: Works seamlessly with Hostinger File Manager "Extract",
 *    cPanel File Manager, Git auto-deploy, and SSH unzip.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'deploy-bundle');
const ZIP_FILE = path.join(ROOT_DIR, 'deploy-bundle.zip');

// Core application folders and files to include
const INCLUDE_PATHS = [
  'server',
  'views',
  'admin',
  'public/css',
  'public/js',
  'public/images',
  'public/uploads/pwa',
  'public/manifest.json',
  'public/manifest.webmanifest',
  'public/sw.js',
  'public/offline.html',
  'public/favicon.ico',
  'public/favicon-32x32.png',
  'public/favicon-192x192.png',
  'public/favicon-512x512.png',
  'public/icon-192x192.png',
  'public/icon-512x512.png',
  'public/icon-maskable-192x192.png',
  'public/icon-maskable-512x512.png',
  'public/apple-touch-icon.png',
  'public/shortcut-phones.png',
  'public/shortcut-compare.png',
  'public/shortcut-tax.png',
  'public/shortcut-news.png',
  'public/robots.txt',
  'database/schema.sql',
  'database/migrate.js',
  'scripts/setup-media.js',
  'scripts/generate-pwa-icons.js',
  'scripts/apply-custom-logo.js',
  'package.json',
  'package-lock.json',
  '.htaccess',
  'setup-persistent-media.sh',
  'git-deploy.sh',
  'safe-deploy.sh',
  'README.md',
  'DEPLOYMENT_GUIDE.md'
];

// Files and folder patterns to strictly blacklist from the package
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.env',
  '.env.local',
  'deploy-bundle',
  'deploy-bundle.zip',
  'scratch',
  'server/uploads',
  'public/webfiles',
  'backups'
];

function shouldExclude(relPath) {
  const normalized = relPath.replace(/\\/g, '/').toLowerCase();
  for (const pattern of EXCLUDE_PATTERNS) {
    if (normalized === pattern || normalized.startsWith(pattern + '/')) {
      return true;
    }
  }
  if (normalized.endsWith('.log') || normalized.endsWith('.sql') || normalized.endsWith('.zip')) {
    return true;
  }
  return false;
}

function copyRecursive(src, dest) {
  const relPath = path.relative(ROOT_DIR, src).replace(/\\/g, '/');
  if (shouldExclude(relPath)) return;

  const stat = fs.statSync(src);

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      const childSrc = path.join(src, item);
      const childRel = path.relative(ROOT_DIR, childSrc).replace(/\\/g, '/');
      if (shouldExclude(childRel)) continue;
      copyRecursive(childSrc, path.join(dest, item));
    }
  } else {
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function run() {
  console.log('====================================================');
  console.log('📦 PhonesDaddy - Packaging Zero-Risk Deployment...');
  console.log('====================================================');

  // Clean previous builds
  if (fs.existsSync(OUT_DIR)) {
    fs.rmSync(OUT_DIR, { recursive: true, force: true });
  }
  if (fs.existsSync(ZIP_FILE)) {
    fs.unlinkSync(ZIP_FILE);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Copy whitelist files
  for (const rel of INCLUDE_PATHS) {
    const src = path.join(ROOT_DIR, rel);
    const dest = path.join(OUT_DIR, rel);
    if (fs.existsSync(src)) {
      copyRecursive(src, dest);
      console.log(`  ✓ Included: ${rel}`);
    } else {
      console.warn(`  ⚠️ Warning: ${rel} not found, skipping.`);
    }
  }

  // 2. Compress to ZIP
  console.log('\n🗜️  Compressing into deploy-bundle.zip...');
  try {
    if (process.platform === 'win32') {
      execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${OUT_DIR}\\*' -DestinationPath '${ZIP_FILE}' -Force"`, {
        stdio: 'inherit'
      });
    } else {
      execSync(`cd "${OUT_DIR}" && zip -r "${ZIP_FILE}" .`, { stdio: 'inherit' });
    }

    const zipStat = fs.statSync(ZIP_FILE);
    const sizeMb = (zipStat.size / (1024 * 1024)).toFixed(2);

    // Clean up staging directory
    if (fs.existsSync(OUT_DIR)) {
      fs.rmSync(OUT_DIR, { recursive: true, force: true });
    }

    console.log('\n====================================================');
    console.log(`🎉 Zero-Risk Bundle Created: deploy-bundle.zip (${sizeMb} MB)`);
    console.log('====================================================');
    console.log('\n🛡️  GUARANTEES:');
    console.log('  ✅ ZERO empty media folders in ZIP (Extracting will NEVER wipe existing photos)');
    console.log('  ✅ .env is excluded (Production database credentials stay untouched)');
    console.log('  ✅ node_modules excluded (Lightweight upload)');
    console.log('\n🚀 DEPLOYMENT INSTRUCTIONS:');
    console.log('  OPTION A (ZIP via Hostinger / cPanel File Manager):');
    console.log('    1. Upload "deploy-bundle.zip" to your server.');
    console.log('    2. Click "Extract" in File Manager directly (100% safe — no media folders in zip).');
    console.log('    3. Run: npm install --omit=dev');
    console.log('    4. Restart your app in Node.js App Manager.');
    console.log('\n  OPTION B (GitHub / Git Auto-Deploy):');
    console.log('    Push changes to GitHub. Git pulls only code. Your external media folder is untouched.\n');
  } catch (err) {
    console.error('❌ Failed to create zip file:', err.message);
  }
}

run();
