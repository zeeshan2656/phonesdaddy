const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Common User-Agent to avoid blocking
const DEFAULT_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache'
};

// Auto-generate clean URL slug
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

/**
 * Remove plain/solid background from mobile phone product images
 * Uses boundary flood-fill (BFS) with RGB Euclidean distance and edge feathering.
 * Preserves inner phone details, screen, and icons while making outer background transparent.
 */
async function removeImageBackground(inputBuffer) {
  try {
    const image = sharp(inputBuffer);
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;

    // Sample perimeter & corners to determine background color
    const samples = [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
      [Math.floor(width / 2), 0],
      [Math.floor(width / 2), height - 1],
      [0, Math.floor(height / 2)],
      [width - 1, Math.floor(height / 2)]
    ];

    let bgR = 0, bgG = 0, bgB = 0;
    for (const [cx, cy] of samples) {
      const idx = (cy * width + cx) * channels;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    }
    bgR = Math.round(bgR / samples.length);
    bgG = Math.round(bgG / samples.length);
    bgB = Math.round(bgB / samples.length);

    // Flood fill visited tracking & queue
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0;
    let tail = 0;

    const innerTol = 32; // Complete transparency
    const outerTol = 58; // Smooth feathered transition

    function colorDist(r, g, b) {
      return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
    }

    // Seed top and bottom borders
    for (let x = 0; x < width; x++) {
      let idx = x * channels;
      if (colorDist(data[idx], data[idx + 1], data[idx + 2]) <= outerTol) {
        visited[x] = 1;
        queue[tail++] = x;
      }
      let bPos = (height - 1) * width + x;
      idx = bPos * channels;
      if (colorDist(data[idx], data[idx + 1], data[idx + 2]) <= outerTol) {
        visited[bPos] = 1;
        queue[tail++] = bPos;
      }
    }

    // Seed left and right borders
    for (let y = 0; y < height; y++) {
      let lPos = y * width;
      let idx = lPos * channels;
      if (!visited[lPos] && colorDist(data[idx], data[idx + 1], data[idx + 2]) <= outerTol) {
        visited[lPos] = 1;
        queue[tail++] = lPos;
      }
      let rPos = y * width + (width - 1);
      idx = rPos * channels;
      if (!visited[rPos] && colorDist(data[idx], data[idx + 1], data[idx + 2]) <= outerTol) {
        visited[rPos] = 1;
        queue[tail++] = rPos;
      }
    }

    // BFS Flood-fill
    while (head < tail) {
      const pos = queue[head++];
      const x = pos % width;
      const y = Math.floor(pos / width);
      const pixelIdx = pos * channels;

      const r = data[pixelIdx];
      const g = data[pixelIdx + 1];
      const b = data[pixelIdx + 2];
      const d = colorDist(r, g, b);

      if (d <= innerTol) {
        data[pixelIdx + 3] = 0; // Fully transparent
      } else if (d <= outerTol) {
        const factor = (d - innerTol) / (outerTol - innerTol);
        data[pixelIdx + 3] = Math.round(255 * factor); // Anti-aliased feathering
      }

      const neighbors = [
        x > 0 ? pos - 1 : -1,
        x < width - 1 ? pos + 1 : -1,
        y > 0 ? pos - width : -1,
        y < height - 1 ? pos + width : -1
      ];

      for (const nPos of neighbors) {
        if (nPos >= 0 && !visited[nPos]) {
          const nIdx = nPos * channels;
          if (colorDist(data[nIdx], data[nIdx + 1], data[nIdx + 2]) <= outerTol) {
            visited[nPos] = 1;
            queue[tail++] = nPos;
          }
        }
      }
    }

    return await sharp(data, {
      raw: { width, height, channels: 4 }
    }).png().toBuffer();
  } catch (err) {
    console.error('removeImageBackground error, returning original buffer:', err.message);
    return inputBuffer;
  }
}

