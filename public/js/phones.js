// PhonesDaddy - Phones Catalog & Filtering Logic

let currentFilters = {
  page: 1,
  limit: 12,
  brand: [],
  minPrice: '',
  maxPrice: '',
  ram: '',
  storage: '',
  is5G: '',
  sort: 'newest'
};

async function initCatalog() {
  parseUrlParams();
  await loadBrandFilters();
  setupFilterListeners();
  loadPhones();
}

function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('page')) currentFilters.page = parseInt(urlParams.get('page'), 10);
  if (urlParams.has('brand')) currentFilters.brand = urlParams.getAll('brand');
  if (urlParams.has('minPrice')) currentFilters.minPrice = urlParams.get('minPrice');
  if (urlParams.has('maxPrice')) currentFilters.maxPrice = urlParams.get('maxPrice');
  if (urlParams.has('ram')) currentFilters.ram = urlParams.get('ram');
  if (urlParams.has('storage')) currentFilters.storage = urlParams.get('storage');
  if (urlParams.has('is5G')) currentFilters.is5G = urlParams.get('is5G');
  if (urlParams.has('sort')) currentFilters.sort = urlParams.get('sort');

  // Set sort dropdown value
  const sortSelect = document.getElementById('catalogSortSelect');
  if (sortSelect && currentFilters.sort) {
    sortSelect.value = currentFilters.sort;
  }
}

