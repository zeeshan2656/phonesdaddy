const PhoneModel = require('../models/phoneModel');
const BrandModel = require('../models/brandModel');
const { scrapePhoneFromUrl } = require('../utils/phoneScraper');
const { cache } = require('../utils/cache');
const { optimizePhoneImage, deleteMediaFiles } = require('../utils/imageOptimizer');

function extractUrls(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const regex = /https?:\/\/(?:www\.)?(?:whatmobile\.com\.pk|gsmarena\.com)[^\s"',;)<>]+/gi;
  const matches = rawText.match(regex) || [];
  const valid = [];
  const seen = new Set();
  for (let raw of matches) {
    let clean = raw.trim().replace(/^[("'\s<\[{]+|[)"'\s>,.\]}]+$/g, '');
    if (!clean) continue;
    try {
      const u = new URL(clean);
      const host = u.hostname.toLowerCase();
      if ((host.includes('whatmobile.com.pk') || host.includes('gsmarena.com')) && !seen.has(clean)) {
        seen.add(clean);
        valid.push(clean);
      }
    } catch (_) {}
  }
  return valid;
}

class PhoneController {
  static async list(req, res, next) {
    try {
      const {
        page = 1,
        limit = 24,
        brand,
        minPrice,
        maxPrice,
        ram,
        storage,
        is5G,
        sort = 'newest',
        status,
        search,
        featured,
        popular
      } = req.query;

      const result = await PhoneModel.getPhones({
        page,
        limit,
        brand,
        minPrice,
        maxPrice,
        ram,
        storage,
        is5G,
        sort,
        status: status || null,
        search: search || null,
        featured: featured !== undefined && featured !== '' ? featured === 'true' || featured === '1' : null,
        popular: popular !== undefined && popular !== '' ? popular === 'true' || popular === '1' : null
      });

      return res.json({
        success: true,
        data: result.phones,
        pagination: result.pagination
      });
    } catch (err) {
      next(err);
    }
  }

  static async getLatest(req, res, next) {
    try {
      const limit = req.query.limit || 8;
      const result = await PhoneModel.getPhones({ page: 1, limit, sort: 'newest', skipCount: true });
      return res.json({ success: true, data: result.phones });
    } catch (err) {
      next(err);
    }
  }

  static async getPopular(req, res, next) {
    try {
      const limit = req.query.limit || 8;
      const result = await PhoneModel.getPhones({ page: 1, limit, sort: 'popular', skipCount: true });
      return res.json({ success: true, data: result.phones });
    } catch (err) {
      next(err);
    }
  }

  static async getUpcoming(req, res, next) {
    try {
      const limit = req.query.limit || 8;
      const result = await PhoneModel.getPhones({ page: 1, limit, status: 'Upcoming', skipCount: true });
      return res.json({ success: true, data: result.phones });
    } catch (err) {
      next(err);
    }
  }

  static async getBySlug(req, res, next) {
    try {
      const { slug } = req.params;
      const phone = await PhoneModel.getPhoneBySlug(slug);

      if (!phone) {
        return res.status(404).json({ success: false, message: 'Phone not found' });
      }

      // Asynchronously increment view count without blocking response
      PhoneModel.incrementViews(phone.id).catch(console.error);

      return res.json({ success: true, data: phone });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const { id } = req.params;
      const phone = await PhoneModel.getPhoneById(id);

      if (!phone) {
        return res.status(404).json({ success: false, message: 'Phone not found' });
      }

      return res.json({ success: true, data: phone });
    } catch (err) {
      next(err);
    }
  }

  static async create(req, res, next) {
    try {
      const {
        brand_id,
        name,
        slug,
        short_description,
        release_date,
        status,
        price,
        featured,
        popular,
        meta_title,
        meta_description,
        specs,
        prices
      } = req.body;

      if (!brand_id || !name || !slug) {
        return res.status(400).json({ success: false, message: 'Brand, name, and slug are required.' });
      }

      let imagePath = '/images/placeholder.svg';
      if (req.file) {
        try {
          const { url } = await optimizePhoneImage(req.file.path, slug);
          imagePath = url;
        } catch (_) {
          imagePath = `/uploads/phones/${req.file.filename}`;
        }
      } else if (req.body.image && req.body.image.trim()) {
        imagePath = req.body.image.trim();
      }

      // Parse JSON strings if passed via multipart/form-data
      let parsedSpecs = [];
      if (specs) {
        parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : specs;
      }

      let parsedPrices = [];
      if (prices) {
        parsedPrices = typeof prices === 'string' ? JSON.parse(prices) : prices;
      }

      // Parse images array
      let parsedImages;
      const rawImages = req.body.images;
      if (rawImages) {
        try {
          parsedImages = typeof rawImages === 'string' ? JSON.parse(rawImages) : rawImages;
        } catch (_) {
          parsedImages = String(rawImages).split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      // Parse affiliate links
      let parsedAffiliateLinks = [];
      if (req.body.affiliate_links) {
        try {
          parsedAffiliateLinks = typeof req.body.affiliate_links === 'string'
            ? JSON.parse(req.body.affiliate_links)
            : req.body.affiliate_links;
        } catch (_) {
          parsedAffiliateLinks = [];
        }
      }

      const phoneData = {
        brand_id: parseInt(brand_id, 10),
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        short_description: short_description || '',
        image: imagePath,
        images: parsedImages || (imagePath !== '/images/placeholder.svg' ? [imagePath] : undefined),
        affiliate_links: parsedAffiliateLinks,
        video_url: req.body.video_url ? req.body.video_url.trim() : null,
        release_date: release_date || '',
        status: status || 'Available',
        price: parseFloat(price) || 0,
        featured: featured === 'true' || featured === true || featured === 1,
        popular: popular === 'true' || popular === true || popular === 1,
        meta_title,
        meta_description
      };

      const phoneId = await PhoneModel.createPhone(phoneData, parsedSpecs, parsedPrices);

      // Invalidate relevant cache groups
      cache.invalidateTags(['phones', 'home']);

      return res.status(201).json({
        success: true,
        message: 'Phone created successfully',
        data: { id: phoneId, slug: phoneData.slug }
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A phone with this slug already exists.' });
      }
      next(err);
    }
  }

  static async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        brand_id,
        name,
        slug,
        short_description,
        release_date,
        status,
        price,
        featured,
        popular,
        meta_title,
        meta_description,
        specs,
        prices
      } = req.body;

      if (!brand_id || !name || !slug) {
        return res.status(400).json({ success: false, message: 'Brand, name, and slug are required.' });
      }

      const phoneData = {
        brand_id: parseInt(brand_id, 10),
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        short_description: short_description || '',
        release_date: release_date || '',
        status: status || 'Available',
        price: parseFloat(price) || 0,
        featured: featured === 'true' || featured === true || featured === 1,
        popular: popular === 'true' || popular === true || popular === 1,
        meta_title,
        meta_description
      };

      if (req.file) {
        try {
          const { url } = await optimizePhoneImage(req.file.path, slug);
          phoneData.image = url;
        } catch (_) {
          phoneData.image = `/uploads/phones/${req.file.filename}`;
        }
      } else if (req.body.remove_image === 'true' || req.body.remove_image === true) {
        phoneData.image = '/images/placeholder.svg';
      } else if (req.body.image) {
        phoneData.image = req.body.image;
      }

      // Handle images gallery array
      if (req.body.images !== undefined) {
        try {
          phoneData.images = typeof req.body.images === 'string'
            ? JSON.parse(req.body.images)
            : req.body.images;
        } catch (_) {
          phoneData.images = String(req.body.images).split(',').map(s => s.trim()).filter(Boolean);
        }
      }

      if (req.body.affiliate_links !== undefined) {
        try {
          phoneData.affiliate_links = typeof req.body.affiliate_links === 'string'
            ? JSON.parse(req.body.affiliate_links)
            : req.body.affiliate_links;
        } catch (_) {
          phoneData.affiliate_links = [];
        }
      }

      if (req.body.video_url !== undefined) {
        phoneData.video_url = req.body.video_url ? req.body.video_url.trim() : null;
      }

      let parsedSpecs = null;
      if (specs !== undefined) {
        parsedSpecs = typeof specs === 'string' ? JSON.parse(specs) : specs;
      }

      let parsedPrices = null;
      if (prices !== undefined) {
        parsedPrices = typeof prices === 'string' ? JSON.parse(prices) : prices;
      }

      // Clean up old image if user uploaded a new one or requested image removal
      if (req.file || req.body.remove_image === 'true' || req.body.remove_image === true) {
        try {
          const oldPhone = await PhoneModel.getImagesByPhoneIds([id]);
          if (oldPhone.length > 0 && oldPhone[0].image && oldPhone[0].image !== phoneData.image) {
            deleteMediaFiles(oldPhone[0].image);
          }
        } catch (cleanupErr) {
          console.warn('Could not clean up replaced image:', cleanupErr.message);
        }
      }

      await PhoneModel.updatePhone(id, phoneData, parsedSpecs, parsedPrices);

      // Invalidate relevant cache groups
      cache.invalidateTags(['phones', 'home']);

      return res.json({
        success: true,
        message: 'Phone updated successfully'
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ success: false, message: 'A phone with this slug already exists.' });
      }
      next(err);
    }
  }

  static async deletePhone(req, res, next) {
    try {
      const { id } = req.params;
      const phoneId = parseInt(id, 10);
      if (isNaN(phoneId)) {
        return res.status(400).json({ success: false, message: 'Invalid phone ID' });
      }

      // 1. Fetch image and gallery URLs before deleting the record
      const rows = await PhoneModel.getImagesByPhoneIds([phoneId]);

      // 2. Delete phone from database
      const success = await PhoneModel.deletePhone(phoneId);

      if (!success) {
        return res.status(404).json({ success: false, message: 'Phone not found' });
      }

      // 3. Automatically clean up image files and thumbnails from disk
      if (rows && rows.length > 0) {
        const mediaList = [];
        if (rows[0].image) mediaList.push(rows[0].image);
        if (rows[0].images) {
          try {
            const parsed = typeof rows[0].images === 'string' ? JSON.parse(rows[0].images) : rows[0].images;
            if (Array.isArray(parsed)) mediaList.push(...parsed);
          } catch (_) {}
        }
        deleteMediaFiles(mediaList);
      }

      // Invalidate relevant cache groups
      cache.invalidateTags(['phones', 'home']);

      return res.json({ success: true, message: 'Phone and associated images deleted successfully' });
    } catch (err) {
      next(err);
    }
  }

  static async bulkDeletePhones(req, res, next) {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'No phone IDs provided for deletion.' });
      }

      const cleanIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id) && id > 0);
      if (cleanIds.length === 0) {
        return res.status(400).json({ success: false, message: 'No valid phone IDs provided.' });
      }

      // 1. Fetch image and gallery URLs before deleting the records
      const rows = await PhoneModel.getImagesByPhoneIds(cleanIds);

      // 2. Delete phones from database
      const affected = await PhoneModel.deletePhones(cleanIds);

      // 3. Automatically clean up image files and thumbnails from disk
      if (rows && rows.length > 0) {
        const mediaList = [];
        for (const row of rows) {
          if (row.image) mediaList.push(row.image);
          if (row.images) {
            try {
              const parsed = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
              if (Array.isArray(parsed)) mediaList.push(...parsed);
            } catch (_) {}
          }
        }
        deleteMediaFiles(mediaList);
      }

      // Invalidate relevant cache groups
      cache.invalidateTags(['phones', 'home']);

      return res.json({
        success: true,
        message: `Successfully deleted ${affected} phone(s) and associated images.`,
        affected
      });
    } catch (err) {
      next(err);
    }
  }

  static async fetchExternalSpecs(req, res, next) {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, message: 'A valid URL is required.' });
      }

      const multiUrls = extractUrls(url);
      if (multiUrls.length > 1) {
        return res.status(400).json({
          success: false,
          isMultiple: true,
          count: multiUrls.length,
          urls: multiUrls,
          message: `Detected ${multiUrls.length} phone links. Please click "Start Bulk Queue" to import all devices sequentially.`
        });
      }

      const cleanUrl = multiUrls.length === 1 
        ? multiUrls[0] 
        : String(url || '').trim().replace(/^[("'\s<\[{]+|[)"'\s>,.\]}]+$/g, '');
      const scrapedData = await scrapePhoneFromUrl(cleanUrl);

      // Attempt to match brand in the database
      let matchedBrand = null;
      if (scrapedData.brand) {
        const allBrands = await BrandModel.getAllBrands();
        matchedBrand = allBrands.find(b => 
          b.name.toLowerCase() === scrapedData.brand.toLowerCase() ||
          b.slug.toLowerCase() === scrapedData.brand.toLowerCase()
        );
      }

      // Ensure model name contains ONLY the model, not the brand prefix
      let cleanModelName = scrapedData.name || '';
      if (matchedBrand) {
        const bName = matchedBrand.name.toLowerCase();
        if (cleanModelName.toLowerCase().startsWith(bName + ' ')) {
          cleanModelName = cleanModelName.slice(matchedBrand.name.length).trim();
        }
      }
      if (scrapedData.brand) {
        const bName = scrapedData.brand.toLowerCase();
        if (cleanModelName.toLowerCase().startsWith(bName + ' ')) {
          cleanModelName = cleanModelName.slice(scrapedData.brand.length).trim();
        }
      }

      return res.json({
        success: true,
        message: `Successfully fetched phone specifications from ${scrapedData.source === 'gsmarena' ? 'GSMArena' : 'WhatMobile'}!`,
        data: {
          ...scrapedData,
          name: cleanModelName,
          shortSummary: scrapedData.shortSummary || '',
          images: scrapedData.images || (scrapedData.image ? [scrapedData.image] : []),
          brand_id: matchedBrand ? matchedBrand.id : null,
          brand_name: matchedBrand ? matchedBrand.name : scrapedData.brand,
          brand_found: !!matchedBrand
        }
      });
    } catch (err) {
      console.error('fetchExternalSpecs error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to fetch phone specifications from URL.'
      });
    }
  }

  static async importSingleUrl(req, res, next) {
    try {
      const { url, overwrite = false, defaultStatus = 'Available', autoAddBrand = true } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, message: 'A valid URL is required.' });
      }

      const cleanUrl = String(url || '')
        .trim()
        .replace(/^[("'\s<\[{]+|[)"'\s>,.\]}]+$/g, '');
      const scrapedData = await scrapePhoneFromUrl(cleanUrl);

      // Attempt to match brand in the database
      let brandId = null;
      let brandName = scrapedData.brand || 'Other';

      if (scrapedData.brand) {
        const allBrands = await BrandModel.getAllBrands();
        let matched = allBrands.find(b =>
          b.name.toLowerCase() === scrapedData.brand.toLowerCase() ||
          b.slug.toLowerCase() === scrapedData.brand.toLowerCase()
        );

        if (matched) {
          brandId = matched.id;
          brandName = matched.name;
        } else if (autoAddBrand) {
          // Auto-create brand if it doesn't exist
          const bSlug = String(scrapedData.brand)
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');

          const newBrandId = await BrandModel.createBrand({
            name: scrapedData.brand,
            slug: bSlug,
            logo: '',
            description: `${scrapedData.brand} mobile phones and specifications.`,
            status: 'active'
          });
          brandId = newBrandId;
          brandName = scrapedData.brand;
        }
      }

      if (!brandId) {
        return res.status(400).json({
          success: false,
          message: `Brand "${scrapedData.brand}" not found in database and auto-create is disabled.`
        });
      }

      // Ensure model name contains ONLY the model, not the brand prefix
      let cleanModelName = scrapedData.name || '';
      const bLower = brandName.toLowerCase();
      if (cleanModelName.toLowerCase().startsWith(bLower + ' ')) {
        cleanModelName = cleanModelName.slice(brandName.length).trim();
      }

      const slugifyFn = (t) => String(t || '')
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');

      const phoneSlug = scrapedData.slug || slugifyFn(cleanModelName);
      const shortDesc = scrapedData.shortSummary || `${brandName} ${cleanModelName} full specifications, camera, battery, and price details.`;
      const primaryImage = scrapedData.image || (scrapedData.images && scrapedData.images[0]) || '/images/placeholder.svg';
      const imagesArr = (scrapedData.images && scrapedData.images.length > 0)
        ? scrapedData.images
        : (primaryImage !== '/images/placeholder.svg' ? [primaryImage] : []);

      const phoneData = {
        brand_id: brandId,
        name: cleanModelName,
        slug: phoneSlug,
        short_description: shortDesc,
        image: primaryImage,
        images: imagesArr,
        affiliate_links: [],
        video_url: null,
        release_date: scrapedData.releaseDate || '',
        status: defaultStatus || scrapedData.status || 'Available',
        price: scrapedData.price || 0,
        featured: false,
        popular: false,
        meta_title: `${brandName} ${cleanModelName} Price in Pakistan & Specifications`,
        meta_description: `${brandName} ${cleanModelName} price in Pakistan, specifications, camera, battery, and display details.`
      };

      // Check if phone with this slug exists
      const existing = await PhoneModel.getPhoneBySlug(phoneSlug);

      if (existing) {
        if (!overwrite) {
          return res.json({
            success: true,
            action: 'skipped',
            message: `"${brandName} ${cleanModelName}" already exists (skipped)`,
            phone: {
              id: existing.id,
              name: `${brandName} ${cleanModelName}`,
              slug: phoneSlug,
              price: existing.price,
              imagesCount: (existing.images || []).length
            }
          });
        }

        // Overwrite existing phone
        await PhoneModel.updatePhone(existing.id, phoneData, scrapedData.specs, scrapedData.prices);
        cache.invalidateTags(['phones', 'home']);

        return res.json({
          success: true,
          action: 'updated',
          message: `"${brandName} ${cleanModelName}" updated successfully`,
          phone: {
            id: existing.id,
            name: `${brandName} ${cleanModelName}`,
            slug: phoneSlug,
            price: phoneData.price,
            image: primaryImage,
            imagesCount: imagesArr.length
          }
        });
      }

      // Create new phone
      const newPhoneId = await PhoneModel.createPhone(phoneData, scrapedData.specs, scrapedData.prices);
      cache.invalidateTags(['phones', 'home']);

      return res.status(201).json({
        success: true,
        action: 'created',
        message: `"${brandName} ${cleanModelName}" added successfully`,
        phone: {
          id: newPhoneId,
          name: `${brandName} ${cleanModelName}`,
          slug: phoneSlug,
          price: phoneData.price,
          image: primaryImage,
          imagesCount: imagesArr.length
        }
      });
    } catch (err) {
      console.error('importSingleUrl error:', err);
      return res.status(400).json({
        success: false,
        message: err.message || 'Failed to import phone from URL.'
      });
    }
  }
}

module.exports = PhoneController;
