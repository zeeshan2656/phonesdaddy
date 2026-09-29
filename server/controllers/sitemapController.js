const { pool } = require('../config/database');
const SettingsModel = require('../models/settingsModel');

// In-memory sitemap cache to provide sub-10ms response times for Googlebot
const sitemapCache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date) {
  if (!date) return new Date().toISOString();
  try {
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch (_) {
    return new Date().toISOString();
  }
}

function toAbsoluteUrl(baseUrl, relativePath) {
  if (!relativePath) return '';
  const trimmed = String(relativePath).trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${cleanBase}${cleanPath}`;
}

async function getCanonicalHost(req) {
  try {
    const branding = await SettingsModel.getBranding();
    if (branding && branding.site_url && !branding.site_url.includes('localhost')) {
      return branding.site_url.replace(/\/+$/, '');
    }
  } catch (_) {}
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.get('host') || 'phonesdaddy.com';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

class SitemapController {
  /**
   * Helper to set Google-standard headers for XML sitemaps
   */
  static setSitemapHeaders(res) {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
  }

  /**
   * GET /sitemap.xml and /sitemap_index.xml
   * Master Google Sitemap Index pointing to sub-sitemaps
   */
  static async getSitemapIndex(req, res, next) {
    try {
      const host = await getCanonicalHost(req);
      const cacheKey = `index_${host}`;
      const cached = sitemapCache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        SitemapController.setSitemapHeaders(res);
        return res.send(cached.xml);
      }

      // Query latest update timestamps from each major section
      const [[latestPhone]] = await pool.query(`SELECT MAX(updated_at) AS lastmod FROM phones WHERE status != 'Discontinued'`);
      const [[latestBrand]] = await pool.query(`SELECT MAX(updated_at) AS lastmod FROM brands WHERE status = 'active'`);
      const [[latestNews]] = await pool.query(`SELECT MAX(updated_at) AS lastmod FROM news WHERE status = 'published'`);
      const [[latestPage]] = await pool.query(`SELECT MAX(updated_at) AS lastmod FROM pages WHERE status = 'published'`);

      const now = new Date().toISOString();
      const sitemaps = [
        { loc: `${host}/sitemap-phones.xml`, lastmod: formatDate(latestPhone && latestPhone.lastmod ? latestPhone.lastmod : now) },
        { loc: `${host}/sitemap-brands.xml`, lastmod: formatDate(latestBrand && latestBrand.lastmod ? latestBrand.lastmod : now) },
        { loc: `${host}/sitemap-news.xml`, lastmod: formatDate(latestNews && latestNews.lastmod ? latestNews.lastmod : now) },
        { loc: `${host}/sitemap-pages.xml`, lastmod: formatDate(latestPage && latestPage.lastmod ? latestPage.lastmod : now) }
      ];

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      for (const s of sitemaps) {
        xml += `  <sitemap>\n`;
        xml += `    <loc>${escapeXml(s.loc)}</loc>\n`;
        xml += `    <lastmod>${escapeXml(s.lastmod)}</lastmod>\n`;
        xml += `  </sitemap>\n`;
      }

      xml += `</sitemapindex>`;

      sitemapCache.set(cacheKey, { xml, time: Date.now() });
      SitemapController.setSitemapHeaders(res);
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /sitemap-phones.xml
   * Google-friendly Phone Specs Sitemap with Google Images extension
   */
  static async getPhonesSitemap(req, res, next) {
    try {
      const host = await getCanonicalHost(req);
      const cacheKey = `phones_${host}`;
      const cached = sitemapCache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        SitemapController.setSitemapHeaders(res);
        return res.send(cached.xml);
      }

      const [phones] = await pool.query(`
        SELECT p.slug, p.name, p.image, p.updated_at, p.created_at, b.name AS brand_name
        FROM phones p
        LEFT JOIN brands b ON p.brand_id = b.id
        WHERE p.status != 'Discontinued'
        ORDER BY p.updated_at DESC
      `);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      for (const p of phones) {
        const url = `${host}/phone/${p.slug}`;
        const lastmod = formatDate(p.updated_at || p.created_at);

        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(url)}</loc>\n`;
        xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
        xml += `    <changefreq>daily</changefreq>\n`;
        xml += `    <priority>0.9</priority>\n`;

        if (p.image) {
          const imgUrl = toAbsoluteUrl(host, p.image);
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(p.name)} Specs &amp; Price</image:title>\n`;
          xml += `      <image:caption>${escapeXml(p.name)} specifications, official price, and PTA tax</image:caption>\n`;
          xml += `    </image:image>\n`;
        }

        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      sitemapCache.set(cacheKey, { xml, time: Date.now() });
      SitemapController.setSitemapHeaders(res);
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /sitemap-brands.xml
   * Google-friendly Brand Directory Sitemap
   */
  static async getBrandsSitemap(req, res, next) {
    try {
      const host = await getCanonicalHost(req);
      const cacheKey = `brands_${host}`;
      const cached = sitemapCache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        SitemapController.setSitemapHeaders(res);
        return res.send(cached.xml);
      }

      const [brands] = await pool.query(`
        SELECT slug, name, logo, updated_at, created_at
        FROM brands
        WHERE status = 'active'
        ORDER BY name ASC
      `);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      for (const b of brands) {
        const url = `${host}/brand/${b.slug}`;
        const lastmod = formatDate(b.updated_at || b.created_at);

        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(url)}</loc>\n`;
        xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;

        if (b.logo) {
          const logoUrl = toAbsoluteUrl(host, b.logo);
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${escapeXml(logoUrl)}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(b.name)} Mobile Phones</image:title>\n`;
          xml += `    </image:image>\n`;
        }

        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      sitemapCache.set(cacheKey, { xml, time: Date.now() });
      SitemapController.setSitemapHeaders(res);
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /sitemap-news.xml
   * Google-friendly News & Blog Articles Sitemap with Images
   */
  static async getNewsSitemap(req, res, next) {
    try {
      const host = await getCanonicalHost(req);
      const cacheKey = `news_${host}`;
      const cached = sitemapCache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        SitemapController.setSitemapHeaders(res);
        return res.send(cached.xml);
      }

      const [articles] = await pool.query(`
        SELECT slug, title, image, updated_at, created_at
        FROM news
        WHERE status = 'published'
        ORDER BY created_at DESC
      `);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      for (const a of articles) {
        const url = `${host}/news/${a.slug}`;
        const lastmod = formatDate(a.updated_at || a.created_at);

        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(url)}</loc>\n`;
        xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;

        if (a.image) {
          const imgUrl = toAbsoluteUrl(host, a.image);
          xml += `    <image:image>\n`;
          xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
          xml += `      <image:title>${escapeXml(a.title)}</image:title>\n`;
          xml += `    </image:image>\n`;
        }

        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      sitemapCache.set(cacheKey, { xml, time: Date.now() });
      SitemapController.setSitemapHeaders(res);
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /sitemap-pages.xml
   * Static and Custom Content Pages Sitemap
   */
  static async getPagesSitemap(req, res, next) {
    try {
      const host = await getCanonicalHost(req);
      const cacheKey = `pages_${host}`;
      const cached = sitemapCache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        SitemapController.setSitemapHeaders(res);
        return res.send(cached.xml);
      }

      const today = new Date().toISOString().split('T')[0];

      // Core portal pages
      const corePages = [
        { path: '', changefreq: 'daily', priority: '1.0' },
        { path: '/phones', changefreq: 'daily', priority: '0.9' },
        { path: '/pta-tax-calculator', changefreq: 'weekly', priority: '0.9' },
        { path: '/brands', changefreq: 'weekly', priority: '0.8' },
        { path: '/compare', changefreq: 'weekly', priority: '0.8' },
        { path: '/news', changefreq: 'daily', priority: '0.8' }
      ];

      const [customPages] = await pool.query(`
        SELECT slug, title, updated_at, created_at
        FROM pages
        WHERE status = 'published'
        ORDER BY id ASC
      `);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

      for (const p of corePages) {
        const url = `${host}${p.path}`;
        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(url)}</loc>\n`;
        xml += `    <lastmod>${today}</lastmod>\n`;
        xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
        xml += `    <priority>${p.priority}</priority>\n`;
        xml += `  </url>\n`;
      }

      for (const cp of customPages) {
        const pageLoc = ['about-us', 'contact-us', 'privacy-policy', 'disclaimer'].includes(cp.slug)
          ? `${host}/${cp.slug}`
          : `${host}/page/${cp.slug}`;
        const lastmod = formatDate(cp.updated_at || cp.created_at);

        xml += `  <url>\n`;
        xml += `    <loc>${escapeXml(pageLoc)}</loc>\n`;
        xml += `    <lastmod>${escapeXml(lastmod)}</lastmod>\n`;
        xml += `    <changefreq>monthly</changefreq>\n`;
        xml += `    <priority>0.6</priority>\n`;
        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      sitemapCache.set(cacheKey, { xml, time: Date.now() });
      SitemapController.setSitemapHeaders(res);
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /sitemap-all.xml
   * Consolidated single sitemap with all URLs and Google Images in one document
   */
  static async getConsolidatedSitemap(req, res, next) {
    try {
      const host = await getCanonicalHost(req);
      const cacheKey = `all_${host}`;
      const cached = sitemapCache.get(cacheKey);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        SitemapController.setSitemapHeaders(res);
        return res.send(cached.xml);
      }

      const today = new Date().toISOString().split('T')[0];

      const [phones] = await pool.query(`
        SELECT slug, name, image, updated_at, created_at
        FROM phones
        WHERE status != 'Discontinued'
        ORDER BY updated_at DESC
      `);

      const [brands] = await pool.query(`
        SELECT slug, name, logo, updated_at, created_at
        FROM brands
        WHERE status = 'active'
        ORDER BY name ASC
      `);

      const [articles] = await pool.query(`
        SELECT slug, title, image, updated_at, created_at
        FROM news
        WHERE status = 'published'
        ORDER BY created_at DESC
      `);

      const [customPages] = await pool.query(`
        SELECT slug, updated_at, created_at
        FROM pages
        WHERE status = 'published'
      `);

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
      xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

      // 1. Core Pages
      const corePages = [
        { path: '', changefreq: 'daily', priority: '1.0' },
        { path: '/phones', changefreq: 'daily', priority: '0.9' },
        { path: '/pta-tax-calculator', changefreq: 'weekly', priority: '0.9' },
        { path: '/brands', changefreq: 'weekly', priority: '0.8' },
        { path: '/compare', changefreq: 'weekly', priority: '0.8' },
        { path: '/news', changefreq: 'daily', priority: '0.8' }
      ];
      for (const p of corePages) {
        xml += `  <url>\n    <loc>${escapeXml(`${host}${p.path}`)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${p.changefreq}</changefreq>\n    <priority>${p.priority}</priority>\n  </url>\n`;
      }

      // 2. Custom Pages
      for (const cp of customPages) {
        const pageLoc = ['about-us', 'contact-us', 'privacy-policy', 'disclaimer'].includes(cp.slug)
          ? `${host}/${cp.slug}`
          : `${host}/page/${cp.slug}`;
        xml += `  <url>\n    <loc>${escapeXml(pageLoc)}</loc>\n    <lastmod>${escapeXml(formatDate(cp.updated_at || cp.created_at))}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n`;
      }

      // 3. Brands
      for (const b of brands) {
        xml += `  <url>\n    <loc>${escapeXml(`${host}/brand/${b.slug}`)}</loc>\n    <lastmod>${escapeXml(formatDate(b.updated_at || b.created_at))}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n`;
        if (b.logo) {
          xml += `    <image:image>\n      <image:loc>${escapeXml(toAbsoluteUrl(host, b.logo))}</image:loc>\n      <image:title>${escapeXml(b.name)}</image:title>\n    </image:image>\n`;
        }
        xml += `  </url>\n`;
      }

      // 4. Phones
      for (const p of phones) {
        xml += `  <url>\n    <loc>${escapeXml(`${host}/phone/${p.slug}`)}</loc>\n    <lastmod>${escapeXml(formatDate(p.updated_at || p.created_at))}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.9</priority>\n`;
        if (p.image) {
          xml += `    <image:image>\n      <image:loc>${escapeXml(toAbsoluteUrl(host, p.image))}</image:loc>\n      <image:title>${escapeXml(p.name)}</image:title>\n    </image:image>\n`;
        }
        xml += `  </url>\n`;
      }

      // 5. News
      for (const a of articles) {
        xml += `  <url>\n    <loc>${escapeXml(`${host}/news/${a.slug}`)}</loc>\n    <lastmod>${escapeXml(formatDate(a.updated_at || a.created_at))}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n`;
        if (a.image) {
          xml += `    <image:image>\n      <image:loc>${escapeXml(toAbsoluteUrl(host, a.image))}</image:loc>\n      <image:title>${escapeXml(a.title)}</image:title>\n    </image:image>\n`;
        }
        xml += `  </url>\n`;
      }

      xml += `</urlset>`;

      sitemapCache.set(cacheKey, { xml, time: Date.now() });
      SitemapController.setSitemapHeaders(res);
      res.send(xml);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Clear cache helper
   */
  static clearCache() {
    sitemapCache.clear();
  }
}

module.exports = SitemapController;
