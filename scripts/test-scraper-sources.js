const assert = require('assert');
const SettingsModel = require('../server/models/settingsModel');
const { buildPicturesUrl } = require('../server/utils/phoneScraper');

async function runTests() {
  console.log('--- Testing Auto-Fetch & Scraper Sources Engine ---');

  // 1. Test buildPicturesUrl rules
  console.log('\n[1] Testing buildPicturesUrl transformation rules:');

  // GSMArena format (insert_before_id)
  const gsmUrl = 'https://www.gsmarena.com/vivo_v80_5g-14989.php';
  const gsmRule = {
    rule_type: 'insert_before_id',
    param_insert_text: 'pictures-'
  };
  const gsmTransformed = buildPicturesUrl(gsmUrl, gsmRule);
  console.log('GSMArena Specs URL:   ', gsmUrl);
  console.log('GSMArena Pictures URL:', gsmTransformed);
  assert.strictEqual(gsmTransformed, 'https://www.gsmarena.com/vivo_v80_5g-pictures-14989.php', 'GSMArena URL should have "pictures-" before 14989.php');

  // WhatMobile format (append_suffix)
  const wmUrl = 'https://www.whatmobile.com.pk/Samsung_Galaxy-A55';
  const wmRule = {
    rule_type: 'append_suffix',
    param_insert_text: '_Pictures'
  };
  const wmTransformed = buildPicturesUrl(wmUrl, wmRule);
  console.log('WhatMobile Specs URL:   ', wmUrl);
  console.log('WhatMobile Pictures URL:', wmTransformed);
  assert.strictEqual(wmTransformed, 'https://www.whatmobile.com.pk/Samsung_Galaxy-A55_Pictures', 'WhatMobile URL should have "_Pictures" appended');

  // Custom Site: Insert before extension (.php / .html)
  const customExtUrl = 'https://www.examplephones.com/xiaomi-15-ultra.html';
  const customExtRule = {
    rule_type: 'insert_before_extension',
    param_insert_text: '-gallery'
  };
  const customExtTransformed = buildPicturesUrl(customExtUrl, customExtRule);
  console.log('Custom Ext Specs URL:   ', customExtUrl);
  console.log('Custom Ext Pictures URL:', customExtTransformed);
  assert.strictEqual(customExtTransformed, 'https://www.examplephones.com/xiaomi-15-ultra-gallery.html', 'Custom URL should insert -gallery before .html');

  // Custom Site: Replace text (/specs/ -> /pictures/)
  const replaceUrl = 'https://www.devicespecifications.com/specs/phone-1234';
  const replaceRule = {
    rule_type: 'replace_text',
    param_target_pattern: '/specs/',
    param_insert_text: '/pictures/'
  };
  const replaceTransformed = buildPicturesUrl(replaceUrl, replaceRule);
  console.log('Replace Text Specs URL:   ', replaceUrl);
  console.log('Replace Text Pictures URL:', replaceTransformed);
  assert.strictEqual(replaceTransformed, 'https://www.devicespecifications.com/pictures/phone-1234', 'Should replace /specs/ with /pictures/');

  // 2. Test SettingsModel getScraperSources & saveScraperSources
  console.log('\n[2] Testing SettingsModel scraper sources persistence:');
  const initialSources = await SettingsModel.getScraperSources();
  console.log(`Found ${initialSources.length} initial sources:`, initialSources.map(s => s.name));
  assert(initialSources.length >= 2, 'Should have at least 2 default sources');

  // Add custom source
  const testCustomSource = {
    id: 'test-custom-phones',
    name: 'Test Mobile Portal',
    domain: 'testmobileportal.com',
    enabled: true,
    is_builtin: false,
    specs_url_example: 'https://testmobileportal.com/devices/phone-99.html',
    rule_type: 'insert_before_extension',
    param_insert_text: '-photos',
    param_target_pattern: '',
    image_url_example: 'https://testmobileportal.com/devices/phone-99-photos.html',
    image_selector: '.device-gallery-grid',
    description: 'Custom portal for mobile tests'
  };

  const updatedSources = [...initialSources, testCustomSource];
  await SettingsModel.saveScraperSources(updatedSources);

  const reloadedSources = await SettingsModel.getScraperSources();
  const foundCustom = reloadedSources.find(s => s.id === 'test-custom-phones');
  assert(foundCustom, 'Custom source should be saved and reloaded');
  assert.strictEqual(foundCustom.name, 'Test Mobile Portal');
  console.log('Successfully saved and reloaded custom source:', foundCustom.name);

  // Clean up: remove custom source to restore state
  const cleanedSources = reloadedSources.filter(s => s.id !== 'test-custom-phones');
  await SettingsModel.saveScraperSources(cleanedSources);
  const finalSources = await SettingsModel.getScraperSources();
  assert.strictEqual(finalSources.length, initialSources.length, 'Should restore original count');
  console.log('Successfully cleaned up test source. Final count:', finalSources.length);

  console.log('\n✅ All scraper sources engine tests passed successfully!');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