async function loadBrandFilters() {
  const container = document.getElementById('brandFiltersList');
  if (!container) return;

  try {
    const res = await fetch('/api/brands?active=true');
    const json = await res.json();

    if (json.success && json.data) {
      container.innerHTML = json.data.map(b => `
        <label class="filter-label">
          <input type="checkbox" name="brand" value="${b.slug}" ${currentFilters.brand.includes(b.slug) ? 'checked' : ''}>
          <span>${b.name} (${b.phone_count})</span>
        </label>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading brand filters:', err);
  }
}

function setupFilterListeners() {
  // Brand checkboxes
  const brandList = document.getElementById('brandFiltersList');
  if (brandList) {
    brandList.addEventListener('change', () => {
      const checked = Array.from(brandList.querySelectorAll('input[name="brand"]:checked')).map(cb => cb.value);
      currentFilters.brand = checked;
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  }

  // Price inputs
  const minPriceInput = document.getElementById('filterMinPrice');
  const maxPriceInput = document.getElementById('filterMaxPrice');
  const applyPriceBtn = document.getElementById('btnApplyPrice');

  if (applyPriceBtn) {
    applyPriceBtn.addEventListener('click', () => {
      currentFilters.minPrice = minPriceInput ? minPriceInput.value : '';
      currentFilters.maxPrice = maxPriceInput ? maxPriceInput.value : '';
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  }

  // RAM radios
  document.querySelectorAll('input[name="filterRam"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentFilters.ram = e.target.value;
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  });

  // Storage radios
  document.querySelectorAll('input[name="filterStorage"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentFilters.storage = e.target.value;
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  });

  // 5G checkbox
  const check5G = document.getElementById('filter5G');
  if (check5G) {
    check5G.addEventListener('change', (e) => {
      currentFilters.is5G = e.target.checked ? 'true' : '';
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('catalogSortSelect');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      currentFilters.sort = e.target.value;
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  }

  // Reset filters button
  const resetBtn = document.getElementById('btnResetFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      currentFilters = {
        page: 1,
        limit: 12,
        brand: [],
        minPrice: '',
        maxPrice: '',
        ram: '',
        storage: '',
        is5G: '',
        sort: 'newest'
      };
      // Reset inputs in DOM
      document.querySelectorAll('#brandFiltersList input').forEach(cb => cb.checked = false);
      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      document.querySelectorAll('input[name="filterRam"]').forEach(r => r.checked = r.value === '');
      document.querySelectorAll('input[name="filterStorage"]').forEach(r => r.checked = r.value === '');
      if (check5G) check5G.checked = false;
      if (sortSelect) sortSelect.value = 'newest';
      updateUrlAndFetch();
    });
  }
}

function updateUrlAndFetch() {
  const params = new URLSearchParams();
  if (currentFilters.page > 1) params.set('page', currentFilters.page);
  currentFilters.brand.forEach(b => params.append('brand', b));
  if (currentFilters.minPrice) params.set('minPrice', currentFilters.minPrice);
  if (currentFilters.maxPrice) params.set('maxPrice', currentFilters.maxPrice);
  if (currentFilters.ram) params.set('ram', currentFilters.ram);
  if (currentFilters.storage) params.set('storage', currentFilters.storage);
  if (currentFilters.is5G) params.set('is5G', currentFilters.is5G);
  if (currentFilters.sort && currentFilters.sort !== 'newest') params.set('sort', currentFilters.sort);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.pushState({}, '', newUrl);

  loadPhones();
}

async function loadPhones() {
  const container = document.getElementById('phonesCatalogGrid');
  const countEl = document.getElementById('catalogTotalCount');
  if (!container) return;

  container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: #64748b;">Loading smartphones...</div>`;

  const queryParams = new URLSearchParams();
  queryParams.set('page', currentFilters.page);
  queryParams.set('limit', currentFilters.limit);
  queryParams.set('sort', currentFilters.sort);
  currentFilters.brand.forEach(b => queryParams.append('brand', b));
  if (currentFilters.minPrice) queryParams.set('minPrice', currentFilters.minPrice);
  if (currentFilters.maxPrice) queryParams.set('maxPrice', currentFilters.maxPrice);
  if (currentFilters.ram) queryParams.set('ram', currentFilters.ram);
  if (currentFilters.storage) queryParams.set('storage', currentFilters.storage);
  if (currentFilters.is5G) queryParams.set('is5G', currentFilters.is5G);

  try {
    const res = await fetch(`/api/phones?${queryParams.toString()}`);
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="font-size: 1.3rem; margin-bottom: 8px; color: #0f172a;">No phones found</h3>
          <p style="color: #64748b; font-size: 14px; margin-bottom: 20px;">Try relaxing your filters or search terms.</p>
          <button class="btn btn-primary" onclick="document.getElementById('btnResetFilters').click()">Clear All Filters</button>
        </div>
      `;
      if (countEl) countEl.innerText = '0 phones';
      renderPagination({ total: 0, page: 1, limit: currentFilters.limit, totalPages: 0 });
      return;
    }

    if (countEl) {
      countEl.innerText = `${json.pagination.total} phones found`;
    }

    container.innerHTML = json.data.map(phone => createPhoneCardHtml(phone)).join('');

    renderPagination(json.pagination);
  } catch (err) {
    console.error('Error fetching phones:', err);
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #dc2626; padding: 30px;">Error loading phones. Please try again.</div>`;
  }
}

function createPhoneCardHtml(phone) {
  return `
    <div class="phone-card" onclick="window.location.href='/phone/${phone.slug}'">
      <div class="phone-card-image-wrap">
        <span class="phone-card-brand-badge">${escapeHtml(phone.brand_name || '')}</span>
        <a href="/phone/${phone.slug}" onclick="event.stopPropagation()">
          <img src="${phone.image || '/images/placeholder.svg'}" alt="${escapeHtml(phone.name)}" class="phone-card-image" loading="lazy" decoding="async" width="160" height="212">
        </a>
      </div>
      <div class="phone-card-body">
        <a href="/phone/${phone.slug}" onclick="event.stopPropagation()">
          <h3 class="phone-card-title">${escapeHtml(phone.name)}</h3>
        </a>
        <div class="phone-card-price">${phone.price > 0 ? formatPKR(phone.price) : 'Rumored Price'}</div>
        <div class="phone-card-stats-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px; font-size: 11.5px; color: #64748b; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
          <span style="display: inline-flex; align-items: center; gap: 4px;" title="${(phone.views || 0).toLocaleString()} views">
            ${ICONS.eye} <span class="stat-label">${(phone.views || 0).toLocaleString()}</span>
          </span>
          <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: ${phone.review_count > 0 ? '#0d9488' : '#94a3b8'};" title="${(phone.review_count || 0).toLocaleString()} reviews">
            ${ICONS.comment} <span class="stat-label">${(phone.review_count || 0).toLocaleString()}</span>
          </span>
        </div>
      </div>
    </div>
  `;
}

function renderPagination(pagination) {
  const container = document.getElementById('catalogPagination');
  if (!container) return;

  if (pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Previous button
  html += `
    <button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="goToPage(${pagination.page - 1})">
      &laquo;
    </button>
  `;

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    // Show first, last, and current neighbors
    if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 1 && i <= pagination.page + 1)) {
      html += `
        <button class="page-btn ${i === pagination.page ? 'active' : ''}" onclick="goToPage(${i})">
          ${i}
        </button>
      `;
    } else if (i === pagination.page - 2 || i === pagination.page + 2) {
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
    }
  }

  // Next button
  html += `
    <button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="goToPage(${pagination.page + 1})">
      &raquo;
    </button>
  `;

  container.innerHTML = html;
}

function goToPage(page) {
  currentFilters.page = page;
  updateUrlAndFetch();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleQuickCompare(slug) {
  CompareBasket.add(slug);
  const list = CompareBasket.get();
  if (list.length >= 2) {
    window.location.href = `/compare?phones=${list.join(',')}`;
  } else {
    alert('Added to compare! Select 1 more phone to compare.');
  }
}

// Mobile Filter Sidebar & Collapsible Accordion Handlers
function toggleMobileFilterSidebar() {
  const sidebar = document.getElementById('filterSidebar');
  const stateText = document.getElementById('mobileFilterStateText');
  if (!sidebar) return;

  sidebar.classList.toggle('mobile-open');
  const isOpen = sidebar.classList.contains('mobile-open');
  if (stateText) {
    stateText.innerHTML = isOpen ? 'Tap to Close ▴' : 'Tap to Open ▾';
  }
}

function toggleFilterAccordion(groupId) {
  // Only toggle accordion collapse on mobile / small screens (window width <= 768px)
  const group = document.getElementById(groupId);
  if (!group) return;

  group.classList.toggle('is-expanded');
}

document.addEventListener('DOMContentLoaded', initCatalog);
