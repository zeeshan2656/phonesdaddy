const express = require('express');
const router = express.Router();
const AnnouncementController = require('../controllers/announcementController');
const { requireMasterAdmin } = require('../middleware/auth');

// Public: active announcement only
router.get('/active', AnnouncementController.getActive);

// Admin protected routes
router.get('/admin/list',       requireMasterAdmin, AnnouncementController.list);
router.get('/admin/:id',        requireMasterAdmin, AnnouncementController.getById);
router.post('/admin',           requireMasterAdmin, AnnouncementController.create);
router.put('/admin/:id',        requireMasterAdmin, AnnouncementController.update);
router.patch('/admin/:id/toggle', requireMasterAdmin, AnnouncementController.toggleActive);
router.delete('/admin/:id',     requireMasterAdmin, AnnouncementController.delete);

module.exports = router;
