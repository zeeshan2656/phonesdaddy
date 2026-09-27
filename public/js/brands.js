// PhonesDaddy - Brands Listing & Single Brand Page Script

async function initBrandsPage() {
  const container = document.getElementById('brandsGridContainer');
  if (!container) return;

  try {
    const res = await fetch('/api/brands?active=true');
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No brands found</div>`;
      return;
    }

    container.innerHTML = json.data.map(b => `
      <a href="/brand/${b.slug}" class="brand-card">
        <img src="${b.logo || '/images/brands/' + b.slug + '-logo.svg'}" alt="${b.name}" class="brand-card-logo" width="80" height="40" loading="lazy" decoding="async" onerror="this.src='/images/placeholder.svg'">
        <div class="brand-card-name">${b.name}</div>
        <div class="brand-card-count">${b.phone_count} models</div>
      </a>
    `).join('');
  } catch (err) {
    console.error('Error loading brands:', err);
  }
}

function renderBrandData(brand, phonesGrid) {
  if (!brand || !phonesGrid) return;

  // Populate Brand Header
  const nameEl = document.getElementById('brandPageName');
  if (nameEl) nameEl.innerText = brand.name;

  const descEl = document.getElementById('brandPageDesc');
  if (descEl) descEl.innerText = brand.description || `Browse the latest ${brand.name} smartphones with prices in Pakistan and technical specifications.`;

  const countEl = document.getElementById('brandPagePhoneCount');
  const phonesList = brand.phones || [];
  if (countEl) countEl.innerText = `${phonesList.length} phones available`;

  const logoEl = document.getElementById('brandPageLogo');
  if (logoEl) {
    logoEl.src = brand.logo || `/images/brands/${brand.slug}-logo.svg`;
    logoEl.alt = brand.name;
  }

  // Render Phones Grid
  if (phonesList.length === 0) {
    phonesGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No phones currently listed for ${brand.name}.</div>`;
    return;
  }

  phonesGrid.innerHTML = phonesList.map(p => `
    <div class="phone-card" onclick="window.location.href='/phone/${p.slug}'">
      <div class="phone-card-image-wrap">
        <span class="phone-card-brand-badge">${escapeHtml(brand.name || '')}</span>
        <a href="/phone/${p.slug}" onclick="event.stopPropagation()">
          <img src="${p.image || '/images/placeholder.svg'}" alt="${escapeHtml(p.name)}" class="phone-card-image" loading="lazy" decoding="async" width="160" height="212">
        </a>
      </div>
      <div class="phone-card-body">
        <a href="/phone/${p.slug}" onclick="event.stopPropagation()">
          <h3 class="phone-card-title" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</h3>
        </a>
        <div class="phone-card-price">${p.price > 0 ? formatPKR(p.price) : 'Rumored Price'}</div>
      </div>
    </div>
  `).join('');
}

async function initSingleBrandPage() {
  const phonesGrid = document.getElementById('brandPhonesGrid');
  if (!phonesGrid) return;

  if (window.__INITIAL_BRAND__) {
    renderBrandData(window.__INITIAL_BRAND__, phonesGrid);
    return;
  }

  const pathParts = window.location.pathname.split('/');
  const brandSlug = pathParts[pathParts.length - 1];
  if (!brandSlug) return;

  try {
    const res = await fetch(`/api/brands/slug/${brandSlug}`);
    const json = await res.json();

    if (!json.success || !json.data) {
      document.getElementById('brandContentArea').innerHTML = `
        <div style="text-align: center; padding: 60px 20px;">
          <h2>Brand not found</h2>
          <a href="/brands" class="btn btn-primary" style="margin-top: 16px;">View All Brands</a>
        </div>
      `;
      return;
    }

    renderBrandData(json.data, phonesGrid);
  } catch (err) {
    console.error('Error loading brand phones:', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('brandsGridContainer')) {
    initBrandsPage();
  }
  if (document.getElementById('brandPhonesGrid')) {
    initSingleBrandPage();
  }
});
