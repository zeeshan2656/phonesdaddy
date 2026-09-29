const express = require('express');
const router = express.Router();
const { calculatePtaTax, getPopularPtaTaxes, PTA_SLABS, USD_EXCHANGE_RATE } = require('../utils/ptaTax');
const { pool } = require('../config/database');

/**
 * GET /api/pta-tax/calculate
 * Calculate tax based on query parameters (name, price, usd)
 */
router.get('/calculate', (req, res) => {
  try {
    const { name, price, usd } = req.query;
    let pricePkr = parseFloat(price) || 0;
    let priceUsd = parseFloat(usd) || 0;

    // Smart detection: if price was passed under 5000 and usd wasn't given, treat price as USD
    if (pricePkr > 0 && pricePkr < 5000 && !priceUsd) {
      priceUsd = pricePkr;
      pricePkr = 0;
    }

    const result = calculatePtaTax({
      name: name || '',
      pricePkr,
      priceUsd
    });

    res.json({ success: true, data: result, tax: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/pta-tax/popular
 * Returns list of popular flagships with estimated taxes
 */
router.get('/popular', (req, res) => {
  try {
    const data = getPopularPtaTaxes();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/pta-tax/slabs
 * Returns official FBR DIRBS tax slabs
 */
router.get('/slabs', (req, res) => {
  res.json({
    success: true,
    data: {
      exchangeRate: USD_EXCHANGE_RATE,
      slabs: PTA_SLABS
    }
  });
});

module.exports = router;
