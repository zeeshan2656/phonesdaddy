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

        // Floating WhatsApp Contact Button
        whatsapp_number: '',
        whatsapp_message: 'Hello! I have an inquiry from PhonesDaddy.',
        whatsapp_enabled: '1',

        // Floating Social Channels (YouTube, Instagram, Facebook, TikTok)
        youtube_url: '',
        youtube_enabled: '1',
        instagram_url: '',
        instagram_enabled: '1',
        facebook_url: '',
        facebook_enabled: '1',
        tiktok_url: '',
        tiktok_enabled: '1',

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
    cache.clear();

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
    let rawText = settings.head_snippets || '';

    // Helper: Non-blocking, interaction-loaded Google Analytics & AdSense
    let gaId = '';
    if (settings.google_analytics_id && settings.google_analytics_id.trim()) {
      gaId = settings.google_analytics_id.trim();
      if (gaId.startsWith('b64:')) {
        try { gaId = Buffer.from(gaId.slice(4), 'base64').toString('utf8').trim(); } catch (_) {}
      }
    }

    // Also extract GTM / GA ID if pasted raw into head_snippets (e.g. G-PVOXTVZNRL)
    const gtmMatch = rawText.match(/googletagmanager\.com\/gtag\/js\?id=([a-zA-Z0-9_-]+)/i);
    if (gtmMatch && gtmMatch[1]) {
      if (!gaId) gaId = gtmMatch[1];
      // Strip raw blocking script tags from head_snippets so it doesn't execute twice or block render
      rawText = rawText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*googletagmanager\.com[^<]*<\/script>/gi, '');
      rawText = rawText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*gtag\s*\(\s*['"]config['"][^<]*<\/script>/gi, '');
    }

    let adClient = '';
    if (settings.google_adsense_client && settings.google_adsense_client.trim()) {
      adClient = settings.google_adsense_client.trim();
      if (adClient.startsWith('b64:')) {
        try { adClient = Buffer.from(adClient.slice(4), 'base64').toString('utf8').trim(); } catch (_) {}
      }
    }

    const adMatch = rawText.match(/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=([a-zA-Z0-9_-]+)/i);
    if (adMatch && adMatch[1]) {
      if (!adClient) adClient = adMatch[1];
      rawText = rawText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*adsbygoogle\.js[^<]*<\/script>/gi, '');
    }

    const shouldLoadGa = !!gaId;
    const shouldLoadAds = !!adClient;

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
      if (!rawText.includes(settings.adsterra_code.trim())) {
        snippets.push(`<!-- Adsterra Code -->\n${settings.adsterra_code.trim()}`);
      }
    }

    // Primary: Custom Raw Head Snippet Code (Cleaned of render-blocking trackers)
    if (rawText && rawText.trim()) {
      snippets.push(rawText.trim());
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
      footer_copyright: settings.footer_copyright || `© ${new Date().getFullYear()} ${settings.site_name || 'PhonesDaddy'}. All rights reserved.`,
      whatsapp_number: settings.whatsapp_number || '',
      whatsapp_message: settings.whatsapp_message || '',
      whatsapp_enabled: settings.whatsapp_enabled !== '0' && settings.whatsapp_enabled !== false ? '1' : '0',
      facebook_url: settings.facebook_url || '',
      facebook_enabled: settings.facebook_enabled !== '0' && settings.facebook_enabled !== false ? '1' : '0',
      tiktok_url: settings.tiktok_url || '',
      tiktok_enabled: settings.tiktok_enabled !== '0' && settings.tiktok_enabled !== false ? '1' : '0',
      youtube_url: settings.youtube_url || '',
      youtube_enabled: settings.youtube_enabled !== '0' && settings.youtube_enabled !== false ? '1' : '0',
      instagram_url: settings.instagram_url || '',
      instagram_enabled: settings.instagram_enabled !== '0' && settings.instagram_enabled !== false ? '1' : '0'
    };
  }

  /**
   * Generates floating social contact dock HTML (YouTube, Instagram, TikTok, Facebook, WhatsApp)
   * positioned right above scroll-to-top button
   */
  static async getWhatsAppButtonHtml() {
    const settings = await this.getAllSettings();
    const waEnabled = settings.whatsapp_enabled !== '0' && settings.whatsapp_enabled !== false;
    const rawNumber = (settings.whatsapp_number || '').trim();
    const cleanNumber = rawNumber.replace(/[^\d]/g, '');
    const defaultMsg = settings.whatsapp_message || 'Hello! I have an inquiry from PhonesDaddy.';
    const waUrl = (waEnabled && cleanNumber) ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(defaultMsg)}` : '';

    const fbEnabled = settings.facebook_enabled !== '0' && settings.facebook_enabled !== false;
    const fbUrl = (fbEnabled && (settings.facebook_url || '').trim()) ? settings.facebook_url.trim() : '';

    const ttEnabled = settings.tiktok_enabled !== '0' && settings.tiktok_enabled !== false;
    const ttUrl = (ttEnabled && (settings.tiktok_url || '').trim()) ? settings.tiktok_url.trim() : '';

    const ytEnabled = settings.youtube_enabled !== '0' && settings.youtube_enabled !== false;
    const ytUrl = (ytEnabled && (settings.youtube_url || '').trim()) ? settings.youtube_url.trim() : '';

    const igEnabled = settings.instagram_enabled !== '0' && settings.instagram_enabled !== false;
    const igUrl = (igEnabled && (settings.instagram_url || '').trim()) ? settings.instagram_url.trim() : '';

    if (!waUrl && !fbUrl && !ttUrl && !ytUrl && !igUrl) {
      return '';
    }

    let buttonsHtml = '';

    // 1. YouTube button (top of stack)
    if (ytUrl) {
      buttonsHtml += `
  <a href="${ytUrl}" id="youtubeFloatBtn" target="_blank" rel="noopener noreferrer" class="social-float-btn youtube-float-btn" aria-label="Watch on YouTube" title="Watch on YouTube">
    <svg class="social-icon youtube-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
    <span class="social-float-tooltip">Watch on YouTube</span>
  </a>`;
    }

    // 2. Instagram button
    if (igUrl) {
      buttonsHtml += `
  <a href="${igUrl}" id="instagramFloatBtn" target="_blank" rel="noopener noreferrer" class="social-float-btn instagram-float-btn" aria-label="Follow us on Instagram" title="Follow us on Instagram">
    <svg class="social-icon instagram-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="21" height="21" fill="#ffffff" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
    <span class="social-float-tooltip">Follow us on Instagram</span>
  </a>`;
    }

    // 3. TikTok button
    if (ttUrl) {
      buttonsHtml += `
  <a href="${ttUrl}" id="tiktokFloatBtn" target="_blank" rel="noopener noreferrer" class="social-float-btn tiktok-float-btn" aria-label="Follow us on TikTok" title="Follow us on TikTok">
    <svg class="social-icon tiktok-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="#ffffff" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.298-.002.595.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.86 4.46 6.27 6.27 0 0 0 1.89-4.48V8.75a8.16 8.16 0 0 0 4.84 1.57V6.89a4.88 4.88 0 0 1-1-.2z"/>
    </svg>
    <span class="social-float-tooltip">Follow us on TikTok</span>
  </a>`;
    }

    // 4. Facebook button (above WhatsApp)
    if (fbUrl) {
      buttonsHtml += `
  <a href="${fbUrl}" id="facebookFloatBtn" target="_blank" rel="noopener noreferrer" class="social-float-btn facebook-float-btn" aria-label="Follow us on Facebook" title="Follow us on Facebook">
    <svg class="social-icon facebook-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="#ffffff" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
    <span class="social-float-tooltip">Follow us on Facebook</span>
  </a>`;
    }

    // 5. WhatsApp button (bottom of dock, sits right above scroll-to-top)
    if (waUrl) {
      buttonsHtml += `
  <a href="${waUrl}" id="whatsappFloatBtn" target="_blank" rel="noopener noreferrer" class="social-float-btn whatsapp-float-btn" aria-label="Chat on WhatsApp" title="Chat with Admin on WhatsApp">
    <svg class="social-icon whatsapp-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="26" height="26" fill="#ffffff" aria-hidden="true">
      <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.188 8.188 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m-3.53 3.03c-.19 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51l-.57-.01z"/>
    </svg>
    <span class="social-float-tooltip">Chat with us</span>
  </a>`;
    }

    return `
