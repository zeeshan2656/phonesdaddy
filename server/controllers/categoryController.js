const CategoryModel = require('../models/categoryModel');
const { cache } = require('../utils/cache');

class CategoryController {
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
   * Public / Admin: List all categories
   */
  static async list(req, res, next) {
    try {
      const categories = await CategoryModel.getAll();
      return res.json({ success: true, data: categories });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Create category
   */
  static async create(req, res, next) {
    try {
      const { name, slug, description } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }

      const trimmedName = name.trim();
      let finalSlug = slug && slug.trim() !== '' ? CategoryController.generateSlug(slug) : CategoryController.generateSlug(trimmedName);

      // Check duplicate name or slug
      const existingName = await CategoryModel.getByName(trimmedName);
      if (existingName) {
        return res.status(400).json({ success: false, message: 'A category with this name already exists' });
      }

      const existingSlug = await CategoryModel.getBySlug(finalSlug);
      if (existingSlug) {
        finalSlug = `${finalSlug}-${Date.now().toString().slice(-4)}`;
      }

      const id = await CategoryModel.create({
        name: trimmedName,
        slug: finalSlug,
        description: description ? description.trim() : null
      });

      cache.invalidateTags(['news']);

      return res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: { id, name: trimmedName, slug: finalSlug }
      });
    } catch (err) {
      console.error('Error creating category:', err);
      return res.status(500).json({ success: false, message: 'Failed to create category: ' + err.message });
    }
  }

  /**
   * Admin: Update category
   */
  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, slug, description } = req.body;

      const existing = await CategoryModel.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      if (!name || name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Category name is required' });
      }

      const trimmedName = name.trim();
      let finalSlug = slug && slug.trim() !== '' ? CategoryController.generateSlug(slug) : CategoryController.generateSlug(trimmedName);

      // Check name uniqueness if changed
      if (trimmedName.toLowerCase() !== existing.name.toLowerCase()) {
        const dupName = await CategoryModel.getByName(trimmedName);
        if (dupName && dupName.id !== parseInt(id, 10)) {
          return res.status(400).json({ success: false, message: 'A category with this name already exists' });
        }
      }

      await CategoryModel.update(id, {
        name: trimmedName,
        slug: finalSlug,
        description: description !== undefined ? (description ? description.trim() : null) : existing.description
      });

      cache.invalidateTags(['news']);

      return res.json({
        success: true,
        message: 'Category updated successfully',
        data: { id, name: trimmedName, slug: finalSlug }
      });
    } catch (err) {
      console.error('Error updating category:', err);
      return res.status(500).json({ success: false, message: 'Failed to update category: ' + err.message });
    }
  }

  /**
   * Admin: Delete category
   */
  static async delete(req, res, next) {
    try {
      const { id } = req.params;
      const existing = await CategoryModel.getById(id);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Category not found' });
      }

      await CategoryModel.delete(id);
      cache.invalidateTags(['news']);
      return res.json({ success: true, message: 'Category deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CategoryController;
