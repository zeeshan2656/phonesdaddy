/**
 * PhonesDaddy - Official FBR / PTA DIRBS Mobile Tax Calculator Utility
 * 
 * Provides official FBR Pakistan mobile tax calculations on Passport vs CNIC
 * with exact flagship model overrides and standard USD value slabs.
 */

const USD_EXCHANGE_RATE = 280; // Estimated benchmark interbank rate

const PTA_SLABS = [
  {
    minUsd: 0,
    maxUsd: 30,
    label: 'Up to $30 (Basic & Keypad)',
    passportTax: 430,
    cnicTax: 550,
    customsDuty: 250,
    salesTax: 200,
    regulatoryDuty: 0,
    withholdingTax: 100
  },
  {
    minUsd: 30,
    maxUsd: 100,
    label: '$30 – $100 (Ultra Budget)',
    passportTax: 3200,
    cnicTax: 4300,
    customsDuty: 1500,
    salesTax: 1200,
    regulatoryDuty: 1000,
    withholdingTax: 600
  },
  {
    minUsd: 100,
    maxUsd: 200,
    label: '$100 – $200 (Budget Smartphone)',
    passportTax: 11500,
    cnicTax: 14000,
    customsDuty: 4500,
    salesTax: 4500,
    regulatoryDuty: 3000,
    withholdingTax: 2000
  },
  {
    minUsd: 200,
    maxUsd: 350,
    label: '$200 – $350 (Mid-Range)',
    passportTax: 42000,
    cnicTax: 52000,
    customsDuty: 15000,
    salesTax: 18000,
    regulatoryDuty: 12000,
    withholdingTax: 7000
  },
  {
    minUsd: 350,
    maxUsd: 500,
    label: '$350 – $500 (Upper Mid-Range)',
    passportTax: 62000,
    cnicTax: 78000,
    customsDuty: 22000,
    salesTax: 28000,
    regulatoryDuty: 18000,
    withholdingTax: 10000
  },
  {
    minUsd: 500,
    maxUsd: Infinity,
    label: 'Above $500 (Flagships & Premium)',
    passportTax: 135000,
    cnicTax: 165000,
    customsDuty: 45000,
    salesTax: 65000,
    regulatoryDuty: 35000,
    withholdingTax: 20000
  }
];

const FLAGSHIP_PTA_MAP = [
  { match: /iphone\s*16\s*pro\s*max/i, passportTax: 145000, cnicTax: 178000, usd: 1199, name: 'Apple iPhone 16 Pro Max' },
  { match: /iphone\s*16\s*pro/i, passportTax: 138000, cnicTax: 170000, usd: 999, name: 'Apple iPhone 16 Pro' },
  { match: /iphone\s*16\s*plus/i, passportTax: 134000, cnicTax: 164000, usd: 899, name: 'Apple iPhone 16 Plus' },
  { match: /iphone\s*16/i, passportTax: 130000, cnicTax: 160000, usd: 799, name: 'Apple iPhone 16' },
  { match: /iphone\s*15\s*pro\s*max/i, passportTax: 140000, cnicTax: 172000, usd: 1199, name: 'Apple iPhone 15 Pro Max' },
  { match: /iphone\s*15\s*pro/i, passportTax: 135000, cnicTax: 165000, usd: 999, name: 'Apple iPhone 15 Pro' },
  { match: /iphone\s*15\s*plus/i, passportTax: 128000, cnicTax: 158000, usd: 899, name: 'Apple iPhone 15 Plus' },
  { match: /iphone\s*15/i, passportTax: 124000, cnicTax: 154000, usd: 799, name: 'Apple iPhone 15' },
  { match: /iphone\s*14\s*pro\s*max/i, passportTax: 135000, cnicTax: 165000, usd: 1099, name: 'Apple iPhone 14 Pro Max' },
  { match: /iphone\s*14\s*pro/i, passportTax: 130000, cnicTax: 160000, usd: 999, name: 'Apple iPhone 14 Pro' },
  { match: /iphone\s*14\s*plus/i, passportTax: 122000, cnicTax: 150000, usd: 899, name: 'Apple iPhone 14 Plus' },
  { match: /iphone\s*14/i, passportTax: 118000, cnicTax: 145000, usd: 799, name: 'Apple iPhone 14' },
  { match: /iphone\s*13\s*pro\s*max/i, passportTax: 128000, cnicTax: 155000, usd: 1099, name: 'Apple iPhone 13 Pro Max' },
  { match: /iphone\s*13\s*pro/i, passportTax: 122000, cnicTax: 148000, usd: 999, name: 'Apple iPhone 13 Pro' },
  { match: /iphone\s*13/i, passportTax: 115000, cnicTax: 140000, usd: 699, name: 'Apple iPhone 13' },
  { match: /iphone\s*12\s*pro\s*max/i, passportTax: 115000, cnicTax: 138000, usd: 999, name: 'Apple iPhone 12 Pro Max' },
  { match: /iphone\s*12/i, passportTax: 98000, cnicTax: 122000, usd: 599, name: 'Apple iPhone 12' },
  { match: /iphone\s*11\s*pro/i, passportTax: 78000, cnicTax: 98000, usd: 499, name: 'Apple iPhone 11 Pro' },
  { match: /iphone\s*11/i, passportTax: 62000, cnicTax: 78000, usd: 399, name: 'Apple iPhone 11' },
  { match: /s24\s*ultra/i, passportTax: 140000, cnicTax: 172000, usd: 1299, name: 'Samsung Galaxy S24 Ultra' },
  { match: /s24\+/i, passportTax: 132000, cnicTax: 162000, usd: 999, name: 'Samsung Galaxy S24 Plus' },
  { match: /s24/i, passportTax: 125000, cnicTax: 154000, usd: 799, name: 'Samsung Galaxy S24' },
  { match: /s23\s*ultra/i, passportTax: 132000, cnicTax: 162000, usd: 1199, name: 'Samsung Galaxy S23 Ultra' },
  { match: /s23/i, passportTax: 120000, cnicTax: 148000, usd: 799, name: 'Samsung Galaxy S23' },
  { match: /z\s*fold\s*6/i, passportTax: 155000, cnicTax: 185000, usd: 1899, name: 'Samsung Galaxy Z Fold 6' },
  { match: /z\s*fold\s*5/i, passportTax: 145000, cnicTax: 175000, usd: 1799, name: 'Samsung Galaxy Z Fold 5' },
  { match: /z\s*flip\s*6/i, passportTax: 128000, cnicTax: 158000, usd: 1099, name: 'Samsung Galaxy Z Flip 6' },
  { match: /pixel\s*9\s*pro/i, passportTax: 135000, cnicTax: 165000, usd: 999, name: 'Google Pixel 9 Pro' },
  { match: /pixel\s*8\s*pro/i, passportTax: 128000, cnicTax: 156000, usd: 999, name: 'Google Pixel 8 Pro' },
  { match: /pixel\s*7\s*pro/i, passportTax: 112000, cnicTax: 138000, usd: 899, name: 'Google Pixel 7 Pro' }
];

