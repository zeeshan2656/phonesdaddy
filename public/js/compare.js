// PhonesDaddy - Side-by-Side Phone Comparison Script

let compareSlugs = [];

async function initCompare() {
  const urlParams = new URLSearchParams(window.location.search);
  const phonesParam = urlParams.get('phones');

  if (phonesParam) {
    compareSlugs = phonesParam.split(',').map(s => s.trim()).filter(Boolean);
  } else {
    // Check localStorage basket
    compareSlugs = CompareBasket.get();
    if (compareSlugs.length === 0) {
      // Default demo comparison
      compareSlugs = ['samsung-galaxy-s26-ultra', 'apple-iphone-17-pro-max'];
    }
  }

  setupPhoneSearchPicker();
  loadComparisonData();
}

function updateUrl() {
  const newUrl = `${window.location.pathname}?phones=${compareSlugs.join(',')}`;
  window.history.pushState({}, '', newUrl);
}

function removePhone(slug) {
  compareSlugs = compareSlugs.filter(s => s !== slug);
  CompareBasket.remove(slug);
  updateUrl();
  loadComparisonData();
}

function addPhoneToCompare(slug) {
  if (compareSlugs.includes(slug)) return;
  if (compareSlugs.length >= 4) {
    alert('Maximum 4 phones can be compared at a time.');
    return;
  }
  compareSlugs.push(slug);
  CompareBasket.add(slug);
  updateUrl();
  loadComparisonData();
}

async function loadComparisonData() {
  const container = document.getElementById('compareTableContainer');
  if (!container) return;

  if (compareSlugs.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; background: #fff; border-radius: 8px; border: 1px solid #e2e8f0;">
        <h3 style="color: #0f172a; margin-bottom: 8px;">No phones selected for comparison</h3>
        <p style="color: #64748b; margin-bottom: 20px;">Search and add phones using the box above, or browse our catalog.</p>
        <a href="/phones" class="btn btn-primary">Browse Phones</a>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div style="text-align: center; padding: 48px; color: #64748b;">Loading comparison matrix...</div>`;

  try {
    const res = await fetch(`/api/compare?phones=${compareSlugs.join(',')}`);
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 48px; color: #dc2626;">Could not load comparison data.</div>`;
      return;
    }

    renderCompareMatrix(json.data);
  } catch (err) {
    console.error('Error fetching comparison:', err);
  }
}

