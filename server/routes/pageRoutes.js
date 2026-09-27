const express = require('express');
const router = express.Router();
const PageController = require('../controllers/pageController');
const { requireAdminAuth } = require('../middleware/auth');

const { cacheMiddleware } = require('../utils/cache');

// Public endpoints (Cached with 'pages' tag)
router.get('/footer', cacheMiddleware(3600, ['pages']), PageController.getFooterPages);
router.get('/slug/:slug', cacheMiddleware(1800, ['pages']), PageController.getBySlug);

// Admin endpoints (Protected)
router.get('/admin/list', requireAdminAuth, PageController.adminList);
router.get('/admin/:id', requireAdminAuth, PageController.adminGetById);
router.post('/admin', requireAdminAuth, PageController.create);
router.put('/admin/:id', requireAdminAuth, PageController.update);
router.delete('/admin/:id', requireAdminAuth, PageController.delete);

module.exports = router;
