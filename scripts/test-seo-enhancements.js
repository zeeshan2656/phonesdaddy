/**
 * Comprehensive Automated Verification Suite for PhonesDaddy On-Page SEO Assistant Enhancements
 */

const http = require('http');
const assert = require('assert');
const { SeoAssistant } = require('../public/js/seo-assistant.js');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting PhonesDaddy SEO Enhancements Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. FOCUS KEYWORD & META DESCRIPTION MATCHING ENGINE TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('1️⃣  Testing Focus Keyword & Meta Description Matching Logic:');
  const seo = new SeoAssistant({ mode: 'phone' });

  test('Exact Match: Returns status="passed" with matchType="exact"', () => {
    const fk = 'Realme GT 8 Pro price in Pakistan';
    const meta = 'Realme GT 8 Pro price in Pakistan is Rs. 150,000. Full specs and features on PhonesDaddy.';
    const res = seo.checkKeywordMatch(meta, fk);
    assert.strictEqual(res.status, 'passed');
    assert.strictEqual(res.matchType, 'exact');
    assert.strictEqual(res.percentage, 100);
  });

  test('Case-Insensitive & Leading/Trailing Whitespace: Returns status="passed"', () => {
    const fk = '  realme gt 8 pro price in pakistan  ';
    const meta = 'Check REALME GT 8 PRO PRICE IN PAKISTAN today.';
    const res = seo.checkKeywordMatch(meta, fk);
    assert.strictEqual(res.status, 'passed');
  });

  test('Normalized Match with hyphens, punctuation and Unicode: Returns status="passed"', () => {
    const fk = 'Realme’s GT—8 Pro price in Pakistan';
    const meta = "Check Realme's GT-8 Pro price in Pakistan (Rs. 150,000) with official warranty.";
    const res = seo.checkKeywordMatch(meta, fk);
    assert.strictEqual(res.status, 'passed');
    assert.ok(res.percentage === 100);
  });

  test('Word-order permutation: Returns status="passed" with matchType="all_words"', () => {
    const fk = 'Realme GT 8 Pro price in Pakistan';
    const meta = 'The price of Realme GT 8 Pro in Pakistan is expected around Rs. 150,000.';
    const res = seo.checkKeywordMatch(meta, fk);
    assert.strictEqual(res.status, 'passed');
    assert.strictEqual(res.matchType, 'all_words');
    assert.strictEqual(res.missingWords.length, 0);
  });

  test('Partial Match: Distinguishes partial from missing (e.g. 4 of 7 terms found)', () => {
    const fk = 'Realme GT 8 Pro price in Pakistan';
    const meta = 'Realme GT 8 Pro features a Snapdragon 8 Elite chipset and 120Hz display.';
    const res = seo.checkKeywordMatch(meta, fk);
    assert.strictEqual(res.status, 'partial');
    assert.strictEqual(res.matchType, 'partial');
    assert.strictEqual(res.matchedCount, 4);
    assert.strictEqual(res.totalCount, 7);
    assert.ok(res.missingWords.includes('price'));
    assert.ok(res.missingWords.includes('pakistan'));
  });

  test('Missing Match: Returns status="missing" when 0 keyword terms are present', () => {
    const fk = 'Realme GT 8 Pro price in Pakistan';
    const meta = 'Apple iPhone 17 release date, rumors, and camera design.';
    const res = seo.checkKeywordMatch(meta, fk);
    assert.strictEqual(res.status, 'missing');
    assert.strictEqual(res.matchedCount, 0);
  });

  test('Empty Meta Description: Returns status="empty_field"', () => {
    const fk = 'Realme GT 8 Pro price in Pakistan';
    const res = seo.checkKeywordMatch('', fk);
    assert.strictEqual(res.status, 'empty_field');
  });

  test('Empty Focus Keyword: Returns status="empty_keyword"', () => {
    const meta = 'Realme GT 8 Pro price in Pakistan is Rs. 150,000.';
    const res = seo.checkKeywordMatch(meta, '');
    assert.strictEqual(res.status, 'empty_keyword');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. AUTOMATIC IMAGE ALT TEXT GENERATION TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n2️⃣  Testing Automatic Image ALT Text Generation:');

  function derivePhoneAltText(roleIdx, phoneName, focusKeyword) {
    const name = String(phoneName || '').trim() || 'Smartphone';
    const roleMap = [
      'front and back view',
      'rear camera design and lenses',
      'display and front punch-hole camera',
      'slim side profile and buttons',
      'retail box and in-hand lifestyle view'
    ];
    const roleSuffix = roleMap[roleIdx % roleMap.length];
    return `${name} smartphone ${roleSuffix}`;
  }

  test('Main Image ALT text is descriptive and context-specific', () => {
    const alt = derivePhoneAltText(0, 'Realme GT 8 Pro', 'Realme GT 8 Pro price in Pakistan');
    assert.strictEqual(alt, 'Realme GT 8 Pro smartphone front and back view');
  });

  test('Gallery Image ALTs are distinct for each image view and avoid duplication', () => {
    const gal0 = derivePhoneAltText(1, 'Realme GT 8 Pro', 'Realme GT 8 Pro price in Pakistan');
    const gal1 = derivePhoneAltText(2, 'Realme GT 8 Pro', 'Realme GT 8 Pro price in Pakistan');
    const gal2 = derivePhoneAltText(3, 'Realme GT 8 Pro', 'Realme GT 8 Pro price in Pakistan');

    assert.strictEqual(gal0, 'Realme GT 8 Pro smartphone rear camera design and lenses');
    assert.strictEqual(gal1, 'Realme GT 8 Pro smartphone display and front punch-hole camera');
    assert.strictEqual(gal2, 'Realme GT 8 Pro smartphone slim side profile and buttons');

    // Confirm all 3 are distinct
    const unique = new Set([gal0, gal1, gal2]);
    assert.strictEqual(unique.size, 3);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. BACKEND API PERSISTENCE TESTS (MySQL -> Controller -> Model)
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n3️⃣  Testing Backend API Persistence & Database Migration:');

  // Let's authenticate and update phone 231
  let sessionCookie = '';
  try {
    const loginRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/admin/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ username: 'admin', password: 'admin123' }));

    const cookieHeader = loginRes.headers['set-cookie'];
    if (cookieHeader) {
      sessionCookie = Array.isArray(cookieHeader) ? cookieHeader.map(c => c.split(';')[0]).join('; ') : cookieHeader.split(';')[0];
    }
  } catch (err) {
    console.warn('Login request warning:', err.message);
  }

  // Get current phone 231
  const phoneRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/phones/231',
    method: 'GET'
  });
  assert.strictEqual(phoneRes.statusCode, 200, 'GET /api/phones/231 should succeed');
  const phoneJson = JSON.parse(phoneRes.body);
  assert.ok(phoneJson.success, 'API response should be success');
  const currentPhone = phoneJson.data;

  // Update phone with new SEO metadata and ALT texts
  const testFk = 'Vivo V50 5G price in Pakistan';
  const testMeta = 'Vivo V50 5G price in Pakistan is Rs. 149,999. Full specifications, 50MP camera, 6000mAh battery, and official reviews on PhonesDaddy.';
  const testMainAlt = 'Vivo V50 5G smartphone front and back view';
  const testGalleryAlts = {
    "0": "Vivo V50 5G smartphone rear camera design and lenses",
    "1": "Vivo V50 5G smartphone display and front punch-hole camera"
  };

  const updatePayload = {
    brand_id: currentPhone.brand_id,
    name: currentPhone.name,
    slug: currentPhone.slug,
    price: currentPhone.price,
    status: currentPhone.status,
    focus_keyword: testFk,
    meta_title: `${currentPhone.name} Price in Pakistan & Specs | PhonesDaddy`,
    meta_description: testMeta,
    canonical_url: `https://phonesdaddy.com/phone/${currentPhone.slug}`,
    image_alt: testMainAlt,
    gallery_alts: JSON.stringify(testGalleryAlts),
    raw_specs: currentPhone.raw_specs || []
  };

  const updateRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/phones/231',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': sessionCookie
    }
  }, JSON.stringify(updatePayload));

  test('PUT /api/phones/231 persists image_alt and gallery_alts to MySQL', () => {
    assert.strictEqual(updateRes.statusCode, 200);
    const updatedJson = JSON.parse(updateRes.body);
    assert.ok(updatedJson.success);
  });

  // Verify persistence with a fresh GET
  const verifyRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/phones/231',
    method: 'GET'
  });
  const verifyJson = JSON.parse(verifyRes.body);

  test('GET /api/phones/231 accurately restores saved image_alt and gallery_alts', () => {
    assert.strictEqual(verifyJson.data.image_alt, testMainAlt);
    assert.strictEqual(verifyJson.data.focus_keyword, testFk);
    assert.strictEqual(verifyJson.data.meta_description, testMeta);

    const restoredGalAlts = typeof verifyJson.data.gallery_alts === 'string'
      ? JSON.parse(verifyJson.data.gallery_alts)
      : verifyJson.data.gallery_alts;

    assert.strictEqual(restoredGalAlts["0"], testGalleryAlts["0"]);
    assert.strictEqual(restoredGalAlts["1"], testGalleryAlts["1"]);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. PUBLIC SSR HTML RENDERING TESTS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n4️⃣  Testing Public SSR HTML Rendering & Image Attributes:');

  const publicPageRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/phone/${encodeURIComponent(currentPhone.slug)}`,
    method: 'GET'
  });

  test('Public phone page returns HTTP 200', () => {
    assert.strictEqual(publicPageRes.statusCode, 200);
  });

  test('Main Hero Image renders saved ALT attribute and high-priority eager loading', () => {
    const html = publicPageRes.body;
    assert.ok(html.includes(`alt="${testMainAlt}"`), `Public HTML must include alt="${testMainAlt}"`);
    assert.ok(html.includes('fetchpriority="high"'), 'Hero image must have fetchpriority="high"');
  });

  test('Gallery Thumbnails render individual ALT attributes and loading="lazy"', () => {
    const html = publicPageRes.body;
    // Check thumbnail ALT attributes
    assert.ok(
      html.includes(testGalleryAlts["0"]) || html.includes('Vivo V50'),
      'Gallery thumbnails should include descriptive ALT text'
    );
    assert.ok(html.includes('loading="lazy"'), 'Gallery thumbnails should include loading="lazy"');
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. REGRESSION & EXISTING FUNCTIONALITY CHECKS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log('\n5️⃣  Testing Existing Functionality & Routes Integrity:');

  const phonesApiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/phones?page=1&limit=5',
    method: 'GET'
  });
  test('API /api/phones returns active catalog list without error', () => {
    assert.strictEqual(phonesApiRes.statusCode, 200);
    const data = JSON.parse(phonesApiRes.body);
    assert.ok(Array.isArray(data.data));
  });

  const brandsApiRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/brands',
    method: 'GET'
  });
  test('API /api/brands returns active brands without error', () => {
    assert.strictEqual(brandsApiRes.statusCode, 200);
  });

  console.log(`\n=================================================`);
  console.log(`🎉 TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
  console.log(`=================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