function renderCompareMatrix(phones) {
  const container = document.getElementById('compareTableContainer');
  if (!container) return;

  // Key comparison sections & attributes
  const comparisonSections = [
    {
      title: 'General',
      rows: [
        { label: 'Brand', getVal: p => p.brand_name },
        { label: 'Release Date', getVal: p => p.release_date || '-' },
        { label: 'Status', getVal: p => p.status || '-' },
        { label: 'Price (Pakistan)', getVal: p => p.price > 0 ? formatPKR(p.price) : 'Rumored' }
      ]
    },
    {
      title: 'Display',
      rows: [
        { label: 'Display Type', getVal: p => getSpecVal(p, 'Display', 'Type') },
        { label: 'Screen Size', getVal: p => getSpecVal(p, 'Display', 'Size') },
        { label: 'Resolution', getVal: p => getSpecVal(p, 'Display', 'Resolution') },
        { label: 'Refresh Rate', getVal: p => getSpecVal(p, 'Display', 'Refresh Rate') },
        { label: 'Protection', getVal: p => getSpecVal(p, 'Display', 'Protection') }
      ]
    },
    {
      title: 'Platform & Performance',
      rows: [
        { label: 'Operating System', getVal: p => getSpecVal(p, 'Platform', 'OS') },
        { label: 'Chipset', getVal: p => getSpecVal(p, 'Platform', 'Chipset') },
        { label: 'CPU', getVal: p => getSpecVal(p, 'Platform', 'CPU') },
        { label: 'GPU', getVal: p => getSpecVal(p, 'Platform', 'GPU') }
      ]
    },
    {
      title: 'Memory & Storage',
      rows: [
        { label: 'RAM', getVal: p => getSpecVal(p, 'Memory', 'RAM') },
        { label: 'Internal Storage', getVal: p => getSpecVal(p, 'Memory', 'Internal Storage') },
        { label: 'Card Slot', getVal: p => getSpecVal(p, 'Memory', 'Card Slot') }
      ]
    },
    {
      title: 'Cameras',
      rows: [
        { label: 'Main Camera', getVal: p => getSpecVal(p, 'Main Camera', 'Main sensor') || getSpecVal(p, 'Main Camera', 'Camera configuration') },
        { label: 'Ultrawide', getVal: p => getSpecVal(p, 'Main Camera', 'Ultrawide') },
        { label: 'Telephoto', getVal: p => getSpecVal(p, 'Main Camera', 'Telephoto') },
        { label: 'Camera Video', getVal: p => getSpecVal(p, 'Main Camera', 'Video') },
        { label: 'Selfie Camera', getVal: p => getSpecVal(p, 'Selfie Camera', 'Camera') }
      ]
    },
    {
      title: 'Battery & Charging',
      rows: [
        { label: 'Battery Capacity', getVal: p => getSpecVal(p, 'Battery', 'Capacity') },
        { label: 'Charging Speed', getVal: p => getSpecVal(p, 'Battery', 'Charging') },
        { label: 'Wireless Charging', getVal: p => getSpecVal(p, 'Battery', 'Wireless Charging') }
      ]
    },
    {
      title: 'Body & Build',
      rows: [
        { label: 'Dimensions', getVal: p => getSpecVal(p, 'Body', 'Dimensions') },
        { label: 'Weight', getVal: p => getSpecVal(p, 'Body', 'Weight') },
        { label: 'Build Material', getVal: p => getSpecVal(p, 'Body', 'Build') },
        { label: 'SIM', getVal: p => getSpecVal(p, 'Body', 'SIM') }
      ]
    },
    {
      title: 'Connectivity & Features',
      rows: [
        { label: '5G Support', getVal: p => getSpecVal(p, 'Network', '5G') ? 'Yes' : 'No' },
        { label: 'WLAN / Wi-Fi', getVal: p => getSpecVal(p, 'Connectivity', 'WLAN') },
        { label: 'Bluetooth', getVal: p => getSpecVal(p, 'Connectivity', 'Bluetooth') },
        { label: 'NFC', getVal: p => getSpecVal(p, 'Connectivity', 'NFC') },
        { label: 'Sensors / Fingerprint', getVal: p => getSpecVal(p, 'Features', 'Fingerprint') || getSpecVal(p, 'Features', 'Sensors') }
      ]
    }
  ];

  let html = `
    <div class="compare-matrix-wrap">
      <table class="compare-matrix">
        <thead>
          <tr>
            <th class="compare-head-col" style="vertical-align: middle;">Model</th>
            ${phones.map(p => `
              <th class="compare-phone-card">
                <button onclick="removePhone('${p.slug}')" title="Remove" style="position: absolute; top: 10px; right: 10px; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 50%; width: 26px; height: 26px; cursor: pointer; font-weight: bold; font-size: 14px;">&times;</button>
                <img src="${p.image || '/images/placeholder.svg'}" alt="${p.name}" class="compare-phone-thumb" width="160" height="212" loading="lazy" decoding="async">
                <div class="compare-phone-title"><a href="/phone/${p.slug}">${p.name}</a></div>
                <div class="compare-phone-price">${p.price > 0 ? formatPKR(p.price) : 'Rumored'}</div>
              </th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
  `;

  for (const section of comparisonSections) {
    html += `
      <tr class="compare-section-header-row">
        <td colspan="${phones.length + 1}">${section.title}</td>
      </tr>
    `;

    for (const row of section.rows) {
      html += `
        <tr>
          <td class="compare-head-col">${row.label}</td>
          ${phones.map(p => `<td>${row.getVal(p) || '-'}</td>`).join('')}
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
}

function getSpecVal(phone, section, key) {
  if (!phone.specs || !phone.specs[section]) return '-';
  return phone.specs[section][key] || '-';
}

function setupPhoneSearchPicker() {
  const input = document.getElementById('compareSearchInput');
  const dropdown = document.getElementById('compareSearchDropdown');
  if (!input || !dropdown) return;

  const performSearch = debounce(async (q) => {
    if (!q || q.trim().length < 2) {
      dropdown.innerHTML = '';
      dropdown.classList.remove('show');
      return;
    }

    try {
      const res = await fetch(`/api/phones/search?q=${encodeURIComponent(q.trim())}&limit=6`);
      const json = await res.json();

      if (json.success && json.data.length > 0) {
        dropdown.innerHTML = json.data.map(p => `
          <div class="search-item" onclick="addPhoneToCompare('${p.slug}'); document.getElementById('compareSearchDropdown').classList.remove('show'); document.getElementById('compareSearchInput').value = '';" style="cursor: pointer;">
            <img src="${p.image || '/images/placeholder.svg'}" class="search-thumb" alt="${p.name}" width="36" height="48" loading="lazy" decoding="async">
            <div class="search-item-info">
              <div class="search-item-name">${p.name}</div>
              <div class="search-item-meta">${p.brand_name}</div>
            </div>
            <button class="btn btn-primary btn-sm">+ Add</button>
          </div>
        `).join('');
        dropdown.classList.add('show');
      } else {
        dropdown.innerHTML = `<div style="padding: 12px; color: #64748b; font-size: 13px; text-align: center;">No models found</div>`;
        dropdown.classList.add('show');
      }
    } catch (err) {
      console.error(err);
    }
  }, 250);

  input.addEventListener('input', e => performSearch(e.target.value));
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

document.addEventListener('DOMContentLoaded', initCompare);
