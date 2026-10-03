const express = require('express');
const router = express.Router();
const PwaController = require('../controllers/pwaController');
const { requireAdminAuth, requireMasterAdmin } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public tracking endpoint (records install & launches from client devices)
router.post('/track', PwaController.trackEvent);

// Public/Admin stats & badge count endpoint
router.get('/stats', PwaController.getStats);
router.get('/config', PwaController.getConfig);

// Admin PWA Management Endpoints
router.post('/config', requireAdminAuth, PwaController.updateConfig);
router.put('/config', requireAdminAuth, PwaController.updateConfig);

// App Icon Management (Upload custom icon or reset to site brand icon)
router.post('/icon', requireAdminAuth, upload.single('pwa_icon'), PwaController.uploadIcon);
router.post('/reset-icon', requireAdminAuth, PwaController.resetIcon);

// Admin testing endpoint
router.post('/simulate-install', requireAdminAuth, PwaController.simulateInstall);

module.exports = router;
