const fs = require('fs');
const path = require('path');
const { pool } = require('../server/config/database');
const { optimizePhoneImage, optimizeBrandLogo, DIRS } = require('../server/utils/imageOptimizer');

async function migrate() {
  console.log('🚀 Starting Image Migration to WebP & /webfiles/...');
  let convertedPhones = 0;
  let convertedBrands = 0;
  let totalBytesSaved = 0;

  // 1. Process Phones
  const [phones] = await pool.query('SELECT id, name, slug, image, images FROM phones');
  console.log(`Found ${phones.length} phones in database.`);

  for (const phone of phones) {
    let updatedImage = phone.image;
    let updatedImages = null;
    let galleryList = [];

    if (phone.images) {
      try {
        galleryList = typeof phone.images === 'string' ? JSON.parse(phone.images) : phone.images;
      } catch (_) {
        galleryList = String(phone.images).split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Process main phone image
    if (phone.image && !phone.image.startsWith('http') && !phone.image.includes('/webfiles/')) {
      // Resolve path
      let localPath = null;
      if (phone.image.startsWith('/uploads/')) {
        localPath = path.join(__dirname, '../server', phone.image);
      } else if (phone.image.startsWith('/images/')) {
        localPath = path.join(__dirname, '../public', phone.image);
      }

      if (localPath && fs.existsSync(localPath)) {
        try {
          const originalSize = fs.statSync(localPath).size;
          const { url, thumbUrl } = await optimizePhoneImage(localPath, phone.slug);
          const fullPath = path.join(__dirname, '../public', url);
          const newSize = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
          
          totalBytesSaved += Math.max(0, originalSize - newSize);
          updatedImage = url;
          convertedPhones++;
          console.log(`✅ [Phone ${phone.id}] ${phone.name}: ${phone.image} -> ${url} (${(originalSize/1024).toFixed(1)}KB -> ${(newSize/1024).toFixed(1)}KB)`);
        } catch (imgErr) {
          console.warn(`⚠️ Could not convert phone image ${phone.image}:`, imgErr.message);
        }
      }
    }

    // Process gallery images if present
    if (Array.isArray(galleryList) && galleryList.length > 0) {
      const newGallery = [];
      let galleryChanged = false;

      for (let i = 0; i < galleryList.length; i++) {
        const gImg = galleryList[i];
        if (gImg && !gImg.startsWith('http') && !gImg.includes('/webfiles/')) {
          let gPath = null;
          if (gImg.startsWith('/uploads/')) {
            gPath = path.join(__dirname, '../server', gImg);
          } else if (gImg.startsWith('/images/')) {
            gPath = path.join(__dirname, '../public', gImg);
          }

          if (gPath && fs.existsSync(gPath)) {
            try {
              const originalSize = fs.statSync(gPath).size;
              const { url } = await optimizePhoneImage(gPath, `${phone.slug}-gal-${i}`);
              const fullPath = path.join(__dirname, '../public', url);
              const newSize = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
              totalBytesSaved += Math.max(0, originalSize - newSize);
              newGallery.push(url);
              galleryChanged = true;
            } catch (_) {
              newGallery.push(gImg);
            }
          } else {
            newGallery.push(gImg);
          }
        } else {
          newGallery.push(gImg);
        }
      }

      if (galleryChanged) {
        updatedImages = JSON.stringify(newGallery);
      }
    }

    // Update DB record if image paths changed
    if (updatedImage !== phone.image || updatedImages !== null) {
      if (updatedImages !== null) {
        await pool.query('UPDATE phones SET image = ?, images = ? WHERE id = ?', [updatedImage, updatedImages, phone.id]);
      } else {
        await pool.query('UPDATE phones SET image = ? WHERE id = ?', [updatedImage, phone.id]);
      }
    }
  }

  // 2. Process Brands
  const [brands] = await pool.query('SELECT id, name, slug, logo FROM brands');
  console.log(`Found ${brands.length} brands in database.`);

  for (const brand of brands) {
    if (brand.logo && !brand.logo.startsWith('http') && !brand.logo.includes('/webfiles/')) {
      let localPath = null;
      if (brand.logo.startsWith('/uploads/')) {
        localPath = path.join(__dirname, '../server', brand.logo);
      } else if (brand.logo.startsWith('/images/')) {
        localPath = path.join(__dirname, '../public', brand.logo);
      }

      if (localPath && fs.existsSync(localPath)) {
        try {
          const ext = path.extname(localPath).toLowerCase();
          if (ext === '.svg') {
            // Copy SVG directly to /webfiles/brands/ for crisp vector rendering + create WebP
            const destSvgName = `${brand.slug}-logo.svg`;
            fs.copyFileSync(localPath, path.join(DIRS.brands, destSvgName));
            const newLogoUrl = `/webfiles/brands/${destSvgName}`;
            await pool.query('UPDATE brands SET logo = ? WHERE id = ?', [newLogoUrl, brand.id]);
            convertedBrands++;
            console.log(`✅ [Brand ${brand.id}] ${brand.name}: SVG moved to ${newLogoUrl}`);
          } else {
            const originalSize = fs.statSync(localPath).size;
            const { url } = await optimizeBrandLogo(localPath, brand.slug);
            const fullPath = path.join(__dirname, '../public', url);
            const newSize = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
            totalBytesSaved += Math.max(0, originalSize - newSize);
            await pool.query('UPDATE brands SET logo = ? WHERE id = ?', [url, brand.id]);
            convertedBrands++;
            console.log(`✅ [Brand ${brand.id}] ${brand.name}: ${brand.logo} -> ${url}`);
          }
        } catch (brandErr) {
          console.warn(`⚠️ Could not convert brand logo ${brand.logo}:`, brandErr.message);
        }
      }
    }
  }

  console.log('==================================================');
  console.log(`🎉 Image Migration to WebP Completed!`);
  console.log(`📱 Phones converted: ${convertedPhones}`);
  console.log(`🏷️ Brands converted: ${convertedBrands}`);
  console.log(`💾 Estimated disk / bandwidth saved: ${(totalBytesSaved / (1024 * 1024)).toFixed(2)} MB`);
  console.log('==================================================');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
