const express = require('express');
const router = express.Router();
const CategoryController = require('../controllers/categoryController');
const { requireArticlePermission } = require('../middleware/auth');

const { cacheMiddleware } = require('../utils/cache');

// Public endpoint (Cached with 'news' tag)
router.get('/', cacheMiddleware(600, ['news']), CategoryController.list);

// Admin endpoints (Protected for Article Writers & Admins)
router.post('/admin', requireArticlePermission, CategoryController.create);
router.put('/admin/:id', requireArticlePermission, CategoryController.update);
router.delete('/admin/:id', requireArticlePermission, CategoryController.delete);

module.exports = router;
