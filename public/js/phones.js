// PhonesDaddy - Phones Catalog & Filtering Logic

// Standalone utility helpers (self-contained fallback)
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPKR(num) {
  if (!num || isNaN(parseFloat(num)) || parseFloat(num) <= 0) return 'Price on Request';
  return 'Rs. ' + Math.round(parseFloat(num)).toLocaleString('en-PK');
}

let currentFilters = {
  page: 1,
  limit: 24,
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

  // Check if server-side rendered initial data is already present in the DOM
  const initialDataEl = document.getElementById('initialCatalogData');
  let initialData = null;
  if (initialDataEl) {
    try {
      initialData = JSON.parse(initialDataEl.textContent);
    } catch (_) {}
  }

  // Load brands if not pre-rendered by SSR
  const brandList = document.getElementById('brandFiltersList');
  const needsBrands = !brandList || brandList.children.length === 0 || brandList.textContent.includes('Loading brands');
  if (needsBrands) {
    await loadBrandFilters();
  }

  setupFilterListeners();

  // If URL has specific query filters or page > 1, fetch filtered results
  const urlParams = new URLSearchParams(window.location.search);
  const hasCustomQuery = urlParams.has('brand') || urlParams.has('minPrice') || urlParams.has('maxPrice') ||
    urlParams.has('ram') || urlParams.has('storage') || urlParams.has('is5G') ||
    (urlParams.has('sort') && urlParams.get('sort') !== 'newest') ||
    (urlParams.has('page') && parseInt(urlParams.get('page'), 10) > 1);

  if (hasCustomQuery || !initialData) {
    loadPhones();
  } else if (initialData && initialData.pagination) {
    renderPagination(initialData.pagination);
  }
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
  if (urlParams.has('limit')) currentFilters.limit = parseInt(urlParams.get('limit'), 10) || 24;

  // Set sort dropdown value
  const sortSelect = document.getElementById('catalogSortSelect');
  if (sortSelect && currentFilters.sort) {
    sortSelect.value = currentFilters.sort;
  }

  const minPriceInput = document.getElementById('filterMinPrice');
  const maxPriceInput = document.getElementById('filterMaxPrice');
  if (minPriceInput && currentFilters.minPrice) minPriceInput.value = currentFilters.minPrice;
  if (maxPriceInput && currentFilters.maxPrice) maxPriceInput.value = currentFilters.maxPrice;
  const check5G = document.getElementById('filter5G');
  if (check5G && currentFilters.is5G) check5G.checked = true;
}

