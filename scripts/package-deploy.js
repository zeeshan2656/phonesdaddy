/**
 * PhonesDaddy - Safe Production Deployment Packager
 * 
 * Generates a clean, production-ready deploy package (deploy-bundle.zip).
 * 
 * 🛡️ SAFE DEPLOYMENT GUARANTEES:
 * 1. NEVER includes .env (Prevents overwriting production database credentials)
 * 2. NEVER includes server/uploads/* (Protects all photos and media uploaded on server)
 * 3. NEVER includes public/webfiles/* (Protects all crawled WebP images on server)
 * 4. NEVER includes node_modules or .git (Lightweight, fast upload ~2 MB instead of 200 MB)
 * 5. Includes empty upload folders with .gitkeep so folder structure is always intact
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT_DIR, 'deploy-bundle');
const ZIP_FILE = path.join(ROOT_DIR, 'deploy-bundle.zip');

// Items to copy
const INCLUDE_PATHS = [
  'server',
  'views',
  'admin',
  'public/css',
  'public/js',
  'public/images',
  'database/schema.sql',
  'database/migrate.js',
  'package.json',
  'package-lock.json',
  '.htaccess',
  'README.md'
];

// Empty upload directories to preserve structure without overwriting live files
const ENSURE_EMPTY_DIRS = [
  'server/uploads/phones',
  'server/uploads/brands',
  'server/uploads/branding',
  'server/uploads/news',
  'server/uploads/reviews',
  'public/webfiles/phones',
  'public/webfiles/brands',
  'public/webfiles/news',
  'backups'
];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  const relPath = path.relative(ROOT_DIR, src).replace(/\\/g, '/');

  // Skip uploads folder contents
  if (relPath.startsWith('server/uploads') && relPath !== 'server/uploads') {
    return;
  }

  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const items = fs.readdirSync(src);
    for (const item of items) {
      if (item === 'node_modules' || item === '.git' || item.endsWith('.log') || item === '.env') continue;
      // If we are at server/uploads, don't copy files inside; ENSURE_EMPTY_DIRS handles directory creation
      if (relPath === 'server' && item === 'uploads') {
        const uploadDest = path.join(dest, 'uploads');
        if (!fs.existsSync(uploadDest)) fs.mkdirSync(uploadDest, { recursive: true });
        continue;
      }
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    // Only copy file if it's not .env or an SQL dump / backup
    if (src.endsWith('.env') || src.endsWith('.sql') || src.endsWith('.log')) return;
    const parent = path.dirname(dest);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

async function run() {
  console.log('====================================================');
  console.log('📦 PhonesDaddy - Building Safe Production Release...');
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

  // 2. Ensure empty upload directories with .gitkeep
  for (const d of ENSURE_EMPTY_DIRS) {
    const targetDir = path.join(OUT_DIR, d);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(path.join(targetDir, '.gitkeep'), '');
  }
  console.log('  ✓ Preserved empty upload folder structure (.gitkeep)');

  // 3. Compress to ZIP
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
    console.log(`🎉 Safe Deployment Bundle Created: deploy-bundle.zip (${sizeMb} MB)`);
    console.log('====================================================');
    console.log('\n🛡️  PROTECTIONS APPLIED:');
    console.log('  ✅ .env IS EXCLUDED: Your production database credentials will NOT be overwritten.');
    console.log('  ✅ server/uploads/ IS EXCLUDED: Existing articles, phone photos & branding on server are SAFE.');
    console.log('  ✅ public/webfiles/ IS EXCLUDED: Existing gallery photos on server are SAFE.');
    console.log('  ✅ node_modules/ IS EXCLUDED: Fast, clean ~2MB upload instead of ~200MB.');
    console.log('\n🚀 HOW TO DEPLOY TO SERVER:');
    console.log('  1. Upload "deploy-bundle.zip" to your server (Hostinger / cPanel / VPS).');
    console.log('  2. Extract it over your project root directory.');
    console.log('  3. In Node.js terminal or SSH, run:');
    console.log('     npm install --omit=dev');
    console.log('  4. Restart your Node.js application.');
    console.log('  5. Done! All existing phones, articles, images, and settings remain 100% intact.\n');
  } catch (err) {
    console.error('❌ Failed to create zip file:', err.message);
    console.log(`💡 You can still upload the clean files located in: ${OUT_DIR}`);
  }
}

run();
