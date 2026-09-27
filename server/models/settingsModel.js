const { pool } = require('../config/database');
const { cache } = require('../utils/cache');

let _cachedSettings = null;
let _cachedBundle = null;
let _lastCacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

class SettingsModel {
  /**
   * Ensure site_settings table exists
   */
  static async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        setting_key VARCHAR(100) NOT NULL PRIMARY KEY,
        setting_value LONGTEXT DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  /**
   * Fetch all settings as key-value map
   * Uses in-memory caching to avoid database queries on every public page request
   */
  static async getAllSettings(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && _cachedSettings && (now - _lastCacheTime < CACHE_TTL_MS)) {
      return { ..._cachedSettings };
    }

    try {
      const [rows] = await pool.query(`SELECT setting_key, setting_value FROM site_settings`);
      
      const settings = {
        is_head_code_enabled: '1',
        head_snippets: '',
        google_analytics_id: '',
        google_adsense_client: '',
        adsterra_code: '',
        body_snippets: '',
        is_body_code_enabled: '1',

        // Site Identity & Branding
        site_name: 'PhonesDaddy',
        site_tagline: 'Mobile Phone Specifications, Prices & Comparisons',
        site_description: 'Discover latest mobile phone prices in Pakistan, detailed technical specifications, camera benchmarks, battery life ratings, and phone comparisons.',
        site_url: 'http://localhost:3000',
        site_logo: '', // e.g. /uploads/branding/logo-xxx.png
        site_favicon: '', // e.g. /uploads/branding/favicon-xxx.ico
        footer_copyright: '© 2026 PhonesDaddy. All rights reserved. Clean, fast, and authentic mobile phone specifications.',
        footer_about: 'Discover latest mobile phone prices in Pakistan, authentic technical specifications, camera benchmarks, battery life ratings, and fair side-by-side phone comparisons.',

        // Mobile Phone Ad Placements
        ad_phone_top: '',
        ad_phone_top_enabled: '1',
        ad_phone_mid: '', // In-Specs Ad 1 (between spec sections)
        ad_phone_mid_enabled: '1',
        ad_phone_spec_2: '', // In-Specs Ad 2 (between lower spec sections)
        ad_phone_spec_2_enabled: '1',
        ad_phone_bottom: '',
        ad_phone_bottom_enabled: '1',

        // GSMArena-Style Sidebar Ad Placements
        ad_sidebar_top: '',
        ad_sidebar_top_enabled: '1',
        ad_sidebar_bottom: '',
        ad_sidebar_bottom_enabled: '1',

        // Article / Blog Ad Placements
        ad_article_top: '',
        ad_article_top_enabled: '1',
        ad_article_mid: '',
        ad_article_mid_enabled: '1',
        ad_article_bottom: '',
        ad_article_bottom_enabled: '1'
      };

      for (const row of rows) {
        settings[row.setting_key] = row.setting_value !== null ? row.setting_value : '';
      }

      _cachedSettings = settings;
      _lastCacheTime = now;
      return { ...settings };
    } catch (err) {
      console.error('Error fetching settings from database:', err);
      return _cachedSettings || {};
    }
  }

  /**
   * Fetch single setting by key
   */
  static async getSetting(key) {
    const settings = await this.getAllSettings();
    return settings[key] !== undefined ? settings[key] : null;
  }

  /**
   * Batch update settings
   */
  static async updateSettings(newSettings) {
    await this.ensureTable();
    
    const entries = Object.entries(newSettings);
    if (entries.length === 0) return true;

    for (const [key, value] of entries) {
      const valStr = value !== undefined && value !== null ? String(value) : '';
      await pool.query(`
        INSERT INTO site_settings (setting_key, setting_value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = CURRENT_TIMESTAMP
      `, [key, valStr]);
    }

    // Invalidate cache immediately
    _cachedSettings = null;
    _cachedBundle = null;
    _lastCacheTime = 0;
    cache.invalidateTags(['settings', 'home']);

    return true;
  }

  /**
   * Generates the synthesized <head> code to inject into public pages
   */
  static async getCombinedHeadCode() {
    const settings = await this.getAllSettings();

    // Check if head injection is globally enabled
    if (settings.is_head_code_enabled === '0' || settings.is_head_code_enabled === false) {
      return '';
    }

    const snippets = [];

    // Helper: Non-blocking, interaction-loaded Google Analytics & AdSense
    let gaId = '';
    if (settings.google_analytics_id && settings.google_analytics_id.trim()) {
      gaId = settings.google_analytics_id.trim();
      if (gaId.startsWith('b64:')) {
        try { gaId = Buffer.from(gaId.slice(4), 'base64').toString('utf8').trim(); } catch (_) {}
      }
    }

    let adClient = '';
    if (settings.google_adsense_client && settings.google_adsense_client.trim()) {
      adClient = settings.google_adsense_client.trim();
      if (adClient.startsWith('b64:')) {
        try { adClient = Buffer.from(adClient.slice(4), 'base64').toString('utf8').trim(); } catch (_) {}
      }
    }

    const rawText = settings.head_snippets || '';
    const shouldLoadGa = gaId && !rawText.includes(gaId);
    const shouldLoadAds = adClient && !rawText.includes(adClient);

    if (shouldLoadGa || shouldLoadAds) {
      snippets.push(`<!-- Optimized Non-Blocking Google Services (Zero impact on FCP/LCP/TBT) -->
<script>
(function() {
  var loaded = false;
  function initThirdParty() {
    if (loaded) return;
    loaded = true;
    ['scroll', 'mousemove', 'touchstart', 'keydown'].forEach(function(ev) {
      window.removeEventListener(ev, initThirdParty, { passive: true });
    });
    ${shouldLoadGa ? `
    var ga = document.createElement('script');
    ga.async = true;
    ga.src = 'https://www.googletagmanager.com/gtag/js?id=${escapeAttr(gaId)}';
    document.head.appendChild(ga);
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', '${escapeAttr(gaId)}');
    ` : ''}
    ${shouldLoadAds ? `
    var ads = document.createElement('script');
    ads.async = true;
    ads.crossOrigin = 'anonymous';
    ads.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeAttr(adClient)}';
    document.head.appendChild(ads);
    ` : ''}
  }
  ['scroll', 'mousemove', 'touchstart', 'keydown'].forEach(function(ev) {
    window.addEventListener(ev, initThirdParty, { passive: true, once: true });
  });
  if ('requestIdleCallback' in window) {
    requestIdleCallback(function() { setTimeout(initThirdParty, 3500); });
  } else {
    setTimeout(initThirdParty, 3500);
  }
})();
</script>`);
    }

    // Helper: Adsterra Code if provided separately
    if (settings.adsterra_code && settings.adsterra_code.trim()) {
      const rawText = settings.head_snippets || '';
      if (!rawText.includes(settings.adsterra_code.trim())) {
        snippets.push(`<!-- Adsterra Code -->\n${settings.adsterra_code.trim()}`);
      }
    }

    // Primary: Custom Raw Head Snippet Code (AdSense, Analytics, Adsterra, Meta tags, pixels, etc.)
    if (settings.head_snippets && settings.head_snippets.trim()) {
      snippets.push(settings.head_snippets.trim());
    }

    return snippets.join('\n\n');
  }

  /**
   * Generates the synthesized <body> code to inject before </body>
   */
  static async getCombinedBodyCode() {
    const settings = await this.getAllSettings();

    if (settings.is_body_code_enabled === '0' || settings.is_body_code_enabled === false) {
      return '';
    }

    if (settings.body_snippets && settings.body_snippets.trim()) {
      return settings.body_snippets.trim();
    }

    return '';
  }

  /**
   * Generates ad slot HTML container for a specific placement
   */
  static async getAdSlotHtml(placementKey, label = 'Advertisement') {
    const settings = await this.getAllSettings();
    const isEnabled = settings[`${placementKey}_enabled`] !== '0' && settings[`${placementKey}_enabled`] !== false;
    const code = (settings[placementKey] || '').trim();

    if (!isEnabled || !code) {
      return '';
    }

    return `
<!-- Start Ad Placement: ${escapeAttr(placementKey)} -->
<div class="pd-ad-wrapper pd-ad-${escapeAttr(placementKey)}" style="margin: 22px auto; text-align: center; max-width: 100%; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;">
  <span style="display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; margin-bottom: 4px;">${escapeAttr(label)}</span>
  <div class="pd-ad-inner" style="max-width: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
    ${code}
  </div>
</div>
<!-- End Ad Placement: ${escapeAttr(placementKey)} -->
`;
  }

  /**
   * Return clean public branding bundle
   */
  static async getBranding() {
    const settings = await this.getAllSettings();
    return {
      site_name: settings.site_name || 'PhonesDaddy',
      site_tagline: settings.site_tagline || 'Mobile Phone Specifications, Prices & Comparisons',
      site_description: settings.site_description || 'Discover latest mobile phone prices in Pakistan, detailed technical specifications, camera benchmarks, battery life ratings, and phone comparisons.',
      site_url: (settings.site_url || 'http://localhost:3000').replace(/\/+$/, ''),
      site_logo: settings.site_logo || '',
      site_favicon: settings.site_favicon || '',
      footer_copyright: settings.footer_copyright || `© ${new Date().getFullYear()} ${settings.site_name || 'PhonesDaddy'}. All rights reserved.`
    };
  }

  /**
   * Bundles all branding, logo HTML, favicon, head code, body code, and ad slots
   * in a single fast in-memory object to eliminate repeated database queries and computations.
   */
  static async getViewSnippetsBundle() {
    if (_cachedBundle && (Date.now() - _lastCacheTime < CACHE_TTL_MS)) {
      return _cachedBundle;
    }

    const settings = await this.getAllSettings();
    const branding = {
      site_name: settings.site_name || 'PhonesDaddy',
      site_tagline: settings.site_tagline || 'Mobile Phone Specifications, Prices & Comparisons',
      site_description: settings.site_description || 'Discover latest mobile phone prices in Pakistan, detailed technical specifications, camera benchmarks, battery life ratings, and phone comparisons.',
      site_url: settings.site_url || 'http://localhost:3000',
      site_logo: settings.site_logo || '',
      site_favicon: settings.site_favicon || '',
      footer_copyright: settings.footer_copyright || '© 2026 PhonesDaddy. All rights reserved. Clean, fast, and authentic mobile phone specifications.',
      footer_about: settings.footer_about || settings.site_description || ''
    };

    const headerLogoHtml = await this.getHeaderLogoHtml();
    const footerLogoHtml = await this.getFooterLogoHtml();
    const faviconTag = await this.getFaviconTag();
    const headCode = await this.getCombinedHeadCode();
    const bodyCode = await this.getCombinedBodyCode();

    const adSlots = {
      adPhoneTop: await this.getAdSlotHtml('ad_phone_top', 'Sponsored'),
      adPhoneMid: await this.getAdSlotHtml('ad_phone_mid', 'Advertisement'),
      adPhoneSpec2: await this.getAdSlotHtml('ad_phone_spec_2', 'Sponsored Spec Link'),
      adPhoneBottom: await this.getAdSlotHtml('ad_phone_bottom', 'Sponsored Link'),
      adSidebarTop: await this.getAdSlotHtml('ad_sidebar_top', 'Advertisement'),
      adSidebarBottom: await this.getAdSlotHtml('ad_sidebar_bottom', 'Sponsored'),
      adArticleTop: await this.getAdSlotHtml('ad_article_top', 'Advertisement'),
      adArticleMid: await this.getAdSlotHtml('ad_article_mid', 'Sponsored'),
      adArticleBottom: await this.getAdSlotHtml('ad_article_bottom', 'Advertisement')
    };

    _cachedBundle = {
      branding,
      headerLogoHtml,
      footerLogoHtml,
      faviconTag,
      headCode,
      bodyCode,
      adSlots
    };

    return _cachedBundle;
  }

  /**
   * Helper to format site title into two colors using .brand-highlight:
   * Handles multi-word names (e.g. "What Mobile" -> "What" + "Mobile"),
   * compound/camelCase/PascalCase names (e.g. "PhonesDaddy" -> "Phones" + "Daddy"),
   * and single words (e.g. "Phones" -> "Pho" + "nes").
   */
  static formatTwoColorTitle(siteName) {
    if (!siteName) {
      return '<span>Phones</span><span class="brand-highlight">Daddy</span>';
    }
    const name = siteName.trim();
    const words = name.split(/\s+/);
    if (words.length >= 2) {
      const first = words.slice(0, words.length - 1).join(' ');
      const last = words[words.length - 1];
      return `<span>${escapeHtml(first)} </span><span class="brand-highlight">${escapeHtml(last)}</span>`;
    }
    const camelMatch = name.match(/^([A-Z]?[a-z0-9]+)([A-Z][a-zA-Z0-9]*)$/);
    if (camelMatch) {
      return `<span>${escapeHtml(camelMatch[1])}</span><span class="brand-highlight">${escapeHtml(camelMatch[2])}</span>`;
    }
    if (name.length > 3) {
      const mid = Math.ceil(name.length / 2);
      return `<span>${escapeHtml(name.slice(0, mid))}</span><span class="brand-highlight">${escapeHtml(name.slice(mid))}</span>`;
    }
    return `<span>${escapeHtml(name)}</span>`;
  }

  /**
   * Generates header logo HTML:
   * Displays logo (custom image OR stylized brand icon badge) AND the two-color site title.
   */
  static async getHeaderLogoHtml() {
    const b = await this.getBranding();
    const titleHtml = this.formatTwoColorTitle(b.site_name);

    if (b.site_logo && b.site_logo.trim()) {
      return `
        <img src="${escapeAttr(b.site_logo)}" alt="${escapeAttr(b.site_name)}" class="site-header-logo-img" width="160" height="38" style="max-height: 38px; width: auto; object-fit: contain; vertical-align: middle;">
        <span class="brand-text">${titleHtml}</span>
      `;
    }

    const initial = (b.site_name.charAt(0) || 'P').toUpperCase();
    return `
      <div class="brand-icon">${escapeAttr(initial)}</div>
      <span class="brand-text">${titleHtml}</span>
    `;
  }

  /**
   * Generates footer logo HTML:
   * Displays logo AND two-color site title in footer
   */
  static async getFooterLogoHtml() {
    const b = await this.getBranding();
    const titleHtml = this.formatTwoColorTitle(b.site_name);

    if (b.site_logo && b.site_logo.trim()) {
      return `
        <img src="${escapeAttr(b.site_logo)}" alt="${escapeAttr(b.site_name)}" class="site-footer-logo-img" width="160" height="36" style="max-height: 36px; width: auto; object-fit: contain; vertical-align: middle;">
        <span class="brand-text">${titleHtml}</span>
      `;
    }

    const initial = (b.site_name.charAt(0) || 'P').toUpperCase();
    return `
      <div class="brand-icon">${escapeAttr(initial)}</div>
      <span class="brand-text">${titleHtml}</span>
    `;
  }

  /**
   * Generates favicon <link> HTML tag
   */
  static async getFaviconTag() {
    const b = await this.getBranding();
    if (b.site_favicon && b.site_favicon.trim()) {
      const ext = b.site_favicon.split('.').pop().toLowerCase();
      let type = 'image/x-icon';
      if (ext === 'png') type = 'image/png';
      else if (ext === 'svg') type = 'image/svg+xml';
      else if (ext === 'webp') type = 'image/webp';
      return `<link rel="icon" type="${type}" href="${escapeAttr(b.site_favicon)}">
<link rel="apple-touch-icon" href="${escapeAttr(b.site_favicon)}">`;
    }
    return `<link rel="icon" type="image/svg+xml" href="/images/placeholder.svg">`;
  }
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = SettingsModel;
