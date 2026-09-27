const PhoneModel = require('../models/phoneModel');
const pool = require('../config/database');

class CompareController {
  static async compare(req, res, next) {
    try {
      const phonesParam = req.query.phones || '';
      let slugs = [];

      if (phonesParam) {
        slugs = phonesParam
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
      }

      // Deduplicate slugs, max 4
      slugs = [...new Set(slugs)].slice(0, 4);

      let phones = [];
      if (slugs.length > 0) {
        phones = await PhoneModel.getPhonesForCompare(slugs);
      }

      // If no valid phones found or no slugs provided, fallback to top catalog phones
      if (!phones || phones.length === 0) {
        const [defaultPhones] = await pool.query(`
          SELECT slug FROM phones 
          WHERE slug NOT LIKE '%.%' AND image IS NOT NULL 
          ORDER BY popular DESC, views DESC, id DESC 
          LIMIT 2
        `);
        if (defaultPhones.length > 0) {
          const fallbackSlugs = defaultPhones.map(p => p.slug);
          phones = await PhoneModel.getPhonesForCompare(fallbackSlugs);
        }
      }

      return res.json({
        success: true,
        data: phones || [],
        requestedSlugs: slugs
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CompareController;