<!-- Floating Social Channels Dock (YouTube, Instagram, TikTok, Facebook, WhatsApp) -->
<style id="waFloatBtnStyle">
#floatingSocialDock {
  position: fixed;
  bottom: 28px;
  right: 24px;
  z-index: 9998;
  display: flex !important;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  transition: bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  pointer-events: none;
}
#floatingSocialDock.has-scroll-btn {
  bottom: 86px;
}
#floatingSocialDock .social-float-btn {
  pointer-events: auto;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex !important;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
  outline: none;
  position: relative;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, background-color 0.2s ease, filter 0.2s ease;
}
#floatingSocialDock .social-float-btn:hover {
  transform: translateY(-2px) scale(1.08);
}
#floatingSocialDock .social-float-btn svg {
  display: block;
  flex-shrink: 0;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
}
#floatingSocialDock .social-float-tooltip {
  position: absolute;
  right: 58px;
  background: #0f172a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  opacity: 0;
  visibility: hidden;
  transform: translateX(8px);
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#floatingSocialDock .social-float-btn:hover .social-float-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
}
/* YouTube button */
#youtubeFloatBtn {
  background: #FF0000;
  color: #fff;
  box-shadow: 0 4px 16px rgba(255, 0, 0, 0.45);
}
#youtubeFloatBtn:hover {
  background: #e60000;
  box-shadow: 0 6px 22px rgba(255, 0, 0, 0.65);
}
/* Instagram button */
#instagramFloatBtn {
  background: radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%);
  color: #fff;
  box-shadow: 0 4px 16px rgba(214, 36, 159, 0.45);
}
#instagramFloatBtn:hover {
  filter: brightness(1.1);
  box-shadow: 0 6px 22px rgba(214, 36, 159, 0.65);
}
/* TikTok button */
#tiktokFloatBtn {
  background: #010101;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.15);
}
#tiktokFloatBtn:hover {
  background: #000000;
  box-shadow: 0 6px 22px rgba(254, 44, 85, 0.5), 0 0 12px rgba(37, 244, 238, 0.35);
}
/* Facebook button */
#facebookFloatBtn {
  background: #1877F2;
  color: #fff;
  box-shadow: 0 4px 16px rgba(24, 119, 242, 0.45);
}
#facebookFloatBtn:hover {
  background: #166fe5;
  box-shadow: 0 6px 22px rgba(24, 119, 242, 0.65);
}
/* WhatsApp button */
#whatsappFloatBtn {
  position: relative;
  background: #25D366;
  color: #fff;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
  will-change: transform;
}
#whatsappFloatBtn::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: #25D366;
  opacity: 0.6;
  z-index: -1;
  transform: scale(1);
  animation: waPulseGlow 2.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
  will-change: transform, opacity;
  pointer-events: none;
}
#whatsappFloatBtn:hover {
  background: #20ba5a;
  transform: scale(1.06);
}
@media (max-width: 768px) {
  #floatingSocialDock {
    bottom: 18px;
    right: 14px;
    gap: 8px;
  }
  #floatingSocialDock.has-scroll-btn {
    bottom: 68px;
  }
  #floatingSocialDock .social-float-btn {
    width: 42px;
    height: 42px;
  }
  #floatingSocialDock .social-float-btn svg {
    width: 22px;
    height: 22px;
  }
}
@keyframes waPulseGlow {
  0% {
    transform: scale(1);
    opacity: 0.6;
  }
  60% {
    transform: scale(1.35);
    opacity: 0;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  #whatsappFloatBtn::before {
    animation: none;
    display: none;
  }
}
</style>
<div id="floatingSocialDock" class="floating-social-dock">
${buttonsHtml}
</div>
<script>
(function() {
  function syncSocialDock() {
    var dock = document.getElementById('floatingSocialDock');
    if (!dock) return;
    var topBtn = document.getElementById('scrollToTopBtn');
    var isScrolled = window.scrollY > 300 || (topBtn && topBtn.classList.contains('visible'));
    if (isScrolled) {
      dock.classList.add('has-scroll-btn');
    } else {
      dock.classList.remove('has-scroll-btn');
    }
  }
  window.addEventListener('scroll', syncSocialDock, { passive: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncSocialDock);
  } else {
    syncSocialDock();
  }
})();
</script>`;
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
      footer_about: settings.footer_about || settings.site_description || '',
      whatsapp_number: settings.whatsapp_number || '',
      whatsapp_message: settings.whatsapp_message || '',
      whatsapp_enabled: settings.whatsapp_enabled !== '0' && settings.whatsapp_enabled !== false ? '1' : '0',
      facebook_url: settings.facebook_url || '',
      facebook_enabled: settings.facebook_enabled !== '0' && settings.facebook_enabled !== false ? '1' : '0',
      tiktok_url: settings.tiktok_url || '',
      tiktok_enabled: settings.tiktok_enabled !== '0' && settings.tiktok_enabled !== false ? '1' : '0'
    };

    const headerLogoHtml = await this.getHeaderLogoHtml();
    const footerLogoHtml = await this.getFooterLogoHtml();
    const faviconTag = await this.getFaviconTag();
    const headCode = await this.getCombinedHeadCode();
    const bodyCode = await this.getCombinedBodyCode();
    const whatsappButtonHtml = await this.getWhatsAppButtonHtml();

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
      whatsappButtonHtml,
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
        <img src="${escapeAttr(b.site_logo)}" alt="${escapeAttr(b.site_name)}" class="site-header-logo-img" width="160" height="38" loading="eager" fetchpriority="high" decoding="sync" style="max-height: 38px; width: auto; object-fit: contain; vertical-align: middle;">
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
        <img src="${escapeAttr(b.site_logo)}" alt="${escapeAttr(b.site_name)}" class="site-footer-logo-img" width="160" height="36" loading="lazy" decoding="async" style="max-height: 36px; width: auto; object-fit: contain; vertical-align: middle;">
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
    return `<link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`;
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