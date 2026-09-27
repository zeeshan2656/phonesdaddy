const { pool } = require('../config/database');

class PhoneModel {
  /**
   * Get list of phones with filters, pagination, and sorting
   */
  static async getPhones({
    page = 1,
    limit = 24,
    brand = null,
    minPrice = null,
    maxPrice = null,
    ram = null,
    storage = null,
    is5G = null,
    sort = 'newest',
    featured = null,
    popular = null,
    status = null,
    search = null,
    skipCount = false
  } = {}) {
    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const parsedLimit = parseInt(limit, 10);

    const conditions = [];
    const params = [];

    if (brand) {
      if (Array.isArray(brand)) {
        conditions.push(`b.slug IN (${brand.map(() => '?').join(',')})`);
        params.push(...brand);
      } else {
        conditions.push(`(b.slug = ? OR b.id = ?)`);
        params.push(brand, brand);
      }
    }

    if (minPrice !== null && minPrice !== undefined && minPrice !== '') {
      conditions.push(`p.price >= ?`);
      params.push(parseFloat(minPrice));
    }

    if (maxPrice !== null && maxPrice !== undefined && maxPrice !== '') {
      conditions.push(`p.price <= ?`);
      params.push(parseFloat(maxPrice));
    }

    if (featured !== null && featured !== undefined && featured !== '') {
      conditions.push(`p.featured = ?`);
      params.push(featured ? 1 : 0);
    }

    if (popular !== null && popular !== undefined && popular !== '') {
      conditions.push(`p.popular = ?`);
      params.push(popular ? 1 : 0);
    }

    if (status) {
      conditions.push(`p.status = ?`);
      params.push(status);
    }

    if (search) {
      conditions.push(`(p.name LIKE ? OR b.name LIKE ? OR p.short_description LIKE ?)`);
      const searchWild = `%${search}%`;
      params.push(searchWild, searchWild, searchWild);
    }

    // Filter by RAM using phone_specs
    if (ram) {
      conditions.push(`EXISTS (
        SELECT 1 FROM phone_specs ps 
        WHERE ps.phone_id = p.id AND ps.section = 'Memory' AND ps.spec_key = 'RAM' AND ps.spec_value LIKE ?
      )`);
      params.push(`%${ram}%`);
    }

    // Filter by Storage using phone_specs
    if (storage) {
      conditions.push(`EXISTS (
        SELECT 1 FROM phone_specs ps 
        WHERE ps.phone_id = p.id AND ps.section = 'Memory' AND ps.spec_key = 'Internal Storage' AND ps.spec_value LIKE ?
      )`);
      params.push(`%${storage}%`);
    }

    // Filter by 5G
    if (is5G === 'true' || is5G === true || is5G === 1 || is5G === '1') {
      conditions.push(`EXISTS (
        SELECT 1 FROM phone_specs ps 
        WHERE ps.phone_id = p.id AND ps.section = 'Network' AND (ps.spec_key = '5G' OR ps.spec_key = 'Technology') AND ps.spec_value LIKE '%5G%'
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Sorting
    let orderBy = 'ORDER BY p.id DESC';
    if (sort === 'newest') orderBy = 'ORDER BY p.id DESC';
    else if (sort === 'price_asc') orderBy = 'ORDER BY p.price ASC';
    else if (sort === 'price_desc') orderBy = 'ORDER BY p.price DESC';
    else if (sort === 'popular') orderBy = 'ORDER BY p.popular DESC, p.views DESC';
    else if (sort === 'views') orderBy = 'ORDER BY p.views DESC';
    else if (sort === 'name') orderBy = 'ORDER BY p.name ASC';

    // Queries (Run count and select concurrently via Promise.all)
    const countSql = `
      SELECT COUNT(p.id) as total
      FROM phones p
      JOIN brands b ON p.brand_id = b.id
      ${whereClause}
    `;

    const querySql = `
      SELECT 
        p.id, p.name, p.slug, p.short_description, p.image, p.release_date, 
        p.status, p.price, p.featured, p.popular, p.views, p.created_at,
        b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug,
        (SELECT COUNT(*) FROM reviews_comments ur WHERE ur.entity_type = 'phone' AND ur.entity_id = p.id AND ur.status = 'approved') AS review_count
      FROM phones p
      JOIN brands b ON p.brand_id = b.id
      ${whereClause}
      ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const countPromise = skipCount
      ? Promise.resolve([{ total: 0 }])
      : pool.query(countSql, params).then(([rows]) => rows);

    const queryPromise = pool.query(querySql, [...params, parsedLimit, offset]).then(([rows]) => rows);

    const [countRows, phoneRows] = await Promise.all([countPromise, queryPromise]);
    const total = skipCount ? phoneRows.length : (countRows[0] ? countRows[0].total : 0);

    // Fetch quick specs for each phone (Display, Camera, Battery, RAM, Chipset)
    if (phoneRows.length > 0) {
      const phoneIds = phoneRows.map(p => p.id);
      const [specRows] = await pool.query(`
        SELECT phone_id, section, spec_key, spec_value
        FROM phone_specs
        WHERE phone_id IN (${phoneIds.map(() => '?').join(',')})
          AND (
            (section = 'Display' AND spec_key IN ('Size', 'Technology', 'Extra Features', 'Type')) OR
            (section = 'Main Camera' AND spec_key IN ('Main', 'Main sensor', 'Camera configuration', 'Features')) OR
            (section = 'Platform' AND spec_key IN ('Chipset', 'CPU')) OR
            (section = 'Battery' AND spec_key IN ('Capacity', 'Type')) OR
            (section = 'Memory' AND spec_key IN ('RAM', 'Built-in', 'Internal Storage', 'Internal'))
          )
      `, phoneIds);

      // Map quick specs onto each phone
      const specsMap = {};
      for (const row of specRows) {
        if (!specsMap[row.phone_id]) specsMap[row.phone_id] = {};
        const sm = specsMap[row.phone_id];

        if (row.section === 'Display') {
          if (row.spec_key === 'Size' && !sm.display) {
            sm.display = row.spec_value.split(',')[0].trim();
          } else if (row.spec_key === 'Extra Features' || row.spec_key === 'Technology') {
            if (/120Hz/i.test(row.spec_value) && sm.display && !sm.display.includes('120Hz')) {
              sm.display += ' • 120Hz';
            } else if (/AMOLED|OLED/i.test(row.spec_value) && sm.display && !sm.display.includes('AMOLED') && !sm.display.includes('OLED')) {
              sm.display += ' AMOLED';
            }
          }
        } else if (row.section === 'Main Camera') {
          if (!sm.camera && (row.spec_key === 'Main' || row.spec_key === 'Main sensor' || row.spec_key === 'Camera configuration')) {
            const mpMatch = row.spec_value.match(/(\d+\s*MP)/i);
            const isDual = /dual/i.test(row.spec_value);
            const isTriple = /triple/i.test(row.spec_value);
            const isQuad = /quad/i.test(row.spec_value);
            const config = isQuad ? 'Quad' : isTriple ? 'Triple' : isDual ? 'Dual' : '';
            if (mpMatch) {
              sm.camera = config ? `${mpMatch[1]} ${config} Camera` : `${mpMatch[1]} Camera`;
            } else {
              sm.camera = row.spec_value.split(',')[0].trim();
            }
          }
        } else if (row.section === 'Platform') {
          if (!sm.chipset && row.spec_key === 'Chipset') {
            let chip = row.spec_value.replace(/\([^)]*\)/g, '').trim();
            chip = chip.replace(/^Qualcomm\s+[A-Z0-9-]+\s+/i, '');
            sm.chipset = chip.split(',')[0].trim();
          }
        } else if (row.section === 'Battery') {
          if (!sm.battery && (row.spec_key === 'Capacity' || row.spec_key === 'Type')) {
            const batMatch = row.spec_value.match(/\d+[\s,]*\d*\s*mAh/i);
            sm.battery = batMatch ? batMatch[0].replace(/\s+/g, ' ') + ' Battery' : row.spec_value.trim();
          }
        } else if (row.section === 'Memory') {
          if (!sm.ram) {
            const ramMatch = row.spec_value.match(/(\d+(?:\/\d+)?\s*GB)\s*RAM/i);
            if (ramMatch) {
              sm.ram = ramMatch[1] + ' RAM';
            } else {
              const gbMatch = row.spec_value.match(/\b(\d+GB)\b/i);
              if (gbMatch) sm.ram = gbMatch[1] + ' RAM';
            }
          }
        }
      }

      for (const phone of phoneRows) {
        phone.quick_specs = specsMap[phone.id] || {};
      }
    }

    return {
      phones: phoneRows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit)
      }
    };
  }

  /**
   * Get complete phone details by slug
   */
  static async getPhoneBySlug(slug) {
    const [rows] = await pool.query(`
      SELECT 
        p.*,
        b.name AS brand_name,
        b.slug AS brand_slug,
        b.logo AS brand_logo,
        (SELECT COUNT(*) FROM reviews_comments ur WHERE ur.entity_type = 'phone' AND ur.entity_id = p.id AND ur.status = 'approved') AS review_count
      FROM phones p
      JOIN brands b ON p.brand_id = b.id
      WHERE p.slug = ?
    `, [slug]);

    if (rows.length === 0) return null;
    const phone = rows[0];

    // Concurrently fetch specs, prices, related devices, popular devices, and news
    const brandName = phone.brand_name || '';
    const phoneName = phone.name || '';

    const specsPromise = pool.query(`
      SELECT section, spec_key, spec_value, sort_order
      FROM phone_specs
      WHERE phone_id = ?
      ORDER BY section, sort_order ASC, id ASC
    `, [phone.id]).then(([specRows]) => {
      const specsBySection = {};
      for (const spec of specRows) {
        if (!specsBySection[spec.section]) {
          specsBySection[spec.section] = [];
        }
        specsBySection[spec.section].push({
          key: spec.spec_key,
          value: spec.spec_value
        });
      }
      return specsBySection;
    }).catch(() => ({}));

    const pricesPromise = pool.query(`
      SELECT country, currency, amount
      FROM phone_prices
      WHERE phone_id = ?
      ORDER BY id ASC
    `, [phone.id]).then(([priceRows]) => priceRows).catch(() => []);

    const relatedPromise = pool.query(`
      SELECT id, name, slug, image, price, release_date, status
      FROM phones
      WHERE brand_id = ? AND id != ?
      ORDER BY id DESC
      LIMIT 6
    `, [phone.brand_id, phone.id]).then(([relatedRows]) => relatedRows).catch(() => []);

    const popularPromise = pool.query(`
      SELECT id, name, slug, image, price, release_date, status
      FROM phones
      WHERE brand_id = ? AND id != ?
      ORDER BY popular DESC, views DESC, id DESC
      LIMIT 6
    `, [phone.brand_id, phone.id]).then(([popRows]) => popRows).catch(() => []);

    const newsPromise = pool.query(`
      SELECT id, title, slug, image, created_at
      FROM news
      WHERE status = 'published'
        AND (title LIKE ? OR title LIKE ? OR summary LIKE ?)
      ORDER BY created_at DESC
      LIMIT 4
    `, [`%${phoneName}%`, `%${brandName}%`, `%${brandName}%`]).then(([newsRows]) => newsRows).catch(() => []);

    const [specs, prices, related_phones, popular_brand_phones, related_news] = await Promise.all([
      specsPromise,
      pricesPromise,
      relatedPromise,
      popularPromise,
      newsPromise
    ]);

    phone.specs = specs;
    phone.prices = prices;
    phone.related_phones = related_phones;
    phone.popular_brand_phones = popular_brand_phones;
    phone.related_news = related_news;

    // Parse images JSON
    if (phone.images) {
      try {
        phone.images = typeof phone.images === 'string' ? JSON.parse(phone.images) : phone.images;
      } catch (_) {
        phone.images = String(phone.images).split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      phone.images = phone.image ? [phone.image] : [];
    }

    // Parse affiliate_links JSON
    if (phone.affiliate_links) {
      try {
        phone.affiliate_links = typeof phone.affiliate_links === 'string' ? JSON.parse(phone.affiliate_links) : phone.affiliate_links;
      } catch (_) {
        phone.affiliate_links = [];
      }
    } else {
      phone.affiliate_links = [];
    }

    return phone;
  }

  /**
   * Get phone by ID (for admin editing)
   */
  static async getPhoneById(id) {
    const [rows] = await pool.query(`
      SELECT p.*, b.name as brand_name, b.slug as brand_slug,
        (SELECT COUNT(*) FROM reviews_comments ur WHERE ur.entity_type = 'phone' AND ur.entity_id = p.id AND ur.status = 'approved') AS review_count
      FROM phones p
      JOIN brands b ON p.brand_id = b.id
      WHERE p.id = ?
    `, [id]);

    if (rows.length === 0) return null;
    const phone = rows[0];

    const [specRows] = await pool.query(`
      SELECT section, spec_key, spec_value, sort_order
      FROM phone_specs
      WHERE phone_id = ?
      ORDER BY sort_order ASC, id ASC
    `, [id]);
    phone.raw_specs = specRows;

    const [priceRows] = await pool.query(`
      SELECT country, currency, amount
      FROM phone_prices
      WHERE phone_id = ?
    `, [id]);
    phone.prices = priceRows;

    // Parse images JSON
    if (phone.images) {
      try {
        phone.images = typeof phone.images === 'string' ? JSON.parse(phone.images) : phone.images;
      } catch (_) {
        phone.images = String(phone.images).split(',').map(s => s.trim()).filter(Boolean);
      }
    } else {
      phone.images = phone.image ? [phone.image] : [];
    }

    // Parse affiliate_links JSON
    if (phone.affiliate_links) {
      try {
        phone.affiliate_links = typeof phone.affiliate_links === 'string' ? JSON.parse(phone.affiliate_links) : phone.affiliate_links;
      } catch (_) {
        phone.affiliate_links = [];
      }
    } else {
      phone.affiliate_links = [];
    }

    return phone;
  }

  /**
   * Increment view counter
   */
  static async incrementViews(id) {
    await pool.query(`UPDATE phones SET views = views + 1 WHERE id = ?`, [id]);
  }

  /**
   * Create phone with specs and prices in a single transaction
   */
  static async createPhone(phoneData, specs = [], prices = []) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [res] = await connection.query(`
        INSERT INTO phones (
          brand_id, name, slug, short_description, image, images, affiliate_links, video_url, release_date,
          status, price, featured, popular, views, meta_title, meta_description
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        phoneData.brand_id,
        phoneData.name,
        phoneData.slug,
        phoneData.short_description || '',
        phoneData.image || '',
        phoneData.images ? JSON.stringify(phoneData.images) : null,
        (Array.isArray(phoneData.affiliate_links) && phoneData.affiliate_links.length > 0)
          ? JSON.stringify(phoneData.affiliate_links)
          : (phoneData.affiliate_links && typeof phoneData.affiliate_links === 'string' && phoneData.affiliate_links !== '[]' ? phoneData.affiliate_links : null),
        phoneData.video_url || null,
        phoneData.release_date || '',
        phoneData.status || 'Available',
        phoneData.price || 0,
        phoneData.featured ? 1 : 0,
        phoneData.popular ? 1 : 0,
        0,
        phoneData.meta_title || `${phoneData.name} Price in Pakistan & Specifications | PhonesDaddy`,
        phoneData.meta_description || `${phoneData.name} specifications, price in Pakistan, camera, battery, and details.`
      ]);

      const phoneId = res.insertId;

      // Insert specs
      if (Array.isArray(specs) && specs.length > 0) {
        let order = 1;
        for (const s of specs) {
          if (s.section && s.key && s.value) {
            await connection.query(`
              INSERT INTO phone_specs (phone_id, section, spec_key, spec_value, sort_order)
              VALUES (?, ?, ?, ?, ?)
            `, [phoneId, s.section, s.key, s.value, s.sort_order || order++]);
          }
        }
      }

      // Insert prices
      if (Array.isArray(prices) && prices.length > 0) {
        for (const pr of prices) {
          if (pr.country && pr.amount) {
            await connection.query(`
              INSERT INTO phone_prices (phone_id, country, currency, amount)
              VALUES (?, ?, ?, ?)
            `, [phoneId, pr.country, pr.currency || 'PKR', pr.amount]);
          }
        }
      }

      await connection.commit();
      return phoneId;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Update phone with specs and prices
   */
  static async updatePhone(id, phoneData, specs = [], prices = []) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      let updateFields = [
        'brand_id = ?', 'name = ?', 'slug = ?', 'short_description = ?',
        'release_date = ?', 'status = ?', 'price = ?', 'featured = ?',
        'popular = ?', 'meta_title = ?', 'meta_description = ?'
      ];
      let updateValues = [
        phoneData.brand_id,
        phoneData.name,
        phoneData.slug,
        phoneData.short_description || '',
        phoneData.release_date || '',
        phoneData.status || 'Available',
        phoneData.price || 0,
        phoneData.featured ? 1 : 0,
        phoneData.popular ? 1 : 0,
        phoneData.meta_title || `${phoneData.name} Price in Pakistan & Specifications | PhonesDaddy`,
        phoneData.meta_description || `${phoneData.name} specifications, price in Pakistan, camera, battery, and details.`
      ];

      if (phoneData.affiliate_links !== undefined) {
        updateFields.push('affiliate_links = ?');
        const affVal = (Array.isArray(phoneData.affiliate_links) && phoneData.affiliate_links.length > 0)
          ? JSON.stringify(phoneData.affiliate_links)
          : (phoneData.affiliate_links && typeof phoneData.affiliate_links === 'string' && phoneData.affiliate_links !== '[]' ? phoneData.affiliate_links : null);
        updateValues.push(affVal);
      }

      if (phoneData.video_url !== undefined) {
        updateFields.push('video_url = ?');
        updateValues.push(phoneData.video_url || null);
      }

      if (phoneData.image) {
        updateFields.push('image = ?');
        updateValues.push(phoneData.image);
      }

      // Always update images gallery if provided
      if (phoneData.images !== undefined) {
        updateFields.push('images = ?');
        updateValues.push(Array.isArray(phoneData.images) ? JSON.stringify(phoneData.images) : phoneData.images);
      }

      updateValues.push(id);

      await connection.query(`
        UPDATE phones
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `, updateValues);

      // If specs provided, overwrite existing
      if (Array.isArray(specs) && specs.length > 0) {
        await connection.query(`DELETE FROM phone_specs WHERE phone_id = ?`, [id]);
        let order = 1;
        for (const s of specs) {
          if (s.section && s.key && s.value) {
            await connection.query(`
              INSERT INTO phone_specs (phone_id, section, spec_key, spec_value, sort_order)
              VALUES (?, ?, ?, ?, ?)
            `, [id, s.section, s.key, s.value, s.sort_order || order++]);
          }
        }
      }

      // If prices provided, overwrite existing
      if (Array.isArray(prices) && prices.length > 0) {
        await connection.query(`DELETE FROM phone_prices WHERE phone_id = ?`, [id]);
        for (const pr of prices) {
          if (pr.country && pr.amount) {
            await connection.query(`
              INSERT INTO phone_prices (phone_id, country, currency, amount)
              VALUES (?, ?, ?, ?)
            `, [id, pr.country, pr.currency || 'PKR', pr.amount]);
          }
        }
      }

      await connection.commit();
      return true;
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  /**
   * Get image and gallery URLs for phone IDs
   */
  static async getImagesByPhoneIds(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return [];
    const [rows] = await pool.query(`SELECT id, image, images FROM phones WHERE id IN (?)`, [ids]);
    return rows;
  }

  /**
   * Delete phone
   */
  static async deletePhone(id) {
    const [res] = await pool.query(`DELETE FROM phones WHERE id = ?`, [id]);
    return res.affectedRows > 0;
  }

  /**
   * Delete multiple phones in bulk
   */
  static async deletePhones(ids) {
    if (!Array.isArray(ids) || ids.length === 0) return 0;
    const [res] = await pool.query(`DELETE FROM phones WHERE id IN (?)`, [ids]);
    return res.affectedRows;
  }

  /**
   * Fast global search for auto-complete dropdown
   */
  static async searchPhones(query, limit = 8) {
    const searchTerm = `%${query.trim()}%`;
    const [rows] = await pool.query(`
      SELECT 
        p.id, p.name, p.slug, p.image, p.price, p.status, p.release_date,
        b.name AS brand_name, b.slug AS brand_slug
      FROM phones p
      JOIN brands b ON p.brand_id = b.id
      WHERE p.name LIKE ? OR b.name LIKE ? OR p.short_description LIKE ?
      ORDER BY p.popular DESC, p.views DESC, p.id DESC
      LIMIT ?
    `, [searchTerm, searchTerm, searchTerm, parseInt(limit, 10)]);

    return rows;
  }

  /**
   * Multi-phone comparison data
   */
  static async getPhonesForCompare(slugs = []) {
    if (!Array.isArray(slugs) || slugs.length === 0) return [];

    const cleanSlugs = slugs.map(s => s.trim()).filter(Boolean).slice(0, 4);
    if (cleanSlugs.length === 0) return [];

    const [phones] = await pool.query(`
      SELECT 
        p.id, p.name, p.slug, p.image, p.release_date, p.status, p.price,
        b.name AS brand_name, b.slug AS brand_slug
      FROM phones p
      JOIN brands b ON p.brand_id = b.id
      WHERE p.slug IN (${cleanSlugs.map(() => '?').join(',')})
    `, cleanSlugs);

    // Keep order according to requested slugs
    const phoneMap = {};
    for (const ph of phones) {
      phoneMap[ph.slug] = ph;
    }

    const orderedPhones = [];
    for (const s of cleanSlugs) {
      if (phoneMap[s]) orderedPhones.push(phoneMap[s]);
    }

    if (orderedPhones.length === 0) return [];

    const phoneIds = orderedPhones.map(p => p.id);
    const [specs] = await pool.query(`
      SELECT phone_id, section, spec_key, spec_value
      FROM phone_specs
      WHERE phone_id IN (${phoneIds.map(() => '?').join(',')})
      ORDER BY sort_order ASC, id ASC
    `, phoneIds);

    const specsByPhone = {};
    for (const s of specs) {
      if (!specsByPhone[s.phone_id]) specsByPhone[s.phone_id] = {};
      if (!specsByPhone[s.phone_id][s.section]) specsByPhone[s.phone_id][s.section] = {};
      specsByPhone[s.phone_id][s.section][s.spec_key] = s.spec_value;
    }

    for (const p of orderedPhones) {
      p.specs = specsByPhone[p.id] || {};
    }

    return orderedPhones;
  }
}

module.exports = PhoneModel;
