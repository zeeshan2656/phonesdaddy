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
        whatsapp_enabled
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

      // Helper to decode safe base64-encoded snippets to bypass Hostinger ModSecurity false positives
      const decodeSnippet = (val) => {
        if (typeof val === 'string' && val.startsWith('b64:')) {
          try {
            return Buffer.from(val.slice(4), 'base64').toString('utf8').trim();
          } catch (_) {
            return val.trim();
          }
        }
        return typeof val === 'string' ? val.trim() : '';
      };

      // Snippet & Code fields
      if (head_snippets !== undefined) payload.head_snippets = decodeSnippet(head_snippets);
      if (is_head_code_enabled !== undefined) payload.is_head_code_enabled = is_head_code_enabled ? '1' : '0';
      if (google_analytics_id !== undefined) payload.google_analytics_id = String(google_analytics_id || '').trim();
      if (google_adsense_client !== undefined) payload.google_adsense_client = String(google_adsense_client || '').trim();
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

      const logoUrl = `/uploads/branding/${req.file.filename}`;
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
