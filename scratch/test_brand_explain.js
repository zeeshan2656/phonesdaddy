const { pool } = require('../server/config/database');

async function test() {
  const [exp] = await pool.query(`
    EXPLAIN SELECT 
      b.id, b.name, b.slug, b.logo, b.description, b.status, b.created_at,
      COALESCE(pc.phone_count, 0) AS phone_count
    FROM brands b
    LEFT JOIN (
      SELECT brand_id, COUNT(*) AS phone_count
      FROM phones
      GROUP BY brand_id
    ) pc ON b.id = pc.brand_id
    WHERE b.status = 'active'
    ORDER BY b.name ASC
  `);
  console.table(exp);
  process.exit(0);
}
test();
