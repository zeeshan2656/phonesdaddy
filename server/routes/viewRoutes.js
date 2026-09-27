const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const PhoneModel = require('../models/phoneModel');
const BrandModel = require('../models/brandModel');
const SettingsModel = require('../models/settingsModel');
const NewsModel = require('../models/newsModel');
const PageModel = require('../models/pageModel');
const { 
  requireAdminAuth, 
  requireMasterAdmin, 
  requirePhonePermission, 
  requireArticlePermission 
} = require('../middleware/auth');
const { pool } = require('../config/database');
const { cache } = require('../utils/cache');

const viewsDir = path.join(__dirname, '../../views');
const adminDir = path.join(__dirname, '../../admin');

const templateCache = new Map();

function getTemplateHtml(templateFile) {
  if (templateCache.has(templateFile)) {
    return templateCache.get(templateFile);
  }
  const filePath = path.join(viewsDir, templateFile);
  const content = fs.readFileSync(filePath, 'utf8');
  templateCache.set(templateFile, content);
  return content;
}

/**
/**
 * Helper to generate rendered HTML string with custom snippets and branding
 */
async function getRenderedViewHtml(templateFile, replacements = {}) {
  let html = getTemplateHtml(templateFile);

  const bundle = await SettingsModel.getViewSnippetsBundle();
  const branding = bundle.branding;

  // If footer_copyright has hardcoded PhonesDaddy and buyer changed site_name
  let footerCopyright = branding.footer_copyright || '';
  if (branding.site_name && branding.site_name !== 'PhonesDaddy') {
    footerCopyright = footerCopyright.replace(/PhonesDaddy/g, branding.site_name);
  }

  // Common branding replacements
  const commonReplacements = {
    '{{SITE_NAME}}': escapeHtml(branding.site_name),
    '{{SITE_TAGLINE}}': escapeHtml(branding.site_tagline),
    '{{SITE_DESCRIPTION}}': escapeHtml(branding.site_description),
    '{{SITE_URL}}': branding.site_url,
    '{{SITE_LOGO_URL}}': branding.site_logo || '/images/logo.png',
    '{{SITE_LOGO_HTML}}': bundle.headerLogoHtml,
    '{{SITE_FOOTER_LOGO_HTML}}': bundle.footerLogoHtml,
    '{{SITE_FAVICON_TAG}}': bundle.faviconTag,
    '{{FOOTER_COPYRIGHT}}': escapeHtml(footerCopyright),
    '{{FOOTER_ABOUT}}': escapeHtml(branding.site_description)
  };

  const allReplacements = { ...commonReplacements, ...replacements };

  for (const [key, val] of Object.entries(allReplacements)) {
    html = html.replace(new RegExp(key, 'g'), val);
  }

  // If buyer changed site_name, clean up any residual PhonesDaddy strings in the rendered page
  if (branding.site_name && branding.site_name !== 'PhonesDaddy') {
    html = html.replace(/PhonesDaddy/g, escapeHtml(branding.site_name));
  }

  // Ensure favicon is present in <head>
  if (html.includes('</head>')) {
    if (!html.includes('rel="icon"') && !html.includes("rel='icon'")) {
      html = html.replace('</head>', `\n  ${bundle.faviconTag}\n</head>`);
    }
  }

  // Inject Custom Head & Body Snippets
  if (bundle.headCode) {
    if (html.includes('</head>')) {
      html = html.replace('</head>', `\n<!-- Custom Head Snippets (AdSense / Analytics / Adsterra / Custom) -->\n${bundle.headCode}\n</head>`);
    } else {
      html = bundle.headCode + '\n' + html;
    }
  }

  if (bundle.bodyCode) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', `\n<!-- Custom Body Snippets -->\n${bundle.bodyCode}\n</body>`);
    }
  }

  // Inject Custom Ad Placements (Google AdSense Units)
  const ads = bundle.adSlots;
  html = html
    .replace(/\{\{AD_PHONE_TOP\}\}/g, ads.adPhoneTop)
    .replace(/\{\{AD_PHONE_MID\}\}/g, ads.adPhoneMid)
    .replace(/\{\{AD_PHONE_SPEC_2\}\}/g, ads.adPhoneSpec2)
    .replace(/\{\{AD_PHONE_BOTTOM\}\}/g, ads.adPhoneBottom)
    .replace(/\{\{AD_SIDEBAR_TOP\}\}/g, ads.adSidebarTop)
    .replace(/\{\{AD_SIDEBAR_BOTTOM\}\}/g, ads.adSidebarBottom)
    .replace(/\{\{AD_ARTICLE_TOP\}\}/g, ads.adArticleTop)
    .replace(/\{\{AD_ARTICLE_MID\}\}/g, ads.adArticleMid)
    .replace(/\{\{AD_ARTICLE_BOTTOM\}\}/g, ads.adArticleBottom);

  return html;
}

