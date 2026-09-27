// PhonesDaddy - Side-by-Side Phone Comparison Script
// Supports 1 to 4 phones with inline search, dynamic fallbacks, and live autocomplete

let compareSlugs = [];

async function initCompare() {
  const urlParams = new URLSearchParams(window.location.search);
  const phonesParam = urlParams.get('phones');

  if (phonesParam) {
    compareSlugs = phonesParam.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    // Deduplicate
    compareSlugs = [...new Set(compareSlugs)].slice(0, 4);
  } else {
    // Check localStorage basket
    const basket = (typeof CompareBasket !== 'undefined' && CompareBasket.get) ? CompareBasket.get() : [];
    if (Array.isArray(basket) && basket.length > 0) {
      compareSlugs = [...new Set(basket.map(s => s.trim().toLowerCase()))].slice(0, 4);
    }
  }

  // Setup header search picker immediately
  setupHeaderPhoneSearchPicker();

  // Load comparison data
  await loadComparisonData();
}

function updateUrl() {
  const newUrl = compareSlugs.length > 0
    ? `${window.location.pathname}?phones=${compareSlugs.join(',')}`
    : window.location.pathname;
  window.history.pushState({}, '', newUrl);
}

function removePhone(slug) {
  if (!slug) return;
  compareSlugs = compareSlugs.filter(s => s !== slug);
  if (typeof CompareBasket !== 'undefined' && CompareBasket.remove) {
    CompareBasket.remove(slug);
  }
  updateUrl();
  loadComparisonData();
}

function addPhoneToCompare(slug) {
  if (!slug) return;
  slug = slug.trim().toLowerCase();
  if (compareSlugs.includes(slug)) {
    alert('This phone is already in the comparison table.');
    return;
  }
  if (compareSlugs.length >= 4) {
    alert('Maximum 4 phones can be compared at a time.');
    return;
  }
  compareSlugs.push(slug);
  if (typeof CompareBasket !== 'undefined' && CompareBasket.add) {
    CompareBasket.add(slug);
  }
  updateUrl();
  loadComparisonData();
}

function setComparisonPair(slug1, slug2) {
  compareSlugs = [slug1, slug2].filter(Boolean);
  if (typeof CompareBasket !== 'undefined') {
    if (CompareBasket.clear) CompareBasket.clear();
    compareSlugs.forEach(s => CompareBasket.add(s));
  }
  updateUrl();
  loadComparisonData();
}

