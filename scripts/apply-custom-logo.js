const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { pool } = require('../server/config/database');
const SettingsModel = require('../server/models/settingsModel');

const SRC_IMAGE = path.resolve('C:/Users/Basharat/.gemini/antigravity-ide/brain/95045f4a-6538-4fd1-86b9-9b48f214752f/.user_uploaded/media_1791062492154.png');
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const UPLOADS_PWA_DIR = path.join(PUBLIC_DIR, 'uploads/pwa');

async function main() {
  console.log('1. Reading source image:', SRC_IMAGE);
  if (!fs.existsSync(SRC_IMAGE)) {
    throw new Error('Source image not found at ' + SRC_IMAGE);
  }

  if (!fs.existsSync(UPLOADS_PWA_DIR)) {
    fs.mkdirSync(UPLOADS_PWA_DIR, { recursive: true });
  }

  // Load raw RGBA pixels
  const { data, info } = await sharp(SRC_IMAGE).raw().toBuffer({ resolveWithObject: true });

  // 1. Clean background: eliminate faint alpha noise (< 10)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 10) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }

  // 2. Find tight bounding box of the artwork
  let minX = info.width, maxX = 0, minY = info.height, maxY = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a >= 12) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;
  console.log(`Tight logo bounds: [${minX}, ${minY}] to [${maxX}, ${maxY}] -> ${cropW} x ${cropH}`);

  // Extract clean tightly cropped logo
  const tightLogoBuffer = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 }
  })
  .extract({ left: minX, top: minY, width: cropW, height: cropH })
  .png({ compressionLevel: 9 })
  .toBuffer();

  /**
   * Helper to place cropped logo into a centered canvas of size (canvasW x canvasH)
   * with transparent or colored background, scaled by scaleRatio.
   */
  async function createCenteredIcon(targetSize, scaleRatio = 0.88, bg = { r: 0, g: 0, b: 0, alpha: 0 }) {
    const maxInnerSize = Math.round(targetSize * scaleRatio);
    // Resize logo to fit inside maxInnerSize while maintaining aspect ratio
    const resizedLogo = await sharp(tightLogoBuffer)
      .resize(maxInnerSize, maxInnerSize, { fit: 'inside' })
      .toBuffer({ resolveWithObject: true });

    const left = Math.round((targetSize - resizedLogo.info.width) / 2);
    const top = Math.round((targetSize - resizedLogo.info.height) / 2);

    return sharp({
      create: {
        width: targetSize,
        height: targetSize,
        channels: 4,
        background: bg
      }
    })
    .composite([{ input: resizedLogo.data, left, top }])
    .png({ compressionLevel: 9 });
  }

  console.log('2. Generating master high-res transparent icon (1024x1024)...');
  const master1024 = await createCenteredIcon(1024, 0.88);
  const master1024Path = path.join(UPLOADS_PWA_DIR, 'pwa-custom-icon.png');
  await master1024.toFile(master1024Path);
  console.log('   Saved:', master1024Path);

  console.log('3. Generating standard transparent PWA icons...');
  // 512x512 Transparent
  const icon512 = await createCenteredIcon(512, 0.88);
  await icon512.toFile(path.join(PUBLIC_DIR, 'icon-512x512.png'));
  await icon512.toFile(path.join(PUBLIC_DIR, 'favicon-512x512.png'));
  await icon512.toFile(path.join(UPLOADS_PWA_DIR, 'icon-512x512.png'));

  // 192x192 Transparent
  const icon192 = await createCenteredIcon(192, 0.88);
  await icon192.toFile(path.join(PUBLIC_DIR, 'icon-192x192.png'));
  await icon192.toFile(path.join(PUBLIC_DIR, 'favicon-192x192.png'));

  // 32x32 Favicon Transparent
  const icon32 = await createCenteredIcon(32, 0.94);
  await icon32.toFile(path.join(PUBLIC_DIR, 'favicon-32x32.png'));
  await icon32.toFile(path.join(PUBLIC_DIR, 'favicon.ico'));

  console.log('4. Generating maskable icons with safe-zone padding and theme background...');
  // Maskable 512x512: Theme background #0f172a, logo scaled to 74% inside 80% safe zone circle
  const maskable512 = await createCenteredIcon(512, 0.74, { r: 15, g: 23, b: 42, alpha: 1 });
  await maskable512.toFile(path.join(PUBLIC_DIR, 'icon-maskable-512x512.png'));

  // Maskable 192x192:
  const maskable192 = await createCenteredIcon(192, 0.74, { r: 15, g: 23, b: 42, alpha: 1 });
  await maskable192.toFile(path.join(PUBLIC_DIR, 'icon-maskable-192x192.png'));

  // Apple Touch Icon 180x180:
  const appleTouch = await createCenteredIcon(180, 0.78, { r: 15, g: 23, b: 42, alpha: 1 });
  await appleTouch.toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  console.log('5. Updating site_settings in database...');
  await SettingsModel.ensureTable();
  await SettingsModel.updateSettings({
    pwa_custom_icon: '/uploads/pwa/pwa-custom-icon.png',
    site_logo: '/uploads/pwa/pwa-custom-icon.png',
    site_favicon: '/favicon-512x512.png'
  });

  console.log('6. Updating manifest.json and manifest.webmanifest...');
  const manifestPath = path.join(PUBLIC_DIR, 'manifest.json');
  const webmanifestPath = path.join(PUBLIC_DIR, 'manifest.webmanifest');

  let manifest = {};
  if (fs.existsSync(manifestPath)) {
    try { manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')); } catch (_) {}
  }

  manifest.icons = [
    { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    { src: '/favicon-192x192.png', sizes: '192x192', type: 'image/png' },
    { src: '/favicon-512x512.png', sizes: '512x512', type: 'image/png' }
  ];

  const jsonStr = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(manifestPath, jsonStr, 'utf8');
  fs.writeFileSync(webmanifestPath, jsonStr, 'utf8');

  console.log('\n🎉 SUCCESS: Transparent background applied, icon fitted perfectly, and all PWA icons generated!');
  process.exit(0);
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
