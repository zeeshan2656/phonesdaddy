/**
 * PhonesDaddy — Persistent Media Setup & Migration Utility
 *
 * Sets up a dedicated media directory OUTSIDE the deployment folder.
 * Migrates any legacy media found inside the project folder so nothing is lost.
 * Configures .env with MEDIA_DIR.
 *
 * Usage:
 *   node scripts/setup-media.js [optional_target_directory]
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ENV_FILE = path.join(PROJECT_ROOT, '.env');

// Determine media target directory (default: ../phonesdaddy_media)
const customArg = process.argv[2];
let targetMediaDir;

if (customArg && customArg.trim()) {
  targetMediaDir = path.resolve(PROJECT_ROOT, customArg.trim());
} else if (process.env.MEDIA_DIR && process.env.MEDIA_DIR.trim()) {
  targetMediaDir = path.resolve(PROJECT_ROOT, process.env.MEDIA_DIR.trim());
} else {
  targetMediaDir = path.resolve(PROJECT_ROOT, '..', 'phonesdaddy_media');
}

console.log('====================================================');
console.log('🛡️  PhonesDaddy — Persistent Media Directory Setup');
console.log('====================================================');
console.log(`📁 Target Media Directory: ${targetMediaDir}`);

// Verify target directory is outside the project root for safety
const rel = path.relative(PROJECT_ROOT, targetMediaDir);
const isOutside = rel.startsWith('..') || path.isAbsolute(rel);

if (!isOutside) {
  console.warn('⚠️ Warning: Target directory is inside the project. For 100% deployment safety, it should be outside.');
} else {
  console.log('✅ Location verified: OUTSIDE deployment folder (100% safe from Git/ZIP overwrites).');
}

// 1. Create directory structure
const subdirs = [
  'uploads/phones',
  'uploads/brands',
  'uploads/branding',
  'uploads/news',
  'uploads/reviews',
  'webfiles/phones',
  'webfiles/brands',
  'webfiles/news',
  'webfiles/branding',
  'images'
];

for (const sub of subdirs) {
  const dirPath = path.join(targetMediaDir, sub);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
console.log('✅ Created media directory structure.');

// 2. Migrate existing files from project (if any)
function copyFilesRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return 0;
  let count = 0;
  const items = fs.readdirSync(srcDir);
  for (const item of items) {
    if (item === '.gitkeep') continue;
    const srcPath = path.join(srcDir, item);
    const destPath = path.join(destDir, item);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
      count += copyFilesRecursive(srcPath, destPath);
    } else {
      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        count++;
      }
    }
  }
  return count;
}

const legacyUploads = path.join(PROJECT_ROOT, 'server', 'uploads');
const legacyWebfiles = path.join(PROJECT_ROOT, 'public', 'webfiles');

let migratedUploads = 0;
let migratedWebfiles = 0;

if (fs.existsSync(legacyUploads)) {
  migratedUploads = copyFilesRecursive(legacyUploads, path.join(targetMediaDir, 'uploads'));
}
if (fs.existsSync(legacyWebfiles)) {
  migratedWebfiles = copyFilesRecursive(legacyWebfiles, path.join(targetMediaDir, 'webfiles'));
}

console.log(`✅ Media Migration:`);
console.log(`   • Migrated ${migratedUploads} files from server/uploads`);
console.log(`   • Migrated ${migratedWebfiles} files from public/webfiles`);

// 3. Update .env file
if (fs.existsSync(ENV_FILE)) {
  let envContent = fs.readFileSync(ENV_FILE, 'utf8');

  // Check if MEDIA_DIR is already configured
  if (/^MEDIA_DIR=/m.test(envContent)) {
    envContent = envContent.replace(/^MEDIA_DIR=.*/m, `MEDIA_DIR=${targetMediaDir}`);
  } else {
    envContent += `\n# Persistent Media Directory (Outside deployment folder)\nMEDIA_DIR=${targetMediaDir}\n`;
  }

  fs.writeFileSync(ENV_FILE, envContent, 'utf8');
  console.log(`✅ Updated .env with MEDIA_DIR=${targetMediaDir}`);
} else {
  console.log('ℹ️  .env file not found. Remember to set MEDIA_DIR=' + targetMediaDir + ' in your production .env');
}

console.log('\n====================================================');
console.log('🎉 Setup Complete! Your media is now safe across all deploys.');
console.log('====================================================\n');
