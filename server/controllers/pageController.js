const PageModel = require('../models/pageModel');
const { cache } = require('../utils/cache');

class PageController {
  /**
   * Helper to generate URL slug
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
   * Public: Get footer pages list
   */
  static async getFooterPages(req, res, next) {
    try {
      const pages = await PageModel.getFooterPages();
      return res.json({ success: true, data: pages });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public: Get single page by slug
   */
  static async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const page = await PageModel.getBySlug(slug);

      if (!page || page.status !== 'published') {
        return res.status(404).json({ success: false, message: 'Page not found' });
      }

      PageModel.incrementViews(page.id).catch(console.error);

      return res.json({ success: true, data: page });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: List pages with pagination, search, status filter
   */
  static async adminList(req, res, next) {
    try {
      const { page = 1, limit = 20, status = 'all', search = '' } = req.query;
      const result = await PageModel.getPages({ page, limit, status, search });
      return res.json({ success: true, data: result.pages, pagination: result.pagination });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get page by ID
   */
  static async adminGetById(req, res, next) {
    try {
      const { id } = req.params;
      const page = await PageModel.getById(id);
      if (!page) {
        return res.status(404).json({ success: false, message: 'Page not found' });
      }
      return res.json({ success: true, data: page });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Create page
   */
  static async create(req, res, next) {
    try {
      const { title, slug, content, meta_title, meta_description, status, show_in_footer } = req.body;

      if (!title || title.trim() === '') {
        return res.status(400).json({ success: false, message: 'Page title is required' });
      }

      let finalSlug = slug && slug.trim() !== '' ? PageController.generateSlug(slug) : PageController.generateSlug(title);

      const existing = await PageModel.getBySlug(finalSlug);
      if (existing) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      const id = await PageModel.createPage({
        title: title.trim(),
        slug: finalSlug,
        content: content || '',
        meta_title: meta_title ? meta_title.trim() : null,
        meta_description: meta_description ? meta_description.trim() : null,
        status: status || 'published',
        show_in_footer: show_in_footer === '1' || show_in_footer === 1 || show_in_footer === true || show_in_footer === 'true'
      });

      cache.invalidateTags(['pages']);

      return res.status(201).json({
        success: true,
        message: 'Page created successfully',
        data: { id, slug: finalSlug }
      });
    } catch (err) {
      console.error('Error creating page:', err);
      return res.status(500).json({ success: false, message: 'Failed to create page: ' + err.message });
    }
  }

  /**
   * Admin: Update page
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { title, slug, content, meta_title, meta_description, status, show_in_footer } = req.body;

      const existing = await PageModel.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Page not found' });
      }

      let finalSlug = slug && slug.trim() !== '' ? PageController.generateSlug(slug) : existing.slug;

      // Check unique slug conflict
      const conflict = await PageModel.getBySlug(finalSlug);
      if (conflict && conflict.id !== parseInt(id, 10)) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      await PageModel.updatePage(id, {
        title: title ? title.trim() : existing.title,
        slug: finalSlug,
        content: content !== undefined ? content : existing.content,
        meta_title: meta_title !== undefined ? meta_title.trim() : existing.meta_title,
        meta_description: meta_description !== undefined ? meta_description.trim() : existing.meta_description,
        status: status || existing.status,
        show_in_footer: show_in_footer === '1' || show_in_footer === 1 || show_in_footer === true || show_in_footer === 'true'
      });

      cache.invalidateTags(['pages']);

      return res.json({
        success: true,
        message: 'Page updated successfully',
        data: { id, slug: finalSlug }
      });
    } catch (err) {
      console.error('Error updating page:', err);
      return res.status(500).json({ success: false, message: 'Failed to update page: ' + err.message });
    }
  }

  /**
   * Admin: Delete page
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await PageModel.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Page not found' });
      }

      // Check if it is one of the core protected pages, or let user delete with confirmation
      await PageModel.deletePage(id);
      cache.invalidateTags(['pages']);
      return res.json({ success: true, message: 'Page deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PageController;
