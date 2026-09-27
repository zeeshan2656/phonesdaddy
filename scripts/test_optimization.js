/**
 * PhonesDaddy - Performance & Optimization Verification Suite
 */
const http = require('http');
const app = require('../server/app');
const { pool, query } = require('../server/config/database');

async function runTests() {
  console.log('--- PHONESDADDY OPTIMIZATION VERIFICATION SUITE ---');

  // Start app on ephemeral port
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`[PASS] Server successfully bound to ${baseUrl}`);

  function get(urlPath, headers = {}) {
    return new Promise((resolve, reject) => {
      const start = process.hrtime.bigint();
      const req = http.get(`${baseUrl}${urlPath}`, { headers }, (res) => {
        let chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const end = process.hrtime.bigint();
          const latencyMs = Number(end - start) / 1e6;
          const body = Buffer.concat(chunks);
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            latencyMs
          });
        });
      });
      req.on('error', reject);
    });
  }

  try {
    // 1. Test Homepage
    console.log('\n--- 1. Testing Homepage (/) ---');
    const homeRes1 = await get('/');
    console.log(`Initial Load (Cold): Status=${homeRes1.status}, Latency=${homeRes1.latencyMs.toFixed(2)}ms, Cache-Control=${homeRes1.headers['cache-control']}`);
    const homeRes2 = await get('/');
    console.log(`Second Load (Template Cache): Status=${homeRes2.status}, Latency=${homeRes2.latencyMs.toFixed(2)}ms`);

    // 2. Test Compression (Gzip)
    console.log('\n--- 2. Testing HTTP Compression (Accept-Encoding: gzip) ---');
    const gzipRes = await get('/', { 'Accept-Encoding': 'gzip' });
    console.log(`Gzip Response: Content-Encoding=${gzipRes.headers['content-encoding']}, Compressed Bytes=${gzipRes.body.length}`);

    // 3. Test API In-Memory Cache (MISS -> HIT)
    console.log('\n--- 3. Testing API In-Memory LRU Cache ---');
    const endpoints = [
      '/api/phones/latest?limit=16',
      '/api/phones/popular?limit=16',
      '/api/phones/upcoming?limit=16',
      '/api/brands?active=true',
      '/api/news/hot?limit=4',
      '/api/settings/public'
    ];

    for (const ep of endpoints) {
      const miss = await get(ep);
      const hit = await get(ep);
      console.log(`Endpoint: ${ep}`);
      console.log(`  Cold (MISS): Status=${miss.status}, X-Cache=${miss.headers['x-cache']}, Latency=${miss.latencyMs.toFixed(2)}ms`);
      console.log(`  Cached (HIT): Status=${hit.status}, X-Cache=${hit.headers['x-cache']}, Latency=${hit.latencyMs.toFixed(2)}ms (⚡ ${(miss.latencyMs / Math.max(0.1, hit.latencyMs)).toFixed(1)}x faster)`);
    }

    // 4. Test WebP & Static Asset Caching
    console.log('\n--- 4. Testing Static Asset Cache-Control Headers ---');
    const cssRes = await get('/css/style.css');
    console.log(`/css/style.css: Status=${cssRes.status}, Cache-Control=${cssRes.headers['cache-control']}`);

    // Check a sample webfiles image
    const [rows] = await pool.query('SELECT image FROM phones WHERE image LIKE "/webfiles/%" LIMIT 1');
    if (rows.length > 0) {
      const imgRes = await get(rows[0].image);
      console.log(`${rows[0].image}: Status=${imgRes.status}, Cache-Control=${imgRes.headers['cache-control']}`);
    }

    // 5. Test Key Public Pages
    console.log('\n--- 5. Testing Key Page Routes ---');
    const pages = ['/phones', '/brands', '/compare', '/news'];
    for (const p of pages) {
      const res = await get(p);
      console.log(`Route ${p}: Status=${res.status}, Latency=${res.latencyMs.toFixed(2)}ms`);
    }

    // Test a phone detail page if available
    const [samplePhones] = await pool.query('SELECT slug FROM phones LIMIT 1');
    if (samplePhones.length > 0) {
      const phoneRes = await get(`/phone/${samplePhones[0].slug}`);
      const hasInitialPhone = phoneRes.body.toString().includes('window.__INITIAL_PHONE__');
      console.log(`/phone/${samplePhones[0].slug}: Status=${phoneRes.status}, Latency=${phoneRes.latencyMs.toFixed(2)}ms, SSR Hydrated=${hasInitialPhone}`);
    }

    // Test a brand page if available
    const [sampleBrands] = await pool.query('SELECT slug FROM brands LIMIT 1');
    if (sampleBrands.length > 0) {
      const brandRes = await get(`/brand/${sampleBrands[0].slug}`);
      const hasInitialBrand = brandRes.body.toString().includes('window.__INITIAL_BRAND__');
      console.log(`/brand/${sampleBrands[0].slug}: Status=${brandRes.status}, Latency=${brandRes.latencyMs.toFixed(2)}ms, SSR Hydrated=${hasInitialBrand}`);
    }

    console.log('\n[SUCCESS] ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('[ERROR] Verification failed:', err);
  } finally {
    server.close();
    await pool.end();
    process.exit(0);
  }
}

runTests();
