const { pool } = require('../server/config/database');

async function addIndexIfNotExists(table, indexName, columnsSql) {
  try {
    const [existing] = await pool.query(`
      SELECT 1 FROM information_schema.statistics 
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?
      LIMIT 1
    `, [table, indexName]);

    if (existing.length > 0) {
      console.log(`ℹ️ Index ${indexName} on ${table} already exists.`);
      return;
    }

    console.log(`➕ Creating index ${indexName} on ${table}...`);
    await pool.query(`CREATE INDEX ${indexName} ON ${table} ${columnsSql}`);
    console.log(`✅ Index ${indexName} created successfully.`);
  } catch (err) {
    console.error(`❌ Failed to create index ${indexName} on ${table}:`, err.message);
  }
}

async function run() {
  console.log('🚀 Running MySQL Index Optimization...');

  // 1. Phone specs indexes
  await addIndexIfNotExists('phone_specs', 'idx_phone_specs_phone_sec_key', '(phone_id, section, spec_key)');
  await addIndexIfNotExists('phone_specs', 'idx_phone_specs_sec_key_phone', '(section, spec_key, phone_id)');

  // 2. Phones table indexes
  await addIndexIfNotExists('phones', 'idx_phones_brand_status_id', '(brand_id, status, id)');
  await addIndexIfNotExists('phones', 'idx_phones_status_id', '(status, id)');
  await addIndexIfNotExists('phones', 'idx_phones_popular_views', '(popular, views)');
  await addIndexIfNotExists('phones', 'idx_phones_featured_id', '(featured, id)');
  await addIndexIfNotExists('phones', 'idx_phones_price', '(price)');

  // 3. Brands table indexes
  await addIndexIfNotExists('brands', 'idx_brands_status_name', '(status, name, id)');

  // 4. News table indexes
  await addIndexIfNotExists('news', 'idx_news_status_hot_date', '(status, is_hot, created_at)');
  await addIndexIfNotExists('news', 'idx_news_status_date', '(status, created_at)');
  await addIndexIfNotExists('news', 'idx_news_category_status', '(category, status, created_at)');

  // 5. Phone prices indexes
  await addIndexIfNotExists('phone_prices', 'idx_phone_prices_phone_country', '(phone_id, country)');

  console.log('🎉 Index optimization completed!');
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal optimization error:', err);
  process.exit(1);
});
