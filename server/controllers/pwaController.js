const path = require('path');
const fs = require('fs');
const PwaModel = require('../models/pwaModel');

class PwaController {
  /**
   * Track PWA installation or launch event (Public endpoint)
   */
  static async trackEvent(req, res) {
    try {
      const {
        action = 'launch',
        device_uuid,
        platform,
        browser,
        display_mode
      } = req.body || {};

      const user_agent = req.headers['user-agent'] || '';
      const ip_address = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

      const result = await PwaModel.recordEvent({
        action,
        device_uuid: device_uuid || req.body?.clientId || 'anon-' + Math.random().toString(36).substring(2, 10),
        platform: platform || 'Unknown',
        browser: browser || 'Unknown',
        display_mode: display_mode || 'standalone',
        user_agent,
        ip_address: typeof ip_address === 'string' ? ip_address.split(',')[0].trim() : ''
      });

      return res.json({ success: true, data: result });
    } catch (err) {
      console.error('PwaController.trackEvent error:', err);
      return res.status(500).json({ success: false, message: 'Failed to record event' });
    }
  }

  /**
   * Get PWA statistics and configuration
   */
  static async getStats(req, res) {
    try {
      const stats = await PwaModel.getStats();
      return res.json({ success: true, data: stats });
    } catch (err) {
      console.error('PwaController.getStats error:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch PWA stats' });
    }
  }

  /**
   * Get PWA configuration only
   */
  static async getConfig(req, res) {
    try {
      const config = await PwaModel.getConfig();
      return res.json({ success: true, data: config });
    } catch (err) {
      console.error('PwaController.getConfig error:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch PWA config' });
    }
  }

  /**
   * Update PWA configuration
   */
  static async updateConfig(req, res) {
    try {
      const config = await PwaModel.updateConfig(req.body);
      return res.json({
        success: true,
        data: config,
        message: 'PWA configuration and manifest updated successfully!'
      });
    } catch (err) {
      console.error('PwaController.updateConfig error:', err);
      return res.status(500).json({ success: false, message: 'Failed to update PWA configuration' });
    }
  }

  /**
   * Upload custom PWA icon
   */
  static async uploadIcon(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please select an image file to upload.' });
      }

      const fileBuffer = fs.readFileSync(req.file.path);
      const ext = path.extname(req.file.originalname).toLowerCase() || '.png';

      const iconUrl = await PwaModel.setCustomIcon(fileBuffer, ext);

      // Clean up temporary multer upload file if in different directory
      if (req.file.path && fs.existsSync(req.file.path) && !req.file.path.includes('uploads/pwa')) {
        try { fs.unlinkSync(req.file.path); } catch (_) {}
      }

      return res.json({
        success: true,
        data: { icon_url: iconUrl },
        message: 'Custom PWA icon uploaded and app icons generated successfully!'
      });
    } catch (err) {
      console.error('PwaController.uploadIcon error:', err);
      return res.status(500).json({ success: false, message: 'Failed to process PWA icon' });
    }
  }

  /**
   * Reset PWA icon to use the site's brand icon/logo
   */
  static async resetIcon(req, res) {
    try {
      const config = await PwaModel.resetToSiteIcon();
      return res.json({
        success: true,
        data: config,
        message: 'PWA app icon reverted to Site Identity & Brand Icon!'
      });
    } catch (err) {
      console.error('PwaController.resetIcon error:', err);
      return res.status(500).json({ success: false, message: 'Failed to reset PWA icon' });
    }
  }

  /**
   * Simulate a test install (for admin testing / demo)
   */
  static async simulateInstall(req, res) {
    try {
      const platforms = ['Android 15 (Pixel)', 'Windows 11 (Desktop)', 'iOS 18 (Safari PWA)', 'Samsung OneUI (Android)', 'macOS (Chrome PWA)'];
      const browsers = ['Chrome Mobile 128', 'Edge 128', 'Mobile Safari 18.0', 'Samsung Internet 25.0', 'Chrome 128'];
      const randomIdx = Math.floor(Math.random() * platforms.length);
      const testUuid = 'test-device-' + Math.random().toString(36).substring(2, 9);

      const result = await PwaModel.recordEvent({
        action: 'install',
        device_uuid: testUuid,
        platform: platforms[randomIdx],
        browser: browsers[randomIdx],
        display_mode: 'standalone',
        user_agent: 'Simulated PWA Client / PhonesDaddy Admin Panel',
        ip_address: req.ip || '127.0.0.1'
      });

      return res.json({
        success: true,
        data: result,
        message: `Simulated installation recorded for ${platforms[randomIdx]}!`
      });
    } catch (err) {
      console.error('PwaController.simulateInstall error:', err);
      return res.status(500).json({ success: false, message: 'Simulation failed' });
    }
  }
}

module.exports = PwaController;
