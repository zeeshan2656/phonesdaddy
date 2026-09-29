// PhonesDaddy - Phone Detail Page Script

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

async function initPhoneDetail() {
  if (window.__INITIAL_PHONE__) {
    renderPhoneDetail(window.__INITIAL_PHONE__);

    // SSR hydration bypasses the API, so fire a background ping to increment the view counter
    const slug = window.__INITIAL_PHONE__.slug;
    if (slug) {
      fetch(`/api/phones/ping-view/${encodeURIComponent(slug)}`, { method: 'POST' }).catch(() => {});

      // Also fetch fresh live counts (views + review_count) in background to show real-time numbers
      fetch(`/api/phones/slug/${encodeURIComponent(slug)}`)
        .then(r => r.json())
        .then(json => {
          if (json.success && json.data) {
            const viewsEl = document.getElementById('phoneViewsVal');
            const reviewsEl = document.getElementById('phoneReviewsVal');
            const tabReviewsCount = document.getElementById('tabReviewsCount');
            if (viewsEl) viewsEl.innerText = (json.data.views || 0).toLocaleString();
            if (reviewsEl) reviewsEl.innerText = (json.data.review_count || 0).toLocaleString();
            if (tabReviewsCount) tabReviewsCount.innerText = (json.data.review_count || 0).toLocaleString();
          }
        })
        .catch(() => {});
    }
    return;
  }

  const pathParts = window.location.pathname.split('/');
  const slug = pathParts[pathParts.length - 1];

  if (!slug) return;

  try {
    const res = await fetch(`/api/phones/slug/${slug}`);
    const json = await res.json();

    if (!json.success || !json.data) {
      document.getElementById('phoneDetailContainer').innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <h2>Phone not found</h2>
          <p style="margin: 16px 0; color: #64748b;">The mobile phone specifications you are looking for do not exist or were removed.</p>
          <a href="/phones" class="btn btn-primary">Browse All Phones</a>
        </div>
      `;
      return;
    }

    renderPhoneDetail(json.data);
  } catch (err) {
    console.error('Error loading phone details:', err);
  }
}

function renderPhoneDetail(phone) {
  // Update Title & Badge
  document.getElementById('phoneDetailName').innerText = phone.name;
  document.getElementById('phoneDetailBrand').innerText = phone.brand_name;
  document.getElementById('phoneDetailBrand').href = `/brand/${phone.brand_slug}`;

  const statusBadge = document.getElementById('phoneDetailStatus');
  if (statusBadge) {
    statusBadge.innerText = phone.status || 'Available';
    statusBadge.className = `phone-card-badge badge-${(phone.status || 'available').toLowerCase()}`;
  }

  const releaseEl = document.getElementById('phoneDetailRelease');
  const releaseChip = document.getElementById('phoneDetailReleaseChip');
  if (releaseEl) {
    if (phone.release_date) {
      releaseEl.innerText = `Released: ${phone.release_date}`;
      if (releaseChip) releaseChip.style.display = 'inline-flex';
    } else {
      releaseEl.innerText = '';
      if (releaseChip) releaseChip.style.display = 'none';
    }
  }

  const priceEl = document.getElementById('phoneDetailPrice');
  if (priceEl) {
    priceEl.innerText = phone.price > 0 ? formatPKR(phone.price) : 'Rumored Price';
  }

  // Views & Total Reviews Meta Counts
  const viewsEl = document.getElementById('phoneViewsVal');
  if (viewsEl) {
    viewsEl.innerText = (phone.views || 0).toLocaleString();
  }
  const reviewsEl = document.getElementById('phoneReviewsVal');
  if (reviewsEl) {
    reviewsEl.innerText = (phone.review_count || 0).toLocaleString();
  }

  const descEl = document.getElementById('phoneDetailShortDesc');
  const overviewEl = document.getElementById('phoneDetailSummaryParagraph');
  const overviewTitle = document.getElementById('overviewHeadingTitle');
  const overviewCard = document.getElementById('phoneOverviewCard');
  const overviewWrap = document.getElementById('overviewContentWrap');
  const overviewToggleWrap = document.getElementById('overviewToggleWrap');
  const btnToggleOverview = document.getElementById('btnToggleOverview');
  const overviewToggleText = document.getElementById('overviewToggleText');
  const overviewToggleIcon = document.getElementById('overviewToggleIcon');

  const fullSummary = phone.short_description || `${phone.name} full mobile phone specifications and features.`;

  if (descEl) {
    const firstLine = fullSummary.split('\n')[0].trim();
    descEl.innerText = firstLine || `${phone.name} specifications and prices.`;
  }

  if (overviewEl) {
    const summaryText = (phone.short_description || '').trim();
    if (summaryText.length > 0) {
      overviewEl.innerText = summaryText;
      if (overviewTitle) overviewTitle.innerText = `${phone.name} — Device Overview & Key Highlights`;
      if (overviewCard) overviewCard.style.display = 'block';

      // Check if overview has substantial data to collapse
      requestAnimationFrame(() => {
        const textLen = summaryText.length;
        const lineCount = summaryText.split('\n').filter(Boolean).length;
        const scrollH = overviewWrap ? overviewWrap.scrollHeight : overviewEl.scrollHeight;

        if (textLen > 220 || lineCount > 3 || scrollH > 165) {
          if (overviewWrap) overviewWrap.classList.add('collapsed');
          if (overviewToggleWrap) overviewToggleWrap.style.display = 'flex';
          if (btnToggleOverview) btnToggleOverview.setAttribute('aria-expanded', 'false');
          if (overviewToggleText) overviewToggleText.textContent = 'Read More';
          if (overviewToggleIcon) overviewToggleIcon.innerHTML = '&darr;';
        } else {
          if (overviewWrap) overviewWrap.classList.remove('collapsed');
          if (overviewToggleWrap) overviewToggleWrap.style.display = 'none';
        }
      });
    } else {
      if (overviewCard) overviewCard.style.display = 'none';
    }
  }

  // Set main image
  const imgEl = document.getElementById('phoneDetailImage');
  if (imgEl) {
    imgEl.src = phone.image || '/images/placeholder.svg';
    imgEl.alt = phone.name;
  }

  // Render gallery strip if multiple images exist
  renderGalleryStrip(phone.images || [], phone.image);

  // Add to Compare Button
  const compareBtn = document.getElementById('btnAddToCompare');
  if (compareBtn) {
    compareBtn.addEventListener('click', () => {
      CompareBasket.add(phone.slug);
      const basket = CompareBasket.get();
      if (basket.length >= 2) {
        window.location.href = `/compare?phones=${basket.join(',')}`;
      } else {
        alert(`"${phone.name}" added to comparison. Select one more phone to view comparison!`);
      }
    });
  }

  // Update Opinions Tab Count
  const tabReviewsCount = document.getElementById('tabReviewsCount');
  if (tabReviewsCount) {
    tabReviewsCount.innerText = (phone.review_count || 0).toLocaleString();
  }

  // Render Multi-Country Price Table
  renderPricesTable(phone.prices, phone.price);

  // Render External Store Deals & Affiliate Purchase Links (Where to Buy)
  renderAffiliateDeals(phone.affiliate_links, phone.name);

  // Render Video Review & Unboxing (YouTube Responsive Player)
  renderVideoReview(phone.video_url, phone.name);

  // Render Specification Sections
  renderSpecsTable(phone.specs);

  // Render GSMArena Sidebar Widgets
  renderSidebarBrands();
  renderSidebarPrices(phone);
  renderSidebarPta(phone);
  renderSidebarNews(phone.related_news, phone.name, phone.brand_name);
  renderSidebarReviews(phone);
  renderSidebarRelatedDevices(phone.related_phones, phone.brand_slug);
  renderSidebarPopularBrand(phone.popular_brand_phones, phone.brand_name, phone.brand_slug);
}

// ─────────────────────────────────────────────────────────────────────────────
// GSMArena Sidebar Widgets Renderers
// ─────────────────────────────────────────────────────────────────────────────

let _cachedBrands = null;
async function renderSidebarBrands() {
  const advContainer = document.getElementById('detailBrandsList');
  const oldContainer = document.getElementById('sidebarBrandsGrid');
  const countBadge = document.getElementById('detailBrandBadgeCount');

  try {
    if (!_cachedBrands) {
      const res = await fetch('/api/brands?active=true');
      const json = await res.json();
      if (json.success && json.data) {
        _cachedBrands = json.data;
      }
    }

    if (_cachedBrands && _cachedBrands.length > 0) {
      if (countBadge) {
        countBadge.textContent = `${_cachedBrands.length} Brands`;
      }

      if (advContainer) {
        advContainer.innerHTML = _cachedBrands.map(b => {
          const count = parseInt(b.phone_count, 10) || 0;
          return `
            <label class="adv-brand-item" data-brand="${b.name.toLowerCase()}" title="${b.name} (${count} phones)">
              <div class="adv-brand-left">
                <input type="checkbox" name="detailAdvBrand" value="${b.slug}" class="adv-brand-checkbox">
                <span class="adv-brand-name">${b.name}</span>
              </div>
              <span class="adv-brand-count">${count}</span>
            </label>
          `;
        }).join('');
      }

      if (oldContainer) {
        oldContainer.innerHTML = _cachedBrands.slice(0, 18).map(b => `
          <a href="/brand/${b.slug}" class="gsm-brand-item" title="${b.name}">
            ${b.name.toUpperCase()}
          </a>
        `).join('');
      }

      initDetailAdvFilterListeners();
    }
  } catch (err) {
    console.warn('Could not load dynamic brands for sidebar:', err);
  }
}

let _detailFiltersInitialized = false;
function initDetailAdvFilterListeners() {
  if (_detailFiltersInitialized) return;
  _detailFiltersInitialized = true;

  // Brand Search
  const brandSearchInput = document.getElementById('detailBrandSearchInput');
  if (brandSearchInput) {
    brandSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const items = document.querySelectorAll('#detailBrandsList .adv-brand-item');
      items.forEach(item => {
        const name = item.dataset.brand || '';
        item.style.display = name.includes(q) ? 'flex' : 'none';
      });
    });
  }

  // Price inputs & chips
  const minPriceInput = document.getElementById('detailMinPrice');
  const maxPriceInput = document.getElementById('detailMaxPrice');
  const priceChips = document.querySelectorAll('#detailPriceChips .adv-chip');

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
    });
  });

  // RAM Chips
  const ramChips = document.querySelectorAll('#detailRamChips .adv-chip');
  let selectedRam = '';
  ramChips.forEach(chip => {
    chip.addEventListener('click', () => {
      ramChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedRam = chip.dataset.val || '';
    });
  });

  // Storage Chips
  const storageChips = document.querySelectorAll('#detailStorageChips .adv-chip');
  let selectedStorage = '';
  storageChips.forEach(chip => {
    chip.addEventListener('click', () => {
      storageChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      selectedStorage = chip.dataset.val || '';
    });
  });

  // Reset Button
  const btnReset = document.getElementById('btnResetDetailFilters');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      document.querySelectorAll('#detailBrandsList input[type="checkbox"]').forEach(cb => cb.checked = false);
      if (brandSearchInput) {
        brandSearchInput.value = '';
        brandSearchInput.dispatchEvent(new Event('input'));
      }
      if (minPriceInput) minPriceInput.value = '';
      if (maxPriceInput) maxPriceInput.value = '';
      priceChips.forEach(c => c.classList.remove('active'));
      ramChips.forEach(c => c.classList.toggle('active', c.dataset.val === ''));
      storageChips.forEach(c => c.classList.toggle('active', c.dataset.val === ''));
      selectedRam = '';
      selectedStorage = '';
      const toggle5G = document.getElementById('detail5GToggle');
      if (toggle5G) toggle5G.checked = false;
    });
  }

  // Apply Button
  const btnApply = document.getElementById('btnApplyDetailFilters');
  if (btnApply) {
    btnApply.addEventListener('click', () => {
      const checkedBrands = Array.from(document.querySelectorAll('#detailBrandsList input[name="detailAdvBrand"]:checked')).map(cb => cb.value);
      const minP = minPriceInput ? minPriceInput.value.trim() : '';
      const maxP = maxPriceInput ? maxPriceInput.value.trim() : '';
      const is5G = document.getElementById('detail5GToggle')?.checked;

      const params = new URLSearchParams();
      checkedBrands.forEach(b => params.append('brand', b));
      if (minP) params.set('minPrice', minP);
      if (maxP) params.set('maxPrice', maxP);
      if (selectedRam) params.set('ram', selectedRam);
      if (selectedStorage) params.set('storage', selectedStorage);
      if (is5G) params.set('is5G', '1');

      window.location.href = `/phones?${params.toString()}`;
    });
  }
}

let _phoneCurrentPrice = 0;
function renderSidebarPrices(phone) {
  _phoneCurrentPrice = phone.price || 0;
  const pkrEl = document.getElementById('sidebarPricePKR');
  const usdEl = document.getElementById('sidebarPriceUSD');
  const eurEl = document.getElementById('sidebarPriceEUR');

  if (pkrEl) {
    pkrEl.textContent = phone.price > 0 ? formatPKR(phone.price) : 'Rumored';
  }
  if (usdEl) {
    const usd = phone.price > 0 ? Math.round(phone.price / 280) : 0;
    usdEl.textContent = usd > 0 ? `$${usd.toLocaleString()}` : '$—';
  }
  if (eurEl) {
    const eur = phone.price > 0 ? Math.round(phone.price / 300) : 0;
    eurEl.textContent = eur > 0 ? `€${eur.toLocaleString()}` : '€—';
  }

  // Populate variants if memory/storage info is available in specs
  const select = document.getElementById('sidebarVariantSelect');
  if (select && phone.specs && phone.specs['Memory']) {
    const internal = phone.specs['Memory'].find(s => s.key === 'Internal Storage' || s.key === 'Internal' || s.key === 'Storage');
    const ram = phone.specs['Memory'].find(s => s.key === 'RAM');

    const internalVal = internal ? internal.value : '';
    const ramVal = ram ? ram.value : '';

    if (internalVal || ramVal) {
      const parts = [];
      if (internalVal) parts.push(internalVal.split(',')[0].trim());
      if (ramVal) parts.push(ramVal.split(',')[0].trim() + ' RAM');
      const label = parts.join(' / ') || `${phone.name} Base`;

      select.innerHTML = `
        <option value="base">${label}</option>
        <option value="tier2">${phone.name} (Higher Tier)</option>
      `;
    }
  }
}

async function renderSidebarPta(phone) {
  const cnicEl = document.getElementById('sidebarPtaCNIC');
  const passportEl = document.getElementById('sidebarPtaPassport');
  const nonPtaEl = document.getElementById('sidebarPtaNonPta');
  const calcBtn = document.getElementById('sidebarPtaCalcBtn');
  const pillValEl = document.getElementById('phoneDetailPtaVal');
  const pillLinkEl = document.getElementById('phoneDetailPtaLink');

  const phoneName = phone.name || '';
  const pricePkr = phone.price || 0;
  const priceUsd = pricePkr > 0 ? Math.round(pricePkr / 280) : 0;

  const calcUrl = `/pta-tax-calculator?name=${encodeURIComponent(phoneName)}&price=${priceUsd}`;
  if (calcBtn) calcBtn.href = calcUrl;
  if (pillLinkEl) pillLinkEl.href = calcUrl;

  try {
    const res = await fetch(`/api/pta-tax/calculate?name=${encodeURIComponent(phoneName)}&price=${priceUsd}`);
    const data = await res.json();
    if (data.success && data.tax) {
      const tax = data.tax;
      if (cnicEl) cnicEl.textContent = `Rs. ${tax.cnicTax.toLocaleString()}`;
      if (passportEl) passportEl.textContent = `Rs. ${tax.passportTax.toLocaleString()}`;
      if (pillValEl) pillValEl.textContent = `Rs. ${tax.cnicTax.toLocaleString()} (CNIC)`;

      if (nonPtaEl) {
        if (pricePkr > 0 && pricePkr > tax.cnicTax) {
          const nonPtaEst = Math.max(Math.round(pricePkr * 0.65), pricePkr - tax.cnicTax);
          nonPtaEl.textContent = `~Rs. ${nonPtaEst.toLocaleString()}`;
        } else if (priceUsd > 0) {
          const nonPtaEst = priceUsd * 280;
          nonPtaEl.textContent = `~Rs. ${nonPtaEst.toLocaleString()}`;
        } else {
          nonPtaEl.textContent = 'Contact Seller';
        }
      }
    } else {
      if (cnicEl) cnicEl.textContent = 'View Slabs';
      if (passportEl) passportEl.textContent = 'View Slabs';
      if (pillValEl) pillValEl.textContent = 'Check Slabs';
    }
  } catch (err) {
    console.warn('Could not calculate PTA tax for phone:', err);
    if (cnicEl) cnicEl.textContent = 'Check Details';
    if (passportEl) passportEl.textContent = 'Check Details';
    if (pillValEl) pillValEl.textContent = 'Check Details';
  }
}

window.toggleOverviewContent = function() {
  const wrapEl = document.getElementById('overviewContentWrap');
  const toggleBtn = document.getElementById('btnToggleOverview');
  const toggleText = document.getElementById('overviewToggleText');
  const toggleIcon = document.getElementById('overviewToggleIcon');
  if (!wrapEl) return;

  const isCollapsed = wrapEl.classList.contains('collapsed');
  if (isCollapsed) {
    wrapEl.classList.remove('collapsed');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
    if (toggleText) toggleText.textContent = 'Read Less';
    if (toggleIcon) toggleIcon.innerHTML = '&uarr;';
  } else {
    wrapEl.classList.add('collapsed');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
    if (toggleText) toggleText.textContent = 'Read More';
    if (toggleIcon) toggleIcon.innerHTML = '&darr;';

    const cardEl = document.getElementById('phoneOverviewCard');
    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      if (rect.top < 70) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
};

function handleSidebarVariantChange(val) {
  const pkrEl = document.getElementById('sidebarPricePKR');
  const usdEl = document.getElementById('sidebarPriceUSD');
  const eurEl = document.getElementById('sidebarPriceEUR');

  let multiplier = val === 'tier2' ? 1.15 : 1.0;
  const pkr = Math.round(_phoneCurrentPrice * multiplier);
  const usd = Math.round(pkr / 280);
  const eur = Math.round(pkr / 300);

  if (pkrEl) pkrEl.textContent = pkr > 0 ? formatPKR(pkr) : 'Rumored';
  if (usdEl) usdEl.textContent = usd > 0 ? `$${usd.toLocaleString()}` : '$—';
  if (eurEl) eurEl.textContent = eur > 0 ? `€${eur.toLocaleString()}` : '€—';
}

function renderSidebarNews(newsList, phoneName, brandName) {
  const titleEl = document.getElementById('sidebarNewsTitle');
  const listEl = document.getElementById('sidebarNewsList');
  if (!listEl) return;

  if (titleEl && phoneName) {
    titleEl.textContent = `${phoneName.split(' ')[0]} in the News`;
  }

  if (!newsList || newsList.length === 0) {
    listEl.innerHTML = `<div style="padding:14px;text-align:center;color:#94a3b8;font-size:12px;">No articles currently tagged for this phone.</div>`;
    return;
  }

  listEl.innerHTML = newsList.slice(0, 4).map(art => {
    const imgUrl = art.image || '/images/news/news-1.webp';
    const dateStr = art.created_at ? new Date(art.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    return `
      <a href="/news/${art.slug}" class="gsm-news-item">
        <img src="${imgUrl}" alt="${escapeAttr(art.title)}" class="gsm-news-thumb" width="80" height="50" loading="lazy" decoding="async" onerror="this.src='/images/placeholder.svg'">
        <div class="gsm-news-info">
          <div class="gsm-news-title">${art.title}</div>
          <div class="gsm-news-meta">
            <span>${ICONS.calendar} ${dateStr}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function renderSidebarReviews(phone) {
  const titleEl = document.getElementById('sidebarReviewCardTitle');
  const imgEl = document.getElementById('sidebarReviewImg');

  if (titleEl) {
    titleEl.textContent = `${phone.name} Review`;
  }
  if (imgEl && phone.image) {
    imgEl.src = phone.image;
    imgEl.alt = `${phone.name} Review`;
  }
}

function renderSidebarRelatedDevices(phones, brandSlug) {
  const grid = document.getElementById('sidebarRelatedGrid');
  const moreBtn = document.getElementById('sidebarMoreRelatedBtn');
  if (!grid) return;

  if (moreBtn && brandSlug) {
    moreBtn.href = `/brand/${brandSlug}`;
  }

  if (!phones || phones.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#94a3b8;font-size:12px;padding:12px;">No related devices found.</div>`;
    return;
  }

  grid.innerHTML = phones.slice(0, 6).map(p => `
    <a href="/phone/${p.slug}" class="gsm-device-item" title="${p.name}">
      <img src="${p.image || '/images/placeholder.svg'}" alt="${p.name}" class="gsm-device-thumb" width="54" height="72" loading="lazy" decoding="async" onerror="this.src='/images/placeholder.svg'">
      <span class="gsm-device-name">${p.name}</span>
    </a>
  `).join('');
}

function renderSidebarPopularBrand(phones, brandName, brandSlug) {
  const titleEl = document.getElementById('sidebarPopularBrandTitle');
  const grid = document.getElementById('sidebarPopularGrid');
  const moreBtn = document.getElementById('sidebarMoreBrandBtn');

  if (titleEl && brandName) {
    titleEl.textContent = `Popular from ${brandName}`;
  }
  if (moreBtn && brandSlug) {
    moreBtn.href = `/brand/${brandSlug}`;
    moreBtn.textContent = `More From ${brandName} »`;
  }
  if (!grid) return;

  if (!phones || phones.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#94a3b8;font-size:12px;padding:12px;">No devices found.</div>`;
    return;
  }

  grid.innerHTML = phones.slice(0, 6).map(p => `
    <a href="/phone/${p.slug}" class="gsm-device-item" title="${p.name}">
      <img src="${p.image || '/images/placeholder.svg'}" alt="${p.name}" class="gsm-device-thumb" width="54" height="72" loading="lazy" decoding="async" onerror="this.src='/images/placeholder.svg'">
      <span class="gsm-device-name">${p.name}</span>
    </a>
  `).join('');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Gallery Strip
let _galleryImages = [];
let _currentPreviewIndex = 0;

function selectPreviewImage(idx) {
  if (!_galleryImages || _galleryImages.length === 0) return;
  _currentPreviewIndex = Math.max(0, Math.min(idx, _galleryImages.length - 1));

  const mainImg = document.getElementById('phoneDetailImage');
  if (mainImg && _galleryImages[_currentPreviewIndex]) {
    mainImg.src = _galleryImages[_currentPreviewIndex];
  }

  // Update active thumbnail border
  const thumbs = document.querySelectorAll('.phone-thumb-item');
  thumbs.forEach((t, i) => {
    if (i === _currentPreviewIndex) {
      t.classList.add('active');
    } else {
      t.classList.remove('active');
    }
  });
}

function openCurrentInGallery() {
  openGallery(_currentPreviewIndex);
}

function renderGalleryStrip(images, primaryImage) {
  // Build deduped list with primary first
  const allImages = primaryImage
    ? [primaryImage, ...(images || []).filter(u => u && u !== primaryImage)]
    : (images || []);

  _galleryImages = allImages.filter(Boolean);
  _currentPreviewIndex = 0;

  const strip = document.getElementById('phoneGalleryStrip');
  const countBadge = document.getElementById('btnGalleryCountBadge');
  const countText = document.getElementById('galleryCountText');

  if (_galleryImages.length <= 1) {
    if (strip) strip.style.display = 'none';
    if (countBadge) countBadge.style.display = 'none';
    return;
  }

  if (countBadge && countText) {
    countText.textContent = `${_galleryImages.length} Photos`;
    countBadge.style.display = 'inline-flex';
  }

  if (!strip) return;
  strip.style.display = 'flex';
  strip.innerHTML = _galleryImages.map((src, idx) => {
    const isActive = idx === 0;
    return `
      <div
        class="phone-thumb-item ${isActive ? 'active' : ''}"
        onclick="selectPreviewImage(${idx})"
        ondblclick="openGallery(${idx})"
        title="Click to preview photo ${idx + 1}"
      >
        <img src="${src}" alt="Photo ${idx + 1}" loading="lazy" onerror="this.parentElement.style.display='none'">
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────────────────────────────────────

let _lbIndex = 0;

function openGallery(index = 0) {
  if (_galleryImages.length === 0) return;
  _lbIndex = Math.max(0, Math.min(index, _galleryImages.length - 1));
  const lb = document.getElementById('galleryLightbox');
  if (!lb) return;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  _updateLightbox();
}

function closeLightbox() {
  const lb = document.getElementById('galleryLightbox');
  if (lb) lb.style.display = 'none';
  document.body.style.overflow = '';
}

function lightboxNav(dir) {
  _lbIndex = (_lbIndex + dir + _galleryImages.length) % _galleryImages.length;
  _updateLightbox();
}

function _updateLightbox() {
  const img     = document.getElementById('lbImage');
  const counter = document.getElementById('lbCounter');
  const thumbs  = document.getElementById('lbThumbs');
  const prev    = document.getElementById('lbPrev');
  const next    = document.getElementById('lbNext');

  if (img) img.src = _galleryImages[_lbIndex] || '';
  if (counter) counter.textContent = `Photo ${_lbIndex + 1} of ${_galleryImages.length}`;

  const showNav = _galleryImages.length > 1;
  if (prev) prev.style.display = showNav ? 'flex' : 'none';
  if (next) next.style.display = showNav ? 'flex' : 'none';

  if (thumbs) {
    thumbs.innerHTML = _galleryImages.map((src, idx) => `
      <div onclick="openGallery(${idx})" style="width:52px; height:60px; border-radius:6px; overflow:hidden; border:2px solid ${idx === _lbIndex ? '#0d9488' : 'rgba(255,255,255,0.2)'}; padding:2px; background:#1e293b; cursor:pointer; opacity:${idx === _lbIndex ? '1' : '0.55'}; transition:all .15s ease;">
        <img src="${src}" loading="lazy" alt="Thumb ${idx + 1}" style="width:100%; height:100%; object-fit:contain;" onerror="this.parentElement.style.display='none'">
      </div>
    `).join('');
  }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('galleryLightbox');
  if (!lb || lb.style.display === 'none') return;
  if (e.key === 'ArrowLeft')  lightboxNav(-1);
  else if (e.key === 'ArrowRight') lightboxNav(1);
  else if (e.key === 'Escape') closeLightbox();
});

// Click backdrop to close
document.addEventListener('DOMContentLoaded', () => {
  const lb = document.getElementById('galleryLightbox');
  if (lb) {
    lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Price Table
// ─────────────────────────────────────────────────────────────────────────────

function renderPricesTable(prices = [], defaultPrice = 0) {
  const container = document.getElementById('phonePricesContainer');
  if (!container) return;

  if (!prices || prices.length === 0) {
    container.innerHTML = `
      <tr>
        <td><strong>Pakistan</strong></td>
        <td>PKR</td>
        <td><strong>${formatPKR(defaultPrice)}</strong></td>
      </tr>`;
    return;
  }

  container.innerHTML = prices.map(pr => `
    <tr>
      <td><strong>${pr.country}</strong></td>
      <td><span style="color:#64748b;font-weight:600;">${pr.currency}</span></td>
      <td><strong style="color:#0d9488;">${pr.amount}</strong></td>
    </tr>`).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// External Store Deals & Affiliate Purchase Links (Where to Buy)
// ─────────────────────────────────────────────────────────────────────────────

function getStoreMeta(storeName = '') {
  const s = (storeName || '').trim().toLowerCase();
  if (s.includes('amazon')) {
    return {
      name: 'Amazon',
      badgeBg: '#fff7ed',
      badgeColor: '#c2410c',
      badgeBorder: '#fed7aa',
      btnBg: '#ff9900',
      btnText: '#111827',
      tag: 'Global Delivery'
    };
  }
  if (s.includes('daraz')) {
    return {
      name: 'Daraz',
      badgeBg: '#fff1f2',
      badgeColor: '#e11d48',
      badgeBorder: '#fecdd3',
      btnBg: '#f85606',
      btnText: '#ffffff',
      tag: 'Pakistan Store'
    };
  }
  if (s.includes('priceoye') || s.includes('price oye')) {
    return {
      name: 'PriceOye',
      badgeBg: '#eff6ff',
      badgeColor: '#1d4ed8',
      badgeBorder: '#bfdbfe',
      btnBg: '#0077c5',
      btnText: '#ffffff',
      tag: 'Official Warranty'
    };
  }
  if (s.includes('aliexpress') || s.includes('ali express')) {
    return {
      name: 'AliExpress',
      badgeBg: '#fef2f2',
      badgeColor: '#b91c1c',
      badgeBorder: '#fecaca',
      btnBg: '#e62e04',
      btnText: '#ffffff',
      tag: 'Global Shipping'
    };
  }
  if (s.includes('telemart')) {
    return {
      name: 'Telemart',
      badgeBg: '#f0f9ff',
      badgeColor: '#0369a1',
      badgeBorder: '#bae6fd',
      btnBg: '#0054a6',
      btnText: '#ffffff',
      tag: 'Fast Dispatch'
    };
  }
  if (s.includes('shophive')) {
    return {
      name: 'Shophive',
      badgeBg: '#f0fdf4',
      badgeColor: '#15803d',
      badgeBorder: '#bbf7d0',
      btnBg: '#16a34a',
      btnText: '#ffffff',
      tag: 'Original Stock'
    };
  }
  return {
    name: storeName || 'Online Store',
    badgeBg: '#f0fdfa',
    badgeColor: '#0f766e',
    badgeBorder: '#99f6e4',
    btnBg: '#0d9488',
    btnText: '#ffffff',
    tag: 'Verified Partner'
  };
}

function renderAffiliateDeals(links = [], phoneName = '') {
  const section = document.getElementById('phoneAffiliateSection');
  const container = document.getElementById('phoneAffiliateList');
  if (!section || !container) return;

  let affArray = links;
  if (typeof affArray === 'string') {
    try { affArray = JSON.parse(affArray); } catch (_) { affArray = []; }
  }

  if (!affArray || !Array.isArray(affArray) || affArray.length === 0) {
    section.style.display = 'none';
    return;
  }

  const validLinks = affArray.filter(l => l && l.store && (l.url || l.link));
  if (validLinks.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  container.innerHTML = validLinks.map((item, idx) => {
    const store = item.store || 'Store';
    const price = item.price && item.price.trim() ? item.price.trim() : 'View Live Price';
    let targetUrl = (item.url || item.link || '#').trim();
    if (targetUrl !== '#' && !/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    const meta = getStoreMeta(store);

    return `
      <div class="affiliate-deal-item" id="dealRow-${idx}">
        <div class="deal-store-info">
          <div class="deal-store-badge" style="background:${meta.badgeBg}; color:${meta.badgeColor}; border:1px solid ${meta.badgeBorder};">
            <span class="store-dot" style="background:${meta.badgeColor};"></span>
            <strong>${escapeHtml(store)}</strong>
          </div>
          <span class="deal-tag">${meta.tag}</span>
        </div>

        <div class="deal-price-col">
          <span class="deal-price-label">Store Price:</span>
          <span class="deal-price-val">${escapeHtml(price)}</span>
        </div>

        <div class="deal-action-col">
          <a href="${escapeAttr(targetUrl)}" target="_blank" rel="nofollow sponsored noopener" class="deal-buy-btn" style="background:${meta.btnBg}; color:${meta.btnText};">
            <span>Buy Now</span>
            <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          </a>
        </div>
      </div>
    `;
  }).join('');
}

// ─────────────────────────────────────────────────────────────────────────────
// Video Review & Unboxing (YouTube Responsive Player)
// ─────────────────────────────────────────────────────────────────────────────

function extractYouTubeId(url) {
  if (!url || typeof url !== 'string') return null;
  let clean = url.trim();

  // If user pasted full <iframe> embed snippet, extract src attribute
  const srcMatch = clean.match(/src=["']([^"']+)["']/i);
  if (srcMatch) {
    clean = srcMatch[1];
  }

  // Direct 11-char video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;

  // Handle URL-encoded redirects
  if (clean.includes('%2F') || clean.includes('%3A') || clean.includes('%3D')) {
    try { clean = decodeURIComponent(clean); } catch (_) {}
  }

  // Comprehensive regex matching youtube.com, youtube-nocookie.com, youtu.be, /embed/, /shorts/, ?v=
  const match = clean.match(/(?:youtube(?:-nocookie)?\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

function renderVideoReview(videoUrl, phoneName = '') {
  const section = document.getElementById('phoneVideoSection');
  const iframe = document.getElementById('phoneDetailVideoIframe');
  const titleEl = document.getElementById('phoneVideoReviewTitle');
  if (!section || !iframe) return;

  if (!videoUrl || typeof videoUrl !== 'string' || !videoUrl.trim()) {
    section.style.display = 'none';
    iframe.src = '';
    return;
  }

  const videoId = extractYouTubeId(videoUrl);
  if (!videoId) {
    section.style.display = 'none';
    iframe.src = '';
    return;
  }

  if (titleEl && phoneName) {
    titleEl.textContent = `${phoneName} — Video Review & Unboxing`;
  }
  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  iframe.src = `https://www.youtube.com/embed/${videoId}?rel=0`;
  iframe.title = `${phoneName || 'Phone'} Video Review & Unboxing`;
  section.style.display = 'block';

  // Also make the "Review" quick-tab scroll to this video section if clicked
  const reviewTab = document.querySelector('.phone-quick-tabs a[href="#reviewsSection"]');
  if (reviewTab && !reviewTab.dataset.videoBound) {
    reviewTab.dataset.videoBound = 'true';
    reviewTab.addEventListener('click', (e) => {
      e.preventDefault();
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Specs Table
// ─────────────────────────────────────────────────────────────────────────────

function renderSpecsTable(specs = {}) {
  const container = document.getElementById('specsCardContainer');
  if (!container) return;

  const sectionOrder = [
    'Network','Launch','Body','Display','Platform','Memory',
    'Main Camera','Selfie Camera','Sound','Connectivity','Features','Battery','Price'
  ];

  const sections = Object.keys(specs);
  const sortedSections = [];
  for (const s of sectionOrder) { if (specs[s]) sortedSections.push(s); }
  for (const s of sections)     { if (!sortedSections.includes(s)) sortedSections.push(s); }

  const ad1El = document.getElementById('inSpecsAdSlot1');
  const ad1Html = (ad1El && ad1El.innerHTML.trim()) ? ad1El.innerHTML.trim() : '';

  const ad2El = document.getElementById('inSpecsAdSlot2');
  const ad2Html = (ad2El && ad2El.innerHTML.trim()) ? ad2El.innerHTML.trim() : '';

  let html = '';
  sortedSections.forEach((sectionName, idx) => {
    const fields = specs[sectionName] || [];
    html += `
      <div class="spec-section-card" id="spec-${sectionName.toLowerCase().replace(/\s+/g,'-')}">
        <div class="spec-section-title"><span>${sectionName}</span></div>
        <table class="spec-table"><tbody>
          ${fields.map(f => `
            <tr>
              <td class="spec-key">${f.key}</td>
              <td class="spec-val">${f.value}</td>
            </tr>`).join('')}
        </tbody></table>
      </div>`;

    // In-Specs Ad 1: Placed between spec blocks (e.g. after Display/Body)
    if ((idx === 3 || (sortedSections.length <= 5 && idx === 1)) && ad1Html) {
      html += `
        <div class="in-specs-ad-unit in-specs-ad-1" style="margin: 18px auto; max-width: 100%; text-align: center; overflow: hidden;">
          ${ad1Html}
        </div>`;
    }

    // In-Specs Ad 2: Placed between spec blocks (e.g. after Main/Selfie Camera)
    if (idx === 6 && sortedSections.length >= 7 && ad2Html) {
      html += `
        <div class="in-specs-ad-unit in-specs-ad-2" style="margin: 18px auto; max-width: 100%; text-align: center; overflow: hidden;">
          ${ad2Html}
        </div>`;
    }
  });

  container.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
// User Reviews & Star Ratings
// ─────────────────────────────────────────────────────────────────────────────

let currentPhoneSlug = '';

const starLabels = {
  1: '★ Terrible (1/5)',
  2: '★★ Poor (2/5)',
  3: '★★★ Average (3/5)',
  4: '★★★★ Good (4/5)',
  5: '★★★★★ Excellent (5/5)'
};

function updateStars(val) {
  const stars = document.querySelectorAll('#starPickerGroup .star-item');
  stars.forEach(s => {
    const sVal = parseInt(s.getAttribute('data-val'), 10);
    s.style.color = sVal <= val ? '#f59e0b' : '#cbd5e1';
  });
  const label = document.getElementById('starRatingLabel');
  if (label) label.textContent = starLabels[val] || `${val}/5`;
}

function initStarPicker() {
  const stars = document.querySelectorAll('#starPickerGroup .star-item');
  const ratingInput = document.getElementById('reviewRatingInput');
  if (!stars.length || !ratingInput) return;

  stars.forEach(s => {
    s.addEventListener('mouseenter', () => {
      const v = parseInt(s.getAttribute('data-val'), 10);
      updateStars(v);
    });
    s.addEventListener('click', () => {
      const v = parseInt(s.getAttribute('data-val'), 10);
      ratingInput.value = v;
      updateStars(v);
    });
  });

  const group = document.getElementById('starPickerGroup');
  if (group) {
    group.addEventListener('mouseleave', () => {
      const current = parseInt(ratingInput.value, 10) || 5;
      updateStars(current);
    });
  }
}

async function loadPhoneReviews(slug) {
  if (!slug) return;
  const listContainer = document.getElementById('phoneReviewsList');
  if (!listContainer) return;

  try {
    const res = await fetch(`/api/reviews/phone/${slug}`);
    const json = await res.json();

    if (json.success) {
      renderRatingStats(json.stats);
      renderReviewsList(json.reviews);
    }
  } catch (err) {
    console.error('Error loading phone reviews:', err);
    if (listContainer) {
      listContainer.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 20px;">Could not load reviews at this time.</div>`;
    }
  }
}

function renderRatingStats(stats) {
  if (!stats) return;

  const bigScore = document.getElementById('phoneRatingBigScore');
  const starsBig = document.getElementById('phoneRatingStarsBig');
  const totalCount = document.getElementById('phoneRatingTotalCount');
  const breakdownBox = document.getElementById('ratingBreakdownContainer');

  if (bigScore) bigScore.textContent = stats.average_rating;
  if (totalCount) totalCount.textContent = `Based on ${stats.total_reviews} ${stats.total_reviews === 1 ? 'review' : 'reviews'}`;

  // Big stars representation
  if (starsBig) {
    const num = Math.round(parseFloat(stats.average_rating) || 0);
    starsBig.textContent = '★'.repeat(num) + '☆'.repeat(5 - num);
  }

  // Breakdown Bars
  if (breakdownBox) {
    let html = '';
    for (let star = 5; star >= 1; star--) {
      const count = stats.breakdown[star] || 0;
      const pct = stats.percentages[star] || 0;
      html += `
        <div style="display: flex; align-items: center; gap: 10px; font-size: 12.5px;">
          <span style="width: 44px; font-weight: 700; color: #475569; display: flex; align-items: center; gap: 2px;">
            ${star} <span style="color: #f59e0b; font-size: 14px;">★</span>
          </span>
          <div style="flex: 1; height: 9px; background: #f1f5f9; border-radius: 99px; overflow: hidden; position: relative;">
            <div style="width: ${pct}%; height: 100%; background: #f59e0b; border-radius: 99px; transition: width 0.4s ease;"></div>
          </div>
          <span style="width: 32px; text-align: right; color: #64748b; font-weight: 600;">${count}</span>
        </div>
      `;
    }
    breakdownBox.innerHTML = html;
  }
}

function renderReviewsList(reviews) {
  const listContainer = document.getElementById('phoneReviewsList');
  const countBadge = document.getElementById('userReviewsListCount');
  if (!listContainer) return;

  if (countBadge) countBadge.textContent = reviews ? reviews.length : 0;

  if (!reviews || reviews.length === 0) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
        <div style="font-size: 32px; margin-bottom: 8px; color: #0d9488;">${ICONS.penLine}</div>
        <h4 style="font-size: 15px; font-weight: 700; color: #0f172a; margin-bottom: 4px;">No reviews yet</h4>
        <p style="font-size: 13px; color: #64748b;">Have you used this phone? Be the first to share your rating and review!</p>
      </div>
    `;
    return;
  }

  const avatarColors = [
    { bg: '#f0fdfa', text: '#0d9488', border: '#99f6e4' },
    { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' },
    { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
    { bg: '#fdf4ff', text: '#c026d3', border: '#f5d0fe' },
    { bg: '#fefce8', text: '#ca8a04', border: '#fef08a' }
  ];

  listContainer.innerHTML = reviews.map((r, idx) => {
    const col = avatarColors[idx % avatarColors.length];
    const initial = (r.user_name || 'User').trim().charAt(0).toUpperCase();
    const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    }) : 'Recently';

    const stars = '★'.repeat(r.rating || 5) + '☆'.repeat(5 - (r.rating || 5));

    const webLink = r.user_website ? `
      <a href="${escapeHtml(r.user_website)}" target="_blank" rel="nofollow noopener" style="font-size: 12px; color: #0d9488; text-decoration: underline; margin-left: 8px;">
        ${ICONS.globe} Website
      </a>
    ` : '';

    // Render threaded replies
    const repliesHtml = (r.replies && r.replies.length > 0) ? r.replies.map((reply, rIdx) => {
      const replyCol = reply.is_admin 
        ? { bg: '#eff6ff', text: '#1d4ed8', border: '#93c5fd' }
        : avatarColors[(idx + rIdx + 1) % avatarColors.length];
      const replyInitial = (reply.user_name || 'U').trim().charAt(0).toUpperCase();
      const replyDate = reply.created_at ? new Date(reply.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      }) : 'Recently';
      const adminBadge = reply.is_admin ? `
        <span style="background: #1d4ed8; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-left: 4px;">
          ✦ ADMIN
        </span>` : '';
      const replyWebLink = reply.user_website ? `
        <a href="${escapeHtml(reply.user_website)}" target="_blank" rel="nofollow noopener" style="font-size: 11px; color: #0d9488; text-decoration: underline; margin-left: 6px;">${ICONS.globe}</a>
      ` : '';

      return `
        <div class="thread-reply-item ${reply.is_admin ? 'is-admin-reply' : ''}">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <div style="width: 28px; height: 28px; border-radius: 50%; background: ${replyCol.bg}; border: 1px solid ${replyCol.border}; color: ${replyCol.text}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 11.5px;">
              ${replyInitial}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                <span style="font-weight: 700; color: #0f172a; font-size: 13px;">${escapeHtml(reply.user_name)}</span>
                ${adminBadge}
                ${replyWebLink}
              </div>
              <div style="color: #94a3b8; font-size: 11px; margin-top: 1px;">${replyDate}</div>
            </div>
          </div>
          <div class="reply-message-body" style="font-size: 13.5px; line-height: 1.65; color: #334155; margin: 0;">${formatCommentMessage(reply.message)}</div>
        </div>
      `;
    }).join('') : '';

    const replyCount = r.replies ? r.replies.length : 0;

    return `
      <div class="review-thread-item" id="review-${r.id}">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; border-radius: 50%; background: ${col.bg}; border: 1px solid ${col.border}; color: ${col.text}; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 15px;">
              ${initial}
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-weight: 700; color: #0f172a; font-size: 14.5px;">${escapeHtml(r.user_name)}</span>
                <span style="background: #dcfce7; color: #15803d; font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 4px;">Verified</span>
                ${webLink}
              </div>
              <div style="color: #64748b; font-size: 12px; margin-top: 2px;">Reviewed on ${dateStr}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 6px; background: #fffbeb; border: 1px solid #fef3c7; padding: 4px 10px; border-radius: 6px;">
            <span style="color: #f59e0b; font-size: 15px; letter-spacing: 1px;">${stars}</span>
            <strong style="font-size: 12.5px; color: #92400e;">${r.rating}/5</strong>
          </div>
        </div>
        <div class="review-message-body" style="font-size: 14px; line-height: 1.7; color: #334155; margin: 0 0 10px 0;">
          ${formatCommentMessage(r.message)}
        </div>

        <!-- Reply Button & Count -->
        <div style="display: flex; align-items: center; gap: 14px; margin-top: 4px;">
          <button onclick="toggleReplyForm(${r.id})" style="background: none; border: none; color: #0d9488; font-size: 13px; font-weight: 700; cursor: pointer; padding: 4px 0; display: flex; align-items: center; gap: 5px; transition: color 0.15s;">
            ${ICONS.reply} Reply
          </button>
          ${replyCount > 0 ? `<span style="font-size: 12px; color: #64748b; font-weight: 600;">${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}</span>` : ''}
        </div>

        <!-- Inline Reply Form (hidden by default) -->
        <div id="replyForm-${r.id}" class="inline-reply-box" style="display: none;">
          <h4 style="font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">
            Reply to ${escapeHtml(r.user_name)}
          </h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 10px;">
            <input type="text" id="replyName-${r.id}" placeholder="Your Name *" required style="padding: 8px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%;">
            <input type="text" id="replyContact-${r.id}" placeholder="Email or Phone *" required style="padding: 8px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%;">
            <input type="text" id="replyWebsite-${r.id}" placeholder="Website (optional)" style="padding: 8px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 6px; width: 100%;">
          </div>
          <!-- Quick formatting toolbar for reply -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <span style="font-size: 12px; font-weight: 600; color: #64748b;">Your Reply Message</span>
            <div style="display: flex; gap: 4px;">
              <button type="button" onclick="insertReplyFormat(${r.id}, 'b')" style="padding: 2px 7px; font-size: 11px; font-weight: bold; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;" title="Bold">B</button>
              <button type="button" onclick="insertReplyFormat(${r.id}, 'i')" style="padding: 2px 7px; font-size: 11px; font-style: italic; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;" title="Italic">I</button>
              <button type="button" onclick="insertReplyLink(${r.id})" style="padding: 2px 7px; font-size: 11px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;" title="Insert Link">${ICONS.link} Link</button>
              <button type="button" onclick="insertReplyImage(${r.id})" style="padding: 2px 7px; font-size: 11px; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; cursor: pointer;" title="Insert Image">${ICONS.camera} Add Photo</button>
              <input type="file" id="replyImgFile-${r.id}" accept="image/*" style="display: none;" onchange="handleReplyImageFile(${r.id}, this)">
            </div>
          </div>
          <textarea id="replyMessage-${r.id}" rows="3" placeholder="Write your reply (photos & links supported)..." required style="width: 100%; padding: 10px 12px; font-size: 13px; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 10px; line-height: 1.5;"></textarea>
          <div id="replyAlert-${r.id}" style="display: none; padding: 8px 12px; border-radius: 6px; margin-bottom: 10px; font-size: 12.5px; font-weight: 600;"></div>
          <div style="display: flex; gap: 8px;">
            <button onclick="submitPublicReply(${r.id})" id="replyBtn-${r.id}" class="btn btn-primary" style="padding: 7px 18px; font-size: 13px; font-weight: 700;">
              Post Reply
            </button>
            <button onclick="toggleReplyForm(${r.id})" class="btn btn-outline" style="padding: 7px 14px; font-size: 13px;">
              Cancel
            </button>
          </div>
        </div>

        <!-- Threaded Replies -->
        ${repliesHtml}
      </div>
    `;
  }).join('');
}

async function handleReviewSubmit(e) {
  e.preventDefault();
  const alertBox = document.getElementById('reviewAlertBox');
  const submitBtn = document.getElementById('btnSubmitReview');

  const name = document.getElementById('reviewUserName').value.trim();
  const contact = document.getElementById('reviewUserContact').value.trim();
  const website = document.getElementById('reviewUserWebsite').value.trim();
  const rating = document.getElementById('reviewRatingInput').value;

  let message = '';
  if (quillPhoneReview) {
    message = quillPhoneReview.root.innerHTML.trim();
    const textOnly = quillPhoneReview.getText().trim();
    if (!textOnly && !message.includes('<img')) {
      message = '';
    }
  } else {
    const msgEl = document.getElementById('reviewMessage');
    message = msgEl ? msgEl.value.trim() : '';
  }

  if (!name || !contact || !message) {
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.style.background = '#fee2e2';
      alertBox.style.color = '#991b1b';
      alertBox.textContent = 'Please fill in all required fields (Name, Contact, and Review Message).';
    }
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Submitting...';

  try {
    const res = await fetch(`/api/reviews/phone/${currentPhoneSlug}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: name,
        user_email_phone: contact,
        user_website: website,
        rating: parseInt(rating, 10),
        message: message
      })
    });

    const json = await res.json();

    if (json.success) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#dcfce7';
        alertBox.style.color = '#166534';
        alertBox.innerHTML = ICONS.checkCircle + ' ' + (json.message || 'Thank you! Your review has been published.');
      }
      document.getElementById('phoneReviewForm').reset();
      if (quillPhoneReview) quillPhoneReview.setContents([]);
      updateStars(5);
      document.getElementById('reviewRatingInput').value = '5';
      loadPhoneReviews(currentPhoneSlug);
      setTimeout(() => {
        if (alertBox) alertBox.style.display = 'none';
      }, 5000);
    } else {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fee2e2';
        alertBox.style.color = '#991b1b';
        alertBox.textContent = 'Submission failed: ' + (json.message || 'Please try again.');
      }
    }
  } catch (err) {
    console.error('Error submitting review:', err);
    if (alertBox) {
      alertBox.style.display = 'block';
      alertBox.style.background = '#fee2e2';
      alertBox.style.color = '#991b1b';
      alertBox.textContent = 'Network error while submitting review. Please try again.';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = ICONS.rocket + ' Submit Review';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public Reply (User-to-User Threaded Replies)
// ─────────────────────────────────────────────────────────────────────────────

function toggleReplyForm(reviewId) {
  const form = document.getElementById(`replyForm-${reviewId}`);
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function submitPublicReply(parentId) {
  const nameEl = document.getElementById(`replyName-${parentId}`);
  const contactEl = document.getElementById(`replyContact-${parentId}`);
  const websiteEl = document.getElementById(`replyWebsite-${parentId}`);
  const messageEl = document.getElementById(`replyMessage-${parentId}`);
  const alertEl = document.getElementById(`replyAlert-${parentId}`);
  const btnEl = document.getElementById(`replyBtn-${parentId}`);

  if (!nameEl || !contactEl || !messageEl) return;

  const name = nameEl.value.trim();
  const contact = contactEl.value.trim();
  const website = websiteEl ? websiteEl.value.trim() : '';
  const message = messageEl.value.trim();

  if (!name || name.length < 2) {
    showReplyAlert(alertEl, 'Please enter your name (at least 2 characters).', 'error');
    return;
  }
  if (!contact || contact.length < 3) {
    showReplyAlert(alertEl, 'Please enter your email or phone number.', 'error');
    return;
  }
  if (!message || message.length < 2) {
    showReplyAlert(alertEl, 'Please write your reply message.', 'error');
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Posting...'; }

  try {
    const res = await fetch(`/api/reviews/reply/${parentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_name: name,
        user_email_phone: contact,
        user_website: website,
        message: message
      })
    });

    const json = await res.json();

    if (json.success) {
      showReplyAlert(alertEl, ICONS.checkCircle + ' Reply posted successfully!', 'success');
      nameEl.value = '';
      contactEl.value = '';
      if (websiteEl) websiteEl.value = '';
      messageEl.value = '';
      // Refresh the reviews list to show the new reply
      loadPhoneReviews(currentPhoneSlug);
      setTimeout(() => {
        const form = document.getElementById(`replyForm-${parentId}`);
        if (form) form.style.display = 'none';
      }, 1500);
    } else {
      showReplyAlert(alertEl, json.message || 'Failed to post reply. Please try again.', 'error');
    }
  } catch (err) {
    console.error('Error submitting reply:', err);
    showReplyAlert(alertEl, 'Network error. Please check your connection and try again.', 'error');
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Post Reply'; }
  }
}

function showReplyAlert(el, msg, type) {
  if (!el) return;
  el.style.display = 'block';
  el.innerHTML = msg;
  el.style.background = type === 'error' ? '#fee2e2' : '#dcfce7';
  el.style.color = type === 'error' ? '#991b1b' : '#166534';
  if (type === 'success') {
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Related Phones
// ─────────────────────────────────────────────────────────────────────────────

function renderRelatedPhones(phones = [], brandName = '') {
  const container = document.getElementById('relatedPhonesGrid');
  if (!container) return;

  if (!phones || phones.length === 0) {
    if (container.parentElement) container.parentElement.style.display = 'none';
    return;
  }

  container.innerHTML = phones.map(p => `
    <div class="phone-card">
      <div class="phone-card-image-wrap" style="min-height:150px;padding:12px;">
        <a href="/phone/${p.slug}">
          <img src="${p.image || '/images/placeholder.svg'}" alt="${p.name}"
               width="120" height="120" style="max-height:120px;" loading="lazy" decoding="async">
        </a>
      </div>
      <div class="phone-card-body" style="padding:12px;">
        <a href="/phone/${p.slug}">
          <h4 style="font-size:14px;font-weight:700;margin-bottom:4px;color:#0f172a;">${p.name}</h4>
        </a>
        <div style="color:#0d9488;font-weight:700;font-size:14px;">
          ${p.price > 0 ? formatPKR(p.price) : 'Rumored'}
        </div>
      </div>
    </div>`).join('');
}

// Helper: Escape HTML strings
function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Quill Review Editor Setup & Reply Format Helpers
// ─────────────────────────────────────────────────────────────────────────────

let quillPhoneReview = null;

function initReviewQuill() {
  const container = document.getElementById('reviewQuillEditor');
  if (!container || typeof Quill === 'undefined') return;

  quillPhoneReview = new Quill('#reviewQuillEditor', {
    theme: 'snow',
    placeholder: 'Write your honest review on battery life, camera, gaming, and real-world performance... (Photos & links supported)',
    modules: {
      toolbar: [
        ['bold', 'italic', 'underline'],
        ['link', 'image'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        ['clean']
      ]
    }
  });

  const toolbar = quillPhoneReview.getModule('toolbar');
  toolbar.addHandler('image', () => {
    const choice = confirm('Click OK to upload an image from your device, or Cancel to enter an image URL.');
    if (choice) {
      const fileInput = document.getElementById('reviewImgInput');
      if (fileInput) fileInput.click();
    } else {
      const url = prompt('Enter image URL (https://...):');
      if (url && url.trim()) {
        const range = quillPhoneReview.getSelection(true) || { index: quillPhoneReview.getLength() };
        quillPhoneReview.insertEmbed(range.index, 'image', url.trim());
        quillPhoneReview.setSelection(range.index + 1);
      }
    }
  });

  const fileInput = document.getElementById('reviewImgInput');
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      fileInput.value = '';

      const fd = new FormData();
      fd.append('image', file);

      try {
        const res = await fetch('/api/reviews/upload-image', {
          method: 'POST',
          body: fd
        });
        const json = await res.json();
        if (json.success && json.url) {
          const range = quillPhoneReview.getSelection(true) || { index: quillPhoneReview.getLength() };
          quillPhoneReview.insertEmbed(range.index, 'image', json.url);
          quillPhoneReview.setSelection(range.index + 1);
        } else {
          alert('Upload failed: ' + (json.message || 'Error uploading image'));
        }
      } catch (err) {
        console.error('Upload error:', err);
        alert('Network error while uploading image');
      }
    });
  }
}

function insertReplyFormat(parentId, tag) {
  const txt = document.getElementById(`replyMessage-${parentId}`);
  if (!txt) return;
  const start = txt.selectionStart;
  const end = txt.selectionEnd;
  const val = txt.value;
  const selected = val.substring(start, end) || 'text';
  txt.value = val.substring(0, start) + `<${tag}>${selected}</${tag}>` + val.substring(end);
  txt.focus();
}

function insertReplyLink(parentId) {
  const txt = document.getElementById(`replyMessage-${parentId}`);
  if (!txt) return;
  const url = prompt('Enter URL (https://...):', 'https://');
  if (!url || !url.trim() || url === 'https://') return;
  const label = prompt('Enter link text:', 'click here') || url;
  const tag = `<a href="${url.trim()}" target="_blank">${label}</a>`;
  const start = txt.selectionStart;
  const val = txt.value;
  txt.value = val.substring(0, start) + tag + val.substring(txt.selectionEnd);
  txt.focus();
}

function insertReplyImage(parentId) {
  const choice = confirm('Click OK to upload an image from your device, or Cancel to enter an image URL.');
  if (choice) {
    const fileInput = document.getElementById(`replyImgFile-${parentId}`);
    if (fileInput) fileInput.click();
  } else {
    const url = prompt('Enter image URL:');
    if (url && url.trim()) {
      const txt = document.getElementById(`replyMessage-${parentId}`);
      if (txt) {
        txt.value += `\n<img src="${url.trim()}">\n`;
        txt.focus();
      }
    }
  }
}

async function handleReplyImageFile(parentId, input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const fd = new FormData();
  fd.append('image', file);

  try {
    const res = await fetch('/api/reviews/upload-image', {
      method: 'POST',
      body: fd
    });
    const json = await res.json();
    if (json.success && json.url) {
      const txt = document.getElementById(`replyMessage-${parentId}`);
      if (txt) {
        txt.value += `\n<img src="${json.url}">\n`;
        txt.focus();
      }
    } else {
      alert('Upload failed: ' + (json.message || 'Error uploading image'));
    }
  } catch (err) {
    console.error(err);
    alert('Network error while uploading image');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const pathParts = window.location.pathname.split('/');
  currentPhoneSlug = pathParts[pathParts.length - 1] || '';
  initPhoneDetail();
  initStarPicker();
  initReviewQuill();
  if (currentPhoneSlug) {
    loadPhoneReviews(currentPhoneSlug);
  }
});