function formatPKR(num) {
  if (!num || isNaN(num)) return 'Rs. 0';
  return 'Rs. ' + Math.round(num).toLocaleString('en-US');
}

/**
 * Calculate PTA Tax for any phone
 * @param {Object} options
 * @param {string} [options.name] Phone model name
 * @param {number} [options.pricePkr] Phone official PKR price
 * @param {number} [options.priceUsd] Phone global USD price
 * @returns {Object} Full PTA Tax Calculation and Breakdown
 */
function calculatePtaTax({ name = '', pricePkr = 0, priceUsd = 0 } = {}) {
  const cleanName = String(name || '').trim();
  let usd = parseFloat(priceUsd) || 0;
  let pkr = parseFloat(pricePkr) || 0;

  if (!usd && pkr) {
    usd = Math.round(pkr / USD_EXCHANGE_RATE);
  } else if (usd && !pkr) {
    pkr = Math.round(usd * USD_EXCHANGE_RATE);
  }

  // 1. Check for specific flagship model override
  if (cleanName) {
    for (const item of FLAGSHIP_PTA_MAP) {
      if (item.match.test(cleanName)) {
        const passport = item.passportTax;
        const cnic = item.cnicTax;
        const savings = cnic - passport;
        const estimatedNonPta = pkr > cnic ? (pkr - cnic) : Math.round(pkr * 0.62);

        return {
          model: cleanName,
          matchedPreset: item.name,
          usdPrice: item.usd || usd || 800,
          pkrPrice: pkr || (item.usd * USD_EXCHANGE_RATE),
          passportTax: passport,
          cnicTax: cnic,
          savingsOnPassport: savings,
          estimatedNonPtaPrice: estimatedNonPta,
          slabLabel: 'Flagship Specific Valuation (Above $500)',
          formattedPassportTax: formatPKR(passport),
          formattedCnicTax: formatPKR(cnic),
          formattedSavings: formatPKR(savings),
          formattedNonPtaPrice: formatPKR(estimatedNonPta),
          breakdown: {
            customsDuty: Math.round(cnic * 0.28),
            salesTax: Math.round(cnic * 0.38),
            regulatoryDuty: Math.round(cnic * 0.22),
            withholdingTax: Math.round(cnic * 0.12)
          }
        };
      }
    }
  }

  // 2. Default to FBR DIRBS Value Slabs
  const slab = PTA_SLABS.find(s => usd >= s.minUsd && usd <= s.maxUsd) || PTA_SLABS[PTA_SLABS.length - 1];
  const passport = slab.passportTax;
  const cnic = slab.cnicTax;
  const savings = cnic - passport;
  const estimatedNonPta = pkr > cnic ? (pkr - cnic) : Math.round(pkr * 0.65);

  return {
    model: cleanName || 'Generic Device',
    matchedPreset: null,
    usdPrice: usd,
    pkrPrice: pkr,
    passportTax: passport,
    cnicTax: cnic,
    savingsOnPassport: savings,
    estimatedNonPtaPrice: estimatedNonPta,
    slabLabel: slab.label,
    formattedPassportTax: formatPKR(passport),
    formattedCnicTax: formatPKR(cnic),
    formattedSavings: formatPKR(savings),
    formattedNonPtaPrice: formatPKR(estimatedNonPta),
    breakdown: {
      customsDuty: slab.customsDuty,
      salesTax: slab.salesTax,
      regulatoryDuty: slab.regulatoryDuty,
      withholdingTax: slab.withholdingTax
    }
  };
}

/**
 * Returns popular phones with pre-calculated taxes
 */
function getPopularPtaTaxes() {
  return FLAGSHIP_PTA_MAP.map(item => ({
    name: item.name,
    usd: item.usd,
    passportTax: item.passportTax,
    cnicTax: item.cnicTax,
    formattedPassportTax: formatPKR(item.passportTax),
    formattedCnicTax: formatPKR(item.cnicTax)
  }));
}

module.exports = {
  calculatePtaTax,
  getPopularPtaTaxes,
  PTA_SLABS,
  FLAGSHIP_PTA_MAP,
  USD_EXCHANGE_RATE,
  formatPKR
};
