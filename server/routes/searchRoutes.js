const express = require('express');
const router = express.Router();
const SearchController = require('../controllers/searchController');

const { cacheMiddleware } = require('../utils/cache');

router.get('/search', cacheMiddleware(120, ['phones']), SearchController.search);

module.exports = router;
