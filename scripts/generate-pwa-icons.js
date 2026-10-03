const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const PUBLIC_DIR = path.resolve(__dirname, '../public');

// Vector icon definition matching PhonesDaddy branding
function createIconSvg(size, isMaskable = false) {
  // Safe zone calculation for maskable icons (80% safe diameter)
  const paddingRatio = isMaskable ? 0.22 : 0.12;
  const pad = size * paddingRatio;
  const innerSize = size - pad * 2;
  
  // Phone dimensions proportional to 28x40 ratio (0.7)
  const phoneH = innerSize;
  const phoneW = innerSize * 0.68;
  const phoneX = (size - phoneW) / 2;
  const phoneY = (size - phoneH) / 2;
  
  const outerRx = phoneW * 0.18;
  const screenRx = phoneW * 0.08;
  const screenBorder = phoneW * 0.07;
  const screenW = phoneW - screenBorder * 2;
  const screenH = phoneH - screenBorder * 2.2;
  const screenX = phoneX + screenBorder;
  const screenY = phoneY + screenBorder * 1.2;

  // Background elements
  let bgMarkup = '';
  if (isMaskable) {
    // Maskable must have 100% full background covering the entire square canvas
    bgMarkup = `
      <rect width="${size}" height="${size}" fill="#0f172a"/>
      <radialGradient id="maskableGlow" cx="50%" cy="45%" r="65%">
        <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.25"/>
        <stop offset="60%" stop-color="#0d9488" stop-opacity="0.08"/>
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
      </radialGradient>
      <rect width="${size}" height="${size}" fill="url(#maskableGlow)"/>
    `;
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
    <defs>
      <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0d9488"/>
        <stop offset="50%" stop-color="#14b8a6"/>
        <stop offset="100%" stop-color="#2dd4bf"/>
      </linearGradient>
      <linearGradient id="screenGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
      <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#38bdf8"/>
        <stop offset="100%" stop-color="#818cf8"/>
      </linearGradient>
      <filter id="phoneShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="${size * 0.02}" stdDeviation="${size * 0.03}" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>

    ${bgMarkup}

    <g filter="${isMaskable ? 'url(#phoneShadow)' : 'none'}">
      <!-- Phone Outer Shell -->
      <rect x="${phoneX}" y="${phoneY}" width="${phoneW}" height="${phoneH}" rx="${outerRx}" fill="url(#bodyGrad)"/>
      
      <!-- Phone Display Screen -->
      <rect x="${screenX}" y="${screenY}" width="${screenW}" height="${screenH}" rx="${screenRx}" fill="url(#screenGrad)"/>
      
      <!-- Dynamic Island / Top Camera -->
      <rect x="${phoneX + (phoneW - phoneW * 0.32) / 2}" y="${screenY + phoneH * 0.03}" width="${phoneW * 0.32}" height="${phoneH * 0.032}" rx="${phoneH * 0.016}" fill="#020617"/>
      <circle cx="${phoneX + phoneW / 2 + phoneW * 0.09}" cy="${screenY + phoneH * 0.046}" r="${phoneH * 0.008}" fill="#0d9488" opacity="0.8"/>

      <!-- Screen Graphic: Stylized 'P' & 'D' / Signal Waves -->
      <path d="M ${screenX + screenW * 0.22} ${screenY + screenH * 0.28} 
               L ${screenX + screenW * 0.22} ${screenY + screenH * 0.72} 
               M ${screenX + screenW * 0.22} ${screenY + screenH * 0.28} 
               H ${screenX + screenW * 0.55} 
               C ${screenX + screenW * 0.78} ${screenY + screenH * 0.28}, ${screenX + screenW * 0.78} ${screenY + screenH * 0.50}, ${screenX + screenW * 0.55} ${screenY + screenH * 0.50} 
               H ${screenX + screenW * 0.22}" 
            stroke="url(#bodyGrad)" stroke-width="${phoneW * 0.09}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>

      <!-- Accent dot on screen -->
      <circle cx="${screenX + screenW * 0.68}" cy="${screenY + screenH * 0.64}" r="${phoneW * 0.06}" fill="url(#accentGrad)"/>

      <!-- Bottom Home Bar -->
      <rect x="${phoneX + (phoneW - phoneW * 0.36) / 2}" y="${screenY + screenH - phoneH * 0.04}" width="${phoneW * 0.36}" height="${phoneH * 0.016}" rx="${phoneH * 0.008}" fill="#ffffff" opacity="0.75"/>
    </g>
  </svg>`;
}

// Shortcut Icon Generator (Phones, Compare, Tax, News)
function createShortcutSvg(type) {
  let pathD = '';
  if (type === 'phones') {
    // Phone outline
    pathD = `<rect x="28" y="16" width="40" height="64" rx="8" stroke="#14b8a6" stroke-width="6" fill="none"/>
             <circle cx="48" cy="70" r="3" fill="#14b8a6"/>
             <rect x="42" y="22" width="12" height="3" rx="1.5" fill="#14b8a6"/>`;
  } else if (type === 'compare') {
    // Two phones / scale arrows
    pathD = `<rect x="18" y="24" width="26" height="48" rx="5" stroke="#38bdf8" stroke-width="4.5" fill="none"/>
             <rect x="52" y="24" width="26" height="48" rx="5" stroke="#14b8a6" stroke-width="4.5" fill="none"/>
             <path d="M 38 48 L 58 48 M 52 42 L 58 48 L 52 54" stroke="#f59e0b" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (type === 'tax') {
    // Calculator / tax shield
    pathD = `<rect x="22" y="18" width="52" height="60" rx="8" stroke="#10b981" stroke-width="5" fill="none"/>
             <rect x="30" y="26" width="36" height="12" rx="3" fill="#10b981" opacity="0.3"/>
             <circle cx="34" cy="48" r="3.5" fill="#10b981"/>
             <circle cx="48" cy="48" r="3.5" fill="#10b981"/>
             <circle cx="62" cy="48" r="3.5" fill="#10b981"/>
             <circle cx="34" cy="62" r="3.5" fill="#10b981"/>
             <circle cx="48" cy="62" r="3.5" fill="#10b981"/>
             <circle cx="62" cy="62" r="3.5" fill="#10b981"/>`;
  } else if (type === 'news') {
    // Newspaper / lightning
    pathD = `<rect x="20" y="22" width="56" height="52" rx="6" stroke="#f59e0b" stroke-width="5" fill="none"/>
             <line x1="30" y1="34" x2="66" y2="34" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
             <line x1="30" y1="44" x2="66" y2="44" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>
             <line x1="30" y1="54" x2="52" y2="54" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/>`;
  }

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
    <rect width="96" height="96" rx="20" fill="#0f172a"/>
    ${pathD}
  </svg>`;
}

async function generate() {
  console.log('🎨 Generating High-Resolution PWA Icons...');

  const iconsToBuild = [
    // Standard PWA icons (Transparent/Alpha for app drawers)
    { file: 'icon-192x192.png', size: 192, maskable: false },
    { file: 'icon-512x512.png', size: 512, maskable: false },
    { file: 'favicon-192x192.png', size: 192, maskable: false },
    { file: 'favicon-512x512.png', size: 512, maskable: false },

    // Maskable PWA icons (Full background, central safe-zone padded)
    { file: 'icon-maskable-192x192.png', size: 192, maskable: true },
    { file: 'icon-maskable-512x512.png', size: 512, maskable: true },

    // Apple Touch Icon (Opaque 180x180 for iOS home screens)
    { file: 'apple-touch-icon.png', size: 180, maskable: true }
  ];

  for (const item of iconsToBuild) {
    const svgStr = createIconSvg(item.size, item.maskable);
    const dest = path.join(PUBLIC_DIR, item.file);
    await sharp(Buffer.from(svgStr))
      .png({ quality: 100, compressionLevel: 9 })
      .toFile(dest);
    console.log(`  ✓ Created: ${item.file} (${item.size}x${item.size}, maskable: ${item.maskable})`);
  }

  // Generate shortcut icons
  const shortcuts = ['phones', 'compare', 'tax', 'news'];
  for (const s of shortcuts) {
    const svgStr = createShortcutSvg(s);
    const dest = path.join(PUBLIC_DIR, `shortcut-${s}.png`);
    await sharp(Buffer.from(svgStr))
      .png({ quality: 100 })
      .toFile(dest);
    console.log(`  ✓ Created: shortcut-${s}.png (96x96)`);
  }

  console.log('✅ All PWA Icons generated successfully!');
}

generate().catch(console.error);
