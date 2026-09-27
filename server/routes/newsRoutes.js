const express = require('express');
const router = express.Router();
const multer = require('multer');
const NewsController = require('../controllers/newsController');
const { requireArticlePermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * Wrapper to handle multer errors gracefully and return JSON
 */
function handleUpload(fieldName) {
  return (req, res, next) => {
    const uploadMiddleware = upload.single(fieldName);
    uploadMiddleware(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: `Upload error: ${err.message}`
        });
      } else if (err) {
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed'
        });
      }
      next();
    });
  };
}

const { cacheMiddleware } = require('../utils/cache');

// Public endpoints (Cached with 'news' and 'home' tags)
router.get('/', cacheMiddleware(180, ['news']), NewsController.list);
router.get('/hot', cacheMiddleware(300, ['news', 'home']), NewsController.getHot);
router.get('/categories', cacheMiddleware(600, ['news']), NewsController.getCategories);
router.get('/slug/:slug', cacheMiddleware(300, ['news']), NewsController.getBySlug);

// Admin endpoints (Protected for Article Writers & Admins)
router.get('/admin/stats', requireArticlePermission, NewsController.getStats);
router.get('/admin/list', requireArticlePermission, NewsController.adminList);
router.post('/admin/upload-inline-image', requireArticlePermission, handleUpload('image'), NewsController.uploadInlineImage);
router.post('/admin', requireArticlePermission, handleUpload('image'), NewsController.create);
router.get('/admin/:id', requireArticlePermission, NewsController.adminGetById);
router.put('/admin/:id', requireArticlePermission, handleUpload('image'), NewsController.update);
router.post('/admin/bulk-delete', requireArticlePermission, NewsController.bulkDelete);
router.delete('/admin/:id', requireArticlePermission, NewsController.delete);

module.exports = router;
