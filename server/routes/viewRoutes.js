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
const SitemapController = require('../controllers/sitemapController');

const viewsDir = path.join(__dirname, '../../views');
const adminDir = path.join(__dirname, '../../admin');

const templateCache = new Map();

function clearTemplateCache() {
  templateCache.clear();
}

function getTemplateHtml(templateFile) {
  if (process.env.NODE_ENV === 'production' && templateCache.has(templateFile)) {
    return templateCache.get(templateFile);
  }
  const filePath = path.join(viewsDir, templateFile);
  const content = fs.readFileSync(filePath, 'utf8');
  if (process.env.NODE_ENV === 'production') {
    templateCache.set(templateFile, content);
  }
  return content;
}

function unescapeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>');
}

/**
 * Helper to ensure phone cards load optimized WebP thumbnails (5-15 KB instead of full-size image)
 */
function getCardThumbUrl(imgUrl) {
  if (!imgUrl) return '/images/placeholder.svg';
  if (imgUrl.endsWith('-thumb.webp')) return imgUrl;
  if (/\.(webp|png|jpe?g)$/i.test(imgUrl)) {
    return imgUrl.replace(/\.(webp|png|jpe?g)$/i, '-thumb.webp');
  }
  return imgUrl;
}

const brandSvgCache = new Map();
function getBrandLogoMarkup(slug, name) {
  if (brandSvgCache.has(slug)) return brandSvgCache.get(slug);
  const svgPath = path.join(__dirname, `../../public/images/brands/${slug}-logo.svg`);
  if (fs.existsSync(svgPath)) {
    const raw = fs.readFileSync(svgPath, 'utf8')
      .replace(/width="160"\s+height="60"/i, 'width="80" height="30"')
      .replace(/<svg\b/i, `<svg class="brand-card-logo" aria-label="${escapeAttr(name)}" role="img"`);
    brandSvgCache.set(slug, raw);
    return raw;
  }
  const fallback = `<img src="/images/placeholder.svg" alt="${escapeAttr(name)}" class="brand-card-logo" loading="lazy" decoding="async" width="80" height="40">`;
  brandSvgCache.set(slug, fallback);
  return fallback;
}

/**
 * Helper to generate rendered HTML string with custom snippets and branding
 */
