const express = require('express');
const router = express.Router();
const PhoneController = require('../controllers/phoneController');
const { requirePhonePermission } = require('../middleware/auth');
const upload = require('../middleware/upload');

const { cacheMiddleware } = require('../utils/cache');

// Public routes (Cached in-memory with automatic tag invalidation)
router.get('/', cacheMiddleware(180, ['phones']), PhoneController.list);
router.get('/latest', cacheMiddleware(300, ['phones', 'home']), PhoneController.getLatest);
router.get('/popular', cacheMiddleware(300, ['phones', 'home']), PhoneController.getPopular);
router.get('/upcoming', cacheMiddleware(300, ['phones', 'home']), PhoneController.getUpcoming);
router.get('/slug/:slug', cacheMiddleware(600, ['phones']), PhoneController.getBySlug);
router.get('/:id', cacheMiddleware(600, ['phones']), PhoneController.getById);

// Non-cached: Fire view increment (called from phone detail page after SSR hydration)
router.post('/ping-view/:slug', PhoneController.pingView);

// Protected admin & mobile manager routes
router.post('/fetch-external-specs', requirePhonePermission, PhoneController.fetchExternalSpecs);
router.post('/bulk-import-url', requirePhonePermission, PhoneController.importSingleUrl);
router.post('/', requirePhonePermission, upload.single('image'), PhoneController.create);
router.put('/:id', requirePhonePermission, upload.single('image'), PhoneController.update);
router.post('/bulk-delete', requirePhonePermission, PhoneController.bulkDeletePhones);
router.delete('/:id', requirePhonePermission, PhoneController.deletePhone);

module.exports = router;
