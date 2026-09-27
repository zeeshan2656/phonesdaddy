const express = require('express');
const router = express.Router();
const ReviewController = require('../controllers/reviewController');
const { requireAdminAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// --- Public Endpoints ---
// Upload image for rich comments & reviews
router.post('/upload-image', upload.single('image'), ReviewController.uploadImage);

const { cacheMiddleware } = require('../utils/cache');

// Mobile Phone Reviews & Ratings (Cached with 'reviews' tag)
router.get('/phone/:identifier', cacheMiddleware(60, ['reviews']), ReviewController.getPhoneReviews);
router.post('/phone/:identifier', ReviewController.postPhoneReview);

// Blog & News Comments (Cached with 'reviews' tag)
router.get('/news/:identifier', cacheMiddleware(60, ['reviews']), ReviewController.getNewsComments);
router.post('/news/:identifier', ReviewController.postNewsComment);

// Public Threaded Reply (User-to-User)
router.post('/reply/:parentId', ReviewController.postPublicReply);

// --- Admin Endpoints (Protected) ---
// Both /stats and /admin/stats to support flexible mounting
router.get('/stats', requireAdminAuth, ReviewController.adminStats);
router.get('/admin/stats', requireAdminAuth, ReviewController.adminStats);

router.get('/list', requireAdminAuth, ReviewController.adminList);
router.get('/admin/list', requireAdminAuth, ReviewController.adminList);

// Admin View Specific Review/Comment & its thread
router.get('/:id', requireAdminAuth, ReviewController.adminGetThread);
router.get('/admin/:id', requireAdminAuth, ReviewController.adminGetThread);

// Admin Reply to Review/Comment
router.post('/:id/reply', requireAdminAuth, ReviewController.adminPostReply);
router.post('/admin/:id/reply', requireAdminAuth, ReviewController.adminPostReply);

router.patch('/:id/status', requireAdminAuth, ReviewController.adminUpdateStatus);
router.patch('/admin/:id/status', requireAdminAuth, ReviewController.adminUpdateStatus);
router.put('/:id/status', requireAdminAuth, ReviewController.adminUpdateStatus);
router.put('/admin/:id/status', requireAdminAuth, ReviewController.adminUpdateStatus);

router.delete('/:id', requireAdminAuth, ReviewController.adminDelete);
router.delete('/admin/:id', requireAdminAuth, ReviewController.adminDelete);

module.exports = router;
