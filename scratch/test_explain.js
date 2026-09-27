const { pool } = require('../server/config/database');

async function testExplain() {
  console.log('--- EXPLAIN PhoneModel.getPhones ---');
  const [exp1] = await pool.query(`
    EXPLAIN SELECT p.id, p.name, p.slug, p.short_description, p.image, p.release_date, p.status, p.price, p.featured, p.popular, p.views, p.created_at, b.id AS brand_id, b.name AS brand_name, b.slug AS brand_slug 
    FROM phones p 
    JOIN brands b ON p.brand_id = b.id 
    ORDER BY p.id DESC LIMIT 24 OFFSET 0
  `);
  console.table(exp1);

  console.log('--- EXPLAIN BrandModel.getAllBrands ---');
  const [exp2] = await pool.query(`
    EXPLAIN SELECT b.id, b.name, b.slug, b.logo, b.description, b.status, b.created_at, COUNT(p.id) AS phone_count 
    FROM brands b 
    LEFT JOIN phones p ON b.id = p.brand_id 
    WHERE b.status = 'active' 
    GROUP BY b.id 
    ORDER BY b.name ASC
  `);
  console.table(exp2);

  console.log('--- EXPLAIN phone_specs by phone_id ---');
  const [exp3] = await pool.query(`
    EXPLAIN SELECT phone_id, section, spec_key, spec_value 
    FROM phone_specs 
    WHERE phone_id IN (1,2,3,4,5) 
      AND ((section = 'Display' AND spec_key IN ('Size', 'Technology')) OR (section = 'Platform' AND spec_key = 'Chipset'))
  `);
  console.table(exp3);

  console.log('--- EXPLAIN phones filtering by specs RAM ---');
  const [exp4] = await pool.query(`
    EXPLAIN SELECT p.id FROM phones p 
    WHERE EXISTS (
      SELECT 1 FROM phone_specs ps 
      WHERE ps.phone_id = p.id AND ps.section = 'Memory' AND ps.spec_key = 'RAM' AND ps.spec_value LIKE '%8GB%'
    )
  `);
  console.table(exp4);

  console.log('--- EXPLAIN phone by slug ---');
  const [exp5] = await pool.query(`
    EXPLAIN SELECT p.id, p.name, p.slug, p.brand_id, b.name AS brand_name, b.slug AS brand_slug 
    FROM phones p 
    JOIN brands b ON p.brand_id = b.id 
    WHERE p.slug = 'samsung-galaxy-s26-ultra'
  `);
  console.table(exp5);

  process.exit(0);
}

testExplain().catch(err => {
  console.error(err);
  process.exit(1);
});