/**
 * Helper to render HTML view with custom <head> and <body> snippets, and dynamic branding injected
 * High performance: Uses in-memory template cache and unified settings bundle
 */
async function renderViewWithSnippets(res, templateFile, replacements = {}, statusCode = 200) {
  const html = await getRenderedViewHtml(templateFile, replacements);
  res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=360');
  res.status(statusCode).send(html);
}

// Cache key & TTL for Homepage SSR
const HOME_SSR_CACHE_KEY = 'view_home_ssr_replacements';
const HOME_SSR_TTL_SECONDS = 180; // 3 minutes

async function getQuickCompareOptions() {
  const cached = cache.get('QUICK_COMPARE_OPTIONS_HTML');
  if (cached) return cached;

  try {
    const [phones] = await pool.query(`
      SELECT p.slug, p.name, b.name AS brand_name 
      FROM phones p 
      JOIN brands b ON p.brand_id = b.id 
      ORDER BY b.name ASC, p.name ASC
    `);

    const byBrand = {};
    for (const p of phones) {
      const bName = p.brand_name || 'Other';
      if (!byBrand[bName]) byBrand[bName] = [];
      byBrand[bName].push(p);
    }

    let html = '';
    for (const [brand, list] of Object.entries(byBrand)) {
      html += `<optgroup label="${escapeAttr(brand)}">`;
      for (const p of list) {
        const displayName = p.name.toLowerCase().startsWith(brand.toLowerCase())
          ? p.name
          : `${brand} ${p.name}`;
        html += `<option value="${escapeAttr(p.slug)}">${escapeHtml(displayName)}</option>`;
      }
      html += `</optgroup>`;
    }

    cache.set('QUICK_COMPARE_OPTIONS_HTML', html, 600, ['phones', 'brands']);
    return html;
  } catch (err) {
    console.error('getQuickCompareOptions error:', err);
    return '';
  }
}