async function loadComparisonData() {
  const container = document.getElementById('compareTableContainer');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align: center; padding: 60px 20px;">
      <div style="display: inline-block; width: 36px; height: 36px; border: 3px solid #e2e8f0; border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 14px;"></div>
      <div style="color: #64748b; font-size: 15px; font-weight: 500;">Loading phone comparison matrix...</div>
    </div>
  `;

  try {
    const url = compareSlugs.length > 0
      ? `/api/compare?phones=${compareSlugs.join(',')}`
      : '/api/compare';

    const res = await fetch(url);
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      renderEmptyState(container);
      return;
    }

    // Sync compareSlugs with the retrieved phones
    const returnedSlugs = json.data.map(p => p.slug);
    compareSlugs = returnedSlugs;
    updateUrl();

    renderCompareMatrix(json.data);
  } catch (err) {
    console.error('Error fetching comparison:', err);
    container.innerHTML = `
      <div style="text-align: center; padding: 48px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h3 style="color: #0f172a; margin-bottom: 8px;">Could not load comparison data</h3>
        <p style="color: #64748b; margin-bottom: 20px;">An error occurred while fetching device specifications. Please try again.</p>
        <button onclick="loadComparisonData()" class="btn btn-primary">Try Again</button>
      </div>
    `;
  }
}

function getSpecVal(phone, section, keys) {
  if (!phone || !phone.specs) return '-';
  const sec = phone.specs[section];
  if (!sec) return '-';

  if (Array.isArray(keys)) {
    for (const k of keys) {
      if (sec[k] && sec[k].trim() && sec[k] !== '-') return sec[k];
    }
    return '-';
  }
  return sec[keys] || '-';
}

function renderEmptyState(container) {
  container.innerHTML = `
    <div style="text-align: center; padding: 60px 24px; background: #fff; border-radius: 12px; border: 1px solid var(--border-color); box-shadow: var(--shadow-sm); max-width: 640px; margin: 0 auto;">
      <div style="font-size: 40px; margin-bottom: 12px;">⚖️</div>
      <h2 style="color: var(--dark); font-size: 1.5rem; font-weight: 800; margin-bottom: 8px;">Select Phones to Compare</h2>
      <p style="color: var(--text-muted); font-size: 14px; margin-bottom: 24px;">Search and add any two smartphones to compare specs, performance, battery, cameras, and prices.</p>

      <div style="margin-bottom: 28px;">
        <input type="text" id="emptySearchInput" class="form-control" placeholder="Search phone name (e.g. Galaxy, Infinix, Vivo)..." style="max-width: 380px; margin: 0 auto; height: 46px;" autocomplete="off">
        <div class="search-results-dropdown" id="emptySearchDropdown" style="max-width: 380px; margin: 0 auto; position: relative;"></div>
      </div>

      <div style="border-top: 1px solid var(--border-color); padding-top: 20px;">
        <div style="font-size: 13px; font-weight: 700; color: var(--text-muted); margin-bottom: 12px; text-transform: uppercase;">Popular Comparisons:</div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
          <button onclick="setComparisonPair('galaxy-a32', 'galaxy-a27')" class="compare-chip">Galaxy A32 vs Galaxy A27</button>
          <button onclick="setComparisonPair('hot-70-pro', 'hot-70')" class="compare-chip">Hot 70 Pro vs Hot 70</button>
          <button onclick="setComparisonPair('v80-lite', 'y53s')" class="compare-chip">Vivo V80 Lite vs Vivo Y53s</button>
          <button onclick="setComparisonPair('c100i', 'tecno-spark-8c')" class="compare-chip">Realme C100i vs Spark 8C</button>
        </div>
      </div>
    </div>
  `;

  // Attach search listener for empty state
  const input = document.getElementById('emptySearchInput');
  const dropdown = document.getElementById('emptySearchDropdown');
  if (input && dropdown) {
    attachLiveSearch(input, dropdown, (slug) => addPhoneToCompare(slug));
  }
}

function renderCompareMatrix(phones) {
  const container = document.getElementById('compareTableContainer');
  if (!container) return;

  const showAddCard = phones.length < 4;
  const totalColumns = showAddCard ? phones.length + 2 : phones.length + 1;

  // Comparison sections mapped to actual database keys with fallbacks
  const comparisonSections = [
    {
      title: 'General',
      rows: [
        { label: 'Brand', getVal: p => p.brand_name },
        { label: 'Release Date', getVal: p => p.release_date || '-' },
        { label: 'Status', getVal: p => p.status || '-' },
        { label: 'Price (Pakistan)', getVal: p => (p.price > 0 && typeof formatPKR === 'function') ? formatPKR(p.price) : (p.price > 0 ? 'Rs. ' + Number(p.price).toLocaleString() : 'Rumored') }
      ]
    },
    {
      title: 'Display',
      rows: [
        { label: 'Display Type', getVal: p => getSpecVal(p, 'Display', ['Technology', 'Type']) },
        { label: 'Screen Size', getVal: p => getSpecVal(p, 'Display', ['Size', 'Screen Size']) },
        { label: 'Resolution', getVal: p => getSpecVal(p, 'Display', ['Resolution']) },
        { label: 'Refresh Rate & Extras', getVal: p => getSpecVal(p, 'Display', ['Extra Features', 'Refresh Rate']) },
        { label: 'Protection', getVal: p => getSpecVal(p, 'Display', ['Protection']) }
      ]
    },
    {
      title: 'Platform & Performance',
      rows: [
        { label: 'Operating System', getVal: p => getSpecVal(p, 'Platform', ['OS', 'Operating System']) },
        { label: 'User Interface', getVal: p => getSpecVal(p, 'Platform', ['UI', 'User Interface']) },
        { label: 'Chipset', getVal: p => getSpecVal(p, 'Platform', ['Chipset']) },
        { label: 'CPU (Processor)', getVal: p => getSpecVal(p, 'Platform', ['CPU', 'Processor']) },
        { label: 'GPU (Graphics)', getVal: p => getSpecVal(p, 'Platform', ['GPU']) }
      ]
    },
    {
      title: 'Memory & Storage',
      rows: [
        { label: 'RAM & Internal Storage', getVal: p => getSpecVal(p, 'Memory', ['Built-in', 'RAM', 'Internal Storage']) },
        { label: 'Memory Card Slot', getVal: p => getSpecVal(p, 'Memory', ['Card', 'Card Slot']) }
      ]
    },
    {
      title: 'Cameras',
      rows: [
        { label: 'Main Camera Setup', getVal: p => getSpecVal(p, 'Main Camera', ['Main', 'Main sensor', 'Camera configuration']) },
        { label: 'Camera Features & Video', getVal: p => getSpecVal(p, 'Main Camera', ['Features', 'Video']) },
        { label: 'Selfie / Front Camera', getVal: p => getSpecVal(p, 'Selfie Camera', ['Front', 'Camera', 'Single']) }
      ]
    },
    {
      title: 'Battery & Endurance',
      rows: [
        { label: 'Battery Capacity', getVal: p => getSpecVal(p, 'Battery', ['Capacity', 'Type']) },
        { label: 'Charging & Speed', getVal: p => getSpecVal(p, 'Battery', ['Charging', 'Fast Charging']) }
      ]
    },
    {
      title: 'Body & Build',
      rows: [
        { label: 'Dimensions', getVal: p => getSpecVal(p, 'Body', ['Dimensions']) },
        { label: 'Weight', getVal: p => getSpecVal(p, 'Body', ['Weight']) },
        { label: 'SIM Support', getVal: p => getSpecVal(p, 'Body', ['SIM']) },
        { label: 'Available Colors', getVal: p => getSpecVal(p, 'Body', ['Colors']) }
      ]
    },
    {
      title: 'Network & Connectivity',
      rows: [
        { label: '5G Support', getVal: p => (p.specs?.Network?.['5G Band']) ? `Yes (${p.specs.Network['5G Band']})` : ((p.specs?.Network?.['4G Band']) ? '4G LTE' : '-') },
        { label: 'WLAN / Wi-Fi', getVal: p => getSpecVal(p, 'Connectivity', ['WLAN']) },
        { label: 'Bluetooth', getVal: p => getSpecVal(p, 'Connectivity', ['Bluetooth']) },
        { label: 'GPS Navigation', getVal: p => getSpecVal(p, 'Connectivity', ['GPS']) },
        { label: 'NFC', getVal: p => getSpecVal(p, 'Connectivity', ['NFC']) },
        { label: 'USB Port', getVal: p => getSpecVal(p, 'Connectivity', ['USB']) },
        { label: 'Audio Jack / Sound', getVal: p => getSpecVal(p, 'Sound', ['Audio', '3.5mm Jack']) }
      ]
    },
    {
      title: 'Sensors & Features',
      rows: [
        { label: 'Sensors & Security', getVal: p => getSpecVal(p, 'Features', ['Sensors', 'Fingerprint']) },
        { label: 'Extra Features', getVal: p => getSpecVal(p, 'Features', ['Extra']) }
      ]
    }
  ];

  // Quick comparison suggestion bar if 1 phone is selected
  let suggestionBarHtml = '';
  if (phones.length === 1) {
    const currentSlug = phones[0].slug;
    const popularCandidates = [
      { name: 'Galaxy A32', slug: 'galaxy-a32' },
      { name: 'Galaxy A27', slug: 'galaxy-a27' },
      { name: 'Hot 70 Pro', slug: 'hot-70-pro' },
      { name: 'Vivo V80 Lite', slug: 'v80-lite' },
      { name: 'Vivo Y53s', slug: 'y53s' }
    ].filter(c => c.slug !== currentSlug);

    suggestionBarHtml = `
      <div class="compare-suggestions-bar">
        <span class="compare-suggestions-label">💡 Compare ${phones[0].name} with:</span>
        ${popularCandidates.map(c => `
          <button onclick="addPhoneToCompare('${c.slug}')" class="compare-chip">+ ${c.name}</button>
        `).join('')}
      </div>
    `;
  }

  let html = `
    ${suggestionBarHtml}
    <div class="compare-matrix-wrap">
      <table class="compare-matrix">
        <thead>
          <tr>
            <th class="compare-head-col" style="vertical-align: middle;">Model</th>
            ${phones.map(p => `
              <th class="compare-phone-card">
                <button onclick="removePhone('${p.slug}')" title="Remove ${p.name}" style="position: absolute; top: 10px; right: 10px; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; font-weight: bold; font-size: 14px; line-height: 1;">&times;</button>
                <a href="/phone/${p.slug}">
                  <img src="${p.image || '/images/placeholder.svg'}" alt="${p.name}" class="compare-phone-thumb" width="160" height="212" loading="lazy" decoding="async">
                </a>
                <div class="compare-phone-title"><a href="/phone/${p.slug}">${p.name}</a></div>
                <div class="compare-phone-price">${(p.price > 0 && typeof formatPKR === 'function') ? formatPKR(p.price) : (p.price > 0 ? 'Rs. ' + Number(p.price).toLocaleString() : 'Rumored')}</div>
                <a href="/phone/${p.slug}" class="btn btn-outline btn-sm" style="margin-top: 8px; font-size: 12px; padding: 4px 12px;">Full Specs</a>
              </th>
            `).join('')}
            ${showAddCard ? `
              <th class="compare-phone-card compare-add-card">
                <div class="compare-add-slot">
                  <div class="compare-add-icon">+</div>
                  <div class="compare-add-title">Add Phone to Compare</div>
                  <div class="compare-slot-search-wrap">
                    <input type="text" id="slotSearchInput" class="compare-slot-search" placeholder="Type phone name..." autocomplete="off">
                    <div class="compare-slot-dropdown" id="slotSearchDropdown"></div>
                  </div>
                </div>
              </th>
            ` : ''}
          </tr>
        </thead>
        <tbody>
  `;

  for (const section of comparisonSections) {
    html += `
      <tr class="compare-section-header-row">
        <td colspan="${totalColumns}">${section.title}</td>
      </tr>
    `;

    for (const row of section.rows) {
      html += `
        <tr>
          <td class="compare-head-col">${row.label}</td>
          ${phones.map(p => `<td>${row.getVal(p) || '-'}</td>`).join('')}
          ${showAddCard ? `<td class="compare-cell-empty">-</td>` : ''}
        </tr>
      `;
    }
  }

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  // Attach search listener to the inline slot input if present
  if (showAddCard) {
    const slotInput = document.getElementById('slotSearchInput');
    const slotDropdown = document.getElementById('slotSearchDropdown');
    if (slotInput && slotDropdown) {
      attachLiveSearch(slotInput, slotDropdown, (slug) => addPhoneToCompare(slug));
    }
  }
}

function attachLiveSearch(inputEl, dropdownEl, onSelect) {
  if (!inputEl || !dropdownEl) return;

  const performSearch = (typeof debounce === 'function') 
    ? debounce(async (q) => {
        runSearch(q, dropdownEl, onSelect, inputEl);
      }, 250)
    : async (q) => runSearch(q, dropdownEl, onSelect, inputEl);

  inputEl.addEventListener('input', e => performSearch(e.target.value));

  document.addEventListener('click', e => {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      dropdownEl.classList.remove('show');
    }
  });
}

async function runSearch(q, dropdownEl, onSelect, inputEl) {
  if (!q || q.trim().length < 2) {
    dropdownEl.innerHTML = '';
    dropdownEl.classList.remove('show');
    return;
  }

  try {
    const res = await fetch(`/api/phones/search?q=${encodeURIComponent(q.trim())}&limit=6`);
    const json = await res.json();

    if (json.success && json.data && json.data.length > 0) {
      dropdownEl.innerHTML = json.data.map(p => `
        <div class="search-item" data-slug="${p.slug}" style="display: flex; align-items: center; gap: 10px; padding: 8px 12px; cursor: pointer; border-bottom: 1px solid #f1f5f9;">
          <img src="${p.image || '/images/placeholder.svg'}" class="search-thumb" alt="${p.name}" width="36" height="48" loading="lazy" decoding="async" style="object-fit: contain;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 13px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${p.name}</div>
            <div style="font-size: 11px; color: #64748b;">${p.brand_name || ''}</div>
          </div>
          <button type="button" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 4px 8px;">+ Add</button>
        </div>
      `).join('');

      dropdownEl.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          const slug = item.getAttribute('data-slug');
          dropdownEl.classList.remove('show');
          if (inputEl) inputEl.value = '';
          onSelect(slug);
        });
      });

      dropdownEl.classList.add('show');
    } else {
      dropdownEl.innerHTML = `<div style="padding: 12px; color: #64748b; font-size: 13px; text-align: center;">No models found</div>`;
      dropdownEl.classList.add('show');
    }
  } catch (err) {
    console.error('Search error:', err);
  }
}

function setupHeaderPhoneSearchPicker() {
  const input = document.getElementById('compareSearchInput');
  const dropdown = document.getElementById('compareSearchDropdown');
  if (!input || !dropdown) return;

  attachLiveSearch(input, dropdown, (slug) => addPhoneToCompare(slug));
}

// Safely initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCompare);
} else {
  initCompare();
}
