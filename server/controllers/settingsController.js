const fs = require('fs');
const path = require('path');
const SettingsModel = require('../models/settingsModel');
const { cache } = require('../utils/cache');

class SettingsController {
  /**
   * GET /api/admin/settings
   * Retrieve all current settings
   */
  static async getSettings(req, res) {
    try {
      const settings = await SettingsModel.getAllSettings(true); // force fresh from DB
      res.json({
        success: true,
        settings
      });
    } catch (err) {
      console.error('Error in getSettings:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to load settings.'
      });
    }
  }

  /**
   * PUT /api/admin/settings
   * Update settings
   */
  static async updateSettings(req, res) {
    try {
      const {
        site_name,
        site_tagline,
        site_description,
        site_url,
        footer_copyright,
        head_snippets,
        is_head_code_enabled,
        google_site_verification,
        google_analytics_id,
        google_adsense_client,
        adsterra_code,
        body_snippets,
        is_body_code_enabled,
        // Ad placements
        ad_phone_top,
        ad_phone_top_enabled,
        ad_phone_mid,
        ad_phone_mid_enabled,
        ad_phone_spec_2,
        ad_phone_spec_2_enabled,
        ad_phone_bottom,
        ad_phone_bottom_enabled,
        ad_sidebar_top,
        ad_sidebar_top_enabled,
        ad_sidebar_bottom,
        ad_sidebar_bottom_enabled,
        ad_article_top,
        ad_article_top_enabled,
        ad_article_mid,
        ad_article_mid_enabled,
        ad_article_bottom,
        ad_article_bottom_enabled,
        whatsapp_number,
        whatsapp_message,
        whatsapp_enabled,
        facebook_url,
        facebook_enabled,
        tiktok_url,
        tiktok_enabled,
        youtube_url,
        youtube_enabled,
        instagram_url,
        instagram_enabled
      } = req.body;

      const payload = {};

      // Branding fields
      if (site_name !== undefined) payload.site_name = String(site_name || '').trim();
      if (site_tagline !== undefined) payload.site_tagline = String(site_tagline || '').trim();
      if (site_description !== undefined) payload.site_description = String(site_description || '').trim();
      if (site_url !== undefined) payload.site_url = String(site_url || '').trim().replace(/\/+$/, '');
      if (footer_copyright !== undefined) payload.footer_copyright = String(footer_copyright || '').trim();
      if (req.body.footer_about !== undefined) payload.footer_about = String(req.body.footer_about || '').trim();

      // Floating WhatsApp Contact Button
      if (whatsapp_number !== undefined) payload.whatsapp_number = String(whatsapp_number || '').trim();
      if (whatsapp_message !== undefined) payload.whatsapp_message = String(whatsapp_message || '').trim();
      if (whatsapp_enabled !== undefined) {
        payload.whatsapp_enabled = (whatsapp_enabled === '1' || whatsapp_enabled === true || whatsapp_enabled === 'true') ? '1' : '0';
      }

      // Floating Social Channels (Facebook, TikTok, YouTube, Instagram)
      if (facebook_url !== undefined) payload.facebook_url = String(facebook_url || '').trim();
      if (facebook_enabled !== undefined) {
        payload.facebook_enabled = (facebook_enabled === '1' || facebook_enabled === true || facebook_enabled === 'true') ? '1' : '0';
      }
      if (tiktok_url !== undefined) payload.tiktok_url = String(tiktok_url || '').trim();
      if (tiktok_enabled !== undefined) {
        payload.tiktok_enabled = (tiktok_enabled === '1' || tiktok_enabled === true || tiktok_enabled === 'true') ? '1' : '0';
      }
      if (youtube_url !== undefined) payload.youtube_url = String(youtube_url || '').trim();
      if (youtube_enabled !== undefined) {
        payload.youtube_enabled = (youtube_enabled === '1' || youtube_enabled === true || youtube_enabled === 'true') ? '1' : '0';
      }
      if (instagram_url !== undefined) payload.instagram_url = String(instagram_url || '').trim();
      if (instagram_enabled !== undefined) {
        payload.instagram_enabled = (instagram_enabled === '1' || instagram_enabled === true || instagram_enabled === 'true') ? '1' : '0';
      }

      // Helper to decode safe base64-encoded snippets to bypass Hostinger ModSecurity false positives
      const decodeSnippet = (val) => {
        let cur = typeof val === 'string' ? val.trim() : '';
        while (typeof cur === 'string' && cur.startsWith('b64:')) {
          try {
            const decoded = Buffer.from(cur.slice(4), 'base64').toString('utf8').trim();
            if (decoded === cur) break;
            cur = decoded;
          } catch (_) {
            break;
          }
        }
        return cur;
      };

      // Snippet & Code fields
      if (head_snippets !== undefined) payload.head_snippets = decodeSnippet(head_snippets);
      if (is_head_code_enabled !== undefined) payload.is_head_code_enabled = is_head_code_enabled ? '1' : '0';
      if (google_site_verification !== undefined) payload.google_site_verification = decodeSnippet(google_site_verification);
      if (google_analytics_id !== undefined) payload.google_analytics_id = decodeSnippet(google_analytics_id);
      if (google_adsense_client !== undefined) payload.google_adsense_client = decodeSnippet(google_adsense_client);
      if (adsterra_code !== undefined) payload.adsterra_code = decodeSnippet(adsterra_code);
      if (body_snippets !== undefined) payload.body_snippets = decodeSnippet(body_snippets);
      if (is_body_code_enabled !== undefined) payload.is_body_code_enabled = is_body_code_enabled ? '1' : '0';

      // Ad placement slots
      if (ad_phone_top !== undefined) payload.ad_phone_top = decodeSnippet(ad_phone_top);
      if (ad_phone_top_enabled !== undefined) payload.ad_phone_top_enabled = ad_phone_top_enabled ? '1' : '0';
      if (ad_phone_mid !== undefined) payload.ad_phone_mid = decodeSnippet(ad_phone_mid);
      if (ad_phone_mid_enabled !== undefined) payload.ad_phone_mid_enabled = ad_phone_mid_enabled ? '1' : '0';
      if (ad_phone_spec_2 !== undefined) payload.ad_phone_spec_2 = decodeSnippet(ad_phone_spec_2);
      if (ad_phone_spec_2_enabled !== undefined) payload.ad_phone_spec_2_enabled = ad_phone_spec_2_enabled ? '1' : '0';
      if (ad_phone_bottom !== undefined) payload.ad_phone_bottom = decodeSnippet(ad_phone_bottom);
      if (ad_phone_bottom_enabled !== undefined) payload.ad_phone_bottom_enabled = ad_phone_bottom_enabled ? '1' : '0';

      if (ad_sidebar_top !== undefined) payload.ad_sidebar_top = decodeSnippet(ad_sidebar_top);
      if (ad_sidebar_top_enabled !== undefined) payload.ad_sidebar_top_enabled = ad_sidebar_top_enabled ? '1' : '0';
      if (ad_sidebar_bottom !== undefined) payload.ad_sidebar_bottom = decodeSnippet(ad_sidebar_bottom);
      if (ad_sidebar_bottom_enabled !== undefined) payload.ad_sidebar_bottom_enabled = ad_sidebar_bottom_enabled ? '1' : '0';

      if (ad_article_top !== undefined) payload.ad_article_top = decodeSnippet(ad_article_top);
      if (ad_article_top_enabled !== undefined) payload.ad_article_top_enabled = ad_article_top_enabled ? '1' : '0';
      if (ad_article_mid !== undefined) payload.ad_article_mid = decodeSnippet(ad_article_mid);
      if (ad_article_mid_enabled !== undefined) payload.ad_article_mid_enabled = ad_article_mid_enabled ? '1' : '0';
      if (ad_article_bottom !== undefined) payload.ad_article_bottom = decodeSnippet(ad_article_bottom);
      if (ad_article_bottom_enabled !== undefined) payload.ad_article_bottom_enabled = ad_article_bottom_enabled ? '1' : '0';

      if (req.body.scraper_sources !== undefined) {
        payload.scraper_sources = typeof req.body.scraper_sources === 'object'
          ? JSON.stringify(req.body.scraper_sources)
          : String(req.body.scraper_sources);
      }

      await SettingsModel.updateSettings(payload);
      cache.clear();

      const updatedSettings = await SettingsModel.getAllSettings(true);

      res.json({
        success: true,
        message: 'Settings saved and synchronized successfully!',
        settings: updatedSettings
      });
    } catch (err) {
      console.error('Error in updateSettings:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to update settings.'
      });
    }
  }

  /**
   * GET /api/admin/settings/scraper-sources
   * Retrieve all configured scraper sources
   */
  static async getScraperSources(req, res) {
    try {
      const sources = await SettingsModel.getScraperSources();
      res.json({
        success: true,
        sources
      });
    } catch (err) {
      console.error('Error in getScraperSources:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to load scraper sources.'
      });
    }
  }

  /**
   * GET /api/admin/settings/scraper-sources/active
   * Retrieve active scraper sources (for frontend phone form & queues)
   */
  static async getActiveScraperSources(req, res) {
    try {
      const sources = await SettingsModel.getScraperSources();
      const active = sources.filter(s => s.enabled !== false);
      res.json({
        success: true,
        sources: active
      });
    } catch (err) {
      console.error('Error in getActiveScraperSources:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to load active scraper sources.'
      });
    }
  }

  /**
   * POST /api/admin/settings/scraper-sources
   * Add or update a scraper source
   */
  static async saveScraperSource(req, res) {
    try {
      const {
        id,
        name,
        domain,
        specs_url_example,
        rule_type = 'insert_before_id',
        param_insert_text = '',
        param_target_pattern = '',
        image_selector = '',
        enabled = true,
        description = ''
      } = req.body;

      if (!name || !domain) {
        return res.status(400).json({
          success: false,
          message: 'Website name and domain/hostname are required.'
        });
      }

      const cleanDomain = String(domain || '')
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//i, '')
        .replace(/\/.*$/, '')
        .replace(/^www\./i, '');

      if (!cleanDomain) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid domain (e.g. devicespecifications.com).'
        });
      }

      const sources = await SettingsModel.getScraperSources();
      const sourceId = (id || cleanDomain.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `source-${Date.now()}`).toLowerCase();

      // Calculate preview pictures URL
      const { buildPicturesUrl } = require('../utils/phoneScraper');
      const testSpecsUrl = (specs_url_example || `https://${cleanDomain}/sample-phone-1234.php`).trim();
      const generatedImageUrl = buildPicturesUrl(testSpecsUrl, {
        rule_type,
        param_insert_text,
        param_target_pattern
      });

      const existingIndex = sources.findIndex(s => s.id === sourceId || s.domain === cleanDomain);
      const isBuiltin = existingIndex >= 0 && !!sources[existingIndex].is_builtin;

      const newSource = {
        id: sourceId,
        name: String(name).trim(),
        domain: cleanDomain,
        enabled: enabled === true || enabled === 'true' || enabled === '1' || enabled === 1,
        is_builtin: isBuiltin,
        specs_url_example: testSpecsUrl,
        rule_type: rule_type || 'insert_before_id',
        param_insert_text: String(param_insert_text || '').trim(),
        param_target_pattern: String(param_target_pattern || '').trim(),
        image_url_example: generatedImageUrl,
        image_selector: String(image_selector || '').trim(),
        description: String(description || '').trim()
      };

      if (existingIndex >= 0) {
        sources[existingIndex] = { ...sources[existingIndex], ...newSource };
      } else {
        sources.push(newSource);
      }

      await SettingsModel.saveScraperSources(sources);

      res.json({
        success: true,
        message: `Scraper source "${newSource.name}" saved successfully!`,
        source: newSource,
        sources
      });
    } catch (err) {
      console.error('Error in saveScraperSource:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to save scraper source.'
      });
    }
  }

  /**
   * DELETE /api/admin/settings/scraper-sources/:id
   * Delete a custom scraper source
   */
  static async deleteScraperSource(req, res) {
    try {
      const { id } = req.params;
      const sources = await SettingsModel.getScraperSources();
      const target = sources.find(s => s.id === id);

      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'Scraper source not found.'
        });
      }

      if (target.is_builtin) {
        return res.status(400).json({
          success: false,
          message: 'Built-in sources (GSMArena & WhatMobile) cannot be deleted. You can disable them instead.'
        });
      }

      const updated = sources.filter(s => s.id !== id);
      await SettingsModel.saveScraperSources(updated);

      res.json({
        success: true,
        message: `Source "${target.name}" removed successfully.`,
        sources: updated
      });
    } catch (err) {
      console.error('Error in deleteScraperSource:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to delete scraper source.'
      });
    }
  }

  /**
   * POST /api/admin/settings/scraper-sources/test-transform
   * Live test URL transformation for previewing pictures URL
   */
  static async testUrlTransform(req, res) {
    try {
      const { specsUrl, rule_type, param_insert_text, param_target_pattern } = req.body;
      if (!specsUrl) {
        return res.status(400).json({
          success: false,
          message: 'Phone specs URL is required.'
        });
      }

      const { buildPicturesUrl } = require('../utils/phoneScraper');
      const picturesUrl = buildPicturesUrl(specsUrl, {
        rule_type,
        param_insert_text,
        param_target_pattern
      });

      res.json({
        success: true,
        originalUrl: specsUrl,
        picturesUrl,
        isModified: picturesUrl !== specsUrl
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err.message || 'Transformation failed.'
      });
    }
  }

  /**
   * POST /api/admin/settings/logo
   * Upload and set custom site logo
   */
  static async uploadLogo(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No logo image file was uploaded.'
        });
      }

      // Check if previous custom logo file exists and remove it
      try {
        const current = await SettingsModel.getBranding();
        if (current.site_logo && current.site_logo.startsWith('/uploads/branding/')) {
          const oldFilePath = path.join(__dirname, '../../public', current.site_logo);
          if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
        }
      } catch (cleanErr) {
        // Non-critical if old file cleanup fails
      }

      let logoUrl = `/uploads/branding/${req.file.filename}`;
      try {
        const sharp = require('sharp');
        const { UPLOADS_BASE } = require('../utils/paths');
        const brandingDir = path.join(UPLOADS_BASE, 'branding');
        if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

        const webpFilename = `logo-${Date.now()}.webp`;
        const webpDest = path.join(brandingDir, webpFilename);

        await sharp(req.file.path)
          .rotate()
          .resize({ height: 76, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 92, effort: 5 })
          .toFile(webpDest);

        // Remove raw uploaded file if it was a bulky PNG/JPG
        if (req.file.path !== webpDest && fs.existsSync(req.file.path)) {
          try { fs.unlinkSync(req.file.path); } catch (_) {}
        }
        logoUrl = `/uploads/branding/${webpFilename}`;
      } catch (optErr) {
        console.warn('Logo optimization notice:', optErr.message);
      }

      await SettingsModel.updateSettings({ site_logo: logoUrl });

      res.json({
        success: true,
        message: 'Site logo uploaded and applied successfully!',
        logoUrl: logoUrl,
        logo_url: logoUrl
      });
    } catch (err) {
      console.error('Error in uploadLogo:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to upload site logo.'
      });
    }
  }

  /**
   * DELETE /api/admin/settings/logo
   * Remove custom logo and restore default text branding
   */
  static async removeLogo(req, res) {
    try {
      // Remove physical file from disk
      try {
        const current = await SettingsModel.getBranding();
        if (current.site_logo && current.site_logo.startsWith('/uploads/branding/')) {
          const filePath = path.join(__dirname, '../../public', current.site_logo);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      } catch (cleanErr) {
        // Non-critical
      }

      await SettingsModel.updateSettings({ site_logo: '' });
      res.json({
        success: true,
        message: 'Custom logo removed. Default stylized brand text restored.'
      });
    } catch (err) {
      console.error('Error in removeLogo:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to remove site logo.'
      });
    }
  }

  /**
   * POST /api/admin/settings/favicon
   * Upload and set custom favicon / browser icon
   */
  static async uploadFavicon(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No favicon / icon file was uploaded.'
        });
      }

      const faviconUrl = `/uploads/branding/${req.file.filename}`;
      await SettingsModel.updateSettings({ site_favicon: faviconUrl });

      res.json({
        success: true,
        message: 'Site favicon uploaded and applied successfully!',
        faviconUrl: faviconUrl,
        favicon_url: faviconUrl
      });
    } catch (err) {
      console.error('Error in uploadFavicon:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to upload site favicon.'
      });
    }
  }

  /**
   * DELETE /api/admin/settings/favicon
   * Remove custom favicon and restore default icon
   */
  static async removeFavicon(req, res) {
    try {
      await SettingsModel.updateSettings({ site_favicon: '' });
      res.json({
        success: true,
        message: 'Custom favicon removed. Default icon restored.'
      });
    } catch (err) {
      console.error('Error in removeFavicon:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to remove site favicon.'
      });
    }
  }

  /**
   * GET /api/settings/public
   * Public endpoint providing brand information
   */
  static async getPublicBranding(req, res) {
    try {
      const branding = await SettingsModel.getBranding();
      res.json({
        success: true,
        branding
      });
    } catch (err) {
      console.error('Error in getPublicBranding:', err);
      res.status(500).json({
        success: false,
        message: 'Failed to load public branding.'
      });
    }
  }
}

module.exports = SettingsController;