async function getHomeSsrReplacements() {
  const cached = cache.get(HOME_SSR_CACHE_KEY);
  if (cached) {
    return cached;
  }

  try {
    const [latestPhones, popularPhones, upcomingPhones, topBrands, articles] = await Promise.all([
      pool.query(`
        SELECT p.id, p.name, p.slug, p.image, b.name AS brand_name
        FROM phones p
        JOIN brands b ON p.brand_id = b.id
        ORDER BY p.id DESC
        LIMIT 16
      `).then(([rows]) => rows).catch(() => []),

      pool.query(`
        SELECT p.id, p.name, p.slug, p.image, b.name AS brand_name
        FROM phones p
        JOIN brands b ON p.brand_id = b.id
        ORDER BY p.popular DESC, p.views DESC, p.id DESC
        LIMIT 16
      `).then(([rows]) => rows).catch(() => []),

      pool.query(`
        SELECT p.id, p.name, p.slug, p.image, b.name AS brand_name
        FROM phones p
        JOIN brands b ON p.brand_id = b.id
        WHERE p.status = 'Upcoming'
        ORDER BY p.id DESC
        LIMIT 16
      `).then(([rows]) => rows).catch(() => []),

      pool.query(`
        SELECT b.id, b.name, b.slug, b.logo, COUNT(p.id) AS phone_count
        FROM brands b
        LEFT JOIN phones p ON b.id = p.brand_id
        WHERE b.status = 'active'
        GROUP BY b.id
        ORDER BY phone_count DESC, b.name ASC
        LIMIT 12
      `).then(([rows]) => rows).catch(() => []),

      pool.query(`
        SELECT id, title, slug, summary, image, author, category, is_hot, created_at
        FROM news
        WHERE status = 'published'
        ORDER BY is_hot DESC, created_at DESC
        LIMIT 4
      `).then(([rows]) => rows).catch(() => [])
    ]);

    const renderCard = (p, isEager = false, isLcp = false) => {
      let loadingAttrs = 'loading="lazy" decoding="async"';
      if (isLcp) {
        loadingAttrs = 'loading="eager" fetchpriority="high"';
      } else if (isEager) {
        loadingAttrs = 'loading="eager"';
      }

      return `
      <div class="phone-card home-phone-card" onclick="window.location.href='/phone/${escapeAttr(p.slug)}'">
        <div class="phone-card-image-wrap">
          <span class="phone-card-brand-badge">${escapeHtml(p.brand_name || '')}</span>
          <a href="/phone/${escapeAttr(p.slug)}" onclick="event.stopPropagation()">
            <img src="${escapeAttr(p.image || '/images/placeholder.svg')}" alt="${escapeAttr(p.name)}" class="phone-card-image" ${loadingAttrs} width="160" height="212">
          </a>
        </div>
        <div class="phone-card-body">
          <a href="/phone/${escapeAttr(p.slug)}" onclick="event.stopPropagation()" style="display: flex; align-items: center; justify-content: center; width: 100%; text-decoration: none;">
            <h3 class="phone-card-title" title="${escapeAttr(p.name)}">${escapeHtml(p.name)}</h3>
          </a>
        </div>
      </div>
    `;
    };

    // First row (4 cards) is above the fold: Card 0 is LCP with fetchpriority="high", rest are eager
    const latestHtml = (latestPhones || []).map((p, idx) => renderCard(p, idx < 4, idx === 0)).join('');
    const popularHtml = (popularPhones || []).map(p => renderCard(p, false, false)).join('');
    const upcomingHtml = (upcomingPhones || []).map(p => renderCard(p, false, false)).join('');

    // Preload the primary LCP image in <head> for instantaneous paint with WebP MIME
    let lcpPreload = '';
    if (latestPhones && latestPhones.length > 0 && latestPhones[0].image) {
      lcpPreload = `<link rel="preload" href="${escapeAttr(latestPhones[0].image)}" as="image" type="image/webp" fetchpriority="high">`;
    }

    const brandsHtml = (topBrands || []).map(b => `
      <a href="/brand/${escapeAttr(b.slug)}" class="brand-card">
        <img src="${escapeAttr(b.logo || '/images/placeholder.svg')}" alt="${escapeAttr(b.name)}" class="brand-card-logo" loading="lazy" decoding="async" width="80" height="40">
        <div class="brand-card-name">${escapeHtml(b.name)}</div>
        <div class="brand-card-count">${parseInt(b.phone_count, 10) || 0} phones</div>
      </a>
    `).join('');

    let newsHtml = '';
    if (articles && articles.length > 0) {
      newsHtml = articles.map(a => {
        const thumb = a.image || '/images/placeholder.svg';
        const dateStr = a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
        return `
          <article class="news-card" style="box-shadow: var(--shadow-sm); border-radius: 8px;">
            <a href="/news/${escapeAttr(a.slug)}" class="news-card-thumb-wrap" style="height: 160px;">
              <img src="${escapeAttr(thumb)}" alt="${escapeAttr(a.title)}" class="news-card-thumb" loading="lazy" decoding="async" width="280" height="160">
              <span class="news-card-badge">${escapeHtml(a.category || 'Hot News')}</span>
              ${a.is_hot ? '<span class="news-card-hot"><svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> HOT</span>' : ''}
            </a>
            <div class="news-card-body" style="padding: 16px;">
              <div class="news-card-meta" style="font-size: 11px; margin-bottom: 6px;">
                <span>📅 ${dateStr}</span>
                <span>•</span>
                <span>✍️ ${escapeHtml(a.author || 'Editorial')}</span>
              </div>
              <h3 class="news-card-title" style="font-size: 15px; margin-bottom: 6px;">
                <a href="/news/${escapeAttr(a.slug)}">${escapeHtml(a.title)}</a>
              </h3>
              <p class="news-card-excerpt" style="font-size: 12.5px; margin-bottom: 10px;">
                ${escapeHtml(a.summary || '')}
              </p>
              <div class="news-card-footer" style="padding-top: 8px;">
                <a href="/news/${escapeAttr(a.slug)}" style="text-decoration: none; color: var(--primary);">Read Story &rarr;</a>
              </div>
            </div>
          </article>
        `;
      }).join('');
    } else {
      newsHtml = `<div style="grid-column: 1/-1; text-align: center; color: #94a3b8; padding: 24px;">No hot stories published yet. Stay tuned!</div>`;
    }

    const quickCompareOptions = await getQuickCompareOptions();

    const replacements = {
      '{{LATEST_PHONES_HTML}}': latestHtml || '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 24px;">No phones found.</div>',
      '{{POPULAR_PHONES_HTML}}': popularHtml || '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 24px;">No popular phones found.</div>',
      '{{UPCOMING_PHONES_HTML}}': upcomingHtml || '<div style="grid-column: 1/-1; text-align: center; color: #64748b; padding: 24px;">No upcoming phones found.</div>',
      '{{HOME_BRANDS_HTML}}': brandsHtml,
      '{{HOT_NEWS_HTML}}': newsHtml,
      '{{QUICK_COMPARE_OPTIONS}}': quickCompareOptions,
      '{{HOME_LCP_PRELOAD}}': lcpPreload
    };

    cache.set(HOME_SSR_CACHE_KEY, replacements, HOME_SSR_TTL_SECONDS, ['home', 'phones', 'brands', 'news']);
    return replacements;
  } catch (err) {
    console.error('Error generating home SSR data:', err);
    return {
      '{{LATEST_PHONES_HTML}}': '',
      '{{POPULAR_PHONES_HTML}}': '',
      '{{UPCOMING_PHONES_HTML}}': '',
      '{{HOME_BRANDS_HTML}}': '',
      '{{HOT_NEWS_HTML}}': '',
      '{{QUICK_COMPARE_OPTIONS}}': ''
    };
  }
}

