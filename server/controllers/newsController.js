const NewsModel = require('../models/newsModel');
const path = require('path');
const fs = require('fs');
const { cache } = require('../utils/cache');
const { deleteMediaFiles } = require('../utils/imageOptimizer');

class NewsController {
  /**
   * Helper to generate clean slug
   */
  static generateSlug(text) {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Public: List published articles
   */
  static async list(req, res, next) {
    try {
      const { page = 1, limit = 9, category, search } = req.query;
      const result = await NewsModel.getArticles({
        page,
        limit,
        category,
        status: 'published',
        search
      });
      return res.json({ success: true, data: result.articles, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Top hot news for homepage or widget
   */
  static async getHot(req, res, next) {
    try {
      const limit = req.query.limit || 6;
      const articles = await NewsModel.getHotNews(limit);
      return res.json({ success: true, data: articles });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Single article by slug
   */
  static async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const article = await NewsModel.getBySlug(slug);

      if (!article) {
        return res.status(404).json({ success: false, message: 'Article not found' });
      }

      // Increment view counter asynchronously
      NewsModel.incrementViews(article.id).catch(console.error);

      // Fetch 3 related hot articles
      const related = await NewsModel.getHotNews(4);
      const filteredRelated = related.filter(a => a.id !== article.id).slice(0, 3);

      return res.json({ success: true, data: article, related: filteredRelated });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Categories list
   */
  static async getCategories(req, res, next) {
    try {
      const categories = await NewsModel.getCategories();
      return res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: List all articles (including drafts)
   */
  static async adminList(req, res, next) {
    try {
      const { page = 1, limit = 20, category, status, search } = req.query;
      const result = await NewsModel.getArticles({
        page,
        limit,
        category,
        status: status || 'all',
        search
      });
      return res.json({ success: true, data: result.articles, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get article by ID for editing
   */
  static async adminGetById(req, res, next) {
    try {
      const { id } = req.params;
      const article = await NewsModel.getById(id);
      if (!article) {
        return res.status(404).json({ success: false, message: 'Article not found' });
      }
      return res.json({ success: true, data: article });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Create article
   */
  static async create(req, res, next) {
    try {
      const { title, slug, summary, author, category, is_hot, status, content } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({ success: false, message: 'Title is required' });
      }

      let finalSlug = slug && slug.trim() !== '' ? NewsController.generateSlug(slug) : NewsController.generateSlug(title);

      // Check unique slug
      const existing = await NewsModel.getBySlug(finalSlug);
      if (existing) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      let image = null;
      if (req.file) {
        image = `/uploads/news/${req.file.filename}`;
      } else if (req.body.image_url) {
        image = req.body.image_url;
      }

      const newId = await NewsModel.createArticle({
        title: title.trim(),
        slug: finalSlug,
        summary: summary ? summary.trim() : null,
        author: author ? author.trim() : 'Editorial Team',
        category: category || 'Hot News',
        is_hot: is_hot === '1' || is_hot === 1 || is_hot === 'true' || is_hot === true,
        status: status || 'published',
        content: content || '',
        image
      });

      cache.invalidateTags(['news', 'home']);

      return res.status(201).json({
        success: true,
        message: 'Article published successfully',
        data: { id: newId, slug: finalSlug }
      });
    } catch (err) {
      console.error('Error creating article:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to create article: ' + (err.message || 'Database error')
      });
    }
  }

  /**
   * Admin: Update article
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { title, slug, summary, author, category, is_hot, status, content } = req.body;

      const existing = await NewsModel.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Article not found' });
      }

      let finalSlug = slug && slug.trim() !== '' ? NewsController.generateSlug(slug) : NewsController.generateSlug(title || existing.title);

      // Check if slug conflicts with another article
      const conflict = await NewsModel.getBySlug(finalSlug);
      if (conflict && conflict.id !== parseInt(id, 10)) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      let image = undefined;
      if (req.file) {
        image = `/uploads/news/${req.file.filename}`;
      } else if (req.body.image_url !== undefined) {
        image = req.body.image_url;
      }

      await NewsModel.updateArticle(id, {
        title: title ? title.trim() : existing.title,
        slug: finalSlug,
        summary: summary !== undefined ? summary.trim() : existing.summary,
        author: author ? author.trim() : existing.author,
        category: category || existing.category,
        is_hot: is_hot === '1' || is_hot === 1 || is_hot === 'true' || is_hot === true,
        status: status || existing.status,
        content: content !== undefined ? content : existing.content,
        image
      });

      cache.invalidateTags(['news', 'home']);

      return res.json({
        success: true,
        message: 'Article updated successfully',
        data: { id, slug: finalSlug }
      });
    } catch (err) {
      console.error('Error updating article:', err);
      return res.status(500).json({
        success: false,
        message: 'Failed to update article: ' + (err.message || 'Database error')
      });
    }
  }

  /**
   * Admin: Delete article
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await NewsModel.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Article not found' });
      }

      await NewsModel.deleteArticle(id);
      if (existing.image) {
        deleteMediaFiles(existing.image);
      }
      cache.invalidateTags(['news', 'home']);
      return res.json({ success: true, message: 'Article deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Bulk Delete articles
   */
  static async bulkDelete(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'No article IDs provided for deletion.' });
      }

      const cleanIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
      if (cleanIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid article IDs provided.' });
      }

      // Fetch images before deleting records
      let imagesToDelete = [];
      try {
        const { pool } = require('../config/database');
        const [rows] = await pool.query('SELECT image FROM news WHERE id IN (?)', [cleanIds]);
        if (rows && rows.length > 0) {
          imagesToDelete = rows.map(r => r.image).filter(Boolean);
        }
      } catch (_) {}

      const affected = await NewsModel.deleteArticles(cleanIds);

      if (imagesToDelete.length > 0) {
        deleteMediaFiles(imagesToDelete);
      }

      cache.invalidateTags(['news', 'home']);
      return res.json({
        success: true,
        message: `Successfully deleted ${affected} article(s).`,
        affected
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Upload inline image for rich text editor
   */
  static async uploadInlineImage(req, res, next) {
    try {
      if (!req.file) {
        console.error('Inline image upload: No file received. Body fields:', Object.keys(req.body || {}));
        return res.status(400).json({ success: false, message: 'No image file uploaded. Make sure the field name is "image".' });
      }
      const imageUrl = `/uploads/news/${req.file.filename}`;
      console.log('Inline image uploaded successfully:', imageUrl);
      return res.json({
        success: true,
        url: imageUrl,
        message: 'Image uploaded successfully'
      });
    } catch (err) {
      console.error('Error in uploadInlineImage:', err);
      return res.status(500).json({
        success: false,
        message: 'Image upload failed: ' + (err.message || 'Server error')
      });
    }
  }

  /**
   * Admin: Stats for dashboard
   */
  static async getStats(req, res, next) {
    try {
      const stats = await NewsModel.getStats();
      return res.json({ success: true, data: stats });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = NewsController;
