const { pool } = require('../config/database');

class AnnouncementModel {
  /**
   * Ensure announcements table exists
   */
  static async ensureTable() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info','success','warning','promo','urgent') DEFAULT 'info',
        bg_color VARCHAR(30) DEFAULT '#0d9488',
        text_color VARCHAR(30) DEFAULT '#ffffff',
        emoji VARCHAR(10) DEFAULT '📢',
        cta_text VARCHAR(100) DEFAULT '',
        cta_url VARCHAR(500) DEFAULT '',
        is_active TINYINT(1) DEFAULT 0,
        show_once TINYINT(1) DEFAULT 1,
        start_date DATETIME DEFAULT NULL,
        end_date DATETIME DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  /**
   * Get the currently active announcement (for public API)
   */
  static async getActive() {
    await this.ensureTable();
    const now = new Date();
    const [rows] = await pool.query(`
      SELECT id, title, message, type, bg_color, text_color, emoji, cta_text, cta_url, show_once
      FROM announcements
      WHERE is_active = 1
        AND (start_date IS NULL OR start_date <= ?)
        AND (end_date IS NULL OR end_date >= ?)
      ORDER BY updated_at DESC
      LIMIT 1
    `, [now, now]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Admin: list all announcements
   */
  static async getAll() {
    await this.ensureTable();
    const [rows] = await pool.query(`
      SELECT * FROM announcements ORDER BY created_at DESC
    `);
    return rows;
  }

  /**
   * Admin: get single announcement by ID
   */
  static async getById(id) {
    await this.ensureTable();
    const [rows] = await pool.query(`SELECT * FROM announcements WHERE id = ?`, [id]);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Admin: create new announcement
   */
  static async create(data) {
    await this.ensureTable();
    // Deactivate all existing if this one is active
    if (data.is_active) {
      await pool.query(`UPDATE announcements SET is_active = 0`);
    }
    const [result] = await pool.query(`
      INSERT INTO announcements (title, message, type, bg_color, text_color, emoji, cta_text, cta_url, is_active, show_once, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.title,
      data.message,
      data.type || 'info',
      data.bg_color || '#0d9488',
      data.text_color || '#ffffff',
      data.emoji || '📢',
      data.cta_text || '',
      data.cta_url || '',
      data.is_active ? 1 : 0,
      data.show_once !== false ? 1 : 0,
      data.start_date || null,
      data.end_date || null
    ]);
    return result.insertId;
  }

  /**
   * Admin: update announcement
   */
  static async update(id, data) {
    await this.ensureTable();
    // Deactivate all others if this one is being activated
    if (data.is_active) {
      await pool.query(`UPDATE announcements SET is_active = 0 WHERE id != ?`, [id]);
    }
    await pool.query(`
      UPDATE announcements SET
        title = ?, message = ?, type = ?, bg_color = ?, text_color = ?,
        emoji = ?, cta_text = ?, cta_url = ?, is_active = ?, show_once = ?,
        start_date = ?, end_date = ?
      WHERE id = ?
    `, [
      data.title,
      data.message,
      data.type || 'info',
      data.bg_color || '#0d9488',
      data.text_color || '#ffffff',
      data.emoji || '📢',
      data.cta_text || '',
      data.cta_url || '',
      data.is_active ? 1 : 0,
      data.show_once !== false ? 1 : 0,
      data.start_date || null,
      data.end_date || null,
      id
    ]);
  }

  /**
   * Admin: toggle is_active
   */
  static async toggleActive(id) {
    await this.ensureTable();
    const ann = await this.getById(id);
    if (!ann) return null;
    const newState = ann.is_active ? 0 : 1;
    if (newState === 1) {
      // Deactivate all others
      await pool.query(`UPDATE announcements SET is_active = 0`);
    }
    await pool.query(`UPDATE announcements SET is_active = ? WHERE id = ?`, [newState, id]);
    return newState;
  }

  /**
   * Admin: delete announcement
   */
  static async delete(id) {
    await this.ensureTable();
    await pool.query(`DELETE FROM announcements WHERE id = ?`, [id]);
  }
}

module.exports = AnnouncementModel;