// Homepage with Full In-Memory HTML Page Caching (Sub-5ms TTFB & 100% Performance)
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.session && req.session.admin;
    const cacheKey = 'PAGE_FULL_HTML:/';

    if (!isAdmin) {
      const cached = cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(cached);
      }
    }

    const ssrReplacements = await getHomeSsrReplacements();
    const html = await getRenderedViewHtml('home.html', ssrReplacements);

    if (!isAdmin) {
      cache.set(cacheKey, html, 600, ['home', 'phones', 'brands', 'news', 'settings']);
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// Phones Catalog / Listing with in-memory page caching
router.get('/phones', async (req, res, next) => {
  try {
    const isAdmin = req.session && req.session.admin;
    const cacheKey = 'PAGE_FULL_HTML:/phones';

    if (!isAdmin) {
      const cached = cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(cached);
      }
    }

    const html = await getRenderedViewHtml('phones.html');

    if (!isAdmin) {
      cache.set(cacheKey, html, 600, ['phones', 'settings']);
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// Single Phone Detail Page (with Server-Side SEO & Schema.org Injection)
router.get('/phone/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const phone = await PhoneModel.getPhoneBySlug(slug);

    if (!phone) {
      return await renderViewWithSnippets(res, '404.html', {}, 404);
    }

    const branding = await SettingsModel.getBranding();
    const siteName = branding.site_name || 'PhonesDaddy';
    const siteUrl = branding.site_url || `${req.protocol}://${req.get('host')}`;

    let pageTitle = phone.meta_title || `${phone.name} Price in Pakistan & Specifications | ${siteName}`;
    let pageDescription = phone.meta_description || `${phone.name} price in Pakistan, specifications, display, camera, battery, processor, RAM, storage and other details.`;
    if (branding.site_name && branding.site_name !== 'PhonesDaddy') {
      pageTitle = pageTitle.replace(/PhonesDaddy/gi, branding.site_name);
      pageDescription = pageDescription.replace(/PhonesDaddy/gi, branding.site_name);
    }
    const canonicalUrl = `${siteUrl}/phone/${phone.slug}`;
    const fullImageUrl = phone.image ? (phone.image.startsWith('http') ? phone.image : `${siteUrl}${phone.image}`) : '';

    // Schema.org Product structured data
    const schemaData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": phone.name,
      "image": fullImageUrl,
      "description": phone.short_description || pageDescription,
      "brand": {
        "@type": "Brand",
        "name": phone.brand_name
      }
    };

    if (phone.price && parseFloat(phone.price) > 0) {
      schemaData.offers = {
        "@type": "Offer",
        "url": canonicalUrl,
        "priceCurrency": "PKR",
        "price": parseFloat(phone.price),
        "priceValidUntil": "2027-12-31",
        "itemCondition": "https://schema.org/NewCondition",
        "availability": phone.status === 'Available' ? "https://schema.org/InStock" : "https://schema.org/PreOrder"
      };
    }

    function extractYouTubeId(url) {
      if (!url || typeof url !== 'string') return null;
      let clean = url.trim();
      const srcMatch = clean.match(/src=["']([^"']+)["']/i);
      if (srcMatch) clean = srcMatch[1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;
      if (clean.includes('%2F') || clean.includes('%3A') || clean.includes('%3D')) {
        try { clean = decodeURIComponent(clean); } catch (_) {}
      }
      const match = clean.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
      return match ? match[1] : null;
    }

    const videoId = extractYouTubeId(phone.video_url);
    const videoSectionDisplay = videoId ? 'display: block;' : 'display: none;';
    const videoIframeSrc = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0` : '';

    const allGalleryImages = phone.image
      ? [phone.image, ...(Array.isArray(phone.images) ? phone.images : []).filter(u => u && u !== phone.image)]
      : (Array.isArray(phone.images) ? phone.images : []);
    const validGalleryImages = allGalleryImages.filter(Boolean);

    let galleryThumbsHtml = '';
    let galleryCountBadgeStyle = 'display: none;';
    let galleryCountText = '0 Photos';
    let galleryStripStyle = 'display: none;';

    if (validGalleryImages.length > 1) {
      galleryCountBadgeStyle = 'display: inline-flex;';
      galleryCountText = `${validGalleryImages.length} Photos`;
      galleryStripStyle = 'display: flex;';
      galleryThumbsHtml = validGalleryImages.map((src, idx) => `
        <div class="phone-thumb-item ${idx === 0 ? 'active' : ''}" onclick="selectPreviewImage(${idx})" ondblclick="openGallery(${idx})" title="Click to preview photo ${idx + 1}">
          <img src="${escapeAttr(src)}" alt="Photo ${idx + 1}" loading="lazy" width="56" height="56" onerror="this.parentElement.style.display='none'">
        </div>
      `).join('');
    }

    const phoneImgUrl = phone.image || '/images/placeholder.svg';
    const lcpPreload = phone.image ? `<link rel="preload" href="${escapeAttr(phone.image)}" as="image" fetchpriority="high">` : '';

    const replacements = {
      '{{PAGE_TITLE}}': escapeHtml(pageTitle),
      '{{META_DESCRIPTION}}': escapeHtml(pageDescription),
      '{{CANONICAL_URL}}': canonicalUrl,
      '{{PHONE_NAME}}': escapeHtml(phone.name),
      '{{PHONE_SLUG}}': escapeHtml(phone.slug),
      '{{SCHEMA_JSON}}': JSON.stringify(schemaData, null, 2),
      '{{PHONE_DATA_JSON}}': JSON.stringify(phone).replace(/</g, '\\u003c'),
      '{{PHONE_IMAGE}}': escapeAttr(phoneImgUrl),
      '{{PHONE_IMAGE_PRELOAD}}': lcpPreload,
      '{{GALLERY_BADGE_STYLE}}': galleryCountBadgeStyle,
      '{{GALLERY_COUNT_TEXT}}': galleryCountText,
      '{{GALLERY_STRIP_STYLE}}': galleryStripStyle,
      '{{PHONE_GALLERY_THUMBS_HTML}}': galleryThumbsHtml,
      '{{VIDEO_SECTION_DISPLAY}}': videoSectionDisplay,
      '{{VIDEO_IFRAME_SRC}}': videoIframeSrc
    };

    await renderViewWithSnippets(res, 'phone.html', replacements);
  } catch (err) {
    next(err);
  }
});

// Brands Listing
router.get('/brands', async (req, res, next) => {
  try {
    await renderViewWithSnippets(res, 'brands.html');
  } catch (err) {
    next(err);
  }
});

// Single Brand Page
router.get('/brand/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const brand = await BrandModel.getBrandBySlug(slug);

    if (!brand) {
      return await renderViewWithSnippets(res, '404.html', {}, 404);
    }

    const branding = await SettingsModel.getBranding();
    const siteName = branding.site_name || 'PhonesDaddy';
    const siteUrl = branding.site_url || `${req.protocol}://${req.get('host')}`;

    const pageTitle = `${brand.name} Mobile Phones, Latest Prices & Specifications | ${siteName}`;
    const pageDescription = `Browse all ${brand.name} smartphones with latest official prices, complete specs, and comparisons on ${siteName}.`;
    const canonicalUrl = `${siteUrl}/brand/${brand.slug}`;

    const replacements = {
      '{{PAGE_TITLE}}': escapeHtml(pageTitle),
      '{{META_DESCRIPTION}}': escapeHtml(pageDescription),
      '{{CANONICAL_URL}}': canonicalUrl,
      '{{BRAND_NAME}}': escapeHtml(brand.name),
      '{{BRAND_SLUG}}': escapeHtml(brand.slug),
      '{{BRAND_DATA_JSON}}': JSON.stringify(brand).replace(/</g, '\\u003c')
    };

    await renderViewWithSnippets(res, 'brand.html', replacements);
  } catch (err) {
    next(err);
  }
});

// Phone Comparison Page
router.get('/compare', async (req, res, next) => {
  try {
    const quickCompareOptions = await getQuickCompareOptions();
    await renderViewWithSnippets(res, 'compare.html', {
      '{{QUICK_COMPARE_OPTIONS}}': quickCompareOptions
    });
  } catch (err) {
    next(err);
  }
});

// News & Blog Listing Page
router.get('/news', async (req, res, next) => {
  try {
    await renderViewWithSnippets(res, 'news.html');
  } catch (err) {
    next(err);
  }
});

// Single News & Blog Post Page (with SEO & Schema.org NewsArticle Structured Data)
router.get('/news/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const article = await NewsModel.getBySlug(slug);

    if (!article || article.status !== 'published') {
      return await renderViewWithSnippets(res, '404.html', {}, 404);
    }

    const branding = await SettingsModel.getBranding();
    const siteName = branding.site_name || 'PhonesDaddy';
    const siteUrl = branding.site_url || `${req.protocol}://${req.get('host')}`;

    const pageTitle = `${article.title} | ${siteName} News`;
    const pageDescription = article.summary || (article.content ? article.content.replace(/<[^>]*>?/gm, '').slice(0, 160) : `Latest smartphone news and updates on ${siteName}.`);
    const canonicalUrl = `${siteUrl}/news/${article.slug}`;
    const fullImageUrl = article.image ? (article.image.startsWith('http') ? article.image : `${siteUrl}${article.image}`) : `${siteUrl}/images/placeholder.svg`;
    const logoUrl = branding.site_logo ? (branding.site_logo.startsWith('http') ? branding.site_logo : `${siteUrl}${branding.site_logo}`) : `${siteUrl}/images/logo.png`;

    // Schema.org NewsArticle
    const schemaData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": article.title,
      "image": [fullImageUrl],
      "datePublished": article.created_at,
      "dateModified": article.updated_at || article.created_at,
      "author": [{
        "@type": "Person",
        "name": article.author || "Editorial Team"
      }],
      "publisher": {
        "@type": "Organization",
        "name": siteName,
        "logo": {
          "@type": "ImageObject",
          "url": logoUrl
        }
      },
      "description": pageDescription
    };

    const replacements = {
      '{{PAGE_TITLE}}': escapeHtml(pageTitle),
      '{{META_DESCRIPTION}}': escapeHtml(pageDescription),
      '{{CANONICAL_URL}}': canonicalUrl,
      '{{ARTICLE_TITLE}}': escapeHtml(article.title),
      '{{ARTICLE_SLUG}}': escapeHtml(article.slug),
      '{{ARTICLE_IMAGE}}': fullImageUrl,
      '{{SCHEMA_JSON}}': JSON.stringify(schemaData)
    };

    await renderViewWithSnippets(res, 'news-detail.html', replacements);
  } catch (err) {
    next(err);
  }
});