// Download remote image, remove background for transparency, and save to local uploads/phones directory
async function downloadScrapedImage(imageUrl, slug) {
  try {
    if (!imageUrl || !imageUrl.startsWith('http')) return null;

    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': DEFAULT_HEADERS['User-Agent'],
        'Referer': imageUrl
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!res.ok) {
      console.warn(`Failed to download image from ${imageUrl}: status ${res.status}`);
      return null;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Remove background to produce a transparent PNG
    let finalBuffer = buffer;
    try {
      finalBuffer = await removeImageBackground(buffer);
    } catch (bgErr) {
      console.warn('Background removal error:', bgErr.message);
    }

    const { optimizePhoneImage } = require('./imageOptimizer');
    const { url } = await optimizePhoneImage(finalBuffer, `scraped-${slugify(slug || 'phone')}`);
    return url;
  } catch (err) {
    console.error('Error downloading scraped phone image:', err.message);
    return null;
  }
}

/**
 * Download multiple images in parallel (with concurrency limit)
 * Each image gets background removed and saved locally
 * Returns array of local paths
 */
async function downloadAllImages(imageUrls, slug) {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return [];

  // Deduplicate URLs
  const unique = [...new Set(imageUrls.filter(u => u && u.startsWith('http')))];
  // Limit to first 12 images
  const limited = unique.slice(0, 12);

  const uploadDir = path.join(__dirname, '..', 'uploads', 'phones');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const results = [];
  // Process in batches of 3 to avoid rate limiting
  for (let i = 0; i < limited.length; i += 3) {
    const batch = limited.slice(i, i + 3);
    const batchResults = await Promise.all(batch.map(async (imgUrl, idx) => {
      try {
        const res = await fetch(imgUrl, {
          headers: {
            'User-Agent': DEFAULT_HEADERS['User-Agent'],
            'Referer': imgUrl
          },
          signal: AbortSignal.timeout(12000)
        });
        if (!res.ok) { console.warn(`Gallery img skip (${res.status}): ${imgUrl}`); return null; }

        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let finalBuffer = buffer;
        try {
          finalBuffer = await removeImageBackground(buffer);
        } catch (bgErr) {
          console.warn('Gallery BG removal error:', bgErr.message);
        }

        const { optimizePhoneImage } = require('./imageOptimizer');
        const optRes = await optimizePhoneImage(finalBuffer, `gallery-${slugify(slug || 'phone')}-${i + idx}`);
        return optRes ? optRes.url : null;
      } catch (err) {
        console.warn(`Gallery image download failed: ${imgUrl} – ${err.message}`);
        return null;
      }
    }));
    results.push(...batchResults.filter(Boolean));
    // Small delay between batches to avoid rate limits
    if (i + 3 < limited.length) await new Promise(r => setTimeout(r, 800));
  }
  return results;
}

/**
 * Fetch GSMArena gallery images strictly following user rule:
 * For GSMArena: add (-pictures) to the given link before (-ID.php)
 * Example: https://www.gsmarena.com/umidigi_g100x-14541.php
 *       -> https://www.gsmarena.com/umidigi_g100x-pictures-14541.php
 * If any image is available inside #pictures-list, fetch all of them. If none, skip.
 */
