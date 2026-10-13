const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settingsController');
const { requireMasterAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

const { cacheMiddleware } = require('../utils/cache');

// Public Branding Endpoint (Cached with 'settings' tag)
router.get('/public', cacheMiddleware(3600, ['settings']), SettingsController.getPublicBranding);

// Admin Protected Routes (Master Admin only)
router.get('/', requireMasterAdmin, SettingsController.getSettings);
router.put('/', requireMasterAdmin, SettingsController.updateSettings);
router.post('/', requireMasterAdmin, SettingsController.updateSettings);

// Brand Logo & Favicon Upload Endpoints
router.post('/logo', requireMasterAdmin, upload.single('logo'), upload.optimizeUploadedImages, SettingsController.uploadLogo);
router.delete('/logo', requireMasterAdmin, SettingsController.removeLogo);

router.post('/favicon', requireMasterAdmin, upload.single('favicon'), upload.optimizeUploadedImages, SettingsController.uploadFavicon);
router.delete('/favicon', requireMasterAdmin, SettingsController.removeFavicon);

// Scraper Sources Endpoints
router.get('/scraper-sources', requireMasterAdmin, SettingsController.getScraperSources);
router.get('/scraper-sources/active', SettingsController.getActiveScraperSources);
router.post('/scraper-sources', requireMasterAdmin, SettingsController.saveScraperSource);
router.delete('/scraper-sources/:id', requireMasterAdmin, SettingsController.deleteScraperSource);
router.post('/scraper-sources/test-transform', requireMasterAdmin, SettingsController.testUrlTransform);

module.exports = router;
