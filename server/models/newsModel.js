const { pool } = require('../config/database');

class NewsModel {
  /**
   * Get paginated articles with optional filters
   */
  static async getArticles({ page = 1, limit = 10, category = '', status = 'published', is_hot = null, search = '' } = {}) {
    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const conditions = [];
    const params = [];

    if (status && status !== 'all') {
      conditions.push('status = ?');
      params.push(status);
    }

    if (category) {
      conditions.push('category = ?');
      params.push(category);
    }

    if (is_hot !== null && is_hot !== undefined && is_hot !== '') {
      conditions.push('is_hot = ?');
      params.push(is_hot ? 1 : 0);
    }

    if (search && search.trim() !== '') {
      conditions.push('(title LIKE ? OR summary LIKE ? OR content LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count total
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM news ${whereClause}`,
      params
    );
    const total = countRows[0].total;

    // Fetch items
    const query = `
      SELECT 
        id, title, slug, summary, author, category, is_hot, status,
        image, views, created_at, updated_at,
        (SELECT COUNT(*) FROM reviews_comments ur WHERE ur.entity_type = 'news' AND ur.entity_id = news.id AND ur.status = 'approved') AS comment_count
      FROM news
      ${whereClause}
      ORDER BY is_hot DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [rows] = await pool.query(query, [...params, parsedLimit, offset]);

    return {
      articles: rows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    };
  }

  /**
   * Get top Hot / Featured News for home page or widget
   */
  static async getHotNews(limit = 6) {
    const [rows] = await pool.query(`
      SELECT 
        id, title, slug, summary, author, category, is_hot, status,
        image, views, created_at,
        (SELECT COUNT(*) FROM reviews_comments ur WHERE ur.entity_type = 'news' AND ur.entity_id = news.id AND ur.status = 'approved') AS comment_count
      FROM news
      WHERE status = 'published'
      ORDER BY is_hot DESC, created_at DESC
      LIMIT ?
    `, [parseInt(limit, 10)]);
    return rows;
  }

  /**
   * Get single article by slug
   */
  static async getBySlug(slug) {
    const [rows] = await pool.query(`
      SELECT 
        news.*,
        (SELECT COUNT(*) FROM reviews_comments ur WHERE ur.entity_type = 'news' AND ur.entity_id = news.id AND ur.status = 'approved') AS comment_count
      FROM news
      WHERE slug = ?
    `, [slug]);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get single article by ID
   */
  static async getById(id) {
    const [rows] = await pool.query(`
      SELECT 
        news.*,
        (SELECT COUNT(*) FROM reviews_comments ur WHERE ur.entity_type = 'news' AND ur.entity_id = news.id AND ur.status = 'approved') AS comment_count
      FROM news
      WHERE id = ?
    `, [id]);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Increment view counter
   */
  static async incrementViews(id) {
    await pool.query('UPDATE news SET views = views + 1 WHERE id = ?', [id]);
  }

  /**
   * Create new article
   */
  static async createArticle({ title, slug, summary, author, category, is_hot, status, content, image, meta_title, meta_description, focus_keyword, related_keywords, canonical_url }) {
    const [result] = await pool.query(`
      INSERT INTO news (
        title, slug, summary, author, category, is_hot, status, content, image,
        meta_title, meta_description, focus_keyword, related_keywords, canonical_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      title,
      slug,
      summary || null,
      author || 'Editorial Team',
      category || 'Hot News',
      is_hot ? 1 : 0,
      status || 'published',
      content || '',
      image || null,
      meta_title || null,
      meta_description || null,
      focus_keyword || null,
      related_keywords ? (typeof related_keywords === 'object' ? JSON.stringify(related_keywords) : String(related_keywords)) : null,
      canonical_url || null
    ]);

    return result.insertId;
  }

  /**
   * Update existing article
   */
  static async updateArticle(id, { title, slug, summary, author, category, is_hot, status, content, image, meta_title, meta_description, focus_keyword, related_keywords, canonical_url }) {
    const fields = [
      'title = ?',
      'slug = ?',
      'summary = ?',
      'author = ?',
      'category = ?',
      'is_hot = ?',
      'status = ?',
      'content = ?',
      'meta_title = ?',
      'meta_description = ?',
      'focus_keyword = ?',
      'related_keywords = ?',
      'canonical_url = ?'
    ];
    const params = [
      title,
      slug,
      summary || null,
      author || 'Editorial Team',
      category || 'Hot News',
      is_hot ? 1 : 0,
      status || 'published',
      content || '',
      meta_title || null,
      meta_description || null,
      focus_keyword || null,
      related_keywords ? (typeof related_keywords === 'object' ? JSON.stringify(related_keywords) : String(related_keywords)) : null,
      canonical_url || null
    ];

    if (image !== undefined) {
      fields.push('image = ?');
      params.push(image);
    }

    params.push(id);

    await pool.query(`
      UPDATE news 
      SET ${fields.join(', ')}
      WHERE id = ?
    `, params);

    return true;
  }

  /**
   * Delete article
   */
  static async deleteArticle(id) {
    const [result] = await pool.query('DELETE FROM news WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  /**
   * Delete multiple articles in bulk
   */
  static async deleteArticles(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const [result] = await pool.query('DELETE FROM news WHERE id IN (?)', [ids]);
    return result.affectedRows;
  }

  /**
   * Get stats for admin dashboard
   */
  static async getStats() {
    const [rows] = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN is_hot = 1 THEN 1 ELSE 0 END) AS hot_count,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_count,
        COALESCE(SUM(views), 0) AS total_views
      FROM news
    `);
    return rows[0];
  }

  /**
   * Get distinct categories with counts
   */
  static async getCategories() {
    const [rows] = await pool.query(`
      SELECT category, COUNT(*) as count
      FROM news
      WHERE status = 'published'
      GROUP BY category
      ORDER BY count DESC
    `);
    return rows;
  }
}

module.exports = NewsModel;