async function loadBrandFilters() {
  const container = document.getElementById('brandFiltersList');
  const countBadge = document.getElementById('advBadgeCount');
  if (!container) return;

  try {
    const res = await fetch('/api/brands?active=true');
    const json = await res.json();

    if (json.success && json.data) {
      if (countBadge) countBadge.textContent = `${json.data.length} Brands`;
      container.innerHTML = json.data.map(b => {
        const count = parseInt(b.phone_count, 10) || 0;
        const isChecked = currentFilters.brand.includes(b.slug);
        return `
          <label class="adv-brand-item" data-brand="${escapeHtml(b.name.toLowerCase())}" title="${escapeHtml(b.name)} (${count} phones)">
            <div class="adv-brand-left">
              <input type="checkbox" name="brand" value="${escapeHtml(b.slug)}" class="adv-brand-checkbox" aria-label="Filter by ${escapeHtml(b.name)}" ${isChecked ? 'checked' : ''}>
              <span class="adv-brand-name">${escapeHtml(b.name)}</span>
            </div>
            <span class="adv-brand-count">${count}</span>
          </label>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error loading brand filters:', err);
  }
}

function setupFilterListeners() {
  // Brand live search
  const brandSearchInput = document.getElementById('brandSearchInput');
  if (brandSearchInput) {
    brandSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll('#brandFiltersList .adv-brand-item');
      items.forEach(item => {
        const name = item.dataset.brand || '';
        item.style.display = name.includes(q) ? 'flex' : 'none';
      });
    });
  }

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

  // Price inputs & chips
  const minPriceInput = document.getElementById('filterMinPrice');
  const maxPriceInput = document.getElementById('filterMaxPrice');
  const priceChips = document.querySelectorAll('#advPriceChips .adv-chip');

  if (minPriceInput) {
    minPriceInput.addEventListener('change', () => {
      currentFilters.minPrice = minPriceInput.value.trim();
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  }
  if (maxPriceInput) {
    maxPriceInput.addEventListener('change', () => {
      currentFilters.maxPrice = maxPriceInput.value.trim();
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  }

  priceChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const isActive = chip.classList.contains('active');
      priceChips.forEach(c => c.classList.remove('active'));
      if (!isActive) {
        chip.classList.add('active');
        if (minPriceInput) minPriceInput.value = chip.dataset.min || '';
        if (maxPriceInput) maxPriceInput.value = chip.dataset.max || '';
      } else {
        if (minPriceInput) minPriceInput.value = '';
        if (maxPriceInput) maxPriceInput.value = '';
      }
      currentFilters.minPrice = minPriceInput ? minPriceInput.value : '';
      currentFilters.maxPrice = maxPriceInput ? maxPriceInput.value : '';
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  });

  // RAM chips
  const ramChips = document.querySelectorAll('#advRamChips .adv-chip');
  if (currentFilters.ram) {
    ramChips.forEach(c => c.classList.toggle('active', c.dataset.val === currentFilters.ram));
  }
  ramChips.forEach(chip => {
    chip.addEventListener('click', () => {
      ramChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilters.ram = chip.dataset.val || '';
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  });

  // Storage chips
  const storageChips = document.querySelectorAll('#advStorageChips .adv-chip');
  if (currentFilters.storage) {
    storageChips.forEach(c => c.classList.toggle('active', c.dataset.val === currentFilters.storage));
  }
  storageChips.forEach(chip => {
    chip.addEventListener('click', () => {
      storageChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilters.storage = chip.dataset.val || '';
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  });

  // 5G toggle switch
  const check5G = document.getElementById('filter5G');
  if (check5G) {
    check5G.addEventListener('change', (e) => {
      currentFilters.is5G = e.target.checked ? 'true' : '';
      currentFilters.page = 1;
      updateUrlAndFetch();
    });
  }

  // Primary Apply Button
  const applyBtn = document.getElementById('btnApplyFilters');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      currentFilters.page = 1;
      updateUrlAndFetch();
      const sidebar = document.getElementById('filterSidebar');
      if (sidebar && sidebar.classList.contains('mobile-open')) {
        toggleMobileFilterSidebar();
      }
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
        limit: 24,
        brand: [],
        minPrice: '',
        maxPrice: '',
        ram: '',
        storage: '',
        is5G: '',
        sort: 'newest'
      };
      document.querySelectorAll('#brandFiltersList input').forEach(cb => cb.checked = false);
      if (brandSearchInput) {
        brandSearchInput.value = '';
        brandSearchInput.dispatchEvent(new Event('input'));
      }
      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      priceChips.forEach(c => c.classList.remove('active'));
      ramChips.forEach(c => c.classList.toggle('active', c.dataset.val === ''));
      storageChips.forEach(c => c.classList.toggle('active', c.dataset.val === ''));
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

  container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 48px; color: #475569;">Loading smartphones...</div>`;

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
          <p style="color: #475569; font-size: 14px; margin-bottom: 20px;">Try relaxing your filters or search terms.</p>
          <button class="btn btn-primary" onclick="document.getElementById('btnResetFilters').click()" aria-label="Clear all applied filters">Clear All Filters</button>
        </div>
      `;
      if (countEl) countEl.innerText = '0 phones found';
      renderPagination({ total: 0, page: 1, limit: currentFilters.limit, totalPages: 0 });
      return;
    }

    if (countEl) {
      countEl.innerText = `${json.pagination.total.toLocaleString()} phones found`;
    }

    container.innerHTML = json.data.map((phone, idx) => {
      try {
        return createPhoneCardHtml(phone, idx);
      } catch (err) {
        console.error('Error rendering phone card:', err, phone);
        return '';
      }
    }).join('');

    renderPagination(json.pagination);
  } catch (err) {
    console.error('Error fetching phones:', err);
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #dc2626; padding: 30px;">Error loading phones: ${escapeHtml(err && (err.message || String(err)) ? (err.message || String(err)) : 'Please try again.')}</div>`;
  }
}

function getCardThumb(img) {
  if (!img) return '/images/placeholder.svg';
  if (img.endsWith('-thumb.webp')) return img;
  if (/\.(webp|png|jpe?g)$/i.test(img)) return img.replace(/\.(webp|png|jpe?g)$/i, '-thumb.webp');
  return img;
}

const eyeIcon = '<svg class="svg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const commentIcon = '<svg class="svg-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

function createPhoneCardHtml(phone, index = 0) {
  if (!phone) return '';
  const priceVal = parseFloat(phone.price) || 0;
  const priceDisplay = priceVal > 0 ? formatPKR(priceVal) : 'Rumored Price';
  const brandName = phone.brand_name || '';
  const phoneName = (phone.name || 'Smartphone').replace(/\s*Price\s*(&amp;|&)\s*Specs\s*/gi, '').trim();
  const phoneSlug = phone.slug || '';
  const rawImg = phone.image || '/images/placeholder.svg';
  const thumbImg = getCardThumb(rawImg);
  const fullImg = rawImg.endsWith('-thumb.webp') ? rawImg.replace(/-thumb\.webp$/, '.webp') : rawImg;
  const viewsCount = parseInt(phone.views, 10) || 0;
  const reviewCount = parseInt(phone.review_count, 10) || 0;
  const phoneUrl = `/phone/${escapeHtml(phoneSlug)}`;
  const altText = `${phoneName} smartphone - ${brandName}`;

  // LCP optimization: Card 0 loads eager with high priority; next 3 load eager; others lazy
  let imgLoading = 'loading="lazy" decoding="async"';
  if (index === 0) {
    imgLoading = 'loading="eager" fetchpriority="high" decoding="sync"';
  } else if (index < 4) {
    imgLoading = 'loading="eager" decoding="async"';
  }

  return `
    <article class="phone-card" onclick="window.location.href='${phoneUrl}'" itemscope itemtype="https://schema.org/Product">
      <div class="phone-card-image-wrap">
        <span class="phone-card-brand-badge">${escapeHtml(brandName)}</span>
        <a href="${phoneUrl}" class="phone-card-image-link" aria-label="View specifications for ${escapeHtml(phoneName)}" onclick="event.stopPropagation()">
          <picture>
            <source type="image/webp" srcset="${escapeHtml(thumbImg)} 1x, ${escapeHtml(fullImg)} 2x">
            <img src="${escapeHtml(thumbImg)}" srcset="${escapeHtml(thumbImg)} 1x, ${escapeHtml(fullImg)} 2x" sizes="(max-width: 480px) 140px, (max-width: 768px) 160px, 180px" alt="${escapeHtml(altText)}" class="phone-card-image" ${imgLoading} width="160" height="212" itemprop="image">
          </picture>
        </a>
      </div>
      <div class="phone-card-body">
        <a href="${phoneUrl}" class="phone-card-title-link" aria-label="${escapeHtml(phoneName)} specifications and price" onclick="event.stopPropagation()">
          <h3 class="phone-card-title" itemprop="name" title="${escapeHtml(phoneName)}">${escapeHtml(phoneName)}</h3>
        </a>
        <div class="phone-card-price" itemprop="offers" itemscope itemtype="https://schema.org/Offer">
          <meta itemprop="priceCurrency" content="PKR">
          <meta itemprop="price" content="${priceVal}">
          <link itemprop="availability" href="https://schema.org/InStock">
          ${priceDisplay}
        </div>
        <div class="phone-card-stats-row" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 8px; font-size: 11.5px; color: #475569; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
          <span style="display: inline-flex; align-items: center; gap: 4px;" aria-label="${viewsCount.toLocaleString()} views" title="${viewsCount.toLocaleString()} views">
            ${eyeIcon} <span class="stat-label">${viewsCount.toLocaleString()}</span>
          </span>
          <span style="display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: ${reviewCount > 0 ? '#0f766e' : '#64748b'};" aria-label="${reviewCount.toLocaleString()} reviews" title="${reviewCount.toLocaleString()} reviews">
            ${commentIcon} <span class="stat-label">${reviewCount.toLocaleString()}</span>
          </span>
        </div>
      </div>
    </article>
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
    <button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} aria-label="Go to previous page" onclick="goToPage(${pagination.page - 1})">
      &laquo;
    </button>
  `;

  // Page numbers
  for (let i = 1; i <= pagination.totalPages; i++) {
    // Show first, last, and current neighbors
    if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 1 && i <= pagination.page + 1)) {
      const isActive = (i === pagination.page);
      html += `
        <button class="page-btn ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''} aria-label="Go to page ${i}" onclick="goToPage(${i})">
          ${i}
        </button>
      `;
    } else if (i === pagination.page - 2 || i === pagination.page + 2) {
      html += `<span style="padding: 0 4px; color: #64748b;" aria-hidden="true">...</span>`;
    }
  }

  // Next button
  html += `
    <button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} aria-label="Go to next page" onclick="goToPage(${pagination.page + 1})">
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
  const toggleBtn = document.getElementById('btnToggleMobileFilter');
  if (!sidebar) return;

  sidebar.classList.toggle('mobile-open');
  const isOpen = sidebar.classList.contains('mobile-open');
  if (stateText) {
    stateText.innerHTML = isOpen ? 'Tap to Close ▴' : 'Tap to Open ▾';
  }
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
}

function toggleFilterAccordion(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.classList.toggle('is-expanded');
}

document.addEventListener('DOMContentLoaded', initCatalog);