/**
 * Public Custom Pages (About Us, Contact Us, Privacy Policy, Disclaimer, etc.)
 */
async function renderCustomPage(req, res, next, pageSlug) {
  try {
    const page = await PageModel.getBySlug(pageSlug);
    if (!page || page.status !== 'published') {
      return await renderViewWithSnippets(res, '404.html', {}, 404);
    }

    // Increment page views asynchronously
    PageModel.incrementViews(page.id).catch(console.error);

    const branding = await SettingsModel.getBranding();
    const siteName = branding.site_name || 'PhonesDaddy';
    const siteUrl = branding.site_url || `${req.protocol}://${req.get('host')}`;

    let pageTitle = page.meta_title || `${page.title} | ${siteName}`;
    let pageDescription = page.meta_description || `${page.title} on ${siteName} - Authentic Mobile Specifications & Pricing.`;
    let pageHeading = page.title || '';
    let pageContent = page.content || '';
    if (branding.site_name && branding.site_name !== 'PhonesDaddy') {
      pageTitle = pageTitle.replace(/PhonesDaddy/gi, branding.site_name);
      pageDescription = pageDescription.replace(/PhonesDaddy/gi, branding.site_name);
      pageHeading = pageHeading.replace(/PhonesDaddy/gi, branding.site_name);
      pageContent = pageContent.replace(/PhonesDaddy/gi, branding.site_name);
    }
    const canonicalUrl = `${siteUrl}/page/${page.slug}`;
    const logoUrl = branding.site_logo ? (branding.site_logo.startsWith('http') ? branding.site_logo : `${siteUrl}${branding.site_logo}`) : `${siteUrl}/images/logo.png`;

    const schemaData = {
      "@context": "https://schema.org",
      "@type": page.slug === 'contact-us' ? "ContactPage" : page.slug === 'about-us' ? "AboutPage" : "WebPage",
      "name": page.title,
      "description": pageDescription,
      "url": canonicalUrl,
      "publisher": {
        "@type": "Organization",
        "name": siteName,
        "logo": {
          "@type": "ImageObject",
          "url": logoUrl
        }
      }
    };

    const dateStr = page.updated_at 
      ? new Date(page.updated_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
      : (page.created_at ? new Date(page.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

    const replacements = {
      '{{PAGE_TITLE}}': escapeHtml(pageTitle),
      '{{META_DESCRIPTION}}': escapeHtml(pageDescription),
      '{{CANONICAL_URL}}': canonicalUrl,
      '{{PAGE_HEADING}}': escapeHtml(pageHeading),
      '{{PAGE_DATE}}': dateStr,
      '{{PAGE_CONTENT}}': pageContent,
      '{{SHOW_CONTACT_FORM}}': page.slug === 'contact-us' ? 'block' : 'none',
      '{{SCHEMA_JSON}}': JSON.stringify(schemaData)
    };

    await renderViewWithSnippets(res, 'page.html', replacements);
  } catch (err) {
    next(err);
  }
}

// Canonical Page Route: /page/:slug
router.get('/page/:slug', async (req, res, next) => {
  await renderCustomPage(req, res, next, req.params.slug);
});

// Direct Friendly Root Aliases for Core Pages
router.get('/about-us', async (req, res, next) => {
  await renderCustomPage(req, res, next, 'about-us');
});
router.get('/contact-us', async (req, res, next) => {
  await renderCustomPage(req, res, next, 'contact-us');
});
router.get('/privacy-policy', async (req, res, next) => {
  await renderCustomPage(req, res, next, 'privacy-policy');
});
router.get('/disclaimer', async (req, res, next) => {
  await renderCustomPage(req, res, next, 'disclaimer');
});

// Dynamic XML Sitemap
router.get('/sitemap.xml', async (req, res, next) => {
  try {
    const branding = await SettingsModel.getBranding();
    const host = branding.site_url || `${req.protocol}://${req.get('host')}`;
    const today = new Date().toISOString().split('T')[0];

    const { phones } = await PhoneModel.getPhones({ page: 1, limit: 1000 });
    const brands = await BrandModel.getAllBrands(true);
    const { articles: newsList } = await NewsModel.getArticles({ page: 1, limit: 500, status: 'published' });

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static pages
    const staticPages = [
      { loc: `${host}/`, changefreq: 'daily', priority: '1.0' },
      { loc: `${host}/phones`, changefreq: 'daily', priority: '0.9' },
      { loc: `${host}/news`, changefreq: 'daily', priority: '0.9' },
      { loc: `${host}/brands`, changefreq: 'weekly', priority: '0.8' },
      { loc: `${host}/compare`, changefreq: 'weekly', priority: '0.8' }
    ];

    for (const page of staticPages) {
      xml += `  <url>\n    <loc>${page.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>\n  </url>\n`;
    }

    // Brands
    for (const b of brands) {
      xml += `  <url>\n    <loc>${host}/brand/${b.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
    }

    // Phones
    for (const p of phones) {
      xml += `  <url>\n    <loc>${host}/phone/${p.slug}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // News & Blog Articles
    for (const a of newsList) {
      xml += `  <url>\n    <loc>${host}/news/${a.slug}</loc>\n    <lastmod>${a.updated_at ? new Date(a.updated_at).toISOString().split('T')[0] : today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    }

    // Custom Pages (About Us, Contact Us, Privacy Policy, Disclaimer, etc.)
    const { pages: customPages } = await PageModel.getPages({ page: 1, limit: 100, status: 'published' });
    for (const pg of customPages) {
      const pageLoc = ['about-us', 'contact-us', 'privacy-policy', 'disclaimer'].includes(pg.slug)
        ? `${host}/${pg.slug}`
        : `${host}/page/${pg.slug}`;
      xml += `  <url>\n    <loc>${pageLoc}</loc>\n    <lastmod>${pg.updated_at ? new Date(pg.updated_at).toISOString().split('T')[0] : today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    next(err);
  }
});

// Robots.txt
router.get('/robots.txt', async (req, res) => {
  const branding = await SettingsModel.getBranding();
  const host = branding.site_url || `${req.protocol}://${req.get('host')}`;
  const robots = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /admin/*\nDisallow: /api/*\n\nSitemap: ${host}/sitemap.xml\n`;
  res.header('Content-Type', 'text/plain');
  res.send(robots);
});

// --- Admin Panel Views ---
router.get('/admin', (req, res) => {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  return res.redirect('/admin/login');
});

router.get('/admin/login', (req, res) => {
  if (req.session && req.session.admin) {
    return res.redirect('/admin/dashboard');
  }
  res.sendFile(path.join(adminDir, 'login.html'));
});

router.get('/admin/dashboard', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(adminDir, 'dashboard.html'));
});

// Mobile Phones & Brands Management
router.get('/admin/phones', requirePhonePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'phones.html'));
});

router.get('/admin/phones/new', requirePhonePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'phone-form.html'));
});

router.get('/admin/phones/edit/:id', requirePhonePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'phone-form.html'));
});

router.get('/admin/brands', requirePhonePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'brands.html'));
});

// Articles & Blog Writing
router.get('/admin/news', requireArticlePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'news.html'));
});

router.get('/admin/news/new', requireArticlePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'news-form.html'));
});

router.get('/admin/news/edit/:id', requireArticlePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'news-form.html'));
});

router.get('/admin/categories', requireArticlePermission, (req, res) => {
  res.sendFile(path.join(adminDir, 'categories.html'));
});

// Static Pages & Customer Reviews
router.get('/admin/pages', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(adminDir, 'pages.html'));
});

router.get('/admin/pages/new', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(adminDir, 'page-form.html'));
});

router.get('/admin/pages/edit/:id', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(adminDir, 'page-form.html'));
});

router.get('/admin/reviews', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(adminDir, 'reviews.html'));
});

// Site Settings & Team/User Management (Master Admin only)
router.get('/admin/settings', requireMasterAdmin, (req, res) => {
  res.sendFile(path.join(adminDir, 'settings.html'));
});

router.get('/admin/users', requireMasterAdmin, (req, res) => {
  res.redirect('/admin/settings#users');
});

// Staff / Admin Profile
router.get('/admin/profile', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(adminDir, 'profile.html'));
});

function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

module.exports = router;