async function fetchGSMArenaGallery(mainPageUrl, mainImageUrl) {
  const imageUrls = [];
  if (mainImageUrl) imageUrls.push(mainImageUrl);

  try {
    let picturesUrl = mainPageUrl;
    if (!mainPageUrl.includes('-pictures-')) {
      picturesUrl = mainPageUrl.replace(/(-)(\d+\.php)$/i, '-pictures-$2');
    }

    if (picturesUrl !== mainPageUrl) {
      console.log(`Checking GSMArena pictures URL: ${picturesUrl}`);
      const picRes = await fetch(picturesUrl, {
        headers: DEFAULT_HEADERS,
        signal: AbortSignal.timeout(12000)
      });

      if (picRes.ok) {
        const picHtml = await picRes.text();
        const picListMatch = picHtml.match(/<div[^>]+id=["']pictures-list["'][^>]*>([\s\S]*?)<\/div>/i);
        if (picListMatch) {
          const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
          let m;
          while ((m = imgRegex.exec(picListMatch[1])) !== null) {
            let src = m[1];
            if (src && !src.includes('infinite-pics') && !src.includes('.gif')) {
              if (src.startsWith('//')) src = 'https:' + src;
              if (!imageUrls.includes(src)) {
                imageUrls.push(src);
              }
            }
          }
        }
      } else {
        console.warn(`GSMArena pictures URL skipped (${picRes.status}): ${picturesUrl}`);
      }
    }
  } catch (err) {
    console.warn('fetchGSMArenaGallery error:', err.message);
  }

  return imageUrls;
}

/**
 * Fetch WhatMobile gallery images strictly following user rule:
 * For WhatMobile: add (_Pictures) after URL
 * Example: https://www.whatmobile.com.pk/Vivo_Y53s
 *       -> https://www.whatmobile.com.pk/Vivo_Y53s_Pictures
 * Check if there is any picture in #pictures container, then fetch it. If none, skip.
 */
async function fetchWhatMobileGallery(mainPageUrl, mainImageUrl) {
  const imageUrls = [];
  if (mainImageUrl) imageUrls.push(mainImageUrl);

  try {
    const cleanUrl = mainPageUrl.replace(/\/+$/, '');
    const picturesUrl = cleanUrl.toLowerCase().endsWith('_pictures') ? cleanUrl : cleanUrl + '_Pictures';

    console.log(`Checking WhatMobile pictures URL: ${picturesUrl}`);
    const picRes = await fetch(picturesUrl, {
      headers: DEFAULT_HEADERS,
      signal: AbortSignal.timeout(12000)
    });

    if (picRes.ok) {
      const picHtml = await picRes.text();
      // Genuine phone photos live in #pictures container up to options navbar
      const picMatch = picHtml.match(/<div[^>]+id=["']pictures["'][^>]*>([\s\S]*?)(?:<!--\s*options navbar|<nav|<\/div>\s*<div)/i);
      if (picMatch) {
        const imgRegex = /<img[^>]+src=["']([^"']+)["']/gi;
        let m;
        while ((m = imgRegex.exec(picMatch[1])) !== null) {
          let src = m[1];
          if (src && src.includes('admin/images/')) {
            // Exclude unrelated sidebar phone thumbnails ending with -s.jpg or -s.png or -s
            if (!/-s\.(?:jpg|png|webp)/i.test(src) && !src.endsWith('-s') && !src.includes('.gif')) {
              if (!src.startsWith('http')) {
                src = 'https://www.whatmobile.com.pk/' + src.replace(/^\/+/, '');
              }
              if (!imageUrls.includes(src)) {
                imageUrls.push(src);
              }
            }
          }
        }
      }
    } else {
      console.warn(`WhatMobile pictures URL skipped (${picRes.status}): ${picturesUrl}`);
    }
  } catch (err) {
    console.warn('fetchWhatMobileGallery error:', err.message);
  }

  return imageUrls;
}

/**
 * Auto-generate Short Summary / Highlights as an editorial narrative paragraph
 * Matches WhatMobile / tech editorial style:
 * Title -> Price in Pakistan & USD -> Expected Launch & Memory -> Detailed Hardware Review Narrative
 * @param {Object} params - { specs, name, brand, pricePKR, priceUSD, releaseDate, status }
 * @returns {string} Formatted paragraph summary
 */
function generatePhoneParagraphSummary({ specs, name, brand, pricePKR, priceUSD, releaseDate, status }) {
  const safeName = name || '';
  const safeBrand = brand || '';
  const fullName = safeBrand && !safeName.toLowerCase().startsWith(safeBrand.toLowerCase()) 
    ? `${safeBrand} ${safeName}`.trim() 
    : (safeName || safeBrand || 'Mobile Device');

  function findSpec(secRegex, keyRegex) {
    const item = (specs || []).find(s => secRegex.test(s.section || '') && keyRegex.test(s.key || ''));
    return item ? item.value : '';
  }

  const displaySizeVal = findSpec(/display/i, /size/i);
  const displayTypeVal = findSpec(/display/i, /type|technology/i);
  const displayResVal = findSpec(/display/i, /resolution/i);
  const displayExtra = findSpec(/display/i, /extra|refresh/i);

  const chipsetVal = findSpec(/platform|processor/i, /chipset|cpu|processor/i);
  const osVal = findSpec(/platform/i, /os/i);
  const gpuVal = findSpec(/platform/i, /gpu/i);

  const memoryVal = findSpec(/memory/i, /internal|built-in|storage/i);
  const ramVal = findSpec(/memory/i, /ram/i);
  const romVal = findSpec(/memory/i, /internal storage|rom/i);

  const mainCamVal = findSpec(/camera|main camera/i, /triple|dual|single|quad|main/i);
  const selfieVal = findSpec(/selfie|camera/i, /single|front|selfie/i);

  const batteryVal = findSpec(/battery/i, /capacity|type/i);
  const chargingVal = findSpec(/battery/i, /charging|fast charging/i);
  const fingerprintVal = findSpec(/features/i, /fingerprint|sensors/i);

  const lines = [];

  // Title header
  lines.push(`${fullName} price in Pakistan`);

  let priceStr = pricePKR ? (pricePKR.startsWith('PKR') || pricePKR.startsWith('Rs') ? pricePKR : `Rs. ${pricePKR}`) : '';
  if (!priceStr) priceStr = 'is expected to be announced soon';
  else priceStr = `is expected to be ${priceStr}`;

  let releaseStr = releaseDate ? ` ${fullName} is expected to be launched on ${releaseDate}.` : '';

  let memVariant = '';
  if (ramVal && romVal) {
    memVariant = ` This is ${ramVal} / ${romVal} variant of ${safeBrand || fullName}.`;
  } else if (memoryVal) {
    const cleanMem = memoryVal.split(';')[0].replace(/\(.*?\)/g, '').trim();
    if (cleanMem) memVariant = ` This is ${cleanMem} variant of ${safeBrand || fullName}.`;
  }

  lines.push(`${fullName} price in Pakistan ${priceStr}.${releaseStr}${memVariant}`);

  if (pricePKR) {
    const formattedPKR = pricePKR.startsWith('PKR') ? pricePKR.replace('PKR', 'Rs.') : (pricePKR.startsWith('Rs') ? pricePKR : `Rs. ${pricePKR}`);
    lines.push(`Expected Price of ${fullName} in Pakistan is ${formattedPKR}.`);
  }
  if (priceUSD) {
    const cleanUSD = priceUSD.replace(/USD|\$/gi, '').trim();
    lines.push(`Expected Price of ${safeBrand || fullName} in USD is $${cleanUSD}.`);
  }

  let tagline = `${fullName} - Powerful & Stylish Device!`;
  if (batteryVal && /\b(6000|7000|6500|5500)\s*mAh/i.test(batteryVal)) {
    tagline = `${fullName} - A Big Battery Smartphone!`;
  } else if (mainCamVal && /\b(108|200|50)\s*MP/i.test(mainCamVal)) {
    tagline = `${fullName} - High-Resolution Camera Phone!`;
  }

  let story = `${tagline}\n`;
  story += `${fullName} is officially introduced with cutting-edge mobile hardware. `;

  if (chipsetVal) {
    story += `The smartphone is powered by the capable ${chipsetVal.replace(/\(.*?\)/g, '').trim()} chipset, providing smooth multitasking and reliable execution speed. `;
  }
  if (gpuVal) {
    story += `Graphical performance and gaming are handled by the ${gpuVal.replace(/\(.*?\)/g, '').trim()} GPU. `;
  }

  if (displaySizeVal || displayTypeVal) {
    let dispDesc = [];
    if (displaySizeVal) dispDesc.push(displaySizeVal.match(/[\d.]+\s*(?:inches|inch|")/i)?.[0] || displaySizeVal.split(',')[0]);
    if (displayTypeVal) dispDesc.push(displayTypeVal.split(',')[0]);
    if (displayExtra && /\d+Hz/i.test(displayExtra)) dispDesc.push(displayExtra.match(/\d+Hz/i)?.[0]);
    if (displayResVal) dispDesc.push(`with a crisp resolution of ${displayResVal.split(',')[0].trim()}`);
    story += `On the front, ${fullName} features a stunning ${dispDesc.join(' ')} display, delivering rich colors and immersive viewing angles. `;
  }

  if (mainCamVal) {
    story += `In the optics department, the handset will come equipped with a ${mainCamVal.split('\n')[0].replace(/\(.*?\)/g, '').trim()} setup for sharp photos and stabilized video recording. `;
  }
  if (selfieVal) {
    story += `The selfie shooter of the phone will be a ${selfieVal.split('\n')[0].replace(/\(.*?\)/g, '').trim()} sensor. `;
  }

  if (memoryVal || ramVal) {
    const memDesc = (ramVal && romVal) ? `${ramVal} RAM and ${romVal} storage` : (memoryVal ? memoryVal.split(',')[0].trim() : '');
    if (memDesc) {
      story += `It offers ${memDesc} to comfortably store apps, photos, and high-definition media without running out of space. `;
    }
  }

  if (batteryVal) {
    const mahMatch = batteryVal.match(/\d{3,5}\s*mAh/i)?.[0] || batteryVal.split(',')[0];
    const chargingStr = chargingVal ? ` backed by ${chargingVal.split(',')[0].trim()}` : '';
    story += `The handset is fueled with a generous ${mahMatch} battery${chargingStr}, ensuring full-day battery endurance with ease. `;
  }

  if (osVal) {
    story += `The device runs on ${osVal.split(',')[0].trim()}, offering an intuitive user experience and the latest security updates. `;
  }
  if (fingerprintVal) {
    story += `Security features include a fast ${fingerprintVal.split(',')[0].trim()}. `;
  }

  story += `The coming ${fullName} will be a strong contender in its market segment.`;

  lines.push('');
  lines.push(story);

  return lines.join('\n');
}

// Backward-compatibility wrapper for specs array
function generateShortSummary(specs, extra = {}) {
  if (Array.isArray(specs)) {
    return generatePhoneParagraphSummary({ specs, ...extra });
  }
  return generatePhoneParagraphSummary(specs || {});
}

// Extract editorial paragraphs directly from WhatMobile page HTML
function extractWhatMobileParagraph(html) {
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let match;
  const parts = [];

  while ((match = pRegex.exec(html)) !== null) {
    let clean = match[1]
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&#x24;/g, '$')
      .replace(/&amp;/g, '&')
      .replace(/\r/g, '')
      .split('\n')
      .map(line => line.trim().replace(/\s+/g, ' '))
      .filter(line => line.length > 0)
      .join('\n');

    if (
      clean.includes('price in Pakistan is') ||
      clean.includes('Price of ') ||
      clean.includes('is unveiling') ||
      clean.includes('has released') ||
      clean.includes('equipped with') ||
      clean.includes('empowered by') ||
      clean.includes('powered by')
    ) {
      if (!clean.includes('Disclaimer') && !clean.includes('Mobile Prices in Pakistan')) {
        parts.push(clean);
      }
    }
  }

  return parts.join('\n\n');
}

// Parse GSMArena HTML
function parseGSMArena(html, sourceUrl) {
  // Model Name
  const titleMatch = html.match(/<h1[^>]*class="[^"]*specs-phone-name-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i);
  let fullName = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
  if (!fullName) {
    const t = html.match(/<title>([\s\S]*?)<\/title>/i);
    fullName = t ? t[1].split('-')[0].trim() : '';
  }

  // Extract brand (e.g. "ZTE", "Samsung", "Apple") and separate model name
  let brand = '';
  let modelName = fullName;
  if (fullName) {
    const parts = fullName.split(' ');
    brand = parts[0];
    if (parts.length > 1) {
      modelName = parts.slice(1).join(' ').trim();
    }
  }

  // Main Image (prioritize high-resolution bigpic)
  let imageUrl = '';
  const imgMatch = html.match(/<div class="specs-photo-main">[\s\S]*?<img[^>]+src=["']?([^"'\s>]+)/i)
    || html.match(/<img[^>]+src=["']?([^"'\s>]+\/vv\/bigpic\/[^"'\s>]+)/i);
  if (imgMatch) {
    imageUrl = imgMatch[1];
    if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;
  }

  // Multi-Country Prices
  let pricePKR = '';
  let priceUSD = '';
  let priceINR = '';
  let priceGBP = '';
  let numericPrice = 0;

  // Section mapping
  const sectionMap = {
    'network': 'Network',
    'launch': 'Launch',
    'body': 'Body',
    'display': 'Display',
    'platform': 'Platform',
    'memory': 'Memory',
    'main camera': 'Main Camera',
    'selfie camera': 'Selfie Camera',
    'sound': 'Sound',
    'comms': 'Connectivity',
    'features': 'Features',
    'battery': 'Battery',
    'misc': 'Price'
  };

  const specs = [];
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  let tMatch;

  while ((tMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tMatch[1];
    const thMatch = tableHtml.match(/<th[^>]*>([\s\S]*?)<\/th>/i);
    if (!thMatch) continue;

    const rawSection = thMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
    const sectionName = sectionMap[rawSection] || (rawSection.charAt(0).toUpperCase() + rawSection.slice(1));

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;
    let lastKey = '';

    while ((trMatch = trRegex.exec(tableHtml)) !== null) {
      const trContent = trMatch[1];
      const ttlMatch = trContent.match(/<td class="ttl"[^>]*>([\s\S]*?)<\/td>/i);
      const nfoMatch = trContent.match(/<td class="nfo"[^>]*>([\s\S]*?)<\/td>/i);
      if (!nfoMatch) continue;

      let key = ttlMatch ? ttlMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() : '';
      let value = nfoMatch[1].replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

      if (!key && lastKey) {
        key = lastKey;
      } else if (key) {
        lastKey = key;
      }

      if (key && value) {
        // Extract pricing hints
        if (sectionName === 'Price' || key.toLowerCase().includes('price')) {
          if (value.includes('$')) {
            const m = value.match(/\$\s*([\d,.]+)/);
            if (m) priceUSD = 'USD ' + m[1];
          }
          if (value.includes('₹')) {
            const m = value.match(/₹\s*([\d,.]+)/);
            if (m) priceINR = 'INR ' + m[1];
          }
          if (value.includes('£')) {
            const m = value.match(/£\s*([\d,.]+)/);
            if (m) priceGBP = 'GBP ' + m[1];
          }
          if (value.includes('About') || value.includes('EUR') || value.includes('€')) {
            const m = value.match(/([\d,.]+)\s*EUR|€\s*([\d,.]+)/);
            const amt = m ? (m[1] || m[2]) : null;
            if (amt && !priceUSD) {
              const num = parseFloat(amt.replace(/,/g, ''));
              if (num) priceUSD = 'USD ' + Math.round(num * 1.08);
            }
          }
        }

        specs.push({
          section: sectionName,
          key,
          value
        });
      }
    }
  }

  // Release Date & Status
  let status = 'Available';
  let releaseDate = '';

  specs.forEach(s => {
    if (s.section === 'Launch') {
      const k = s.key.toLowerCase();
      const v = s.value.toLowerCase();
      if (k.includes('status')) {
        if (v.includes('available')) status = 'Available';
        else if (v.includes('rumor')) status = 'Rumored';
        else if (v.includes('upcoming') || v.includes('exp.')) status = 'Upcoming';
        else if (v.includes('discontinued')) status = 'Discontinued';
      }
      if (k.includes('announced') || k.includes('status')) {
        if (!releaseDate) releaseDate = s.value.slice(0, 40);
      }
    }
  });

  const shortSummary = generatePhoneParagraphSummary({
    specs,
    name: modelName,
    brand,
    pricePKR,
    priceUSD,
    releaseDate,
    status
  });

  return {
    source: 'gsmarena',
    sourceUrl,
    name: modelName,
    fullName: fullName,
    brand,
    slug: slugify(modelName || fullName),
    price: numericPrice,
    status,
    releaseDate,
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],  // will be expanded by fetchGSMArenaGallery
    shortSummary,
    prices: [
      { country: 'Pakistan', currency: 'PKR', amount: pricePKR },
      { country: 'USA', currency: 'USD', amount: priceUSD },
      { country: 'India', currency: 'INR', amount: priceINR },
      { country: 'UK', currency: 'GBP', amount: priceGBP }
    ].filter(p => p.amount && p.amount.trim() !== ''),
    specs
  };
}

// Parse WhatMobile HTML
function parseWhatMobile(html, sourceUrl) {
  // Title
  let fullName = '';
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) {
    fullName = h1Match[1].replace(/<[^>]+>/g, '').trim();
  }
  if (!fullName) {
    const tMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
    if (tMatch) {
      fullName = tMatch[1].split('Price in Pakistan')[0].replace(/Specs|Specifications/gi, '').trim();
    }
  }

  // Extract brand and clean model name without brand
  let brand = '';
  let modelName = fullName;
  if (fullName) {
    const parts = fullName.split(' ');
    brand = parts[0];
    if (parts.length > 1) {
      modelName = parts.slice(1).join(' ').trim();
    }
  }

  // Image
  let imageUrl = '';
  const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
  let im;
  while ((im = imgRegex.exec(html)) !== null) {
    const src = im[1];
    if (src.includes('admin/images/') && (src.endsWith('-b.jpg') || src.endsWith('.jpg') || src.endsWith('.png'))) {
      imageUrl = src.startsWith('http') ? src : 'https://www.whatmobile.com.pk/' + src.replace(/^\.?\//, '');
      break;
    }
  }

  // Price PKR
  let pricePKR = '';
  let numericPrice = 0;
  const pMatch = html.match(/Price in Rs:?\s*<strong[^>]*>([\s\S]*?)<\/strong>/i)
    || html.match(/Rs\.\s*([\d,]+)/i);
  if (pMatch) {
    const cleanP = pMatch[1].replace(/<[^>]+>/g, '').replace(/,/g, '').trim();
    numericPrice = parseInt(cleanP, 10) || 0;
    if (numericPrice > 0) {
      pricePKR = 'PKR ' + numericPrice.toLocaleString();
    }
  }

  // USD price if available
  let priceUSD = '';
  const usdMatch = html.match(/Price in USD:?\s*<strong[^>]*>([\s\S]*?)<\/strong>/i)
    || html.match(/\$\s*([\d,]+)/i);
  if (usdMatch) {
    const cleanUSD = usdMatch[1].replace(/<[^>]+>/g, '').replace(/,/g, '').trim();
    priceUSD = 'USD ' + cleanUSD;
  }

  // Section mapping
  const sectionMap = {
    'build': 'Body',
    'frequency': 'Network',
    'processor': 'Platform',
    'display': 'Display',
    'memory': 'Memory',
    'camera': 'Main Camera',
    'connectivity': 'Connectivity',
    'features': 'Features',
    'battery': 'Battery',
    'price': 'Price'
  };

  const specs = [];
  let currentSection = 'Body';

  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch;

  while ((trMatch = trRegex.exec(html)) !== null) {
    const tr = trMatch[1];

    // Check for section heading
    const headingMatch = tr.match(/class="[^"]*specs-mainHeading[^"]*"[^>]*>([\s\S]*?)<\/td>/i)
      || tr.match(/<td[^>]+rowspan[^>]*class="[^"]*hdngArial[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
    if (headingMatch) {
      const rawSec = headingMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
      currentSection = sectionMap[rawSec] || (rawSec.charAt(0).toUpperCase() + rawSec.slice(1));
    }

    // Check for sub heading (key) & value
    const keyMatch = tr.match(/<th[^>]*class="[^"]*specs-subHeading[^"]*"[^>]*>([\s\S]*?)<\/th>/i);
    const valMatch = tr.match(/<td[^>]*class="[^"]*specs-value[^"]*"[^>]*>([\s\S]*?)<\/td>/i);

    if (keyMatch && valMatch) {
      const key = keyMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      const val = valMatch[1].replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

      if (key && val) {
        let finalSection = currentSection;

        // Categorize special fields
        const lowerKey = key.toLowerCase();
        if (currentSection === 'Body' && (lowerKey === 'os' || lowerKey === 'ui')) {
          finalSection = 'Platform';
        } else if (currentSection === 'Main Camera' && lowerKey.includes('front')) {
          finalSection = 'Selfie Camera';
        } else if (lowerKey.includes('audio') || lowerKey.includes('speaker') || lowerKey.includes('3.5mm') || lowerKey.includes('sound')) {
          finalSection = 'Sound';
        }

        specs.push({
          section: finalSection,
          key,
          value: val
        });
      }
    }
  }

  const scrapedParagraph = extractWhatMobileParagraph(html);
  const shortSummary = (scrapedParagraph && scrapedParagraph.length > 80)
    ? scrapedParagraph
    : generatePhoneParagraphSummary({
        specs,
        name: modelName,
        brand,
        pricePKR,
        priceUSD
      });

  return {
    source: 'whatmobile',
    sourceUrl,
    name: modelName,
    fullName: fullName,
    brand,
    slug: slugify(modelName || fullName),
    price: numericPrice,
    status: 'Available',
    releaseDate: '',
    imageUrl,
    imageUrls: imageUrl ? [imageUrl] : [],
    shortSummary,
    prices: [
      { country: 'Pakistan', currency: 'PKR', amount: pricePKR },
      { country: 'USA', currency: 'USD', amount: priceUSD }
    ].filter(p => p.amount && p.amount.trim() !== ''),
    specs
  };
}

/**
 * Main scraper entrypoint
 * @param {string} url - Target URL from whatmobile.com.pk or gsmarena.com
 */
async function scrapePhoneFromUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Please provide a valid URL.');
  }

  const trimmedUrl = url.trim();
  let parsedUrl;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch (e) {
    throw new Error('Invalid URL format. Please paste a full web link (e.g. https://www.gsmarena.com/...)');
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const isGsmArena = hostname.includes('gsmarena.com');
  const isWhatMobile = hostname.includes('whatmobile.com.pk');

  if (!isGsmArena && !isWhatMobile) {
    throw new Error('Unsupported website. Please provide a link from https://www.gsmarena.com/ or https://www.whatmobile.com.pk/');
  }

  // Fetch page HTML
  const res = await fetch(trimmedUrl, {
    headers: DEFAULT_HEADERS,
    signal: AbortSignal.timeout(15000)
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch page from ${hostname} (HTTP ${res.status}: ${res.statusText})`);
  }

  const html = await res.text();
  let parsedData;

  if (isGsmArena) {
    parsedData = parseGSMArena(html, trimmedUrl);
    // Fetch additional gallery images strictly from GSMArena pictures URL: *-pictures-ID.php
    const gsmGalleryUrls = await fetchGSMArenaGallery(trimmedUrl, parsedData.imageUrl);
    parsedData.imageUrls = gsmGalleryUrls;
  } else {
    parsedData = parseWhatMobile(html, trimmedUrl);
    // Fetch additional gallery images strictly from WhatMobile pictures URL: *_Pictures
    const wmGalleryUrls = await fetchWhatMobileGallery(trimmedUrl, parsedData.imageUrl);
    parsedData.imageUrls = wmGalleryUrls;
  }

  if (!parsedData.name) {
    throw new Error('Could not identify phone name from this URL. Please verify the link.');
  }

  // Download all gallery images to local storage
  const allRemoteUrls = (parsedData.imageUrls && parsedData.imageUrls.length > 0)
    ? parsedData.imageUrls
    : (parsedData.imageUrl ? [parsedData.imageUrl] : []);

  if (allRemoteUrls.length > 0) {
    console.log(`Downloading ${allRemoteUrls.length} images for ${parsedData.name}...`);
    const localImages = await downloadAllImages(allRemoteUrls, parsedData.slug);

    if (localImages.length > 0) {
      parsedData.image = localImages[0];           // primary image
      parsedData.images = localImages;             // all gallery images
      parsedData.localImage = true;
    } else {
      parsedData.image = parsedData.imageUrl || (allRemoteUrls[0] || '/images/placeholder.svg');
      parsedData.images = (allRemoteUrls.length > 0) ? allRemoteUrls : (parsedData.imageUrl ? [parsedData.imageUrl] : []);
      parsedData.localImage = false;
    }
  } else {
    parsedData.image = '/images/placeholder.svg';
    parsedData.images = [];
    parsedData.localImage = false;
  }

  if (!parsedData.shortSummary && parsedData.specs) {
    parsedData.shortSummary = generateShortSummary(parsedData.specs);
  }

  return parsedData;
}

module.exports = {
  scrapePhoneFromUrl,
  generateShortSummary,
  generatePhoneParagraphSummary,
  extractWhatMobileParagraph,
  parseGSMArena,
  parseWhatMobile,
  downloadScrapedImage,
  downloadAllImages,
  fetchGSMArenaGallery,
  fetchWhatMobileGallery
};
