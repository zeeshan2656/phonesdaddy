const express = require('express');
const router = express.Router();
const CompareController = require('../controllers/compareController');

const { cacheMiddleware } = require('../utils/cache');

router.get('/', cacheMiddleware(300, ['phones']), CompareController.compare);

module.exports = router;
