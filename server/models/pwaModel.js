const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { pool } = require('../config/database');
const SettingsModel = require('./settingsModel');

class PwaModel {
  /**
   * Ensure pwa_installations table exists
   */
  static async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pwa_installations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        device_uuid VARCHAR(100) NOT NULL UNIQUE,
        platform VARCHAR(50) DEFAULT 'Unknown',
        browser VARCHAR(50) DEFAULT 'Unknown',
        display_mode VARCHAR(30) DEFAULT 'standalone',
        user_agent TEXT,
        ip_address VARCHAR(45) DEFAULT NULL,
        installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        launches_count INT DEFAULT 1,
        INDEX idx_platform (platform),
        INDEX idx_last_active (last_active_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  /**
   * Record PWA installation or active launch
   */
  static async recordEvent({ action = 'launch', device_uuid, platform = 'Unknown', browser = 'Unknown', display_mode = 'standalone', user_agent = '', ip_address = '' }) {
    if (!device_uuid || typeof device_uuid !== 'string' || device_uuid.length < 5) {
      return { success: false, message: 'Invalid device UUID' };
    }

    await this.ensureTable();

    const cleanUuid = String(device_uuid).substring(0, 100);
    const cleanPlatform = String(platform || 'Unknown').substring(0, 50);
    const cleanBrowser = String(browser || 'Unknown').substring(0, 50);
    const cleanDisplay = String(display_mode || 'standalone').substring(0, 30);
    const cleanIp = String(ip_address || '').substring(0, 45);

    try {
      const [existing] = await pool.query(
        'SELECT id, launches_count FROM pwa_installations WHERE device_uuid = ? LIMIT 1',
        [cleanUuid]
      );

      if (existing.length > 0) {
        await pool.query(
          `UPDATE pwa_installations 
           SET last_active_at = NOW(), 
               launches_count = launches_count + 1, 
               display_mode = COALESCE(?, display_mode),
               platform = CASE WHEN platform = 'Unknown' THEN ? ELSE platform END,
               browser = CASE WHEN browser = 'Unknown' THEN ? ELSE browser END
           WHERE device_uuid = ?`,
          [cleanDisplay, cleanPlatform, cleanBrowser, cleanUuid]
        );
        return { success: true, updated: true, action, launches: existing[0].launches_count + 1 };
      } else {
        await pool.query(
          `INSERT INTO pwa_installations 
           (device_uuid, platform, browser, display_mode, user_agent, ip_address, installed_at, last_active_at, launches_count) 
           VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), 1)`,
          [cleanUuid, cleanPlatform, cleanBrowser, cleanDisplay, user_agent, cleanIp]
        );
        return { success: true, inserted: true, action, launches: 1 };
      }
    } catch (err) {
      console.error('Error in PwaModel.recordEvent:', err);
      throw err;
    }
  }

  /**
   * Get PWA statistics and configuration
   */
  static async getStats() {
    await this.ensureTable();

    try {
      const [totalRows] = await pool.query('SELECT COUNT(*) AS total FROM pwa_installations');
      const [activeRows] = await pool.query('SELECT COUNT(*) AS active FROM pwa_installations WHERE last_active_at >= NOW() - INTERVAL 30 DAY');
      const [active7Rows] = await pool.query('SELECT COUNT(*) AS active_7d FROM pwa_installations WHERE last_active_at >= NOW() - INTERVAL 7 DAY');
      const [launchesRows] = await pool.query('SELECT COALESCE(SUM(launches_count), 0) AS total_launches FROM pwa_installations');
      
      const [platformRows] = await pool.query(`
        SELECT platform, COUNT(*) as count 
        FROM pwa_installations 
        GROUP BY platform 
        ORDER BY count DESC
      `);

      const [recentRows] = await pool.query(`
        SELECT id, device_uuid, platform, browser, display_mode, installed_at, last_active_at, launches_count 
        FROM pwa_installations 
        ORDER BY last_active_at DESC 
        LIMIT 25
      `);

      const config = await this.getConfig();

      const total = totalRows[0] ? totalRows[0].total : 0;
      const active = activeRows[0] ? activeRows[0].active : 0;
      const active7 = active7Rows[0] ? active7Rows[0].active_7d : 0;
      const totalLaunches = launchesRows[0] ? launchesRows[0].total_launches : 0;

      const platformBreakdown = platformRows.map(r => ({
        platform: r.platform || 'Unknown',
        count: r.count,
        percentage: total > 0 ? Math.round((r.count / total) * 100) : 0
      }));

      return {
        total_installations: total,
        active_installations: active,
        active_7d: active7,
        total_launches: totalLaunches,
        platform_breakdown: platformBreakdown,
        recent_installations: recentRows,
        config
      };
    } catch (err) {
      console.error('Error in PwaModel.getStats:', err);
      throw err;
    }
  }

  /**
   * Get current PWA settings & effective icons
   */
  static async getConfig() {
    const settings = await SettingsModel.getAllSettings();

    const siteLogo = settings.site_logo || '';
    const siteFavicon = settings.site_favicon || '';
    const defaultSiteIcon = siteLogo || siteFavicon || '/icon-512x512.png';

    const pwaCustomIcon = settings.pwa_custom_icon || '';
    const isCustomIcon = !!(pwaCustomIcon && pwaCustomIcon.trim());
    const effectiveIcon = isCustomIcon ? pwaCustomIcon : defaultSiteIcon;

    return {
      app_name: settings.pwa_app_name || 'PhonesDaddy - Mobile Phone Prices & Specifications',
      short_name: settings.pwa_short_name || 'PhonesDaddy',
      description: settings.pwa_description || 'Discover latest mobile phone prices in Pakistan, full technical specifications, camera reviews, PTA tax calculator, and phone comparisons.',
      theme_color: settings.pwa_theme_color || '#0d9488',
      background_color: settings.pwa_background_color || '#0f172a',
      display_mode: settings.pwa_display_mode || 'standalone',
      start_url: settings.pwa_start_url || '/?source=pwa',
      orientation: settings.pwa_orientation || 'portrait-primary',
      site_icon: defaultSiteIcon,
      custom_icon: pwaCustomIcon,
      effective_icon: effectiveIcon,
      icon_source: isCustomIcon ? 'custom' : 'site'
    };
  }

  /**
   * Update PWA configuration in site_settings and update manifest
   */
  static async updateConfig(updates = {}) {
    const toSave = {};
    if (updates.app_name !== undefined) toSave.pwa_app_name = String(updates.app_name).trim();
    if (updates.short_name !== undefined) toSave.pwa_short_name = String(updates.short_name).trim();
    if (updates.description !== undefined) toSave.pwa_description = String(updates.description).trim();
    if (updates.theme_color !== undefined) toSave.pwa_theme_color = String(updates.theme_color).trim();
    if (updates.background_color !== undefined) toSave.pwa_background_color = String(updates.background_color).trim();
    if (updates.display_mode !== undefined) toSave.pwa_display_mode = String(updates.display_mode).trim();
    if (updates.start_url !== undefined) toSave.pwa_start_url = String(updates.start_url).trim();
    if (updates.orientation !== undefined) toSave.pwa_orientation = String(updates.orientation).trim();
    if (updates.custom_icon !== undefined) toSave.pwa_custom_icon = String(updates.custom_icon).trim();

    await SettingsModel.updateSettings(toSave);
    await this.syncManifest();
    return await this.getConfig();
  }

  /**
   * Synchronize public/manifest.json and manifest.webmanifest with current settings
   */
  static async syncManifest() {
    const config = await this.getConfig();
    const manifestPath = path.join(__dirname, '../../public/manifest.json');
    const webmanifestPath = path.join(__dirname, '../../public/manifest.webmanifest');

    let manifest = {};
    try {
      if (fs.existsSync(manifestPath)) {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      }
    } catch (_) {
      manifest = {};
    }

    manifest.name = config.app_name;
    manifest.short_name = config.short_name;
    manifest.description = config.description;
    manifest.theme_color = config.theme_color;
    manifest.background_color = config.background_color;
    manifest.display = config.display_mode;
    manifest.start_url = config.start_url;
    manifest.orientation = config.orientation;

    if (!manifest.icons || manifest.icons.length === 0) {
      manifest.icons = [
        { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-maskable-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
        { src: '/icon-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }
      ];
    }

    const jsonStr = JSON.stringify(manifest, null, 2);
    try {
      fs.writeFileSync(manifestPath, jsonStr, 'utf8');
      fs.writeFileSync(webmanifestPath, jsonStr, 'utf8');
    } catch (err) {
      console.warn('Could not write manifest files:', err.message);
    }
  }

  /**
   * Apply a custom uploaded image as the PWA icon.
   * Generates standard PWA sizes (192, 512, maskable, apple-touch-icon).
   */
  static async setCustomIcon(fileBuffer, originalExt = '.png') {
    const uploadDir = path.join(__dirname, '../../public/uploads/pwa');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `pwa-icon-${Date.now()}${originalExt}`;
    const customIconPath = path.join(uploadDir, filename);
    const customIconUrl = `/uploads/pwa/${filename}`;

    fs.writeFileSync(customIconPath, fileBuffer);

    // Generate standard PWA icons in public/
    await this.generateStandardIconsFromBuffer(fileBuffer);

    // Save setting
    await this.updateConfig({ custom_icon: customIconUrl });
    return customIconUrl;
  }

  /**
   * Reset PWA icon to use the site's brand icon/logo
   */
  static async resetToSiteIcon() {
    const settings = await SettingsModel.getAllSettings();
    const siteLogo = settings.site_logo || '';
    const siteFavicon = settings.site_favicon || '';

    let sourcePath = null;
    if (siteLogo && siteLogo.startsWith('/')) {
      const p = path.join(__dirname, '../../public', siteLogo);
      if (fs.existsSync(p)) sourcePath = p;
    }
    if (!sourcePath && siteFavicon && siteFavicon.startsWith('/')) {
      const p = path.join(__dirname, '../../public', siteFavicon);
      if (fs.existsSync(p)) sourcePath = p;
    }

    if (sourcePath && fs.existsSync(sourcePath)) {
      try {
        const buf = fs.readFileSync(sourcePath);
        await this.generateStandardIconsFromBuffer(buf);
      } catch (e) {
        console.warn('Could not regenerate PWA icons from site logo:', e.message);
      }
    }

    await this.updateConfig({ custom_icon: '' });
    return await this.getConfig();
  }

  /**
   * Helper: Generate 192x192, 512x512, maskable, and apple-touch-icon using Sharp
   */
  static async generateStandardIconsFromBuffer(buffer) {
    const publicDir = path.join(__dirname, '../../public');
    try {
      // 192x192
      await sharp(buffer)
        .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(path.join(publicDir, 'icon-192x192.png'));

      // 512x512
      await sharp(buffer)
        .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png({ compressionLevel: 9 })
        .toFile(path.join(publicDir, 'icon-512x512.png'));

      // Maskable 192x192 (with slight padding for safe zone)
      await sharp(buffer)
        .resize(150, 150, { fit: 'contain', background: { r: 13, g: 148, b: 136, alpha: 1 } })
        .extend({ top: 21, bottom: 21, left: 21, right: 21, background: { r: 13, g: 148, b: 136, alpha: 1 } })
        .png()
        .toFile(path.join(publicDir, 'icon-maskable-192x192.png'));

      // Maskable 512x512
      await sharp(buffer)
        .resize(410, 410, { fit: 'contain', background: { r: 13, g: 148, b: 136, alpha: 1 } })
        .extend({ top: 51, bottom: 51, left: 51, right: 51, background: { r: 13, g: 148, b: 136, alpha: 1 } })
        .png()
        .toFile(path.join(publicDir, 'icon-maskable-512x512.png'));

      // Apple Touch Icon 180x180
      await sharp(buffer)
        .resize(180, 180, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .png()
        .toFile(path.join(publicDir, 'apple-touch-icon.png'));

    } catch (err) {
      console.warn('Sharp icon generation warning:', err.message);
    }
  }
}

module.exports = PwaModel;