async function getRenderedViewHtml(templateFile, replacements = {}) {
  let html = getTemplateHtml(templateFile);

  // Versioned static asset URLs for 1-year immutable caching & instant cache-busting on build
  html = html
    .replace(/\/css\/style\.css(\?v=[^"']*)?/g, '/css/style.css?v=2026.33')
    .replace(/\/js\/app\.js(\?v=[^"']*)?/g, '/js/app.js?v=2026.33')
    .replace(/\/js\/phones\.js(\?v=[^"']*)?/g, '/js/phones.js?v=2026.33')
    .replace(/\/js\/icons\.js(\?v=[^"']*)?/g, '/js/icons.js?v=2026.33')
    .replace(/\/js\/phone-detail\.js(\?v=[^"']*)?/g, '/js/phone-detail.js?v=2026.33');

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
    '{{FOOTER_ABOUT}}': escapeHtml(branding.site_description),
    '{{WHATSAPP_BUTTON_HTML}}': bundle.whatsappButtonHtml || '',
    '{{FLOATING_SOCIAL_DOCK_HTML}}': bundle.whatsappButtonHtml || '',
    '{{WHATSAPP_NUMBER}}': escapeHtml(branding.whatsapp_number || ''),
    '{{WHATSAPP_MESSAGE}}': escapeHtml(branding.whatsapp_message || ''),
    '{{FACEBOOK_URL}}': escapeHtml(branding.facebook_url || ''),
    '{{TIKTOK_URL}}': escapeHtml(branding.tiktok_url || ''),
    '{{YOUTUBE_URL}}': escapeHtml(branding.youtube_url || ''),
    '{{INSTAGRAM_URL}}': escapeHtml(branding.instagram_url || '')
  };

  const allReplacements = { ...commonReplacements, ...replacements };

  for (const [key, val] of Object.entries(allReplacements)) {
    html = html.split(key).join(val !== undefined && val !== null ? val : '');
  }

  // If buyer changed site_name, clean up any residual PhonesDaddy strings in the rendered page
  if (branding.site_name && branding.site_name !== 'PhonesDaddy') {
    html = html.replace(/PhonesDaddy/g, escapeHtml(branding.site_name));
  }

  // Ensure favicon and WhatsApp / Social meta are present in <head>
  if (html.includes('</head>')) {
    let headInject = '';
    if (!html.includes('rel="icon"') && !html.includes("rel='icon'")) {
      headInject += `\n  ${bundle.faviconTag}`;
    }
    if (branding.site_logo && branding.site_logo.trim()) {
      headInject += `\n  <link rel="preload" href="${escapeAttr(branding.site_logo)}" as="image" fetchpriority="high">`;
    }
    if (branding.whatsapp_number && branding.whatsapp_enabled !== '0') {
      headInject += `\n  <meta name="whatsapp-number" content="${escapeAttr(branding.whatsapp_number)}">`;
      headInject += `\n  <meta name="whatsapp-message" content="${escapeAttr(branding.whatsapp_message || '')}">`;
    }
    if (branding.facebook_url && branding.facebook_enabled !== '0') {
      headInject += `\n  <meta name="facebook-url" content="${escapeAttr(branding.facebook_url)}">`;
    }
    if (branding.tiktok_url && branding.tiktok_enabled !== '0') {
      headInject += `\n  <meta name="tiktok-url" content="${escapeAttr(branding.tiktok_url)}">`;
    }
    if (branding.youtube_url && branding.youtube_enabled !== '0') {
      headInject += `\n  <meta name="youtube-url" content="${escapeAttr(branding.youtube_url)}">`;
    }
    if (branding.instagram_url && branding.instagram_enabled !== '0') {
      headInject += `\n  <meta name="instagram-url" content="${escapeAttr(branding.instagram_url)}">`;
    }
    if (headInject) {
      html = html.replace('</head>', `${headInject}\n</head>`);
    }
  }

  // Inject Floating Social Channels Dock before </body>
  if (bundle.whatsappButtonHtml && !html.includes('id="floatingSocialDock"') && !html.includes('id="whatsappFloatBtn"')) {
    if (html.includes('</body>')) {
      html = html.replace('</body>', `\n${bundle.whatsappButtonHtml}\n</body>`);
    } else if (html.includes('</BODY>')) {
      html = html.replace('</BODY>', `\n${bundle.whatsappButtonHtml}\n</BODY>`);
    } else {
      html += `\n${bundle.whatsappButtonHtml}\n`;
    }
  }

  // Inject PWA Controller Script before </body>
  if (!html.includes('/js/pwa.js')) {
    const pwaScript = `  <script defer src="/js/pwa.js?v=1.0.0"></script>`;
    if (html.includes('</body>')) {
      html = html.replace('</body>', `\n${pwaScript}\n</body>`);
    } else if (html.includes('</BODY>')) {
      html = html.replace('</BODY>', `\n${pwaScript}\n</BODY>`);
    } else {
      html += `\n${pwaScript}\n`;
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
  res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=600');
  res.status(statusCode).send(html);
}

// Cache key & TTL for Homepage SSR
const HOME_SSR_CACHE_KEY = 'view_home_ssr_replacements';
const HOME_SSR_TTL_SECONDS = 600; // 10 minutes

async function getQuickCompareOptions() {
  const cached = cache.get('QUICK_COMPARE_OPTIONS_HTML');
  if (cached) return cached;

  try {
    // Highly optimized: fetch top 20 popular phones for instant SSR compare dropdown
    const [phones] = await pool.query(`
      SELECT p.slug, p.name, b.name AS brand_name 
      FROM phones p 
      JOIN brands b ON p.brand_id = b.id 
      ORDER BY p.popular DESC, p.views DESC, p.id DESC
      LIMIT 20
    `);

    const byBrand = {};
    for (const p of phones) {
      const bName = p.brand_name || 'Popular';
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

    cache.set('QUICK_COMPARE_OPTIONS_HTML', html, 1800, ['phones', 'brands']);
    return html;
  } catch (err) {
    console.error('getQuickCompareOptions error:', err);
    return '';
  }
}

async function getHomeSsrReplacements(noCache = false) {
  if (!noCache) {
    const cached = cache.get(HOME_SSR_CACHE_KEY);
    if (cached) {
      return cached;
    }
  }

  try {
    // Parallel optimized queries with strict LIMIT to keep TTFB < 50ms & DOM size clean
    const [latestPhones, popularPhones, upcomingPhones, topBrands, articles] = await Promise.all([
      pool.query(`
        SELECT p.id, p.name, p.slug, p.image, b.name AS brand_name
        FROM phones p
        JOIN brands b ON p.brand_id = b.id
        ORDER BY p.id DESC
        LIMIT 12
      `).then(([rows]) => rows).catch(() => []),

      pool.query(`
        SELECT p.id, p.name, p.slug, p.image, b.name AS brand_name
        FROM phones p
        JOIN brands b ON p.brand_id = b.id
        ORDER BY p.popular DESC, p.views DESC, p.id DESC
        LIMIT 12
      `).then(([rows]) => rows).catch(() => []),

      pool.query(`
        SELECT p.id, p.name, p.slug, p.image, b.name AS brand_name
        FROM phones p
        JOIN brands b ON p.brand_id = b.id
        WHERE p.status = 'Upcoming'
        ORDER BY p.id DESC
        LIMIT 12
      `).then(([rows]) => rows).catch(() => []),

      pool.query(`
        SELECT b.id, b.name, b.slug, b.logo, COUNT(p.id) AS phone_count
        FROM brands b
        LEFT JOIN phones p ON b.id = p.brand_id
        WHERE b.status = 'active'
        GROUP BY b.id
        ORDER BY phone_count DESC, b.name ASC
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
        loadingAttrs = 'loading="eager" fetchpriority="high" decoding="sync"';
      } else if (isEager) {
        loadingAttrs = 'loading="eager" decoding="async"';
      }

      const cardImg = getCardThumbUrl(p.image);
      const cleanName = (p.name || '').replace(/\s*Price\s*(&amp;|&)\s*Specs\s*/gi, '').trim();

      return `
      <div class="phone-card home-phone-card" onclick="window.location.href='/phone/${escapeAttr(p.slug)}'">
        <div class="phone-card-image-wrap">
          <span class="phone-card-brand-badge">${escapeHtml(p.brand_name || '')}</span>
          <a href="/phone/${escapeAttr(p.slug)}" onclick="event.stopPropagation()">
            <img src="${escapeAttr(cardImg)}" alt="${escapeAttr(cleanName)}" class="phone-card-image" ${loadingAttrs} width="160" height="212">
          </a>
        </div>
        <div class="phone-card-body">
          <a href="/phone/${escapeAttr(p.slug)}" onclick="event.stopPropagation()" style="display: flex; align-items: center; justify-content: center; width: 100%; text-decoration: none;">
            <h3 class="phone-card-title" title="${escapeAttr(cleanName)}">${escapeHtml(cleanName)}</h3>
          </a>
        </div>
      </div>
    `;
    };

    // First 6 cards are above the fold: Card 0 is LCP with fetchpriority="high", next 5 are eager
    const latestHtml = (latestPhones || []).map((p, idx) => renderCard(p, idx < 6, idx === 0)).join('');
    const popularHtml = (popularPhones || []).map(p => renderCard(p, false, false)).join('');
    const upcomingHtml = (upcomingPhones || []).map(p => renderCard(p, false, false)).join('');

    // Preload the primary LCP thumbnail image in <head> for instantaneous paint with WebP MIME
    let lcpPreload = '';
    if (latestPhones && latestPhones.length > 0 && latestPhones[0].image) {
      const lcpImg = getCardThumbUrl(latestPhones[0].image);
      lcpPreload = `<link rel="preload" href="${escapeAttr(lcpImg)}" as="image" type="image/webp" fetchpriority="high">`;
    }

    const allBrands = topBrands || [];
    const featuredBrands = allBrands.slice(0, 12);

    // Inlined SVG Brand Logos (0 extra network roundtrips)
    const brandsHtml = (featuredBrands || []).map(b => `
      <a href="/brand/${escapeAttr(b.slug)}" class="brand-card">
        ${getBrandLogoMarkup(b.slug, b.name)}
        <div class="brand-card-name">${escapeHtml(b.name)}</div>
        <div class="brand-card-count">${parseInt(b.phone_count, 10) || 0} phones</div>
      </a>
    `).join('');

    // Advanced Filter Brand Items (All active brands with checkboxes & counts)
    const sidebarBrandsHtml = (allBrands || []).map(b => {
      const count = parseInt(b.phone_count, 10) || 0;
      return `
        <label class="adv-brand-item" data-brand="${escapeAttr(b.name.toLowerCase())}" title="${escapeAttr(b.name)} (${count} phones)">
          <div class="adv-brand-left">
            <input type="checkbox" name="homeAdvBrand" value="${escapeAttr(b.slug)}" class="adv-brand-checkbox">
            <span class="adv-brand-name">${escapeHtml(b.name)}</span>
          </div>
          <span class="adv-brand-count">${count}</span>
        </label>
      `;
    }).join('');

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
      '{{HOME_SIDEBAR_BRANDS_HTML}}': sidebarBrandsHtml,
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
      '{{HOME_SIDEBAR_BRANDS_HTML}}': '',
      '{{HOT_NEWS_HTML}}': '',
      '{{QUICK_COMPARE_OPTIONS}}': '',
      '{{HOME_LCP_PRELOAD}}': ''
    };
  }
}

// Homepage with Full In-Memory HTML Page Caching (Sub-5ms TTFB & 100% Performance)
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.session && req.session.admin;
    const noCache = Boolean(req.query.nocache);
    const cacheKey = 'PAGE_FULL_HTML:/';

    if (!isAdmin && !noCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=600');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(cached);
      }
    }

    const ssrReplacements = await getHomeSsrReplacements(noCache);
    const html = await getRenderedViewHtml('home.html', ssrReplacements);

    if (!isAdmin && !noCache) {
      cache.set(cacheKey, html, 600, ['home', 'phones', 'brands', 'news', 'settings']);
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// Cache key & TTL for Phones Catalog SSR
const PHONES_CATALOG_SSR_CACHE_KEY = 'view_phones_catalog_ssr_replacements';
const PHONES_CATALOG_SSR_TTL_SECONDS = 300; // 5 minutes

async function getPhonesCatalogSsrReplacements(noCache = false) {
  if (!noCache) {
    const cached = cache.get(PHONES_CATALOG_SSR_CACHE_KEY);
    if (cached) return cached;
  }

  try {
    const branding = await SettingsModel.getBranding().catch(() => ({}));
    const siteName = branding.site_name || 'PhonesDaddy';
    const siteUrl = (branding.site_url || 'https://phonesdaddy.com').replace(/\/+$/, '');

    // Fetch page 1 (24 phones) and active brands in parallel
    const [phonesResult, activeBrandsResult] = await Promise.all([
      PhoneModel.getPhones({ page: 1, limit: 24, sort: 'newest' }).catch(err => {
        console.warn('PhoneModel.getPhones warning in SSR:', err.message);
        return { phones: [], total: 0, page: 1, limit: 24, totalPages: 0 };
      }),
      pool.query(`
        SELECT b.id, b.name, b.slug, COUNT(p.id) AS phone_count
        FROM brands b
        LEFT JOIN phones p ON b.id = p.brand_id
        WHERE b.status = 'active'
        GROUP BY b.id
        ORDER BY phone_count DESC, b.name ASC
      `).then(([rows]) => rows).catch(err => {
        console.warn('Brands query warning in SSR:', err.message);
        return [];
      })
    ]);

    const phones = (phonesResult && phonesResult.phones) || [];
    const total = (phonesResult && phonesResult.total) || 0;
    const totalPages = (phonesResult && phonesResult.totalPages) || 1;
    const activeBrands = activeBrandsResult || [];

    // Helper for formatting PKR
    function formatPKR(num) {
      if (!num || isNaN(parseFloat(num)) || parseFloat(num) <= 0) return 'Price on Request';
      return 'Rs. ' + Math.round(parseFloat(num)).toLocaleString('en-PK');
    }

    const eyeSvg = '<svg class="svg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
    const commentSvg = '<svg class="svg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

    const renderCatalogCard = (p, idx) => {
      const isLcp = (idx === 0);
      const isAboveFold = (idx < 4);
      
      let loadingAttrs = 'loading="lazy" decoding="async"';
      if (isLcp) {
        loadingAttrs = 'loading="eager" fetchpriority="high" decoding="sync"';
      } else if (isAboveFold) {
        loadingAttrs = 'loading="eager" decoding="async"';
      }

      const rawImg = p.image || '/images/placeholder.svg';
      const thumbImg = getCardThumbUrl(rawImg);
      const fullImg = rawImg.endsWith('-thumb.webp') ? rawImg.replace(/-thumb\.webp$/, '.webp') : rawImg;
      
      const cleanName = (p.name || 'Smartphone').replace(/\s*Price\s*(&amp;|&)\s*Specs\s*/gi, '').trim();
      const brandName = p.brand_name || '';
      const priceVal = parseFloat(p.price) || 0;
      const priceDisplay = priceVal > 0 ? formatPKR(priceVal) : 'Rumored Price';
      const viewsCount = parseInt(p.views, 10) || 0;
      const reviewCount = parseInt(p.review_count, 10) || 0;
      const phoneUrl = `/phone/${escapeAttr(p.slug)}`;
      const altText = `${cleanName} mobile phone - ${brandName}`;

      return `
        <article class="phone-card" onclick="window.location.href='${phoneUrl}'" itemscope itemtype="https://schema.org/Product">
          <div class="phone-card-image-wrap">
            <span class="phone-card-brand-badge">${escapeHtml(brandName)}</span>
            <a href="${phoneUrl}" class="phone-card-image-link" aria-label="View specifications for ${escapeAttr(cleanName)}" onclick="event.stopPropagation()">
              <picture>
                <source type="image/webp" srcset="${escapeAttr(thumbImg)} 1x, ${escapeAttr(fullImg)} 2x">
                <img src="${escapeAttr(thumbImg)}" srcset="${escapeAttr(thumbImg)} 1x, ${escapeAttr(fullImg)} 2x" sizes="(max-width: 480px) 140px, (max-width: 768px) 160px, 180px" alt="${escapeAttr(altText)}" class="phone-card-image" ${loadingAttrs} width="160" height="212" itemprop="image">
              </picture>
            </a>
          </div>
          <div class="phone-card-body">
            <a href="${phoneUrl}" class="phone-card-title-link" aria-label="${escapeAttr(cleanName)} specifications and price" onclick="event.stopPropagation()">
              <h3 class="phone-card-title" itemprop="name" title="${escapeAttr(cleanName)}">${escapeHtml(cleanName)}</h3>
            </a>
            <div class="phone-card-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
              <meta itemprop="priceCurrency" content="PKR">
              <meta itemprop="price" content="${priceVal}">
              <link itemprop="availability" href="https://schema.org/InStock">
              ${priceDisplay}
            </div>
            <div class="phone-card-stats-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px; font-size: 11.5px; color: #475569; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
              <span style="display: inline-flex; align-items: center; gap: 4px;" aria-label="${viewsCount.toLocaleString()} views" title="${viewsCount.toLocaleString()} views">
                ${eyeSvg} <span class="stat-label">${viewsCount.toLocaleString()}</span>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: ${reviewCount > 0 ? '#0f766e' : '#64748b'};" aria-label="${reviewCount.toLocaleString()} reviews" title="${reviewCount.toLocaleString()} reviews">
                ${commentSvg} <span class="stat-label">${reviewCount.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </article>
      `;
    };

    const phonesGridHtml = phones.length > 0 
      ? phones.map((p, idx) => renderCatalogCard(p, idx)).join('')
      : `<div style="grid-column: 1/-1; text-align: center; color: #475569; padding: 48px;">No mobile phones found in catalog.</div>`;

    // LCP Preload tag in <head> for Card 0
    let lcpPreload = '';
    if (phones.length > 0 && phones[0].image) {
      const lcpImg = getCardThumbUrl(phones[0].image);
      lcpPreload = `<link rel="preload" href="${escapeAttr(lcpImg)}" as="image" type="image/webp" fetchpriority="high">`;
    }

    // Sidebar Brands Pre-rendered
    const sidebarBrandsHtml = activeBrands.map(b => {
      const count = parseInt(b.phone_count, 10) || 0;
      return `
        <label class="adv-brand-item" data-brand="${escapeAttr((b.name || '').toLowerCase())}" title="${escapeAttr(b.name || '')} (${count} phones)">
          <div class="adv-brand-left">
            <input type="checkbox" name="brand" value="${escapeAttr(b.slug || '')}" class="adv-brand-checkbox" aria-label="Filter by ${escapeAttr(b.name || '')}">
            <span class="adv-brand-name">${escapeHtml(b.name || '')}</span>
          </div>
          <span class="adv-brand-count">${count}</span>
        </label>
      `;
    }).join('');

    // Pre-rendered Pagination
    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml += `<button class="page-btn" disabled aria-label="Previous Page">&laquo;</button>`;
      for (let i = 1; i <= Math.min(5, totalPages); i++) {
        paginationHtml += `<button class="page-btn ${i === 1 ? 'active' : ''}" ${i === 1 ? 'aria-current="page"' : ''} aria-label="Page ${i}" onclick="goToPage(${i})">${i}</button>`;
      }
      if (totalPages > 5) {
        paginationHtml += `<span style="padding: 0 4px; color: #64748b;" aria-hidden="true">...</span>`;
        paginationHtml += `<button class="page-btn" aria-label="Page ${totalPages}" onclick="goToPage(${totalPages})">${totalPages}</button>`;
      }
      if (totalPages > 1) {
        paginationHtml += `<button class="page-btn" aria-label="Next Page" onclick="goToPage(2)">&raquo;</button>`;
      }
    }

    // Schema.org JSON-LD Structured Data
    const itemListElements = phones.slice(0, 24).map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      item: {
        '@type': 'Product',
        name: p.name,
        url: `${siteUrl}/phone/${p.slug}`,
        image: p.image ? (p.image.startsWith('http') ? p.image : `${siteUrl}${p.image}`) : `${siteUrl}/images/placeholder.svg`,
        brand: {
          '@type': 'Brand',
          name: p.brand_name || 'Smartphone'
        },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'PKR',
          price: p.price ? parseFloat(p.price) : 0,
          availability: 'https://schema.org/InStock',
          url: `${siteUrl}/phone/${p.slug}`
        }
      }
    }));

    const schemaObj = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'CollectionPage',
          '@id': `${siteUrl}/phones#webpage`,
          url: `${siteUrl}/phones`,
          name: `All Mobile Phones & Specifications — ${siteName}`,
          description: `Browse and compare mobile phone prices and specifications on ${siteName}.`,
          isPartOf: {
            '@type': 'WebSite',
            '@id': `${siteUrl}/#website`,
            name: siteName,
            url: siteUrl
          },
          breadcrumb: {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: siteUrl
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Mobile Phones',
                item: `${siteUrl}/phones`
              }
            ]
          }
        },
        {
          '@type': 'ItemList',
          '@id': `${siteUrl}/phones#itemlist`,
          name: 'Mobile Phone Catalog',
          numberOfItems: total,
          itemListElement: itemListElements
        }
      ]
    };

    const schemaJsonLd = `<script type="application/ld+json">${JSON.stringify(schemaObj)}</script>`;

    const initialDataScript = `<script id="initialCatalogData" type="application/json">${JSON.stringify({
      pagination: { total, page: 1, limit: 24, totalPages },
      count: phones.length
    })}</script>`;

    const replacements = {
      '{{PHONES_GRID_HTML}}': phonesGridHtml,
      '{{CATALOG_TOTAL_COUNT}}': `${total.toLocaleString()} phones found`,
      '{{CATALOG_LCP_PRELOAD}}': lcpPreload,
      '{{SIDEBAR_BRANDS_HTML}}': sidebarBrandsHtml,
      '{{PAGINATION_HTML}}': paginationHtml,
      '{{SCHEMA_JSON_LD}}': schemaJsonLd,
      '{{INITIAL_PHONES_DATA}}': initialDataScript,
      '{{BRAND_COUNT_LABEL}}': `${activeBrands.length} Brands`
    };

    cache.set(PHONES_CATALOG_SSR_CACHE_KEY, replacements, PHONES_CATALOG_SSR_TTL_SECONDS, ['phones', 'brands']);
    return replacements;
  } catch (err) {
    console.error('Error generating phones catalog SSR replacements:', err);
    return {
      '{{PHONES_GRID_HTML}}': '<div style="grid-column: 1/-1; text-align: center; color: #475569; padding: 48px;">Loading catalog...</div>',
      '{{CATALOG_TOTAL_COUNT}}': 'Mobile Phones Catalog',
      '{{CATALOG_LCP_PRELOAD}}': '',
      '{{SIDEBAR_BRANDS_HTML}}': '',
      '{{PAGINATION_HTML}}': '',
      '{{SCHEMA_JSON_LD}}': '',
      '{{INITIAL_PHONES_DATA}}': '',
      '{{BRAND_COUNT_LABEL}}': 'All Brands'
    };
  }
}

// Phones Catalog / Listing with in-memory page caching & instant SSR
router.get('/phones', async (req, res, next) => {
  try {
    const isAdmin = req.session && req.session.admin;
    const noCache = Boolean(req.query.nocache);
    const cacheKey = 'PAGE_FULL_HTML:/phones';

    if (!isAdmin && !noCache) {
      const cached = cache.get(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=600');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(cached);
      }
    }

    const ssrReplacements = await getPhonesCatalogSsrReplacements(noCache);
    const html = await getRenderedViewHtml('phones.html', ssrReplacements);

    if (!isAdmin && !noCache) {
      cache.set(cacheKey, html, 600, ['phones', 'brands', 'settings']);
    }

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'public, max-age=180, stale-while-revalidate=600');
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

    const cleanPhoneName = unescapeHtmlEntities(phone.name);
    let pageTitle = phone.meta_title ? unescapeHtmlEntities(phone.meta_title) : `${cleanPhoneName} Price in Pakistan & Specifications | ${siteName}`;
    let pageDescription = phone.meta_description ? unescapeHtmlEntities(phone.meta_description) : `${cleanPhoneName} price in Pakistan, specifications, display, camera, battery, processor, RAM, storage and other details.`;
    if (branding.site_name && branding.site_name !== 'PhonesDaddy') {
      pageTitle = pageTitle.replace(/PhonesDaddy/gi, branding.site_name);
      pageDescription = pageDescription.replace(/PhonesDaddy/gi, branding.site_name);
    }
    const canonicalUrl = (phone.canonical_url && phone.canonical_url.trim()) ? phone.canonical_url.trim() : `${siteUrl}/phone/${phone.slug}`;
    const fullImageUrl = phone.image ? (phone.image.startsWith('http') ? phone.image : `${siteUrl}${phone.image}`) : '';

    // Schema.org Product structured data
    const schemaData = {
      "@context": "https://schema.org/",
      "@type": "Product",
      "name": cleanPhoneName,
      "image": fullImageUrl,
      "description": phone.short_description ? unescapeHtmlEntities(phone.short_description) : pageDescription,
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

    const galleryAltsMap = (phone.gallery_alts && typeof phone.gallery_alts === 'object') ? phone.gallery_alts : {};
    const defaultMainAlt = phone.image_alt ? unescapeHtmlEntities(phone.image_alt) : `${cleanPhoneName} smartphone official view`;

    if (validGalleryImages.length > 1) {
      galleryCountBadgeStyle = 'display: inline-flex;';
      galleryCountText = `1 / ${validGalleryImages.length} Photos`;
      galleryStripStyle = 'display: flex;';
      galleryThumbsHtml = validGalleryImages.map((src, idx) => {
        const altText = galleryAltsMap[src] || (idx === 0 ? defaultMainAlt : `${cleanPhoneName} official photo ${idx + 1}`);
        return `
        <div class="phone-thumb-item ${idx === 0 ? 'active' : ''}" onclick="selectPreviewImage(${idx})" ondblclick="openGallery(${idx})" title="${escapeAttr(altText)}">
          <img src="${escapeAttr(src)}" alt="${escapeAttr(altText)}" loading="lazy" width="56" height="56" onerror="this.parentElement.style.display='none'">
        </div>
      `;
      }).join('');
    }

    const phoneImgUrl = phone.image || '/images/placeholder.svg';
    const mainImageAlt = phone.image_alt ? unescapeHtmlEntities(phone.image_alt) : `${cleanPhoneName} smartphone front and back view`;
    const lcpPreload = phone.image ? `<link rel="preload" href="${escapeAttr(phone.image)}" as="image" fetchpriority="high">` : '';

    const pricePKRDisplay = (phone.price && parseFloat(phone.price) > 0)
      ? `Rs. ${Math.round(parseFloat(phone.price)).toLocaleString('en-US')}`
      : 'Rumored Price';

    const replacements = {
      '{{PHONE_PRICE_DISPLAY}}': escapeHtml(pricePKRDisplay),
      '{{PAGE_TITLE}}': escapeHtml(pageTitle),
      '{{META_DESCRIPTION}}': escapeHtml(pageDescription),
      '{{CANONICAL_URL}}': canonicalUrl,
      '{{PHONE_NAME}}': escapeHtml(cleanPhoneName),
      '{{PHONE_SLUG}}': escapeAttr(phone.slug),
      '{{SCHEMA_JSON}}': JSON.stringify(schemaData, null, 2),
      '{{PHONE_DATA_JSON}}': JSON.stringify(phone).replace(/</g, '\\u003c'),
      '{{PHONE_IMAGE}}': escapeAttr(phoneImgUrl),
      '{{PHONE_IMAGE_ALT}}': escapeAttr(mainImageAlt),
      '{{OG_IMAGE}}': escapeAttr(fullImageUrl || phoneImgUrl),
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

// PTA Mobile Tax Calculator Page (2026 DIRBS Slabs & High-Traffic SEO)
router.get('/pta-tax-calculator', async (req, res, next) => {
  try {
    await renderViewWithSnippets(res, 'pta-calculator.html');
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

    let pageTitle = (article.meta_title && article.meta_title.trim()) ? unescapeHtmlEntities(article.meta_title.trim()) : `${article.title} | ${siteName} News`;
    let pageDescription = (article.meta_description && article.meta_description.trim()) ? unescapeHtmlEntities(article.meta_description.trim()) : (article.summary || (article.content ? article.content.replace(/<[^>]*>?/gm, '').slice(0, 160) : `Latest smartphone news and updates on ${siteName}.`));
    if (branding.site_name && branding.site_name !== 'PhonesDaddy') {
      pageTitle = pageTitle.replace(/PhonesDaddy/gi, branding.site_name);
      pageDescription = pageDescription.replace(/PhonesDaddy/gi, branding.site_name);
    }
    const canonicalUrl = (article.canonical_url && article.canonical_url.trim()) ? article.canonical_url.trim() : `${siteUrl}/news/${article.slug}`;
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

// --- Google Search Console & SEO XML Sitemaps ---
router.get('/sitemap.xml', SitemapController.getSitemapIndex);
router.get('/sitemap_index.xml', SitemapController.getSitemapIndex);
router.get('/sitemap-phones.xml', SitemapController.getPhonesSitemap);
router.get('/sitemap-brands.xml', SitemapController.getBrandsSitemap);
router.get('/sitemap-news.xml', SitemapController.getNewsSitemap);
router.get('/sitemap-pages.xml', SitemapController.getPagesSitemap);
router.get('/sitemap-all.xml', SitemapController.getConsolidatedSitemap);

// Google-Friendly Robots.txt with Dynamic Branding
router.get('/robots.txt', async (req, res) => {
  const branding = await SettingsModel.getBranding();
  let host = branding.site_url;
  if (!host || host.includes('localhost')) {
    const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    host = `${proto}://${req.get('host') || 'phonesdaddy.com'}`;
  }
  host = host.replace(/\/+$/, '');

  const robots = `# Google-Friendly & AI Agentic robots.txt for ${branding.site_name || 'PhonesDaddy'}
User-agent: *
Allow: /
Allow: /api/phones
Allow: /api/phones/*
Allow: /api/brands
Allow: /api/brands/*
Allow: /api/pta-tax/*
Allow: /api/news
Allow: /api/news/*
Allow: /api/settings/public
Disallow: /admin
Disallow: /admin/*
Disallow: /api/admin
Disallow: /api/admin/*
Disallow: /api/auth/*

User-agent: Googlebot
Allow: /
Allow: /api/phones
Allow: /api/phones/*
Allow: /api/brands
Allow: /api/brands/*
Disallow: /admin
Disallow: /admin/*
Disallow: /api/admin
Disallow: /api/admin/*

User-agent: Googlebot-Image
Allow: /uploads/
Allow: /images/
Allow: /webfiles/

# AI & Agentic Crawlers (Enabled for Search, Assistants & Citations)
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

# XML Sitemaps (Sitemap Index & Specialized Sub-Sitemaps)
Sitemap: ${host}/sitemap.xml
Sitemap: ${host}/sitemap-phones.xml
Sitemap: ${host}/sitemap-brands.xml
Sitemap: ${host}/sitemap-news.xml
Sitemap: ${host}/sitemap-pages.xml
`;
  res.header('Content-Type', 'text/plain; charset=utf-8');
  res.header('Cache-Control', 'public, max-age=86400');
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

// Progressive Web App (PWA) Management & Installation Tracking
router.get('/admin/pwa', requireAdminAuth, (req, res) => {
  res.sendFile(path.join(adminDir, 'pwa.html'));
});

// Announcement Popup Management
router.get('/admin/announcements', requireMasterAdmin, (req, res) => {
  res.sendFile(path.join(adminDir, 'announcements.html'));
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

// PWA Offline Fallback View
router.get('/offline', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/offline.html'));
});

function escapeAttr(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&amp;/g, '&')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.clearTemplateCache = clearTemplateCache;
module.exports = router;

