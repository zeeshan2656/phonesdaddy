const BrandModel = require('../models/brandModel');
const { cache } = require('../utils/cache');
const { optimizeBrandLogo } = require('../utils/imageOptimizer');

const BRAND_PALETTE = [
  '#1428a0', // Royal Blue (Samsung)
  '#eb0028', // Crimson Red (OnePlus)
  '#ff6900', // Vibrant Orange (Xiaomi)
  '#415fff', // Indigo (Vivo)
  '#008453', // Emerald (Oppo)
  '#4285f4', // Google Blue
  '#d97706', // Amber Gold (Realme)
  '#0072ce', // Azure Blue (Tecno)
  '#00a850', // Bright Green (Infinix)
  '#cf0a2c', // Ruby Red (Huawei)
  '#7c3aed', // Purple
  '#db2777', // Deep Pink
  '#0d9488', // Teal
  '#0284c7', // Sky Blue
  '#4f46e5', // Electric Indigo
  '#b91c1c', // Ruby
  '#059669', // Mint Green
  '#9333ea', // Deep Violet
  '#111827', // Slate Black (Apple/Sony)
  '#ea580c'  // Tangerine
];

function getBrandColor(name = '') {
  if (!name) return '#1428a0';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BRAND_PALETTE.length;
  return BRAND_PALETTE[index];
}

class BrandController {
  static async list(req, res, next) {
    try {
      const activeOnly = req.query.active === 'true';
      const brands = await BrandModel.getAllBrands(activeOnly);
      return res.json({ success: true, data: brands });
    } catch (err) {
      next(err);
    }
  }

  static async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const brand = await BrandModel.getBrandBySlug(slug);

      if (!brand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }

      return res.json({ success: true, data: brand });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const brand = await BrandModel.getBrandById(id);

      if (!brand) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }

      return res.json({ success: true, data: brand });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const { name, slug, description, status, brand_color, color } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ success: false, message: 'Brand name and slug are required' });
      }

      let logoPath = '';
      if (req.file) {
        try {
          const { url } = await optimizeBrandLogo(req.file.path, slug);
          logoPath = url;
        } catch (_) {
          logoPath = `/uploads/brands/${req.file.filename}`;
        }
      } else if (req.body.logo) {
        logoPath = req.body.logo;
      }

      if (!logoPath) {
        const fs = require('fs');
        const path = require('path');
        const logoFilename = `${slug.trim().toLowerCase()}-logo.svg`;
        const logoDir = path.join(__dirname, '../../public/webfiles/brands');
        if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

        const chosenColor = brand_color || color || getBrandColor(name);
        const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
  <rect width="100%" height="100%" fill="transparent"/>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="${chosenColor}" letter-spacing="1">
    ${name.trim().toUpperCase()}
  </text>
</svg>`;
        fs.writeFileSync(path.join(logoDir, logoFilename), logoSvg);
        logoPath = `/webfiles/brands/${logoFilename}`;
      }

      const brandId = await BrandModel.createBrand({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        logo: logoPath,
        description: description || '',
        status: status || 'active'
      });

      // Invalidate brand and related phone caches
      cache.invalidateTags(['brands', 'phones', 'home']);

      return res.status(201).json({
        success: true,
        message: 'Brand created successfully',
        data: { id: brandId, name, slug }
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A brand with this slug already exists.' });
      }
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const { name, slug, description, status, brand_color, color, remove_logo } = req.body;

      if (!name || !slug) {
        return res.status(400).json({ success: false, message: 'Brand name and slug are required' });
      }

      // If user requested to delete custom image or uploaded a new one, clean up old disk file if present
      if ((remove_logo === 'true' || remove_logo === true || req.file) && id) {
        try {
          const currentBrand = await BrandModel.getBrandById(id);
          if (currentBrand && currentBrand.logo) {
            const fs = require('fs');
            const path = require('path');
            let oldFilePath = null;
            if (currentBrand.logo.startsWith('/uploads/brands/')) {
              oldFilePath = path.join(__dirname, '../../server', currentBrand.logo);
            } else if (currentBrand.logo.startsWith('/webfiles/brands/')) {
              oldFilePath = path.join(__dirname, '../../public', currentBrand.logo);
            }
            if (oldFilePath && fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
          }
        } catch (e) {
          console.error('Error removing old brand logo file:', e);
        }
      }

      let logoPath = req.body.logo;
      if (req.file) {
        try {
          const { url } = await optimizeBrandLogo(req.file.path, slug);
          logoPath = url;
        } catch (_) {
          logoPath = `/uploads/brands/${req.file.filename}`;
        }
      } else if (remove_logo === 'true' || remove_logo === true || !logoPath || logoPath.endsWith('-logo.svg')) {
        const fs = require('fs');
        const path = require('path');
        const logoFilename = `${slug.trim().toLowerCase()}-logo.svg`;
        const logoDir = path.join(__dirname, '../../public/webfiles/brands');
        if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

        const chosenColor = brand_color || color || getBrandColor(name);
        const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 60" width="160" height="60">
  <rect width="100%" height="100%" fill="transparent"/>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="20" font-weight="800" fill="${chosenColor}" letter-spacing="1">
    ${name.trim().toUpperCase()}
  </text>
</svg>`;
        fs.writeFileSync(path.join(logoDir, logoFilename), logoSvg);
        logoPath = `/webfiles/brands/${logoFilename}`;
      }

      const updated = await BrandModel.updateBrand(id, {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        logo: logoPath,
        description: description || '',
        status: status || 'active'
      });

      if (!updated) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }

      // Invalidate brand and related phone caches
      cache.invalidateTags(['brands', 'phones', 'home']);

      return res.json({ success: true, message: 'Brand updated successfully' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A brand with this slug already exists.' });
      }
      next(err);
    }
  }

  static async deleteBrand(req, res, next) {
    try {
      const { id } = req.params;
      const deleted = await BrandModel.deleteBrand(id);

      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Brand not found' });
      }

      // Invalidate brand and related phone caches
      cache.invalidateTags(['brands', 'phones', 'home']);

      return res.json({ success: true, message: 'Brand deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = BrandController;
