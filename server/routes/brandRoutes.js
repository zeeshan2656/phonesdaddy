const express = require('express');
const router = express.Router();
const BrandController = require('../controllers/brandController');
const { requirePhonePermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

const { cacheMiddleware } = require('../utils/cache');

// Public routes (Cached with tag 'brands' and 'home')
router.get('/', cacheMiddleware(300, ['brands', 'home']), BrandController.list);
router.get('/slug/:slug', cacheMiddleware(300, ['brands']), BrandController.getBySlug);
router.get('/:id', cacheMiddleware(300, ['brands']), BrandController.getById);

// Protected admin & mobile manager routes
router.post('/', requirePhonePermission, upload.single('logo'), BrandController.create);
router.put('/:id', requirePhonePermission, upload.single('logo'), BrandController.update);
router.delete('/:id', requirePhonePermission, BrandController.deleteBrand);

module.exports = router;
