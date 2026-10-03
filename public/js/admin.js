// PhonesDaddy - Comprehensive Admin Panel Script

// Standard specification sections
const STANDARD_SECTIONS = [
  'Network',
  'Launch',
  'Body',
  'Display',
  'Platform',
  'Memory',
  'Main Camera',
  'Selfie Camera',
  'Sound',
  'Connectivity',
  'Features',
  'Battery',
  'Price'
];

// Admin Phone Filters State
let adminPhoneFilters = {
  page: 1,
  limit: 25,
  search: '',
  brand: '',
  status: '',
  minPrice: '',
  maxPrice: '',
  sort: 'newest',
  featured: '',
  popular: ''
};

// Admin Brands Cache
let adminBrandsList = [];

// Helper: Debounce
function debounce(func, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// Helper: Auto-slugify text
function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
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

// Helper: Escape single quotes for inline onclick attributes
function escapeQuote(str) {
  if (!str) return '';
  return str.toString().replace(/'/g, "\\'");
}

// Helper: Extract YouTube video ID from various URL formats or full iframe embed code
function extractYouTubeVideoId(url) {
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

// Helper: Format rich comment/review message with image and link sanitization
function formatCommentMessage(content) {
  if (!content) return '';
  const str = content.toString().trim();

  // If pure plain text without HTML tags
  if (!/<[a-z][\s\S]*>/i.test(str)) {
    return escapeHtml(str).replace(/\n/g, '<br>');
  }

  // Sanitize HTML: remove script, iframe, object, embed, style, event handlers
  let clean = str
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/\s*on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');

  // Add responsive styling and lazy loading to images
  clean = clean.replace(/<img\s+([^>]*?)>/gi, (match, attrs) => {
    return `<img ${attrs} class="comment-inline-image" style="max-width: 100%; max-height: 380px; height: auto; border-radius: 8px; margin: 10px 0; display: block; border: 1px solid #cbd5e1; object-fit: contain; background: #fff;" loading="lazy">`;
  });

  // Open links in new tab with styling
  clean = clean.replace(/<a\s+([^>]*?)>/gi, (match, attrs) => {
    let extra = '';
    if (!/target=/i.test(attrs)) extra += ' target="_blank"';
    if (!/rel=/i.test(attrs)) extra += ' rel="nofollow noopener noreferrer"';
    return `<a ${attrs}${extra} style="color: #0d9488; text-decoration: underline; font-weight: 600;">`;
  });

  return clean;
}

// 1. Admin Login Form Handler
function initLoginForm() {
  const form = document.getElementById('adminLoginForm');
  const alertBox = document.getElementById('loginAlert');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (alertBox) alertBox.style.display = 'none';

    const username = form.username.value.trim();
    const password = form.password.value;

    try {
      const res = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.success) {
        window.location.href = '/admin/dashboard';
      } else {
        if (alertBox) {
          alertBox.innerText = data.message || 'Invalid credentials';
          alertBox.style.display = 'block';
        }
      }
    } catch (err) {
      console.error(err);
      if (alertBox) {
        alertBox.innerText = 'Network error during login';
        alertBox.style.display = 'block';
      }
    }
  });
}

// 2. Admin Logout
async function handleLogout() {
  try {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    window.location.href = '/admin/login';
  } catch (err) {
    console.error('Logout failed:', err);
  }
}

// Global Toast Notification Helper
function showAdminToast(message, type = 'success') {
  let container = document.getElementById('adminToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'adminToastContainer';
    container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bg = type === 'error' ? '#ef4444' : type === 'info' ? '#0284c7' : '#0d9488';
  toast.style.cssText = `
    background: ${bg};
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    display: flex;
    align-items: center;
    gap: 10px;
    opacity: 0;
    transform: translateY(-10px);
    transition: opacity 0.25s ease, transform 0.25s ease;
    pointer-events: auto;
    font-family: inherit;
  `;
  const icon = type === 'error' ? (window.ICONS ? ICONS.info : '!') : type === 'info' ? (window.ICONS ? ICONS.info : 'i') : (window.ICONS ? ICONS.checkCircle : '✓');
  toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 3. Admin Dashboard Metrics & Lists
async function initDashboard() {
  const phonesEl = document.getElementById('statTotalPhones');
  if (!phonesEl) return;

  const recentTable = document.getElementById('recentPhonesTableBody');
  const brandsTable = document.getElementById('dashboardBrandsTableBody');

  try {
    const res = await fetch('/api/admin/stats');

    if (res.status === 401) {
      window.location.href = '/admin/login';
      return;
    }

    const json = await res.json();

    if (json.success && json.data) {
      const { totalPhones, totalBrands, totalViews, totalNews, recentPhones, topBrands } = json.data;

      // Stats counters
      const statPhones = document.getElementById('statTotalPhones');
      const statBrands = document.getElementById('statTotalBrands');
      const statViews = document.getElementById('statTotalViews');
      const statNews = document.getElementById('statTotalNews');
      const statReviews = document.getElementById('statTotalReviews');

      if (statPhones) statPhones.innerText = totalPhones || 0;
      if (statBrands) statBrands.innerText = totalBrands || 0;
      if (statViews) statViews.innerText = (totalViews || 0).toLocaleString();
      if (statNews) statNews.innerText = totalNews || 0;

      // Fetch reviews stats for dashboard counter
      if (statReviews) {
        fetch('/api/admin/reviews/stats')
          .then(r => r.json())
          .then(rj => {
            if (rj.success && rj.data) {
              statReviews.innerText = (rj.data.total || 0).toLocaleString();
            }
          })
          .catch(() => {});
      }

      // Render Recent Phones
      if (recentTable) {
        const selectAllRecent = document.getElementById('selectAllRecentPhones');
        if (selectAllRecent) {
          selectAllRecent.checked = false;
          selectAllRecent.indeterminate = false;
          selectAllRecent.onchange = () => {
            const chks = document.querySelectorAll('.recent-phone-select-chk');
            chks.forEach(c => { c.checked = selectAllRecent.checked; });
            updateRecentPhoneBulkUI();
          };
        }
        const recentBulkBar = document.getElementById('recentPhonesBulkActionBar');
        if (recentBulkBar) recentBulkBar.style.display = 'none';

        if (!recentPhones || recentPhones.length === 0) {
          recentTable.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No phones added yet. <a href="/admin/phones/new" class="btn btn-primary btn-sm" style="margin-left: 10px;">+ Add First Phone</a></td></tr>`;
        } else {
          recentTable.innerHTML = recentPhones.map(p => `
            <tr>
              <td style="text-align: center;">
                <input type="checkbox" class="recent-phone-select-chk" value="${p.id}" onchange="updateRecentPhoneBulkUI()" style="cursor: pointer; width: 16px; height: 16px; accent-color: #0d9488;">
              </td>
              <td>
                <img src="${p.image || '/images/placeholder.svg'}" alt="${escapeHtml(p.name)}" style="width: 38px; height: 46px; object-fit: contain; background: #f8fafc; border-radius: 4px; padding: 2px; border: 1px solid #e2e8f0;">
              </td>
              <td>
                <strong>${escapeHtml(p.name)}</strong>
                <br><code style="font-size: 11px; color: #64748b;">${escapeHtml(p.slug)}</code>
              </td>
              <td>
                <span style="font-weight: 600; color: #0f172a;">${escapeHtml(p.brand_name || 'Generic')}</span>
              </td>
              <td>
                <strong style="color: #0d9488;">${p.price && parseFloat(p.price) > 0 ? 'Rs. ' + parseFloat(p.price).toLocaleString() : 'Rumored'}</strong>
              </td>
              <td>
                <span class="phone-card-badge badge-${(p.status || 'available').toLowerCase()}">${escapeHtml(p.status || 'Available')}</span>
              </td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <a href="/admin/phones/edit/${p.id}" class="btn btn-outline btn-sm">Edit</a>
                  <a href="/phone/${p.slug}" target="_blank" class="btn btn-outline btn-sm">View</a>
                </div>
              </td>
            </tr>
          `).join('');
        }
      }

      // Render Brands
      if (brandsTable) {
        if (!topBrands || topBrands.length === 0) {
          brandsTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 24px;">No brands registered yet. <a href="/admin/brands" class="btn btn-primary btn-sm" style="margin-left: 10px;">+ Add Brand</a></td></tr>`;
        } else {
          brandsTable.innerHTML = topBrands.map(b => `
            <tr>
              <td>
                <img src="${b.logo || '/images/placeholder.svg'}" alt="${escapeHtml(b.name)}" style="height: 30px; max-width: 70px; object-fit: contain; background: #f8fafc; border-radius: 4px; padding: 2px; border: 1px solid #e2e8f0;">
              </td>
              <td>
                <strong style="color: #0f172a; font-size: 14px;">${escapeHtml(b.name)}</strong>
              </td>
              <td>
                <code>${escapeHtml(b.slug)}</code>
              </td>
              <td>
                <a href="/brand/${b.slug}" target="_blank" style="font-weight: 700; color: #0d9488; text-decoration: underline;">
                  ${b.phone_count || 0} models
                </a>
              </td>
              <td>
                <span class="phone-card-badge ${b.status === 'active' ? 'badge-available' : 'badge-discontinued'}">
                  ${escapeHtml(b.status || 'active')}
                </span>
              </td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <a href="/admin/brands" class="btn btn-outline btn-sm">Manage</a>
                  <a href="/brand/${b.slug}" target="_blank" class="btn btn-outline btn-sm">View</a>
                </div>
              </td>
            </tr>
          `).join('');
        }
      }

      // Render Dashboard Reviews & Comments
      await loadDashboardReviews();
      return;
    }
  } catch (err) {
    console.error('Error fetching dashboard stats, using fallback:', err);
  }

  // Fallback: fetch phones and brands directly
  await loadDashboardFallback(recentTable, brandsTable);
  await loadDashboardReviews();
}

async function loadDashboardFallback(recentTable, brandsTable) {
  try {
    const [phonesRes, brandsRes] = await Promise.all([
      fetch('/api/phones?limit=8&sort=newest').then(r => r.json()).catch(() => ({ success: false })),
      fetch('/api/brands').then(r => r.json()).catch(() => ({ success: false }))
    ]);

    if (phonesRes.success && phonesRes.data) {
      document.getElementById('statTotalPhones').innerText = phonesRes.pagination?.total || phonesRes.data.length;
      if (recentTable) {
        recentTable.innerHTML = phonesRes.data.map(p => `
          <tr>
            <td>
              <img src="${p.image || '/images/placeholder.svg'}" alt="${escapeHtml(p.name)}" style="width: 38px; height: 46px; object-fit: contain; background: #f8fafc; border-radius: 4px; padding: 2px; border: 1px solid #e2e8f0;">
            </td>
            <td>
              <strong>${escapeHtml(p.name)}</strong>
              <br><code style="font-size: 11px; color: #64748b;">${escapeHtml(p.slug)}</code>
            </td>
            <td>
              <span style="font-weight: 600; color: #0f172a;">${escapeHtml(p.brand_name || 'Generic')}</span>
            </td>
            <td>
              <strong style="color: #0d9488;">${p.price && parseFloat(p.price) > 0 ? 'Rs. ' + parseFloat(p.price).toLocaleString() : 'Rumored'}</strong>
            </td>
            <td>
              <span class="phone-card-badge badge-${(p.status || 'available').toLowerCase()}">${escapeHtml(p.status || 'Available')}</span>
            </td>
            <td>
              <div style="display: flex; gap: 6px;">
                <a href="/admin/phones/edit/${p.id}" class="btn btn-outline btn-sm">Edit</a>
                <a href="/phone/${p.slug}" target="_blank" class="btn btn-outline btn-sm">View</a>
              </div>
            </td>
          </tr>
        `).join('');
      }
    } else if (recentTable) {
      recentTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 24px;">Failed to load phones. Please refresh.</td></tr>`;
    }

    if (brandsRes.success && brandsRes.data) {
      document.getElementById('statTotalBrands').innerText = brandsRes.data.length;
      if (brandsTable) {
        brandsTable.innerHTML = brandsRes.data.slice(0, 8).map(b => `
          <tr>
            <td>
              <img src="${b.logo || '/images/placeholder.svg'}" alt="${escapeHtml(b.name)}" style="height: 30px; max-width: 70px; object-fit: contain; background: #f8fafc; border-radius: 4px; padding: 2px; border: 1px solid #e2e8f0;">
            </td>
            <td>
              <strong style="color: #0f172a; font-size: 14px;">${escapeHtml(b.name)}</strong>
            </td>
            <td>
              <code>${escapeHtml(b.slug)}</code>
            </td>
            <td>
              <a href="/brand/${b.slug}" target="_blank" style="font-weight: 700; color: #0d9488; text-decoration: underline;">
                ${b.phone_count || 0} models
              </a>
            </td>
            <td>
              <span class="phone-card-badge ${b.status === 'active' ? 'badge-available' : 'badge-discontinued'}">
                ${escapeHtml(b.status || 'active')}
              </span>
            </td>
            <td>
              <div style="display: flex; gap: 6px;">
                <a href="/admin/brands" class="btn btn-outline btn-sm">Manage</a>
                <a href="/brand/${b.slug}" target="_blank" class="btn btn-outline btn-sm">View</a>
              </div>
            </td>
          </tr>
        `).join('');
      }
    } else if (brandsTable) {
      brandsTable.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #dc2626; padding: 24px;">Failed to load brands. Please refresh.</td></tr>`;
    }
  } catch (fallbackErr) {
    console.error('Dashboard fallback failed:', fallbackErr);
  }
}

function updateRecentPhoneBulkUI() {
  const checkboxes = document.querySelectorAll('.recent-phone-select-chk');
  const checked = document.querySelectorAll('.recent-phone-select-chk:checked');
  const bulkBar = document.getElementById('recentPhonesBulkActionBar');
  const countSpan = document.getElementById('recentPhonesBulkCount');
  const selectAll = document.getElementById('selectAllRecentPhones');

  if (selectAll && checkboxes.length > 0) {
    selectAll.checked = checked.length === checkboxes.length;
    selectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
  }

  if (bulkBar && countSpan) {
    if (checked.length > 0) {
      bulkBar.style.display = 'inline-flex';
      countSpan.innerText = `${checked.length} selected`;
    } else {
      bulkBar.style.display = 'none';
    }
  }
}

async function handleBulkDeleteRecentPhones() {
  const checked = Array.from(document.querySelectorAll('.recent-phone-select-chk:checked')).map(cb => cb.value);
  if (checked.length === 0) {
    alert('Please select at least one phone to delete.');
    return;
  }

  if (!confirm(`Are you sure you want to permanently delete ${checked.length} selected smartphone(s)?\n\nThis will remove the phones from MySQL database.`)) {
    return;
  }

  try {
    const res = await fetch('/api/phones/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: checked })
    });
    const json = await res.json();
    if (json.success) {
      showAdminToast(`Successfully deleted ${checked.length} phone(s)!`);
      initDashboard();
    } else {
      alert(json.message || 'Error deleting selected phones');
    }
  } catch (err) {
    console.error('Recent phones bulk delete error:', err);
    alert('Failed to delete selected phones.');
  }
}



// 4. Admin Phones Table & Advanced Search Suite
async function initPhonesList() {
  const tbody = document.getElementById('adminPhonesTableBody');
  if (!tbody) return;

  // 1. Populate Brand Filter Dropdown
  await populateAdminBrandFilterDropdown();

  // 2. Setup Filter Event Listeners
  setupAdminPhoneFilterListeners();

  // 3. Setup Select All Checkbox
  const selectAll = document.getElementById('selectAllPhones');
  if (selectAll) {
    selectAll.addEventListener('change', () => {
      const checkboxes = document.querySelectorAll('.phone-select-chk');
      checkboxes.forEach(cb => { cb.checked = selectAll.checked; });
      updatePhoneBulkUI();
    });
  }

  // 4. Initial Load
  loadAdminPhones();
}

async function populateAdminBrandFilterDropdown() {
  const select = document.getElementById('adminFilterBrand');
  if (!select) return;

  try {
    const res = await fetch('/api/brands');
    const json = await res.json();
    if (json.success && json.data) {
      const options = json.data.map(b => `<option value="${b.slug}">${b.name}</option>`).join('');
      select.innerHTML = '<option value="">All Brands</option>' + options;
    }
  } catch (err) {
    console.error('Error populating brand filter:', err);
  }
}

function setupAdminPhoneFilterListeners() {
  // Keyword Search
  const searchInput = document.getElementById('adminPhoneSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(() => {
      adminPhoneFilters.search = searchInput.value.trim();
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    }, 300));
  }

  // Brand Filter
  const brandSelect = document.getElementById('adminFilterBrand');
  if (brandSelect) {
    brandSelect.addEventListener('change', () => {
      adminPhoneFilters.brand = brandSelect.value;
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    });
  }

  // Status Filter
  const statusSelect = document.getElementById('adminFilterStatus');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      adminPhoneFilters.status = statusSelect.value;
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    });
  }

  // Sort Filter
  const sortSelect = document.getElementById('adminFilterSort');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      adminPhoneFilters.sort = sortSelect.value;
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    });
  }

  // Limit Selector
  const limitSelect = document.getElementById('adminFilterLimit');
  if (limitSelect) {
    limitSelect.addEventListener('change', () => {
      adminPhoneFilters.limit = parseInt(limitSelect.value, 10);
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    });
  }

  // Min & Max Price
  const minPrice = document.getElementById('adminFilterMinPrice');
  const maxPrice = document.getElementById('adminFilterMaxPrice');
  if (minPrice) {
    minPrice.addEventListener('input', debounce(() => {
      adminPhoneFilters.minPrice = minPrice.value;
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    }, 400));
  }
  if (maxPrice) {
    maxPrice.addEventListener('input', debounce(() => {
      adminPhoneFilters.maxPrice = maxPrice.value;
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    }, 400));
  }

  // Featured & Popular Checkboxes
  const checkFeatured = document.getElementById('adminFilterFeatured');
  if (checkFeatured) {
    checkFeatured.addEventListener('change', () => {
      adminPhoneFilters.featured = checkFeatured.checked ? 'true' : '';
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    });
  }
  const checkPopular = document.getElementById('adminFilterPopular');
  if (checkPopular) {
    checkPopular.addEventListener('change', () => {
      adminPhoneFilters.popular = checkPopular.checked ? 'true' : '';
      adminPhoneFilters.page = 1;
      loadAdminPhones();
    });
  }

  // Reset Filters Button
  const resetBtn = document.getElementById('btnAdminResetFilters');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      adminPhoneFilters = {
        page: 1,
        limit: 25,
        search: '',
        brand: '',
        status: '',
        minPrice: '',
        maxPrice: '',
        sort: 'newest',
        featured: '',
        popular: ''
      };
      if (searchInput) searchInput.value = '';
      if (brandSelect) brandSelect.value = '';
      if (statusSelect) statusSelect.value = '';
      if (sortSelect) sortSelect.value = 'newest';
      if (limitSelect) limitSelect.value = '25';
      if (minPrice) minPrice.value = '';
      if (maxPrice) maxPrice.value = '';
      if (checkFeatured) checkFeatured.checked = false;
      if (checkPopular) checkPopular.checked = false;
      loadAdminPhones();
    });
  }
}

async function loadAdminPhones() {
  const tbody = document.getElementById('adminPhonesTableBody');
  const countBadge = document.getElementById('adminPhonesCountBadge');
  if (!tbody) return;

  // Reset select-all and bulk action bar on load
  const selectAll = document.getElementById('selectAllPhones');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
  const bulkBar = document.getElementById('phoneBulkActionBar');
  if (bulkBar) bulkBar.style.display = 'none';

  tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 24px;">Loading phones...</td></tr>`;

  try {
    const params = new URLSearchParams();
    params.set('page', adminPhoneFilters.page);
    params.set('limit', adminPhoneFilters.limit);
    params.set('sort', adminPhoneFilters.sort);
    if (adminPhoneFilters.search) params.set('search', adminPhoneFilters.search);
    if (adminPhoneFilters.brand) params.set('brand', adminPhoneFilters.brand);
    if (adminPhoneFilters.status) params.set('status', adminPhoneFilters.status);
    if (adminPhoneFilters.minPrice) params.set('minPrice', adminPhoneFilters.minPrice);
    if (adminPhoneFilters.maxPrice) params.set('maxPrice', adminPhoneFilters.maxPrice);
    if (adminPhoneFilters.featured) params.set('featured', adminPhoneFilters.featured);
    if (adminPhoneFilters.popular) params.set('popular', adminPhoneFilters.popular);

    const res = await fetch(`/api/phones?${params.toString()}`);
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 30px;">No phones match the current filters.</td></tr>`;
      if (countBadge) countBadge.innerText = '0 phones found';
      renderAdminPagination({ total: 0, page: 1, limit: adminPhoneFilters.limit, totalPages: 0 });
      return;
    }

    if (countBadge) {
      countBadge.innerText = `Showing ${json.data.length} of ${json.pagination.total} phones`;
    }

    tbody.innerHTML = json.data.map(p => `
      <tr>
        <td style="text-align: center;">
          <input type="checkbox" class="phone-select-chk" value="${p.id}" onchange="updatePhoneBulkUI()" style="cursor: pointer; width: 16px; height: 16px; accent-color: #0d9488;">
        </td>
        <td>
          <img src="${p.image || '/images/placeholder.svg'}" style="width: 38px; height: 46px; object-fit: contain; background: #f8fafc; border-radius: 4px; padding: 2px; border: 1px solid #e2e8f0;">
        </td>
        <td>
          <div style="font-weight: 700; color: #0f172a; font-size: 14px;">${p.name}</div>
          <code style="font-size: 12px; color: #64748b;">${p.slug}</code>
        </td>
        <td>
          <span style="font-weight: 600; color: #0f172a;">${p.brand_name}</span>
        </td>
        <td>
          <strong style="color: #0d9488;">${p.price > 0 ? 'Rs. ' + parseFloat(p.price).toLocaleString() : 'Rumored'}</strong>
        </td>
        <td>
          <span class="phone-card-badge badge-${(p.status || 'available').toLowerCase()}">${p.status}</span>
        </td>
        <td>
          <div style="display: flex; gap: 4px; flex-wrap: wrap;">
            ${p.featured ? '<span style="font-size: 10px; background: #dbeafe; color: #1e40af; font-weight: 700; padding: 2px 6px; border-radius: 3px;">FEATURED</span>' : ''}
            ${p.popular ? '<span style="font-size: 10px; background: #fef3c7; color: #92400e; font-weight: 700; padding: 2px 6px; border-radius: 3px;">POPULAR</span>' : ''}
            ${!p.featured && !p.popular ? '<span style="color: #94a3b8; font-size: 12px;">Standard</span>' : ''}
          </div>
        </td>
        <td>
          <span style="font-weight: 600; color: #475569;">${p.views || 0}</span>
        </td>
        <td style="text-align: center;">
          <a href="/admin/reviews?type=phone&search=${encodeURIComponent(p.name)}" class="btn btn-sm" style="background: ${p.review_count > 0 ? '#eff6ff' : '#f8fafc'}; color: ${p.review_count > 0 ? '#1d4ed8' : '#64748b'}; border: 1px solid ${p.review_count > 0 ? '#bfdbfe' : '#e2e8f0'}; font-weight: 700; font-size: 11.5px; padding: 3px 8px; text-decoration: none; border-radius: 4px;" title="View all reviews for ${escapeQuote(p.name)}">
            ${window.ICONS ? ICONS.comment : ''} ${p.review_count || 0}
          </a>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <a href="/admin/phones/edit/${p.id}" class="btn btn-outline btn-sm" style="font-weight: 600;">Edit</a>
            <button onclick="handleDeletePhone(${p.id}, '${escapeQuote(p.name)}')" class="btn btn-outline btn-sm" style="color: #dc2626; border-color: #fca5a5; font-weight: 600;">Delete</button>
            <a href="/phone/${p.slug}" target="_blank" class="btn btn-outline btn-sm" title="Preview on website">Preview</a>
          </div>
        </td>
      </tr>
    `).join('');

    renderAdminPagination(json.pagination);
  } catch (err) {
    console.error('Error fetching admin phones:', err);
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #dc2626; padding: 20px;">Failed to load phones.</td></tr>`;
  }
}

function updatePhoneBulkUI() {
  const checkboxes = document.querySelectorAll('.phone-select-chk');
  const checked = document.querySelectorAll('.phone-select-chk:checked');
  const bulkBar = document.getElementById('phoneBulkActionBar');
  const countSpan = document.getElementById('phoneBulkCount');
  const selectAll = document.getElementById('selectAllPhones');

  if (selectAll && checkboxes.length > 0) {
    selectAll.checked = checked.length === checkboxes.length;
    selectAll.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
  }

  if (bulkBar && countSpan) {
    if (checked.length > 0) {
      bulkBar.style.display = 'inline-flex';
      countSpan.innerText = `${checked.length} phone${checked.length === 1 ? '' : 's'} selected`;
    } else {
      bulkBar.style.display = 'none';
    }
  }
}

async function handleBulkDeletePhones() {
  const checked = Array.from(document.querySelectorAll('.phone-select-chk:checked')).map(cb => cb.value);
  if (checked.length === 0) {
    alert('Please select at least one phone to delete.');
    return;
  }

  if (!confirm(`Are you sure you want to permanently delete ${checked.length} selected phone(s)?\n\nThis will remove the phones, specifications, and prices from the MySQL database.`)) {
    return;
  }

  try {
    const res = await fetch('/api/phones/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: checked })
    });
    const json = await res.json();
    if (json.success) {
      showAdminToast(`Successfully deleted ${checked.length} phone(s)!`);
      loadAdminPhones();
    } else {
      alert(json.message || 'Error deleting selected phones');
    }
  } catch (err) {
    console.error('Bulk delete error:', err);
    alert('Failed to delete selected phones. Check network connection.');
  }
}

function renderAdminPagination(pagination) {
  const container = document.getElementById('adminPhonesPagination');
  if (!container) return;

  if (pagination.totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `
    <button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} onclick="goToAdminPhonePage(${pagination.page - 1})">
      &laquo; Prev
    </button>
  `;

  for (let i = 1; i <= pagination.totalPages; i++) {
    if (i === 1 || i === pagination.totalPages || (i >= pagination.page - 1 && i <= pagination.page + 1)) {
      html += `
        <button class="page-btn ${i === pagination.page ? 'active' : ''}" onclick="goToAdminPhonePage(${i})">
          ${i}
        </button>
      `;
    } else if (i === pagination.page - 2 || i === pagination.page + 2) {
      html += `<span style="padding: 0 4px; color: #94a3b8;">...</span>`;
    }
  }

  html += `
    <button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} onclick="goToAdminPhonePage(${pagination.page + 1})">
      Next &raquo;
    </button>
  `;

  container.innerHTML = html;
}

function goToAdminPhonePage(page) {
  adminPhoneFilters.page = page;
  loadAdminPhones();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleDeletePhone(id, name) {
  if (!confirm(`Are you sure you want to permanently delete "${name}"?\n\nThis will remove the phone, all associated specifications, and price records from the MySQL database.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/phones/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      loadAdminPhones();
    } else {
      alert(json.message || 'Error deleting phone');
    }
  } catch (err) {
    console.error('Delete error:', err);
    alert('Failed to delete phone. Check server connection.');
  }
}

// Fallbacks for gallery helpers in admin phone form
window.renderAdminGallery = window.renderAdminGallery || function(images, primary) {};
window.setAdminPrimaryImage = window.setAdminPrimaryImage || function(src) {};

// 5. Admin Phone Form (Add & Edit Phone)
async function initPhoneForm() {
  const form = document.getElementById('phoneForm');
  if (!form) return;

  await populateBrandDropdown();

  // Check if we are editing (URL contains /edit/:id)
  const pathParts = window.location.pathname.split('/');
  const isEdit = pathParts.includes('edit');
  const phoneId = isEdit ? pathParts[pathParts.length - 1] : null;

  // Auto slug generation on name input (only when creating)
  const nameInput = document.getElementById('phoneNameInput');
  const slugInput = document.getElementById('phoneSlugInput');

  if (nameInput && slugInput && !isEdit) {
    nameInput.addEventListener('input', () => {
      slugInput.value = slugify(nameInput.value);
    });
  }

  // Setup Image File Live Preview & Delete button
  const fileInput = document.getElementById('phoneImageFile');
  const previewImg = document.getElementById('currentImagePreview');
  const btnDeletePhoneImage = document.getElementById('btnDeletePhoneImage');
  const phoneRemoveImage = document.getElementById('phoneRemoveImage');

  if (fileInput && previewImg) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (file) {
        if (phoneRemoveImage) phoneRemoveImage.value = 'false';
        if (btnDeletePhoneImage) btnDeletePhoneImage.style.display = 'inline-flex';
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          previewImg.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (btnDeletePhoneImage) {
    btnDeletePhoneImage.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      if (phoneRemoveImage) phoneRemoveImage.value = 'true';
      const phoneScrapedImage = document.getElementById('phoneScrapedImage');
      if (phoneScrapedImage) phoneScrapedImage.value = '';
      if (previewImg) {
        previewImg.src = '/images/placeholder.svg';
        previewImg.style.display = 'block';
      }
      btnDeletePhoneImage.style.display = 'none';
    });
  }

  // Admin Gallery Images State & Helpers
  let adminGalleryImages = [];

  function setAdminPrimaryImage(src) {
    const scrapedImgInput = document.getElementById('phoneScrapedImage');
    const previewImg = document.getElementById('currentImagePreview');
    const btnDeletePhoneImage = document.getElementById('btnDeletePhoneImage');
    const removeImgInput = document.getElementById('phoneRemoveImage');

    if (scrapedImgInput) scrapedImgInput.value = src;
    if (removeImgInput) removeImgInput.value = 'false';
    if (previewImg) {
      previewImg.src = src || '/images/placeholder.svg';
      previewImg.style.display = src ? 'block' : 'none';
    }
    if (btnDeletePhoneImage) {
      btnDeletePhoneImage.style.display = src ? 'inline-flex' : 'none';
    }
    renderAdminGallery(adminGalleryImages, src);
  }

  function renderAdminGallery(images, primaryImage) {
    adminGalleryImages = Array.isArray(images) ? [...images].filter(Boolean) : [];
    const container = document.getElementById('adminGalleryContainer');
    const grid = document.getElementById('adminGalleryGrid');
    const badge = document.getElementById('galleryCountBadge');
    const imagesJsonInput = document.getElementById('phoneImagesJson');

    if (!container || !grid) return;

    if (adminGalleryImages.length === 0) {
      container.style.display = 'none';
      if (imagesJsonInput) imagesJsonInput.value = '[]';
      return;
    }

    container.style.display = 'block';
    if (badge) badge.textContent = `${adminGalleryImages.length} image${adminGalleryImages.length === 1 ? '' : 's'}`;
    if (imagesJsonInput) imagesJsonInput.value = JSON.stringify(adminGalleryImages);

    const activePrimary = primaryImage || (document.getElementById('phoneScrapedImage')?.value || adminGalleryImages[0]);

    grid.innerHTML = adminGalleryImages.map((src, idx) => {
      const isPrimary = src === activePrimary;
      return `
        <div style="position: relative; width: 84px; height: 84px; border-radius: 8px; border: 2px solid ${isPrimary ? '#0284c7' : '#e2e8f0'}; background: #ffffff; padding: 4px; box-shadow: ${isPrimary ? '0 0 0 2px #bae6fd' : '0 1px 2px rgba(0,0,0,0.05)'}; cursor: pointer; transition: all .15s ease;"
             class="gallery-thumb-card"
             data-src="${escapeHtml(src)}"
             title="${isPrimary ? 'Current Primary Image' : 'Click to set as Primary Image'}">
          ${isPrimary ? '<span style="position: absolute; bottom: 3px; left: 3px; background: #0284c7; color: #fff; font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 4px; z-index: 2;">★ Primary</span>' : ''}
          <button type="button" class="btn-remove-gallery-img" data-idx="${idx}" style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: #ef4444; color: #fff; border: 1px solid #fff; font-size: 12px; font-weight: bold; line-height: 1; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.2); z-index: 3;" title="Remove from gallery">&times;</button>
          <img src="${escapeHtml(src)}" alt="Gallery image ${idx + 1}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 4px; pointer-events: none;" onerror="this.parentElement.style.display='none'">
        </div>
      `;
    }).join('');

    // Wire click to set primary
    grid.querySelectorAll('.gallery-thumb-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-remove-gallery-img')) return;
        const src = card.dataset.src;
        setAdminPrimaryImage(src);
      });
    });

    // Wire delete thumbnail
    grid.querySelectorAll('.btn-remove-gallery-img').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const removeIdx = parseInt(btn.dataset.idx, 10);
        if (!isNaN(removeIdx)) {
          const removedSrc = adminGalleryImages[removeIdx];
          adminGalleryImages.splice(removeIdx, 1);
          let newPrimary = activePrimary;
          if (removedSrc === activePrimary) {
            newPrimary = adminGalleryImages[0] || '';
            setAdminPrimaryImage(newPrimary);
          } else {
            renderAdminGallery(adminGalleryImages, newPrimary);
          }
        }
      });
    });
  }

  // Expose gallery helpers globally so edit loader can populate gallery images
  window.renderAdminGallery = renderAdminGallery;
  window.setAdminPrimaryImage = setAdminPrimaryImage;

  // Setup Dynamic Spec Row Button
  const addSpecBtn = document.getElementById('btnAddSpecRow');
  if (addSpecBtn) {
    addSpecBtn.addEventListener('click', () => {
      addSpecRow('', '', '');
    });
  }

  // Setup Add Default Specs preset
  const addDefaultBtn = document.getElementById('btnAddDefaultSpecs');
  if (addDefaultBtn) {
    addDefaultBtn.addEventListener('click', () => {
      populateDefaultSpecTemplate();
    });
  }

  // When retail price changes, sync with Pakistan price field if empty
  const priceInput = document.getElementById('phonePriceInput');
  const pricePKR = document.getElementById('pricePKR');
  if (priceInput && pricePKR) {
    priceInput.addEventListener('input', () => {
      if (!pricePKR.value || pricePKR.dataset.auto) {
        pricePKR.value = priceInput.value ? 'PKR ' + parseFloat(priceInput.value).toLocaleString() : '';
        pricePKR.dataset.auto = 'true';
      }
    });
  }

  // ── YouTube Video Review & Preview Setup ──────────────────────────────────
  const videoUrlInput = document.getElementById('phoneVideoUrl');
  const btnClearVideoUrl = document.getElementById('btnClearVideoUrl');

  if (videoUrlInput) {
    videoUrlInput.addEventListener('input', updateVideoPreview);
    videoUrlInput.addEventListener('change', updateVideoPreview);
  }
  if (btnClearVideoUrl && videoUrlInput) {
    btnClearVideoUrl.addEventListener('click', () => {
      videoUrlInput.value = '';
      updateVideoPreview();
    });
  }

  // ── Dynamic External Store Deals & Affiliate Links Builder ─────────────────
  const btnAddAffiliate = document.getElementById('btnAddAffiliateRow');
  if (btnAddAffiliate) {
    btnAddAffiliate.addEventListener('click', () => {
      addAffiliateRow('', '', '');
    });
  }

  // Quick preset buttons (+ Official Site, + Amazon, + Daraz, + PriceOye, + AliExpress, + GSMArena Source)
  document.querySelectorAll('.quick-add-affiliate').forEach(btn => {
    btn.addEventListener('click', () => {
      const store = btn.dataset.store || '';
      let price = '';
      const pricePKRVal = document.getElementById('pricePKR')?.value || '';
      const priceUSDVal = document.getElementById('priceUSD')?.value || '';
      if (store === 'Daraz' || store === 'PriceOye' || store === 'Telemart' || store === 'Shophive') {
        price = pricePKRVal || '';
      } else if (store === 'Amazon' || store === 'AliExpress') {
        price = priceUSDVal || '';
      }
      if (!price) price = btn.dataset.price || '';
      addAffiliateRow(store, price, '');
    });
  });

  // ── Section 5: Quill WYSIWYG Rich Text Editor Setup ─────────────────────────
  let quillSummary = null;
  const quillEditorEl = document.getElementById('summaryQuillEditor');
  const shortDescField = document.getElementById('phoneShortDesc');
  const summaryCharCount = document.getElementById('summaryCharCount');
  const btnAutoGenerateSummary = document.getElementById('btnAutoGenerateSummary');
  const btnInsertBrandInternalLinks = document.getElementById('btnInsertBrandInternalLinks');

  if (quillEditorEl && typeof Quill !== 'undefined') {
    quillSummary = new Quill('#summaryQuillEditor', {
      modules: {
        toolbar: '#summaryQuillToolbar'
      },
      theme: 'snow',
      placeholder: 'Write or auto-generate a comprehensive device overview, key highlights, headings, font colors, and internal device links...'
    });
    window.quillSummary = quillSummary;

    quillSummary.on('text-change', () => {
      const text = quillSummary.getText().trim();
      const html = text.length === 0 ? '' : quillSummary.root.innerHTML;
      if (shortDescField) shortDescField.value = html;
      updateSummaryCharCount();
    });
  }

  function updateSummaryCharCount() {
    if (summaryCharCount) {
      let len = 0;
      if (quillSummary) {
        len = quillSummary.getText().trim().length;
      } else if (shortDescField) {
        len = (shortDescField.value || '').length;
      }
      summaryCharCount.textContent = `${len} character${len === 1 ? '' : 's'}`;
    }
  }

  function setSummaryContent(htmlOrText) {
    const content = (htmlOrText || '').trim();
    if (shortDescField) shortDescField.value = content;
    if (quillSummary) {
      if (content.startsWith('<')) {
        quillSummary.clipboard.dangerouslyPasteHTML(0, content);
      } else if (content) {
        const paragraphs = content.split('\n\n').filter(Boolean);
        const html = paragraphs.map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('');
        quillSummary.clipboard.dangerouslyPasteHTML(0, html);
      } else {
        quillSummary.setText('');
      }
    }
    updateSummaryCharCount();
  }
  window.setAdminSummaryContent = setSummaryContent;

  if (shortDescField) {
    shortDescField.addEventListener('input', updateSummaryCharCount);
    updateSummaryCharCount();
  }

  // ── Insert 2 to 5 Related Devices of Same Brand as Internal Links ───────────
  if (btnInsertBrandInternalLinks) {
    btnInsertBrandInternalLinks.addEventListener('click', async () => {
      const brandSelect = document.getElementById('phoneBrandSelect');
      const brandId = brandSelect ? brandSelect.value : '';
      if (!brandId) {
        alert('Please select a Brand for this phone first (Section 1: Basic Information) to discover related devices.');
        brandSelect?.focus();
        return;
      }

      const brandName = (brandSelect.options && brandSelect.selectedIndex >= 0)
        ? brandSelect.options[brandSelect.selectedIndex].text.replace(/-- Select Brand --/i, '').trim()
        : 'Brand';
      const currentName = (document.getElementById('phoneNameInput')?.value || '').trim();

      const origBtnHtml = btnInsertBrandInternalLinks.innerHTML;
      btnInsertBrandInternalLinks.disabled = true;
      btnInsertBrandInternalLinks.innerHTML = '<span>⏳ Finding related phones...</span>';

      try {
        const res = await fetch(`/api/phones?brand=${encodeURIComponent(brandId)}&limit=12`);
        const json = await res.json();
        const phoneList = (json.data && json.data.phones) ? json.data.phones : (Array.isArray(json.data) ? json.data : []);

        const related = phoneList.filter(p => {
          if (phoneId && p.id == phoneId) return false;
          if (currentName && p.name.trim().toLowerCase() === currentName.toLowerCase()) return false;
          return true;
        }).slice(0, 5); // 2 to 5 related devices

        if (related.length === 0) {
          alert(`No other devices found under brand "${brandName}" in the database yet.\n\nAdd more ${brandName} phones to auto-link them here.`);
          btnInsertBrandInternalLinks.innerHTML = origBtnHtml;
          btnInsertBrandInternalLinks.disabled = false;
          return;
        }

        const linkItemsHtml = related.map(p => {
          const priceStr = p.price > 0 ? ` — Official Price: PKR ${Number(p.price).toLocaleString()}` : '';
          return `<li><a href="/phone/${escapeAttr(p.slug)}" title="${escapeAttr(p.name)} Specs & Price in Pakistan">${escapeHtml(p.name)}</a>${priceStr}</li>`;
        }).join('');

        const internalLinksBlock = `
          <h3>Related ${escapeHtml(brandName)} Devices to Compare</h3>
          <p>Explore these related <strong>${escapeHtml(brandName)}</strong> smartphones available in Pakistan:</p>
          <ul>
            ${linkItemsHtml}
          </ul>
        `;

        if (quillSummary) {
          const range = quillSummary.getSelection(true);
          const insertIndex = range ? range.index : quillSummary.getLength();
          quillSummary.clipboard.dangerouslyPasteHTML(insertIndex, internalLinksBlock);
        } else if (shortDescField) {
          shortDescField.value += `\n\nRelated ${brandName} Devices:\n` + related.map(p => `- ${p.name}: /phone/${p.slug}`).join('\n');
          updateSummaryCharCount();
        }

        btnInsertBrandInternalLinks.innerHTML = `<span>✅ Inserted ${related.length} Device Links!</span>`;
        btnInsertBrandInternalLinks.style.borderColor = '#99f6e4';
        btnInsertBrandInternalLinks.style.background = '#f0fdfa';
        btnInsertBrandInternalLinks.style.color = '#0d9488';

        setTimeout(() => {
          btnInsertBrandInternalLinks.innerHTML = origBtnHtml;
          btnInsertBrandInternalLinks.disabled = false;
        }, 2200);

      } catch (err) {
        console.error('Error fetching brand related devices:', err);
        alert('Could not fetch related brand devices. Check network connection.');
        btnInsertBrandInternalLinks.innerHTML = origBtnHtml;
        btnInsertBrandInternalLinks.disabled = false;
      }
    });
  }

  // ── Auto-Generate Rich Summary Button ───────────────────────────────────────
  if (btnAutoGenerateSummary) {
    btnAutoGenerateSummary.addEventListener('click', async () => {
      btnAutoGenerateSummary.disabled = true;
      btnAutoGenerateSummary.innerHTML = '<span>⚡ Generating Rich Highlights...</span>';

      const summaryHtml = await deriveRichHighlightsFromSpecRowsAsync();
      if (!summaryHtml) {
        alert('Please ensure specifications are present in the builder below before deriving highlights.');
        btnAutoGenerateSummary.disabled = false;
        btnAutoGenerateSummary.innerHTML = '<span>⚡ Auto-Generate from Specs</span>';
        return;
      }

      setSummaryContent(summaryHtml);

      btnAutoGenerateSummary.innerHTML = '<span>Summary Generated!</span>';
      btnAutoGenerateSummary.style.borderColor = '#86efac';
      btnAutoGenerateSummary.style.background = '#f0fdf4';
      btnAutoGenerateSummary.style.color = '#16a34a';

      setTimeout(() => {
        btnAutoGenerateSummary.innerHTML = '<span>⚡ Auto-Generate from Specs</span>';
        btnAutoGenerateSummary.style.borderColor = '#bae6fd';
        btnAutoGenerateSummary.style.background = '#f0f9ff';
        btnAutoGenerateSummary.style.color = '#0284c7';
        btnAutoGenerateSummary.disabled = false;
      }, 2000);
    });
  }

  // Auto-Fetch Phone Specifications from URL (WhatMobile & GSMArena)
  const urlInput = document.getElementById('externalUrlInput');
  const btnFetchSpecs = document.getElementById('btnFetchSpecs');
  const btnClearUrl = document.getElementById('btnClearUrl');
  const fetchStatus = document.getElementById('fetchSpecsStatus');
  const fetchIcon = document.getElementById('fetchIcon');
  const fetchBtnText = document.getElementById('fetchBtnText');

  let adminAutoStartTimer = null;

  const cancelAdminAutoStart = () => {
    if (adminAutoStartTimer) {
      clearTimeout(adminAutoStartTimer);
      adminAutoStartTimer = null;
    }
    if (typeof window.cancelInlineAutoStart === 'function') {
      window.cancelInlineAutoStart();
    }
  };

  const triggerBulkQueue = (urls) => {
    cancelAdminAutoStart();
    if (!urls || urls.length <= 1) return;

    if (typeof window.runInlineBulkQueue === 'function') {
      window.runInlineBulkQueue(urls);
      return;
    }

    openBulkImportModal();
    const bulkTextarea = document.getElementById('bulkImportUrlsInput');
    if (bulkTextarea) {
      bulkTextarea.value = urls.join('\n');
      updateBulkLinksCount();
    }
    startBulkQueue();
  };

  if (urlInput) {

    const handleUrlPasteOrInput = (isPaste = false) => {
      const val = (urlInput.value || '').trim();
      if (btnClearUrl) btnClearUrl.style.display = val ? 'inline-block' : 'none';
      const detectedUrls = parseBulkUrls(val);
      const badge = document.getElementById('detectedUrlsCountBadge');

      if (detectedUrls.length > 1) {
        // If pasted or missing linebreaks, format so every URL is on its own separate line
        if (isPaste || !val.includes('\n')) {
          urlInput.value = detectedUrls.join('\n');
        }
        if (badge) {
          badge.textContent = `⚡ ${detectedUrls.length} links detected (Bulk Mode)`;
          badge.style.display = 'inline-block';
          badge.style.background = '#ecfdf5';
          badge.style.color = '#047857';
          badge.style.borderColor = '#a7f3d0';
        }
        if (fetchBtnText) {
          fetchBtnText.textContent = `⚡ Start Bulk Queue (${detectedUrls.length} Phones)`;
        }
        if (btnFetchSpecs) {
          btnFetchSpecs.style.background = '#0d9488';
        }

        const chkAuto = document.getElementById('chkAutoStartQueue');
        const autoStartEnabled = chkAuto ? chkAuto.checked : true;

        cancelAdminAutoStart();

        if (autoStartEnabled) {
          if (fetchStatus) {
            fetchStatus.style.display = 'block';
            fetchStatus.style.background = '#f0fdfa';
            fetchStatus.style.color = '#0f766e';
            fetchStatus.style.border = '1px solid #99f6e4';
            fetchStatus.innerHTML = `
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span>🚀 <strong>${detectedUrls.length} phone links detected!</strong> Queuing starting automatically...</span>
                <div style="display: flex; gap: 6px;">
                  <button type="button" id="btnAdminAutoStartNow" class="btn btn-primary btn-sm" style="font-size: 11.5px; padding: 3px 12px; background: #0d9488; border: none; font-weight: 700; cursor: pointer;">Start Now ▶</button>
                  <button type="button" id="btnAdminCancelAutoStart" class="btn btn-outline btn-sm" style="font-size: 11.5px; padding: 3px 10px; cursor: pointer;">Cancel</button>
                </div>
              </div>
            `;
            document.getElementById('btnAdminAutoStartNow')?.addEventListener('click', (e) => {
              e.preventDefault();
              triggerBulkQueue(detectedUrls);
            });
            document.getElementById('btnAdminCancelAutoStart')?.addEventListener('click', (e) => {
              e.preventDefault();
              cancelAdminAutoStart();
              if (fetchStatus) {
                fetchStatus.innerHTML = `⚡ Detected <strong>${detectedUrls.length} phone links</strong>. Auto-start paused. Click "Start Bulk Queue" when ready.`;
              }
            });
          }

          adminAutoStartTimer = setTimeout(() => {
            triggerBulkQueue(detectedUrls);
          }, 750);
        } else {
          if (fetchStatus) {
            fetchStatus.style.display = 'block';
            fetchStatus.style.background = '#ecfdf5';
            fetchStatus.style.color = '#065f46';
            fetchStatus.style.border = '1px solid #a7f3d0';
            fetchStatus.innerHTML = `⚡ Detected <strong>${detectedUrls.length} phone links</strong> formatted on separate lines! Click <strong>"Start Bulk Queue"</strong> to import all phones.`;
          }
        }
      } else if (detectedUrls.length === 1) {
        cancelAdminAutoStart();
        if (badge) {
          badge.textContent = `1 link detected`;
          badge.style.display = 'inline-block';
          badge.style.background = '#eff6ff';
          badge.style.color = '#1d4ed8';
          badge.style.borderColor = '#bfdbfe';
        }
        if (fetchBtnText) {
          fetchBtnText.textContent = 'Fetch Phone Specs';
        }
        if (btnFetchSpecs) {
          btnFetchSpecs.style.background = '';
        }
        if (fetchStatus && fetchStatus.textContent.includes('Detected')) {
          fetchStatus.style.display = 'none';
        }
      } else {
        cancelAdminAutoStart();
        if (badge) badge.style.display = 'none';
        if (fetchBtnText) fetchBtnText.textContent = 'Fetch Phone Specs';
        if (btnFetchSpecs) btnFetchSpecs.style.background = '';
      }
    };

    urlInput.addEventListener('input', (e) => {
      const isPaste = e && e.inputType === 'insertFromPaste';
      handleUrlPasteOrInput(isPaste);
    });
    urlInput.addEventListener('paste', () => setTimeout(() => handleUrlPasteOrInput(true), 50));

    if (btnClearUrl) {
      btnClearUrl.addEventListener('click', () => {
        cancelAdminAutoStart();
        urlInput.value = '';
        btnClearUrl.style.display = 'none';
        const badge = document.getElementById('detectedUrlsCountBadge');
        if (badge) badge.style.display = 'none';
        if (fetchBtnText) fetchBtnText.textContent = 'Fetch Phone Specs';
        if (btnFetchSpecs) btnFetchSpecs.style.background = '';
        if (fetchStatus) fetchStatus.style.display = 'none';
      });
    }
  }

  if (btnFetchSpecs) {
      btnFetchSpecs.addEventListener('click', async (e) => {
        cancelAdminAutoStart();
        const raw = urlInput.value.trim();
        if (!raw) {
          alert('Please paste a phone URL from whatmobile.com.pk or gsmarena.com first.');
          urlInput.focus();
          return;
        }

        // If user pasted multiple URLs, route to Bulk Import Queue
        const detectedUrls = parseBulkUrls(raw);
        if (detectedUrls.length > 1) {
          triggerBulkQueue(detectedUrls);
          return;
        }

      const url = detectedUrls.length === 1 ? detectedUrls[0] : raw.replace(/^[("'\s<\[{]+|[)"'\s>,.\]}]+$/g, '');

      // UI Loading state
      btnFetchSpecs.disabled = true;
      if (fetchIcon) fetchIcon.textContent = '⏳';
      if (fetchBtnText) fetchBtnText.textContent = 'Fetching Specs...';
      if (fetchStatus) {
        fetchStatus.style.display = 'block';
        fetchStatus.style.background = '#f1f5f9';
        fetchStatus.style.color = '#334155';
        fetchStatus.style.border = '1px solid #cbd5e1';
        fetchStatus.innerHTML = 'Connecting to server and extracting specifications... Please wait a moment.';
      }

      try {
        const res = await fetch('/api/phones/fetch-external-specs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });

        const json = await res.json();

        if (!json.success || !json.data) {
          if (fetchStatus) {
            fetchStatus.style.display = 'block';
            fetchStatus.style.background = '#fef2f2';
            fetchStatus.style.color = '#991b1b';
            fetchStatus.style.border = '1px solid #fecaca';
            fetchStatus.innerHTML = `⚠️ <strong>Fetch Failed:</strong> ${escapeHtml(json.message || 'Unable to parse phone data from URL.')}`;
          }
          return;
        }

        await window.populatePhoneFormWithSpecs(json.data);

        if (fetchStatus) {
          const sCount = Array.isArray(json.data.specs) ? [...new Set(json.data.specs.map(s => s.section))].length : 0;
          fetchStatus.style.display = 'block';
          fetchStatus.style.background = '#f0fdf4';
          fetchStatus.style.color = '#166534';
          fetchStatus.style.border = '1px solid #bbf7d0';
          fetchStatus.innerHTML = `
            <div style="font-weight: 700; margin-bottom: 4px;">Specs Successfully Fetched from ${json.data.source === 'gsmarena' ? 'GSMArena' : 'WhatMobile'}!</div>
            <div>Loaded <strong>${json.data.specs?.length || 0}</strong> specifications across <strong>${sCount}</strong> sections into Builder below.</div>
          `;
        }
      } catch (err) {
        console.error('Fetch specs error:', err);
        if (fetchStatus) {
          fetchStatus.style.display = 'block';
          fetchStatus.style.background = '#fef2f2';
          fetchStatus.style.color = '#991b1b';
          fetchStatus.style.border = '1px solid #fecaca';
          fetchStatus.innerHTML = `⚠️ <strong>Error:</strong> Failed to fetch data. Please check network connection and URL.`;
        }
      } finally {
        btnFetchSpecs.disabled = false;
        if (fetchIcon) fetchIcon.textContent = '⚡';
        if (fetchBtnText) fetchBtnText.textContent = 'Fetch Phone Specs';
      }
    });
  }

  // ── Global Specifications & Form Population Handler ───────────────────────
  window.populatePhoneFormWithSpecs = async function(data) {
    if (!data) return;

    // 1. Populate General Information
    if (data.name) {
      const nameField = document.getElementById('phoneNameInput');
      if (nameField) {
        nameField.value = data.name;
        const slugField = document.getElementById('phoneSlugInput');
        if (slugField && !isEdit) {
          slugField.value = data.slug || slugify(data.name);
        }
      }
    }
    if (data.slug) {
      const slugField = document.getElementById('phoneSlugInput');
      if (slugField) slugField.value = data.slug;
    }
    if (data.price !== undefined && data.price !== null && data.price > 0) {
      const priceField = document.getElementById('phonePriceInput');
      if (priceField) priceField.value = data.price;
    }
    if (data.status) {
      const statusField = document.getElementById('phoneStatusSelect');
      if (statusField) statusField.value = data.status;
    }
    if (data.releaseDate || data.release_date) {
      const relField = document.getElementById('phoneReleaseDate');
      if (relField) relField.value = data.releaseDate || data.release_date;
    }

    // 2. Handle Brand Selection / Quick Add
    const brandSelect = document.getElementById('phoneBrandSelect');
    if (data.brand_found && data.brand_id && brandSelect) {
      brandSelect.value = data.brand_id;
    } else if (data.brand_name && brandSelect && brandSelect.options) {
      let foundOption = false;
      for (let i = 0; i < brandSelect.options.length; i++) {
        if (brandSelect.options[i].text.toLowerCase().trim() === data.brand_name.toLowerCase().trim()) {
          brandSelect.selectedIndex = i;
          foundOption = true;
          break;
        }
      }
      if (!foundOption) {
        const fetchStatus = document.getElementById('fetchSpecsStatus');
        if (fetchStatus) {
          const quickBtnHtml = ` <button type="button" id="btnQuickAddBrand" class="btn btn-outline btn-sm" style="margin-left: 8px; font-size: 11px; padding: 2px 8px; cursor: pointer;">➕ Quick Add "${escapeHtml(data.brand_name)}"</button>`;
          fetchStatus.innerHTML += `<div style="margin-top: 6px;">Brand "<strong>${escapeHtml(data.brand_name)}</strong>" not found in database.${quickBtnHtml}</div>`;
        }
      }
    }

    // 3. Handle Main Image and Gallery
    if (data.image || (data.images && data.images.length > 0)) {
      const primaryImg = data.image || (data.images && data.images[0]);
      const allImgs = (data.images && data.images.length > 0)
        ? data.images
        : (primaryImg ? [primaryImg] : []);

      const scrapedImgInput = document.getElementById('phoneScrapedImage');
      const previewImg = document.getElementById('currentImagePreview');
      const btnDeletePhoneImage = document.getElementById('btnDeletePhoneImage');
      const removeImgInput = document.getElementById('phoneRemoveImage');

      if (scrapedImgInput) scrapedImgInput.value = primaryImg;
      if (removeImgInput) removeImgInput.value = 'false';
      if (previewImg) {
        previewImg.src = primaryImg;
        previewImg.style.display = 'block';
      }
      if (btnDeletePhoneImage) {
        btnDeletePhoneImage.style.display = 'inline-flex';
      }

      renderAdminGallery(allImgs, primaryImg);
    }

    // 4. Handle Multi-Country Pricing
    if (data.prices && Array.isArray(data.prices)) {
      for (const pr of data.prices) {
        if (pr.country === 'Pakistan' && pr.amount) document.getElementById('pricePKR').value = pr.amount;
        if (pr.country === 'USA' && pr.amount) document.getElementById('priceUSD').value = pr.amount;
        if (pr.country === 'UAE' && pr.amount) document.getElementById('priceAED').value = pr.amount;
        if (pr.country === 'India' && pr.amount) document.getElementById('priceINR').value = pr.amount;
        if (pr.country === 'UK' && pr.amount) document.getElementById('priceGBP').value = pr.amount;
      }
    }
    const priceFieldVal = document.getElementById('phonePriceInput')?.value;
    const pricePKRField = document.getElementById('pricePKR');
    if (priceFieldVal && pricePKRField && !pricePKRField.value) {
      pricePKRField.value = 'PKR ' + parseFloat(priceFieldVal).toLocaleString();
    }

    // 5. Handle Post External Links & Store Deals (Section 3)
    const sourceUrl = data.sourceUrl || data.url;
    if (sourceUrl) {
      const sourceStore = data.source === 'gsmarena' ? 'GSMArena Source' : (data.source === 'whatmobile' ? 'WhatMobile Source' : 'External Source');
      const existingUrls = Array.from(document.querySelectorAll('.aff-url-input')).map(i => i.value.trim());
      if (!existingUrls.includes(sourceUrl)) {
        addAffiliateRow(sourceStore, 'Source', sourceUrl);
      }
    }
    if (Array.isArray(data.affiliate_links) && data.affiliate_links.length > 0) {
      for (const aff of data.affiliate_links) {
        if (aff && aff.store) {
          addAffiliateRow(aff.store, aff.price || '', aff.url || aff.link || '');
        }
      }
    }

    // 6. Populate Detailed Technical Specifications Builder (Section 6)
    const specContainer = document.getElementById('specRowsContainer');
    if (specContainer) {
      specContainer.innerHTML = '';
      const specsList = [];
      if (Array.isArray(data.specs) && data.specs.length > 0) {
        for (const s of data.specs) {
          specsList.push({ section: s.section, key: s.key || s.spec_key || '', value: s.value || s.spec_value || '' });
        }
      } else if (Array.isArray(data.raw_specs) && data.raw_specs.length > 0) {
        for (const s of data.raw_specs) {
          specsList.push({ section: s.section, key: s.spec_key || s.key || '', value: s.spec_value || s.value || '' });
        }
      } else if (data.specs && typeof data.specs === 'object') {
        for (const [sec, items] of Object.entries(data.specs)) {
          if (Array.isArray(items)) {
            for (const item of items) {
              specsList.push({ section: sec, key: item.key || item.spec_key || '', value: item.value || item.spec_value || '' });
            }
          }
        }
      }

      if (specsList.length > 0) {
        for (const s of specsList) {
          addSpecRow(s.section, s.key, s.value);
        }
      } else {
        populateDefaultSpecTemplate();
      }
    }

    // 7. Populate Short Summary / Key Highlights in Quill (Section 5)
    if (data.shortSummary || data.short_description) {
      setSummaryContent(data.shortSummary || data.short_description);
    } else {
      const generatedHtml = await deriveRichHighlightsFromSpecRowsAsync();
      if (generatedHtml) {
        setSummaryContent(generatedHtml);
      }
    }

    // 8. Wire Quick Add Brand button if rendered
    const quickAddBtn = document.getElementById('btnQuickAddBrand');
    if (quickAddBtn && data.brand_name) {
      quickAddBtn.addEventListener('click', async () => {
        try {
          quickAddBtn.disabled = true;
          quickAddBtn.textContent = 'Adding...';
          const bRes = await fetch('/api/brands', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: data.brand_name,
              slug: slugify(data.brand_name),
              description: `${data.brand_name} Mobile Phones & Devices`
            })
          });
          const bJson = await bRes.json();
          if (bJson.success && bJson.data) {
            await populateBrandDropdown(bJson.data.id);
            quickAddBtn.parentElement.innerHTML = `Brand <strong>${escapeHtml(data.brand_name)}</strong> added and selected!`;
          } else {
            alert(bJson.message || 'Could not add brand.');
            quickAddBtn.disabled = false;
            quickAddBtn.textContent = `➕ Quick Add "${escapeHtml(data.brand_name)}"`;
          }
        } catch (err) {
          console.error(err);
          quickAddBtn.disabled = false;
        }
      });
    }
  };

  if (isEdit && phoneId) {
    document.getElementById('phoneFormTitle').innerText = 'Edit Mobile Phone';
    loadPhoneDataForEdit(phoneId);
  } else {
    // Populate default standard specifications template for convenient phone creation
    populateDefaultSpecTemplate();
  }

  // Handle Form Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Sync Quill Editor HTML before FormData creation
    if (window.quillSummary) {
      const text = window.quillSummary.getText().trim();
      const html = text.length === 0 ? '' : window.quillSummary.root.innerHTML;
      if (shortDescField) shortDescField.value = html;
    }

    const formData = new FormData(form);
    if (shortDescField) {
      formData.set('short_description', shortDescField.value);
    }

    // Clean up empty image input so multer does not process empty file
    const fileInput = document.getElementById('phoneImageFile');
    const scrapedImgInput = document.getElementById('phoneScrapedImage');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
      formData.delete('image');
      if (scrapedImgInput && scrapedImgInput.value) {
        formData.set('image', scrapedImgInput.value);
      }
    }

    // Collect Dynamic Specs
    const specRows = document.querySelectorAll('.spec-row-item');
    const specsArray = [];
    specRows.forEach((row, idx) => {
      const section = row.querySelector('.spec-section-select').value;
      const key = row.querySelector('.spec-key-input').value.trim();
      const value = row.querySelector('.spec-val-input').value.trim();
      if (section && key && value) {
        specsArray.push({ section, key, value, sort_order: idx + 1 });
      }
    });
    formData.set('specs', JSON.stringify(specsArray));

    // Collect Multi-Currency Prices
    const pricesArray = [
      { country: 'Pakistan', currency: 'PKR', amount: document.getElementById('pricePKR')?.value || '' },
      { country: 'USA', currency: 'USD', amount: document.getElementById('priceUSD')?.value || '' },
      { country: 'UAE', currency: 'AED', amount: document.getElementById('priceAED')?.value || '' },
      { country: 'India', currency: 'INR', amount: document.getElementById('priceINR')?.value || '' },
      { country: 'UK', currency: 'GBP', amount: document.getElementById('priceGBP')?.value || '' }
    ].filter(p => p.amount.trim() !== '');
    formData.set('prices', JSON.stringify(pricesArray));

    // Collect Gallery Images JSON
    const imagesInput = document.getElementById('phoneImagesJson');
    if (imagesInput && imagesInput.value) {
      formData.set('images', imagesInput.value);
    } else if (adminGalleryImages && adminGalleryImages.length > 0) {
      formData.set('images', JSON.stringify(adminGalleryImages));
    }

    // Collect External Store Affiliate Deals
    const affRows = document.querySelectorAll('.affiliate-row-item');
    const affArray = [];
    const phoneNameVal = document.getElementById('phoneNameInput')?.value.trim() || '';
    affRows.forEach(row => {
      const store = row.querySelector('.aff-store-input')?.value.trim();
      const price = row.querySelector('.aff-price-input')?.value.trim();
      let url = row.querySelector('.aff-url-input')?.value.trim() || '';
      if (store) {
        if (!url) {
          if (store.toLowerCase().includes('amazon')) {
            url = `https://www.amazon.com/s?k=${encodeURIComponent(phoneNameVal)}`;
          } else if (store.toLowerCase().includes('daraz')) {
            url = `https://www.daraz.pk/catalog/?q=${encodeURIComponent(phoneNameVal)}`;
          } else if (store.toLowerCase().includes('priceoye')) {
            url = `https://priceoye.pk/search?q=${encodeURIComponent(phoneNameVal)}`;
          } else {
            url = `https://www.google.com/search?q=${encodeURIComponent(store + ' ' + phoneNameVal)}`;
          }
        } else if (!/^https?:\/\//i.test(url)) {
          url = 'https://' + url;
        }
        affArray.push({ store, price: price || '', url });
      }
    });
    formData.set('affiliate_links', JSON.stringify(affArray));

    // Collect Video URL (Normalize iframe or raw link to clean canonical watch URL)
    const rawVideoUrl = document.getElementById('phoneVideoUrl')?.value.trim() || '';
    const extractedVid = extractYouTubeVideoId(rawVideoUrl);
    const videoUrl = extractedVid ? `https://www.youtube.com/watch?v=${extractedVid}` : rawVideoUrl;
    formData.set('video_url', videoUrl);

    try {
      const url = isEdit ? `/api/phones/${phoneId}` : '/api/phones';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        body: formData
      });
      const json = await res.json();

      if (json.success) {
        alert(isEdit ? 'Phone updated successfully!' : 'Phone created successfully!');
        window.location.href = '/admin/phones';
      } else {
        alert(json.message || 'Error saving phone');
      }
    } catch (err) {
      console.error('Save phone error:', err);
      alert('Error saving phone. Please check required fields.');
    }
  });
}

// ── Shared YouTube Video Review & Preview Helpers ─────────────────────────────
function updateVideoPreview() {
  const videoUrlInput = document.getElementById('phoneVideoUrl');
  const btnClearVideoUrl = document.getElementById('btnClearVideoUrl');
  const videoPreviewBox = document.getElementById('adminVideoPreviewBox');
  const videoPreviewIframe = document.getElementById('adminVideoPreviewIframe');
  const previewVideoIdBadge = document.getElementById('previewVideoIdBadge');

  if (!videoUrlInput) return;
  const url = videoUrlInput.value.trim();
  if (btnClearVideoUrl) btnClearVideoUrl.style.display = url ? 'inline-flex' : 'none';

  const videoId = extractYouTubeVideoId(url);
  if (videoId && videoPreviewBox && videoPreviewIframe) {
    videoPreviewIframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    videoPreviewIframe.src = `https://www.youtube.com/embed/${videoId}`;
    if (previewVideoIdBadge) previewVideoIdBadge.textContent = `ID: ${videoId} (Ready to embed)`;
    videoPreviewBox.style.display = 'block';
  } else {
    if (videoPreviewIframe) videoPreviewIframe.src = '';
    if (videoPreviewBox) videoPreviewBox.style.display = 'none';
  }
}

// ── Shared External Store Deals & Post External Links Row Builder ───────────
function addAffiliateRow(store = '', price = '', url = '') {
  const affiliateContainer = document.getElementById('affiliateRowsContainer');
  if (!affiliateContainer) return;

  const row = document.createElement('div');
  row.className = 'affiliate-row-item';

  row.innerHTML = `
    <div>
      <input type="text" class="form-control aff-store-input" placeholder="e.g. Official Site, Amazon, Daraz" value="${escapeHtml(store)}" list="storePresetsList">
      <datalist id="storePresetsList">
        <option value="Official Store">
        <option value="Official Website">
        <option value="Amazon">
        <option value="Daraz">
        <option value="PriceOye">
        <option value="AliExpress">
        <option value="Telemart">
        <option value="Shophive">
        <option value="GSMArena Source">
        <option value="WhatMobile Source">
      </datalist>
    </div>
    <div>
      <input type="text" class="form-control aff-price-input" placeholder="e.g. Rs. 289,999 or Official Page" value="${escapeHtml(price)}">
    </div>
    <div>
      <input type="url" class="form-control aff-url-input" placeholder="https://..." value="${escapeHtml(url)}">
    </div>
    <div>
      <button type="button" class="btn-remove-row btn-remove-aff-row" title="Remove external link">&times;</button>
    </div>
  `;

  const removeBtn = row.querySelector('.btn-remove-aff-row');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      row.remove();
    });
  }

  affiliateContainer.appendChild(row);
}

async function populateBrandDropdown(selectedId = null) {
  const select = document.getElementById('phoneBrandSelect');
  if (!select) return;

  try {
    const res = await fetch('/api/brands');
    const json = await res.json();

    if (json.success && json.data) {
      select.innerHTML = '<option value="">-- Select Brand --</option>' + json.data.map(b => `
        <option value="${b.id}" ${selectedId && selectedId == b.id ? 'selected' : ''}>${b.name}</option>
      `).join('');
    }
  } catch (err) {
    console.error('Error fetching brands for dropdown:', err);
  }
}

async function loadPhoneDataForEdit(id) {
  try {
    const res = await fetch(`/api/phones/${id}`);
    const json = await res.json();

    if (!json.success || !json.data) {
      alert('Phone not found');
      return;
    }

    const p = json.data;
    const form = document.getElementById('phoneForm');
    form.brand_id.value = p.brand_id;
    form.name.value = p.name;
    form.slug.value = p.slug;
    form.price.value = p.price;
    form.status.value = p.status || 'Available';
    form.release_date.value = p.release_date || '';

    // Load Short Summary / Key Highlights into Quill & textarea
    if (typeof window.setAdminSummaryContent === 'function') {
      window.setAdminSummaryContent(p.short_description || '');
    } else {
      form.short_description.value = p.short_description || '';
      if (window.quillSummary) {
        if ((p.short_description || '').startsWith('<')) {
          window.quillSummary.clipboard.dangerouslyPasteHTML(0, p.short_description);
        } else {
          window.quillSummary.setText(p.short_description || '');
        }
      }
    }

    form.featured.checked = !!p.featured;
    form.popular.checked = !!p.popular;

    if (p.image) {
      const previewImg = document.getElementById('currentImagePreview');
      const btnDeletePhoneImage = document.getElementById('btnDeletePhoneImage');
      if (previewImg) {
        previewImg.src = p.image;
        previewImg.style.display = 'block';
      }
      if (btnDeletePhoneImage && p.image !== '/images/placeholder.svg') {
        btnDeletePhoneImage.style.display = 'inline-flex';
      }
    }

    // Populate Gallery Images in Edit Mode
    try {
      if (typeof window.renderAdminGallery === 'function') {
        if (p.images && p.images.length > 0) {
          window.renderAdminGallery(p.images, p.image);
        } else if (p.image && p.image !== '/images/placeholder.svg') {
          window.renderAdminGallery([p.image], p.image);
        }
      }
    } catch (errGal) {
      console.warn('Gallery populate warning in edit mode:', errGal);
    }

    // Populate Multi-Currency Prices
    try {
      if (p.prices && Array.isArray(p.prices)) {
        for (const pr of p.prices) {
          if (pr.country === 'Pakistan') { const el = document.getElementById('pricePKR'); if (el) el.value = pr.amount; }
          if (pr.country === 'USA') { const el = document.getElementById('priceUSD'); if (el) el.value = pr.amount; }
          if (pr.country === 'UAE') { const el = document.getElementById('priceAED'); if (el) el.value = pr.amount; }
          if (pr.country === 'India') { const el = document.getElementById('priceINR'); if (el) el.value = pr.amount; }
          if (pr.country === 'UK') { const el = document.getElementById('priceGBP'); if (el) el.value = pr.amount; }
        }
      }
    } catch (errPrice) {
      console.warn('Price populate warning in edit mode:', errPrice);
    }

    // Populate YouTube Video URL
    try {
      const vInput = document.getElementById('phoneVideoUrl');
      if (vInput) {
        vInput.value = p.video_url || '';
        if (typeof updateVideoPreview === 'function') updateVideoPreview();
      }
    } catch (errVid) {
      console.warn('Video preview warning in edit mode:', errVid);
    }

    // Populate Post External Links & Store Deals
    try {
      const affContainer = document.getElementById('affiliateRowsContainer');
      if (affContainer) {
        affContainer.innerHTML = '';
        let affLinks = p.affiliate_links;
        if (typeof affLinks === 'string') {
          try { affLinks = JSON.parse(affLinks); } catch (_) { affLinks = []; }
        }
        if (Array.isArray(affLinks) && affLinks.length > 0) {
          for (const item of affLinks) {
            if (item && item.store) {
              addAffiliateRow(item.store || '', item.price || '', item.url || item.link || '');
            }
          }
        }
      }
    } catch (errAff) {
      console.warn('Affiliate rows populate warning in edit mode:', errAff);
    }

    // Populate ALL Fetched Technical Specifications Builder Rows (Section 6)
    try {
      const container = document.getElementById('specRowsContainer');
      if (container) {
        container.innerHTML = '';
        const specsList = [];
        if (Array.isArray(p.raw_specs) && p.raw_specs.length > 0) {
          for (const s of p.raw_specs) {
            specsList.push({ section: s.section, key: s.spec_key || s.key || '', value: s.spec_value || s.value || '' });
          }
        } else if (Array.isArray(p.specs) && p.specs.length > 0) {
          for (const s of p.specs) {
            specsList.push({ section: s.section, key: s.key || s.spec_key || '', value: s.value || s.spec_value || '' });
          }
        } else if (p.specs && typeof p.specs === 'object') {
          for (const [sec, items] of Object.entries(p.specs)) {
            if (Array.isArray(items)) {
              for (const item of items) {
                specsList.push({ section: sec, key: item.key || item.spec_key || '', value: item.value || item.spec_value || '' });
              }
            }
          }
        }

        if (specsList.length > 0) {
          for (const s of specsList) {
            addSpecRow(s.section, s.key, s.value);
          }
        } else {
          populateDefaultSpecTemplate();
        }
      }
    } catch (errSpec) {
      console.error('Specs rows populate error in edit mode:', errSpec);
    }
  } catch (err) {
    console.error('Error loading phone for edit:', err);
  }
}

function addSpecRow(section = 'Display', key = '', value = '') {
  const container = document.getElementById('specRowsContainer');
  if (!container) return;

  const trimmedSec = (section || 'Display').trim();
  const allSections = [...STANDARD_SECTIONS];
  if (trimmedSec && !allSections.some(s => s.toLowerCase() === trimmedSec.toLowerCase())) {
    allSections.push(trimmedSec);
  }

  const sectionOptions = allSections.map(s => {
    const isSelected = s.toLowerCase() === trimmedSec.toLowerCase();
    return `<option value="${escapeHtml(s)}" ${isSelected ? 'selected' : ''}>${escapeHtml(s)}</option>`;
  }).join('');

  const row = document.createElement('div');
  row.className = 'spec-row-item';

  row.innerHTML = `
    <select class="form-control spec-section-select">${sectionOptions}</select>
    <input type="text" class="form-control spec-key-input" placeholder="Field (e.g. Size)" value="${escapeHtml(key)}">
    <input type="text" class="form-control spec-val-input" placeholder="Value (e.g. 6.8 inches)" value="${escapeHtml(value)}">
    <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()" title="Delete row">&times;</button>
  `;

  container.appendChild(row);
}

/**
 * Derive Rich Highlights with headings, font colors, and 2 to 5 internal brand device links
 */
async function deriveRichHighlightsFromSpecRowsAsync() {
  const rows = document.querySelectorAll('.spec-row-item');
  const specs = [];
  rows.forEach(row => {
    const sec = row.querySelector('.spec-section-select')?.value || '';
    const k = row.querySelector('.spec-key-input')?.value || '';
    const v = row.querySelector('.spec-val-input')?.value || '';
    if (k && v) {
      specs.push({ section: sec, key: k, value: v });
    }
  });

  if (specs.length === 0) return '';

  const name = (document.getElementById('phoneNameInput')?.value || '').trim();
  const brandSelect = document.getElementById('phoneBrandSelect');
  const brandId = brandSelect ? brandSelect.value : '';
  const brand = (brandSelect && brandSelect.selectedIndex >= 0)
    ? brandSelect.options[brandSelect.selectedIndex].text.replace(/-- Select Brand --/i, '').trim()
    : '';
  const pricePKR = document.getElementById('pricePKR')?.value 
    || (document.getElementById('phonePriceInput')?.value ? 'Rs. ' + parseFloat(document.getElementById('phonePriceInput').value).toLocaleString() : '');
  const priceUSD = document.getElementById('priceUSD')?.value || '';
  const releaseDate = document.getElementById('phoneReleaseDate')?.value || '';

  const safeName = name || '';
  const safeBrand = brand || '';
  const fullName = safeBrand && !safeName.toLowerCase().startsWith(safeBrand.toLowerCase()) 
    ? `${safeBrand} ${safeName}`.trim() 
    : (safeName || safeBrand || 'Mobile Device');

  function findSpec(secRegex, keyRegex) {
    const item = specs.find(s => secRegex.test(s.section || '') && keyRegex.test(s.key || ''));
    return item ? item.value : '';
  }

  const displaySizeVal = findSpec(/display/i, /size/i);
  const displayTypeVal = findSpec(/display/i, /type|technology/i);
  const displayResVal = findSpec(/display/i, /resolution/i);
  const displayExtra = findSpec(/display/i, /extra|refresh/i);

  const chipsetVal = findSpec(/platform|processor/i, /chipset|cpu|processor/i);
  const osVal = findSpec(/platform/i, /os/i);
  const gpuVal = findSpec(/platform/i, /gpu/i);

  const memoryVal = findSpec(/memory/i, /internal|built-in|storage/i);
  const ramVal = findSpec(/memory/i, /ram/i);
  const romVal = findSpec(/memory/i, /internal storage|rom/i);

  const mainCamVal = findSpec(/camera|main camera/i, /triple|dual|single|quad|main/i);
  const selfieVal = findSpec(/selfie|camera/i, /single|front|selfie/i);

  const batteryVal = findSpec(/battery/i, /capacity|type/i);
  const chargingVal = findSpec(/battery/i, /charging|fast charging/i);
  const fingerprintVal = findSpec(/features/i, /fingerprint|sensors/i);

  let priceStr = pricePKR ? (pricePKR.startsWith('PKR') || pricePKR.startsWith('Rs') ? pricePKR : `Rs. ${pricePKR}`) : '';
  if (!priceStr) priceStr = 'is expected to be announced soon';
  else priceStr = `is expected to be ${priceStr}`;

  let releaseStr = releaseDate ? ` ${fullName} is expected to be launched on ${releaseDate}.` : '';

  let memVariant = '';
  if (ramVal && romVal) {
    memVariant = ` This is the ${ramVal} / ${romVal} variant of ${safeBrand || fullName}.`;
  } else if (memoryVal) {
    const cleanMem = memoryVal.split(';')[0].replace(/\(.*?\)/g, '').trim();
    if (cleanMem) memVariant = ` This is the ${cleanMem} variant of ${safeBrand || fullName}.`;
  }

  const formattedPKR = pricePKR ? (pricePKR.startsWith('PKR') ? pricePKR.replace('PKR', 'Rs.') : (pricePKR.startsWith('Rs') ? pricePKR : `Rs. ${pricePKR}`)) : '';
  const cleanUSD = priceUSD ? priceUSD.replace(/USD|\$/gi, '').trim() : '';

  let tagline = `${fullName} — Powerful &amp; Modern Flagship`;
  if (batteryVal && /\b(6000|7000|6500|5500)\s*mAh/i.test(batteryVal)) {
    tagline = `${fullName} — Exceptional Long-Lasting Battery Smartphone`;
  } else if (mainCamVal && /\b(108|200|50)\s*MP/i.test(mainCamVal)) {
    tagline = `${fullName} — Ultra High-Resolution Camera Phone`;
  }

  let story = `${fullName} is officially introduced with cutting-edge mobile hardware. `;
  if (chipsetVal) {
    story += `The smartphone is powered by the capable <strong>${chipsetVal.replace(/\(.*?\)/g, '').trim()}</strong> processor, delivering seamless multitasking and snappy responsiveness. `;
  }
  if (gpuVal) {
    story += `Graphical rendering and immersive gaming are handled by the <strong>${gpuVal.replace(/\(.*?\)/g, '').trim()}</strong> GPU. `;
  }

  if (displaySizeVal || displayTypeVal) {
    let dispDesc = [];
    if (displaySizeVal) dispDesc.push(displaySizeVal.match(/[\d.]+\s*(?:inches|inch|")/i)?.[0] || displaySizeVal.split(',')[0]);
    if (displayTypeVal) dispDesc.push(displayTypeVal.split(',')[0]);
    if (displayExtra && /\d+Hz/i.test(displayExtra)) dispDesc.push(displayExtra.match(/\d+Hz/i)?.[0]);
    if (displayResVal) dispDesc.push(`with a crisp resolution of ${displayResVal.split(',')[0].trim()}`);
    story += `On the front, the phone features a stunning <strong>${dispDesc.join(' ')}</strong> display, delivering vivid colors and sharp viewing angles. `;
  }

  if (mainCamVal) {
    story += `In optics, the device is equipped with a <strong>${mainCamVal.split('\n')[0].replace(/\(.*?\)/g, '').trim()}</strong> main camera setup for sharp photography and high-definition video recording. `;
  }
  if (selfieVal) {
    story += `The front camera features a <strong>${selfieVal.split('\n')[0].replace(/\(.*?\)/g, '').trim()}</strong> shooter for selfies and video calls. `;
  }

  if (batteryVal) {
    const mahMatch = batteryVal.match(/\d{3,5}\s*mAh/i)?.[0] || batteryVal.split(',')[0];
    const chargingStr = chargingVal ? ` backed by ${chargingVal.split(',')[0].trim()}` : '';
    story += `The phone is powered by a generous <strong>${mahMatch}</strong> battery${chargingStr}, ensuring reliable all-day endurance. `;
  }

  if (osVal) {
    story += `The handset runs on <strong>${osVal.split(',')[0].trim()}</strong> out of the box with the latest software security features. `;
  }

  // Fetch 2 to 5 related brand devices for internal linking
  let relatedHtml = '';
  if (brandId) {
    try {
      const res = await fetch(`/api/phones?brand=${encodeURIComponent(brandId)}&limit=10`);
      const json = await res.json();
      const list = (json.data && json.data.phones) ? json.data.phones : (Array.isArray(json.data) ? json.data : []);
      const pathParts = window.location.pathname.split('/');
      const currentPhoneId = pathParts.includes('edit') ? pathParts[pathParts.length - 1] : null;

      const related = list.filter(p => {
        if (currentPhoneId && p.id == currentPhoneId) return false;
        if (name && p.name.trim().toLowerCase() === name.trim().toLowerCase()) return false;
        return true;
      }).slice(0, 5);

      if (related.length >= 2) {
        relatedHtml = `
          <h3>Related ${escapeHtml(brand)} Devices to Compare</h3>
          <p>Explore other popular <strong>${escapeHtml(brand)}</strong> smartphones available in Pakistan:</p>
          <ul>
            ${related.map(p => {
              const pPrice = p.price > 0 ? ` — PKR ${Number(p.price).toLocaleString()}` : '';
              return `<li><a href="/phone/${escapeAttr(p.slug)}" title="${escapeAttr(p.name)} Specs & Price in Pakistan">${escapeHtml(p.name)}</a>${pPrice}</li>`;
            }).join('')}
          </ul>
        `;
      }
    } catch (_) {}
  }

  const html = `
    <h2>${escapeHtml(fullName)} Price in Pakistan &amp; Overview</h2>
    <p><strong>${escapeHtml(fullName)} price in Pakistan</strong> ${priceStr}.${releaseStr}${memVariant}</p>
    ${formattedPKR ? `<p>Expected Price of <strong>${escapeHtml(fullName)}</strong> in Pakistan is <span style="color: rgb(13, 148, 136); font-weight: 700;">${formattedPKR}</span>${cleanUSD ? ` ($${cleanUSD} USD)` : ''}.</p>` : ''}
    <h3>${tagline}</h3>
    <p>${story}</p>
    ${relatedHtml}
  `;

  return html.trim();
}

function deriveHighlightsFromSpecRows() {
  const rows = document.querySelectorAll('.spec-row-item');
  const specs = [];
  rows.forEach(row => {
    const sec = row.querySelector('.spec-section-select')?.value || '';
    const k = row.querySelector('.spec-key-input')?.value || '';
    const v = row.querySelector('.spec-val-input')?.value || '';
    if (k && v) {
      specs.push({ section: sec, key: k, value: v });
    }
  });

  if (specs.length === 0) return '';

  const name = document.getElementById('phoneNameInput')?.value || '';
  const brandSelect = document.getElementById('phoneBrandSelect');
  const brand = (brandSelect && brandSelect.selectedIndex >= 0)
    ? brandSelect.options[brandSelect.selectedIndex].text.replace(/-- Select Brand --/i, '').trim()
    : '';
  const pricePKR = document.getElementById('pricePKR')?.value 
    || (document.getElementById('phonePriceInput')?.value ? 'Rs. ' + parseFloat(document.getElementById('phonePriceInput').value).toLocaleString() : '');
  const priceUSD = document.getElementById('priceUSD')?.value || '';
  const releaseDate = document.getElementById('phoneReleaseDate')?.value || '';

  const safeName = name || '';
  const safeBrand = brand || '';
  const fullName = safeBrand && !safeName.toLowerCase().startsWith(safeBrand.toLowerCase()) 
    ? `${safeBrand} ${safeName}`.trim() 
    : (safeName || safeBrand || 'Mobile Device');

  function findSpec(secRegex, keyRegex) {
    const item = specs.find(s => secRegex.test(s.section || '') && keyRegex.test(s.key || ''));
    return item ? item.value : '';
  }

  const displaySizeVal = findSpec(/display/i, /size/i);
  const displayTypeVal = findSpec(/display/i, /type|technology/i);
  const displayResVal = findSpec(/display/i, /resolution/i);
  const displayExtra = findSpec(/display/i, /extra|refresh/i);

  const chipsetVal = findSpec(/platform|processor/i, /chipset|cpu|processor/i);
  const osVal = findSpec(/platform/i, /os/i);
  const gpuVal = findSpec(/platform/i, /gpu/i);

  const memoryVal = findSpec(/memory/i, /internal|built-in|storage/i);
  const ramVal = findSpec(/memory/i, /ram/i);
  const romVal = findSpec(/memory/i, /internal storage|rom/i);

  const mainCamVal = findSpec(/camera|main camera/i, /triple|dual|single|quad|main/i);
  const selfieVal = findSpec(/selfie|camera/i, /single|front|selfie/i);

  const batteryVal = findSpec(/battery/i, /capacity|type/i);
  const chargingVal = findSpec(/battery/i, /charging|fast charging/i);
  const fingerprintVal = findSpec(/features/i, /fingerprint|sensors/i);

  const lines = [];

  // Title header
  lines.push(`${fullName} price in Pakistan`);

  let priceStr = pricePKR ? (pricePKR.startsWith('PKR') || pricePKR.startsWith('Rs') ? pricePKR : `Rs. ${pricePKR}`) : '';
  if (!priceStr) priceStr = 'is expected to be announced soon';
  else priceStr = `is expected to be ${priceStr}`;

  let releaseStr = releaseDate ? ` ${fullName} is expected to be launched on ${releaseDate}.` : '';

  let memVariant = '';
  if (ramVal && romVal) {
    memVariant = ` This is ${ramVal} / ${romVal} variant of ${safeBrand || fullName}.`;
  } else if (memoryVal) {
    const cleanMem = memoryVal.split(';')[0].replace(/\(.*?\)/g, '').trim();
    if (cleanMem) memVariant = ` This is ${cleanMem} variant of ${safeBrand || fullName}.`;
  }

  lines.push(`${fullName} price in Pakistan ${priceStr}.${releaseStr}${memVariant}`);

  if (pricePKR) {
    const formattedPKR = pricePKR.startsWith('PKR') ? pricePKR.replace('PKR', 'Rs.') : (pricePKR.startsWith('Rs') ? pricePKR : `Rs. ${pricePKR}`);
    lines.push(`Expected Price of ${fullName} in Pakistan is ${formattedPKR}.`);
  }
  if (priceUSD) {
    const cleanUSD = priceUSD.replace(/USD|\$/gi, '').trim();
    lines.push(`Expected Price of ${safeBrand || fullName} in USD is $${cleanUSD}.`);
  }

  let tagline = `${fullName} - Powerful & Stylish Device!`;
  if (batteryVal && /\b(6000|7000|6500|5500)\s*mAh/i.test(batteryVal)) {
    tagline = `${fullName} - A Big Battery Smartphone!`;
  } else if (mainCamVal && /\b(108|200|50)\s*MP/i.test(mainCamVal)) {
    tagline = `${fullName} - High-Resolution Camera Phone!`;
  }

  let story = `${tagline}\n`;
  story += `${fullName} is officially introduced with cutting-edge mobile hardware. `;

  if (chipsetVal) {
    story += `The smartphone is powered by the capable ${chipsetVal.replace(/\(.*?\)/g, '').trim()} chipset, providing smooth multitasking and reliable execution speed. `;
  }
  if (gpuVal) {
    story += `Graphical performance and gaming are handled by the ${gpuVal.replace(/\(.*?\)/g, '').trim()} GPU. `;
  }

  if (displaySizeVal || displayTypeVal) {
    let dispDesc = [];
    if (displaySizeVal) dispDesc.push(displaySizeVal.match(/[\d.]+\s*(?:inches|inch|")/i)?.[0] || displaySizeVal.split(',')[0]);
    if (displayTypeVal) dispDesc.push(displayTypeVal.split(',')[0]);
    if (displayExtra && /\d+Hz/i.test(displayExtra)) dispDesc.push(displayExtra.match(/\d+Hz/i)?.[0]);
    if (displayResVal) dispDesc.push(`with a crisp resolution of ${displayResVal.split(',')[0].trim()}`);
    story += `On the front, ${fullName} features a stunning ${dispDesc.join(' ')} display, delivering rich colors and immersive viewing angles. `;
  }

  if (mainCamVal) {
    story += `In the optics department, the handset will come equipped with a ${mainCamVal.split('\n')[0].replace(/\(.*?\)/g, '').trim()} setup for sharp photos and stabilized video recording. `;
  }
  if (selfieVal) {
    story += `The selfie shooter of the phone will be a ${selfieVal.split('\n')[0].replace(/\(.*?\)/g, '').trim()} sensor. `;
  }

  if (memoryVal || ramVal) {
    const memDesc = (ramVal && romVal) ? `${ramVal} RAM and ${romVal} storage` : (memoryVal ? memoryVal.split(',')[0].trim() : '');
    if (memDesc) {
      story += `It offers ${memDesc} to comfortably store apps, photos, and high-definition media without running out of space. `;
    }
  }

  if (batteryVal) {
    const mahMatch = batteryVal.match(/\d{3,5}\s*mAh/i)?.[0] || batteryVal.split(',')[0];
    const chargingStr = chargingVal ? ` backed by ${chargingVal.split(',')[0].trim()}` : '';
    story += `The handset is fueled with a generous ${mahMatch} battery${chargingStr}, ensuring full-day battery endurance with ease. `;
  }

  if (osVal) {
    story += `The device runs on ${osVal.split(',')[0].trim()}, offering an intuitive user experience and the latest security updates. `;
  }
  if (fingerprintVal) {
    story += `Security features include a fast ${fingerprintVal.split(',')[0].trim()}. `;
  }

  story += `The coming ${fullName} will be a strong contender in its market segment.`;

  lines.push('');
  lines.push(story);

  return lines.join('\n');
}

function populateDefaultSpecTemplate() {
  const container = document.getElementById('specRowsContainer');
  if (!container) return;
  container.innerHTML = '';

  const defaults = [
    { section: 'Network', key: 'Technology', value: 'GSM / HSPA / LTE / 5G' },
    { section: 'Network', key: '5G', value: 'SA/NSA' },
    { section: 'Launch', key: 'Status', value: 'Available' },
    { section: 'Launch', key: 'Release Date', value: '2026' },
    { section: 'Body', key: 'Dimensions', value: '162 x 75 x 8 mm' },
    { section: 'Body', key: 'Weight', value: '200 g' },
    { section: 'Display', key: 'Type', value: 'AMOLED, 120Hz' },
    { section: 'Display', key: 'Size', value: '6.7 inches' },
    { section: 'Display', key: 'Resolution', value: '1080 x 2400 pixels' },
    { section: 'Platform', key: 'OS', value: 'Android 15' },
    { section: 'Platform', key: 'Chipset', value: 'Octa-core 3.0 GHz' },
    { section: 'Memory', key: 'RAM', value: '12GB' },
    { section: 'Memory', key: 'Internal Storage', value: '256GB' },
    { section: 'Main Camera', key: 'Main sensor', value: '50 MP, f/1.8, OIS' },
    { section: 'Selfie Camera', key: 'Camera', value: '32 MP' },
    { section: 'Battery', key: 'Capacity', value: '5000 mAh' },
    { section: 'Battery', key: 'Charging', value: '67W fast charging' },
    { section: 'Connectivity', key: 'WLAN', value: 'Wi-Fi 6' },
    { section: 'Features', key: 'Fingerprint', value: 'Under display optical' }
  ];

  for (const d of defaults) {
    addSpecRow(d.section, d.key, d.value);
  }
}

// 6. Admin Brands Management (Search, Filter, Create, Edit, Delete)
async function initBrandsList() {
  const tbody = document.getElementById('adminBrandsTableBody');
  if (!tbody) return;

  loadAdminBrands();

  // Search input for brands
  const searchInput = document.getElementById('adminBrandSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterAndRenderBrands();
    });
  }

  // Status filter for brands
  const statusSelect = document.getElementById('adminBrandFilterStatus');
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      filterAndRenderBrands();
    });
  }

  // Brand form submit
  const brandForm = document.getElementById('brandModalForm');
  if (brandForm) {
    brandForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(brandForm);
      const brandId = document.getElementById('modalBrandId').value;
      const isEdit = !!brandId;

      // Clean up empty logo file input so multer does not receive empty file
      const logoInput = document.getElementById('modalBrandLogo');
      if (!logoInput || !logoInput.files || logoInput.files.length === 0) {
        formData.delete('logo');
      }

      try {
        const url = isEdit ? `/api/brands/${brandId}` : '/api/brands';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, { method, body: formData });
        const json = await res.json();

        if (json.success) {
          closeBrandModal();
          loadAdminBrands();
        } else {
          alert(json.message || 'Error saving brand');
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Live Brand Logo Preview & Color Picker Handlers
  setupBrandModalLogoHandlers();
}

const BRAND_PRESET_COLORS = [
  { name: 'Samsung Blue', color: '#1428a0' },
  { name: 'OnePlus Red', color: '#eb0028' },
  { name: 'Xiaomi Orange', color: '#ff6900' },
  { name: 'Vivo Indigo', color: '#415fff' },
  { name: 'Oppo Green', color: '#008453' },
  { name: 'Google Blue', color: '#4285f4' },
  { name: 'Realme Gold', color: '#d97706' },
  { name: 'Tecno Cyan', color: '#0072ce' },
  { name: 'Infinix Green', color: '#00a850' },
  { name: 'Huawei Red', color: '#cf0a2c' },
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Deep Pink', color: '#db2777' },
  { name: 'Sky Blue', color: '#0284c7' },
  { name: 'Teal', color: '#0d9488' },
  { name: 'Slate Black', color: '#111827' }
];

let userSelectedBrandColor = null;

function getDeterministicBrandColor(name = '') {
  if (!name) return '#1428a0';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#1428a0', '#eb0028', '#ff6900', '#415fff', '#008453',
    '#4285f4', '#d97706', '#0072ce', '#00a850', '#cf0a2c',
    '#7c3aed', '#db2777', '#0d9488', '#0284c7', '#4f46e5',
    '#b91c1c', '#059669', '#9333ea', '#111827', '#ea580c'
  ];
  return colors[Math.abs(hash) % colors.length];
}

function renderBrandColorSwatches(activeColor = '#1428a0') {
  const container = document.getElementById('brandColorSwatches');
  if (!container) return;

  container.innerHTML = BRAND_PRESET_COLORS.map(p => `
    <span class="brand-color-dot ${p.color.toLowerCase() === activeColor.toLowerCase() ? 'active' : ''}" 
          style="background: ${p.color};" 
          title="${p.name} (${p.color})" 
          data-color="${p.color}"></span>
  `).join('') + `
    <input type="color" id="brandCustomColorPicker" value="${activeColor}" title="Pick custom color" style="width: 24px; height: 24px; padding: 0; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; border-radius: 50%; vertical-align: middle;">
  `;

  // Attach click listeners to swatches
  container.querySelectorAll('.brand-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      selectBrandColor(dot.dataset.color);
    });
  });

  const customPicker = document.getElementById('brandCustomColorPicker');
  if (customPicker) {
    customPicker.addEventListener('input', () => {
      selectBrandColor(customPicker.value);
    });
  }
}

function selectBrandColor(col) {
  userSelectedBrandColor = col;
  const hiddenInput = document.getElementById('modalBrandColor');
  if (hiddenInput) hiddenInput.value = col;

  const previewText = document.getElementById('brandLogoPreviewText');
  if (previewText) previewText.style.color = col;

  document.querySelectorAll('.brand-color-dot').forEach(dot => {
    if (dot.dataset.color.toLowerCase() === col.toLowerCase()) {
      dot.classList.add('active');
    } else {
      dot.classList.remove('active');
    }
  });

  const customPicker = document.getElementById('brandCustomColorPicker');
  if (customPicker && customPicker.value !== col) {
    customPicker.value = col;
  }
}

function setupBrandModalLogoHandlers() {
  const nameInput = document.getElementById('modalBrandName');
  const slugInput = document.getElementById('modalBrandSlug');
  const previewText = document.getElementById('brandLogoPreviewText');
  const previewImg = document.getElementById('brandLogoPreviewImg');
  const previewNote = document.getElementById('brandLogoPreviewNote');
  const logoInput = document.getElementById('modalBrandLogo');

  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const val = nameInput.value.trim();
      if (slugInput && !document.getElementById('modalBrandId').value) {
        slugInput.value = slugify(nameInput.value);
      }
      if (previewText) {
        previewText.innerText = (val || 'BRAND').toUpperCase();
        // If user hasn't explicitly chosen a color dot, auto-pick a vibrant color matching brand name
        if (!userSelectedBrandColor) {
          const autoColor = getDeterministicBrandColor(val);
          previewText.style.color = autoColor;
          const colorInput = document.getElementById('modalBrandColor');
          if (colorInput) colorInput.value = autoColor;
          renderBrandColorSwatches(autoColor);
        }
      }
    });
  }

  const btnDeleteLogo = document.getElementById('btnDeleteBrandLogo');
  const removeLogoInput = document.getElementById('modalRemoveLogo');

  if (btnDeleteLogo) {
    btnDeleteLogo.addEventListener('click', () => {
      if (logoInput) logoInput.value = '';
      if (removeLogoInput) removeLogoInput.value = 'true';
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }
      if (previewText) previewText.style.display = 'block';
      if (previewNote) previewNote.innerText = 'Reverted to auto-styled badge';
      btnDeleteLogo.style.display = 'none';
    });
  }

  if (logoInput) {
    logoInput.addEventListener('change', () => {
      const file = logoInput.files && logoInput.files[0];
      if (file) {
        if (removeLogoInput) removeLogoInput.value = 'false';
        if (btnDeleteLogo) btnDeleteLogo.style.display = 'inline-flex';
        const reader = new FileReader();
        reader.onload = (e) => {
          if (previewImg) {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
          }
          if (previewText) previewText.style.display = 'none';
          if (previewNote) previewNote.innerText = 'New custom file selected';
        };
        reader.readAsDataURL(file);
      } else {
        if (previewImg) previewImg.style.display = 'none';
        if (previewText) previewText.style.display = 'block';
        if (previewNote) previewNote.innerText = 'Auto-styled badge';
        if (btnDeleteLogo) btnDeleteLogo.style.display = 'none';
      }
    });
  }
}


async function loadAdminBrands() {
  const tbody = document.getElementById('adminBrandsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/brands');
    const json = await res.json();

    if (json.success && json.data) {
      adminBrandsList = json.data;
      filterAndRenderBrands();
    }
  } catch (err) {
    console.error('Error fetching admin brands:', err);
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #dc2626; padding: 24px;">Failed to load brands.</td></tr>`;
  }
}

function filterAndRenderBrands() {
  const tbody = document.getElementById('adminBrandsTableBody');
  const countBadge = document.getElementById('adminBrandsCountBadge');
  if (!tbody) return;

  const search = (document.getElementById('adminBrandSearchInput')?.value || '').toLowerCase().trim();
  const statusFilter = document.getElementById('adminBrandFilterStatus')?.value || '';

  let filtered = adminBrandsList.filter(b => {
    const matchesSearch = !search || b.name.toLowerCase().includes(search) || b.slug.toLowerCase().includes(search);
    const matchesStatus = !statusFilter || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (countBadge) {
    countBadge.innerText = `Total: ${filtered.length} of ${adminBrandsList.length} Brands`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 24px;">No brands found matching your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => `
    <tr>
      <td>
        <img src="${b.logo || '/images/placeholder.svg'}" style="height: 34px; max-width: 90px; object-fit: contain; background: #f8fafc; border-radius: 4px; padding: 2px; border: 1px solid #e2e8f0;">
      </td>
      <td>
        <strong style="color: #0f172a; font-size: 14px;">${b.name}</strong>
      </td>
      <td>
        <code>${b.slug}</code>
      </td>
      <td>
        <span style="color: #64748b; font-size: 13px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 280px;">
          ${b.description || 'No description provided'}
        </span>
      </td>
      <td>
        <a href="/brand/${b.slug}" target="_blank" style="font-weight: 700; color: #0d9488; text-decoration: underline;">
          ${b.phone_count} models
        </a>
      </td>
      <td>
        <span class="phone-card-badge ${b.status === 'active' ? 'badge-available' : 'badge-discontinued'}">
          ${b.status}
        </span>
      </td>
      <td>
        <div style="display: flex; gap: 6px;">
          <button onclick='openEditBrandModal(${JSON.stringify(b)})' class="btn btn-outline btn-sm">Edit</button>
          <button onclick="handleDeleteBrand(${b.id}, '${escapeQuote(b.name)}')" class="btn btn-outline btn-sm" style="color: #dc2626; border-color: #fca5a5;">Delete</button>
          <a href="/brand/${b.slug}" target="_blank" class="btn btn-outline btn-sm">View</a>
        </div>
      </td>
    </tr>
  `).join('');
}

function openAddBrandModal() {
  document.getElementById('brandModalTitle').innerText = 'Add Brand';
  document.getElementById('modalBrandId').value = '';
  document.getElementById('modalBrandName').value = '';
  document.getElementById('modalBrandSlug').value = '';
  document.getElementById('modalBrandDesc').value = '';
  document.getElementById('modalBrandStatus').value = 'active';

  userSelectedBrandColor = null;
  const defaultCol = '#1428a0';
  const colorInput = document.getElementById('modalBrandColor');
  if (colorInput) colorInput.value = defaultCol;

  const previewText = document.getElementById('brandLogoPreviewText');
  const previewImg = document.getElementById('brandLogoPreviewImg');
  const previewNote = document.getElementById('brandLogoPreviewNote');
  const fileInput = document.getElementById('modalBrandLogo');
  const btnDeleteLogo = document.getElementById('btnDeleteBrandLogo');
  const removeLogoInput = document.getElementById('modalRemoveLogo');

  if (fileInput) fileInput.value = '';
  if (removeLogoInput) removeLogoInput.value = 'false';
  if (btnDeleteLogo) btnDeleteLogo.style.display = 'none';

  if (previewText) {
    previewText.innerText = 'BRAND';
    previewText.style.color = defaultCol;
    previewText.style.display = 'block';
  }
  if (previewImg) previewImg.style.display = 'none';
  if (previewNote) previewNote.innerText = 'Auto-styled badge';

  renderBrandColorSwatches(defaultCol);
  document.getElementById('brandModal').style.display = 'flex';
}

function openEditBrandModal(brand) {
  document.getElementById('brandModalTitle').innerText = 'Edit Brand';
  document.getElementById('modalBrandId').value = brand.id;
  document.getElementById('modalBrandName').value = brand.name;
  document.getElementById('modalBrandSlug').value = brand.slug;
  document.getElementById('modalBrandDesc').value = brand.description || '';
  document.getElementById('modalBrandStatus').value = brand.status || 'active';

  const previewText = document.getElementById('brandLogoPreviewText');
  const previewImg = document.getElementById('brandLogoPreviewImg');
  const previewNote = document.getElementById('brandLogoPreviewNote');
  const fileInput = document.getElementById('modalBrandLogo');
  const btnDeleteLogo = document.getElementById('btnDeleteBrandLogo');
  const removeLogoInput = document.getElementById('modalRemoveLogo');

  if (fileInput) fileInput.value = '';
  if (removeLogoInput) removeLogoInput.value = 'false';

  const brandCol = getDeterministicBrandColor(brand.name);
  userSelectedBrandColor = brandCol;
  const colorInput = document.getElementById('modalBrandColor');
  if (colorInput) colorInput.value = brandCol;

  if (brand.logo && !brand.logo.endsWith('-logo.svg')) {
    if (previewImg) {
      previewImg.src = brand.logo;
      previewImg.style.display = 'block';
    }
    if (previewText) previewText.style.display = 'none';
    if (previewNote) previewNote.innerText = 'Current uploaded logo';
    if (btnDeleteLogo) btnDeleteLogo.style.display = 'inline-flex';
  } else {
    if (previewText) {
      previewText.innerText = brand.name.toUpperCase();
      previewText.style.color = brandCol;
      previewText.style.display = 'block';
    }
    if (previewImg) previewImg.style.display = 'none';
    if (previewNote) previewNote.innerText = 'Auto-styled badge';
    if (btnDeleteLogo) btnDeleteLogo.style.display = 'none';
  }

  renderBrandColorSwatches(brandCol);
  document.getElementById('brandModal').style.display = 'flex';
}

function closeBrandModal() {
  document.getElementById('brandModal').style.display = 'none';
}

async function handleDeleteBrand(id, name) {
  if (!confirm(`Are you sure you want to delete brand "${name}"?\n\nWARNING: This will permanently delete the brand and all associated phones!`)) {
    return;
  }

  try {
    const res = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      loadAdminBrands();
    } else {
      alert(json.message || 'Error deleting brand');
    }
  } catch (err) {
    console.error('Delete brand error:', err);
    alert('Failed to delete brand. Check database connection.');
  }
}

// ==========================================================================
// 6. Site Settings & Head Snippets Management
// ==========================================================================

const SNIPPET_PRESETS = {
  adsense: `<!-- Google AdSense Auto Ads -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX"
     crossorigin="anonymous"></script>`,

  analytics: `<!-- Google tag (gtag.js) - Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>`,

  adsterra: `<!-- Adsterra Network Tag -->
<script type="text/javascript">
	atOptions = {
		'key' : 'YOUR_ADSTERRA_KEY_HERE',
		'format' : 'iframe',
		'height' : 250,
		'width' : 300,
		'params' : {}
	};
</script>
<script type="text/javascript" src="//www.highperformanceformat.com/YOUR_ADSTERRA_KEY_HERE/invoke.js"></script>`,

  search_console: `<!-- Google Search Console Verification -->
<meta name="google-site-verification" content="YOUR_VERIFICATION_TOKEN_HERE" />`,

  meta_pixel: `<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', 'YOUR_PIXEL_ID');
fbq('track', 'PageView');
</script>`
};

function initSettings() {
  const form = document.getElementById('siteSettingsForm');
  if (!form) return;

  const headInput = document.getElementById('head_snippets');
  const bodyInput = document.getElementById('body_snippets');
  const headToggle = document.getElementById('is_head_code_enabled');
  const bodyToggle = document.getElementById('is_body_code_enabled');
  const headStatusLabel = document.getElementById('headStatusLabel');
  const bodyStatusLabel = document.getElementById('bodyStatusLabel');
  const headCharCount = document.getElementById('headCodeCharCount');
  const bodyCharCount = document.getElementById('bodyCodeCharCount');

  // Update toggle labels
  if (headToggle && headStatusLabel) {
    headToggle.addEventListener('change', () => {
      headStatusLabel.innerText = headToggle.checked ? 'Active' : 'Disabled';
      headStatusLabel.style.color = headToggle.checked ? '#0d9488' : '#ef4444';
    });
  }

  if (bodyToggle && bodyStatusLabel) {
    bodyToggle.addEventListener('change', () => {
      bodyStatusLabel.innerText = bodyToggle.checked ? 'Active' : 'Disabled';
      bodyStatusLabel.style.color = bodyToggle.checked ? '#0d9488' : '#ef4444';
    });
  }

  // Update char counts
  if (headInput && headCharCount) {
    const updateHeadCount = () => {
      headCharCount.innerText = `${(headInput.value || '').length} characters`;
    };
    headInput.addEventListener('input', updateHeadCount);
    updateHeadCount();
  }

  if (bodyInput && bodyCharCount) {
    const updateBodyCount = () => {
      bodyCharCount.innerText = `${(bodyInput.value || '').length} characters`;
    };
    bodyInput.addEventListener('input', updateBodyCount);
    updateBodyCount();
  }

  // Load existing settings from server
  loadSettingsData();

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submitSettingsForm();
  });

  // Settings Sub-Menu Navigation (Branding vs General vs Ad Placements vs Profile vs Users)
  let initialSection = 'branding';
  if (window.location.hash === '#general') initialSection = 'general';
  else if (window.location.hash === '#ad-placements') initialSection = 'ads';
  else if (window.location.hash === '#profile') initialSection = 'profile';
  else if (window.location.hash === '#users') initialSection = 'users';
  switchSettingsSection(initialSection);

  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#branding') {
      switchSettingsSection('branding');
    } else if (window.location.hash === '#ad-placements') {
      switchSettingsSection('ads');
    } else if (window.location.hash === '#profile') {
      switchSettingsSection('profile');
    } else if (window.location.hash === '#users') {
      switchSettingsSection('users');
    } else if (window.location.hash === '#general') {
      switchSettingsSection('general');
    }
  });

  // Setup Branding drag-and-drop & live input listeners
  initBrandingEvents();
}

function safeSnippet(val) {
  if (!val || typeof val !== 'string') return '';
  try {
    return 'b64:' + btoa(unescape(encodeURIComponent(val)));
  } catch (e) {
    return val;
  }
}

async function loadSettingsData() {
  try {
    const res = await fetch('/api/admin/settings', { credentials: 'same-origin' });
    const data = await res.json();

    if (data.success && data.settings) {
      const s = data.settings;
      
      // Load Branding Fields
      const siteNameInput = document.getElementById('site_name');
      const siteTaglineInput = document.getElementById('site_tagline');
      const siteUrlInput = document.getElementById('site_url');
      const siteDescInput = document.getElementById('site_description');
      const footerCopyInput = document.getElementById('footer_copyright');
      const footerAboutInput = document.getElementById('footer_about');

      if (siteNameInput) siteNameInput.value = s.site_name || 'PhonesDaddy';
      if (siteTaglineInput) siteTaglineInput.value = s.site_tagline || '';
      if (siteUrlInput) siteUrlInput.value = s.site_url || '';
      if (siteDescInput) siteDescInput.value = s.site_description || '';
      if (footerCopyInput) footerCopyInput.value = s.footer_copyright || '';
      if (footerAboutInput) footerAboutInput.value = s.footer_about || '';

      currentBrandingState = {
        site_name: s.site_name || 'PhonesDaddy',
        site_tagline: s.site_tagline || '',
        site_url: s.site_url || '',
        site_description: s.site_description || '',
        site_logo: s.site_logo || '',
        site_favicon: s.site_favicon || '',
        footer_copyright: s.footer_copyright || '',
        footer_about: s.footer_about || ''
      };

      updateLogoPreview(s.site_logo);
      updateFaviconPreview(s.site_favicon);
      updateBrandMockups();
      updateAdminSidebarBrand(currentBrandingState);

      // Floating Social Channels (YouTube, Instagram, TikTok, Facebook, WhatsApp)
      const waNumberInput = document.getElementById('whatsapp_number');
      const waMsgInput = document.getElementById('whatsapp_message');
      const waToggle = document.getElementById('whatsapp_enabled');
      const waStatusLabel = document.getElementById('whatsappStatusLabel');

      const fbUrlInput = document.getElementById('facebook_url');
      const fbToggle = document.getElementById('facebook_enabled');
      const fbStatusLabel = document.getElementById('facebookStatusLabel');

      const ttUrlInput = document.getElementById('tiktok_url');
      const ttToggle = document.getElementById('tiktok_enabled');
      const ttStatusLabel = document.getElementById('tiktokStatusLabel');

      const ytUrlInput = document.getElementById('youtube_url');
      const ytToggle = document.getElementById('youtube_enabled');
      const ytStatusLabel = document.getElementById('youtubeStatusLabel');

      const igUrlInput = document.getElementById('instagram_url');
      const igToggle = document.getElementById('instagram_enabled');
      const igStatusLabel = document.getElementById('instagramStatusLabel');

      if (waNumberInput) waNumberInput.value = s.whatsapp_number || '';
      if (waMsgInput) waMsgInput.value = s.whatsapp_message || 'Hello! I have an inquiry from PhonesDaddy.';
      if (waToggle) {
        waToggle.checked = s.whatsapp_enabled !== '0' && s.whatsapp_enabled !== false;
        if (waStatusLabel) {
          waStatusLabel.innerText = waToggle.checked ? 'Active' : 'Disabled';
          waStatusLabel.style.color = waToggle.checked ? '#0d9488' : '#ef4444';
        }
        waToggle.onchange = () => {
          if (waStatusLabel) {
            waStatusLabel.innerText = waToggle.checked ? 'Active' : 'Disabled';
            waStatusLabel.style.color = waToggle.checked ? '#0d9488' : '#ef4444';
          }
          if (typeof updateSocialChannelsPreview === 'function') updateSocialChannelsPreview();
        };
      }

      if (fbUrlInput) fbUrlInput.value = s.facebook_url || '';
      if (fbToggle) {
        fbToggle.checked = s.facebook_enabled !== '0' && s.facebook_enabled !== false;
        if (fbStatusLabel) {
          fbStatusLabel.innerText = fbToggle.checked ? 'Active' : 'Disabled';
          fbStatusLabel.style.color = fbToggle.checked ? '#0d9488' : '#ef4444';
        }
        fbToggle.onchange = () => {
          if (fbStatusLabel) {
            fbStatusLabel.innerText = fbToggle.checked ? 'Active' : 'Disabled';
            fbStatusLabel.style.color = fbToggle.checked ? '#0d9488' : '#ef4444';
          }
          if (typeof updateSocialChannelsPreview === 'function') updateSocialChannelsPreview();
        };
      }

      if (ttUrlInput) ttUrlInput.value = s.tiktok_url || '';
      if (ttToggle) {
        ttToggle.checked = s.tiktok_enabled !== '0' && s.tiktok_enabled !== false;
        if (ttStatusLabel) {
          ttStatusLabel.innerText = ttToggle.checked ? 'Active' : 'Disabled';
          ttStatusLabel.style.color = ttToggle.checked ? '#0d9488' : '#ef4444';
        }
        ttToggle.onchange = () => {
          if (ttStatusLabel) {
            ttStatusLabel.innerText = ttToggle.checked ? 'Active' : 'Disabled';
            ttStatusLabel.style.color = ttToggle.checked ? '#0d9488' : '#ef4444';
          }
          if (typeof updateSocialChannelsPreview === 'function') updateSocialChannelsPreview();
        };
      }

      if (ytUrlInput) ytUrlInput.value = s.youtube_url || '';
      if (ytToggle) {
        ytToggle.checked = s.youtube_enabled !== '0' && s.youtube_enabled !== false;
        if (ytStatusLabel) {
          ytStatusLabel.innerText = ytToggle.checked ? 'Active' : 'Disabled';
          ytStatusLabel.style.color = ytToggle.checked ? '#0d9488' : '#ef4444';
        }
        ytToggle.onchange = () => {
          if (ytStatusLabel) {
            ytStatusLabel.innerText = ytToggle.checked ? 'Active' : 'Disabled';
            ytStatusLabel.style.color = ytToggle.checked ? '#0d9488' : '#ef4444';
          }
          if (typeof updateSocialChannelsPreview === 'function') updateSocialChannelsPreview();
        };
      }

      if (igUrlInput) igUrlInput.value = s.instagram_url || '';
      if (igToggle) {
        igToggle.checked = s.instagram_enabled !== '0' && s.instagram_enabled !== false;
        if (igStatusLabel) {
          igStatusLabel.innerText = igToggle.checked ? 'Active' : 'Disabled';
          igStatusLabel.style.color = igToggle.checked ? '#0d9488' : '#ef4444';
        }
        igToggle.onchange = () => {
          if (igStatusLabel) {
            igStatusLabel.innerText = igToggle.checked ? 'Active' : 'Disabled';
            igStatusLabel.style.color = igToggle.checked ? '#0d9488' : '#ef4444';
          }
          if (typeof updateSocialChannelsPreview === 'function') updateSocialChannelsPreview();
        };
      }

      if (typeof updateSocialChannelsPreview === 'function') updateSocialChannelsPreview();

      const headToggle = document.getElementById('is_head_code_enabled');
      const bodyToggle = document.getElementById('is_body_code_enabled');
      const headStatusLabel = document.getElementById('headStatusLabel');
      const bodyStatusLabel = document.getElementById('bodyStatusLabel');
      const headInput = document.getElementById('head_snippets');
      const bodyInput = document.getElementById('body_snippets');
      const verificationInput = document.getElementById('google_site_verification');
      const adsenseInput = document.getElementById('google_adsense_client');
      const analyticsInput = document.getElementById('google_analytics_id');
      const adsterraInput = document.getElementById('adsterra_code');

      // Helper to clean any historical b64: prefix if present
      const cleanB64 = (str) => {
        let v = str || '';
        while (typeof v === 'string' && v.startsWith('b64:')) {
          try {
            const dec = decodeURIComponent(escape(atob(v.slice(4))));
            if (dec === v) break;
            v = dec;
          } catch (_) { break; }
        }
        return v;
      };

      if (headToggle) {
        headToggle.checked = s.is_head_code_enabled !== '0' && s.is_head_code_enabled !== false;
        if (headStatusLabel) {
          headStatusLabel.innerText = headToggle.checked ? 'Active' : 'Disabled';
          headStatusLabel.style.color = headToggle.checked ? '#0d9488' : '#ef4444';
        }
      }

      if (bodyToggle) {
        bodyToggle.checked = s.is_body_code_enabled !== '0' && s.is_body_code_enabled !== false;
        if (bodyStatusLabel) {
          bodyStatusLabel.innerText = bodyToggle.checked ? 'Active' : 'Disabled';
          bodyStatusLabel.style.color = bodyToggle.checked ? '#0d9488' : '#ef4444';
        }
      }

      if (headInput) headInput.value = cleanB64(s.head_snippets || '');
      if (bodyInput) bodyInput.value = cleanB64(s.body_snippets || '');
      if (verificationInput) verificationInput.value = cleanB64(s.google_site_verification || '');
      if (adsenseInput) adsenseInput.value = cleanB64(s.google_adsense_client || '');
      if (analyticsInput) analyticsInput.value = cleanB64(s.google_analytics_id || '');
      if (adsterraInput) adsterraInput.value = cleanB64(s.adsterra_code || '');

      // Load Targeted Ad Placements (Google AdSense Units)
      const adSlots = [
        { key: 'ad_phone_top', toggle: 'ad_phone_top_enabled', label: 'adPhoneTopStatus' },
        { key: 'ad_phone_mid', toggle: 'ad_phone_mid_enabled', label: 'adPhoneMidStatus' },
        { key: 'ad_phone_spec_2', toggle: 'ad_phone_spec_2_enabled', label: 'adPhoneSpec2Status' },
        { key: 'ad_phone_bottom', toggle: 'ad_phone_bottom_enabled', label: 'adPhoneBottomStatus' },
        { key: 'ad_sidebar_top', toggle: 'ad_sidebar_top_enabled', label: 'adSidebarTopStatus' },
        { key: 'ad_sidebar_bottom', toggle: 'ad_sidebar_bottom_enabled', label: 'adSidebarBottomStatus' },
        { key: 'ad_article_top', toggle: 'ad_article_top_enabled', label: 'adArticleTopStatus' },
        { key: 'ad_article_mid', toggle: 'ad_article_mid_enabled', label: 'adArticleMidStatus' },
        { key: 'ad_article_bottom', toggle: 'ad_article_bottom_enabled', label: 'adArticleBottomStatus' }
      ];

      adSlots.forEach(slot => {
        const txt = document.getElementById(slot.key);
        if (txt) txt.value = s[slot.key] || '';
        const chk = document.getElementById(slot.toggle);
        const lbl = document.getElementById(slot.label);
        if (chk) {
          chk.checked = s[slot.toggle] !== '0' && s[slot.toggle] !== false;
          if (lbl) {
            lbl.innerText = chk.checked ? 'Active' : 'Disabled';
            lbl.style.color = chk.checked ? '#0d9488' : '#ef4444';
          }
          chk.onchange = () => {
            if (lbl) {
              lbl.innerText = chk.checked ? 'Active' : 'Disabled';
              lbl.style.color = chk.checked ? '#0d9488' : '#ef4444';
            }
          };
        }
      });

      // Trigger counter updates
      if (headInput) headInput.dispatchEvent(new Event('input'));
      if (bodyInput) bodyInput.dispatchEvent(new Event('input'));
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
    showSettingsAlert('Failed to load current settings from database.', 'error');
  }
}

async function submitSettingsForm() {
  const form = document.getElementById('siteSettingsForm');
  if (!form) return;

  const btnTop = document.getElementById('btnSaveSettingsTop');
  const btnBottom = document.getElementById('btnSaveSettingsBottom');

  const setSaving = (isSaving) => {
    if (btnTop) {
      btnTop.disabled = isSaving;
      btnTop.innerText = isSaving ? '⏳ Saving...' : '💾 Save Settings';
    }
    if (btnBottom) {
      btnBottom.disabled = isSaving;
      btnBottom.innerText = isSaving ? '⏳ Saving...' : '💾 Save All Settings';
    }
  };

  const payload = {
    // White-Label Branding Settings
    site_name: (document.getElementById('site_name') ? document.getElementById('site_name').value : '').trim(),
    site_tagline: (document.getElementById('site_tagline') ? document.getElementById('site_tagline').value : '').trim(),
    site_url: (document.getElementById('site_url') ? document.getElementById('site_url').value : '').trim(),
    site_description: (document.getElementById('site_description') ? document.getElementById('site_description').value : '').trim(),
    footer_copyright: (document.getElementById('footer_copyright') ? document.getElementById('footer_copyright').value : '').trim(),
    footer_about: (document.getElementById('footer_about') ? document.getElementById('footer_about').value : '').trim(),

    // Floating Social Channels (YouTube, Instagram, TikTok, Facebook, WhatsApp)
    whatsapp_number: (document.getElementById('whatsapp_number') ? document.getElementById('whatsapp_number').value : '').trim(),
    whatsapp_message: (document.getElementById('whatsapp_message') ? document.getElementById('whatsapp_message').value : '').trim(),
    whatsapp_enabled: document.getElementById('whatsapp_enabled') ? document.getElementById('whatsapp_enabled').checked : true,
    facebook_url: (document.getElementById('facebook_url') ? document.getElementById('facebook_url').value : '').trim(),
    facebook_enabled: document.getElementById('facebook_enabled') ? document.getElementById('facebook_enabled').checked : true,
    tiktok_url: (document.getElementById('tiktok_url') ? document.getElementById('tiktok_url').value : '').trim(),
    tiktok_enabled: document.getElementById('tiktok_enabled') ? document.getElementById('tiktok_enabled').checked : true,
    youtube_url: (document.getElementById('youtube_url') ? document.getElementById('youtube_url').value : '').trim(),
    youtube_enabled: document.getElementById('youtube_enabled') ? document.getElementById('youtube_enabled').checked : true,
    instagram_url: (document.getElementById('instagram_url') ? document.getElementById('instagram_url').value : '').trim(),
    instagram_enabled: document.getElementById('instagram_enabled') ? document.getElementById('instagram_enabled').checked : true,

    // Head & Body Code Snippets (Base64 safe encoded to prevent Hostinger ModSecurity WAF blocks)
    is_head_code_enabled: document.getElementById('is_head_code_enabled') ? document.getElementById('is_head_code_enabled').checked : true,
    head_snippets: safeSnippet(document.getElementById('head_snippets') ? document.getElementById('head_snippets').value.trim() : ''),
    google_site_verification: safeSnippet(document.getElementById('google_site_verification') ? document.getElementById('google_site_verification').value.trim() : ''),
    google_adsense_client: safeSnippet(document.getElementById('google_adsense_client') ? document.getElementById('google_adsense_client').value.trim() : ''),
    google_analytics_id: safeSnippet(document.getElementById('google_analytics_id') ? document.getElementById('google_analytics_id').value.trim() : ''),
    adsterra_code: safeSnippet(document.getElementById('adsterra_code') ? document.getElementById('adsterra_code').value.trim() : ''),
    is_body_code_enabled: document.getElementById('is_body_code_enabled') ? document.getElementById('is_body_code_enabled').checked : true,
    body_snippets: safeSnippet(document.getElementById('body_snippets') ? document.getElementById('body_snippets').value.trim() : ''),

    // Mobile Phone Placements
    ad_phone_top: safeSnippet(document.getElementById('ad_phone_top') ? document.getElementById('ad_phone_top').value.trim() : ''),
    ad_phone_top_enabled: document.getElementById('ad_phone_top_enabled') ? document.getElementById('ad_phone_top_enabled').checked : true,
    ad_phone_mid: safeSnippet(document.getElementById('ad_phone_mid') ? document.getElementById('ad_phone_mid').value.trim() : ''),
    ad_phone_mid_enabled: document.getElementById('ad_phone_mid_enabled') ? document.getElementById('ad_phone_mid_enabled').checked : true,
    ad_phone_spec_2: safeSnippet(document.getElementById('ad_phone_spec_2') ? document.getElementById('ad_phone_spec_2').value.trim() : ''),
    ad_phone_spec_2_enabled: document.getElementById('ad_phone_spec_2_enabled') ? document.getElementById('ad_phone_spec_2_enabled').checked : true,
    ad_phone_bottom: safeSnippet(document.getElementById('ad_phone_bottom') ? document.getElementById('ad_phone_bottom').value.trim() : ''),
    ad_phone_bottom_enabled: document.getElementById('ad_phone_bottom_enabled') ? document.getElementById('ad_phone_bottom_enabled').checked : true,

    // GSMArena Sidebar Placements
    ad_sidebar_top: safeSnippet(document.getElementById('ad_sidebar_top') ? document.getElementById('ad_sidebar_top').value.trim() : ''),
    ad_sidebar_top_enabled: document.getElementById('ad_sidebar_top_enabled') ? document.getElementById('ad_sidebar_top_enabled').checked : true,
    ad_sidebar_bottom: safeSnippet(document.getElementById('ad_sidebar_bottom') ? document.getElementById('ad_sidebar_bottom').value.trim() : ''),
    ad_sidebar_bottom_enabled: document.getElementById('ad_sidebar_bottom_enabled') ? document.getElementById('ad_sidebar_bottom_enabled').checked : true,

    // News & Blog Article Placements
    ad_article_top: safeSnippet(document.getElementById('ad_article_top') ? document.getElementById('ad_article_top').value.trim() : ''),
    ad_article_top_enabled: document.getElementById('ad_article_top_enabled') ? document.getElementById('ad_article_top_enabled').checked : true,
    ad_article_mid: safeSnippet(document.getElementById('ad_article_mid') ? document.getElementById('ad_article_mid').value.trim() : ''),
    ad_article_mid_enabled: document.getElementById('ad_article_mid_enabled') ? document.getElementById('ad_article_mid_enabled').checked : true,
    ad_article_bottom: safeSnippet(document.getElementById('ad_article_bottom') ? document.getElementById('ad_article_bottom').value.trim() : ''),
    ad_article_bottom_enabled: document.getElementById('ad_article_bottom_enabled') ? document.getElementById('ad_article_bottom_enabled').checked : true
  };

  setSaving(true);

  try {
    // Use POST with same-origin credentials for LiteSpeed/Hostinger reverse proxy compatibility
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      if (res.status === 401 || res.status === 403) {
        throw new Error('Admin session expired or access unauthorized. Please log in again.');
      } else {
        throw new Error(`Server returned status ${res.status}: ${text.substring(0, 100)}`);
      }
    }

    if (data.success) {
      showSettingsAlert('✅ Settings and Branding saved successfully! All public pages are now updated.', 'success');
      showAdminToast('Settings and branding saved successfully!', 'success');
      currentBrandingState.site_name = payload.site_name || 'PhonesDaddy';
      currentBrandingState.site_tagline = payload.site_tagline;
      currentBrandingState.site_url = payload.site_url;
      currentBrandingState.site_description = payload.site_description;
      currentBrandingState.footer_copyright = payload.footer_copyright;
      currentBrandingState.footer_about = payload.footer_about;
      updateBrandMockups();
      updateAdminSidebarBrand(currentBrandingState);
    } else {
      showSettingsAlert('❌ Error: ' + (data.message || 'Could not save settings.'), 'error');
      showAdminToast('❌ ' + (data.message || 'Could not save settings.'), 'error');
    }
  } catch (err) {
    console.error('Save settings error:', err);
    showSettingsAlert('❌ ' + (err.message || 'Network error while saving settings.'), 'error');
    showAdminToast('❌ ' + (err.message || 'Error saving settings.'), 'error');
  } finally {
    setSaving(false);
  }
}

/**
 * Real-time preview and test link generator for WhatsApp, Facebook, TikTok channels
 */
function updateSocialChannelsPreview() {
  // 1. WhatsApp
  const numberInput = document.getElementById('whatsapp_number');
  const msgInput = document.getElementById('whatsapp_message');
  const waToggle = document.getElementById('whatsapp_enabled');
  const testWaBtn = document.getElementById('btnTestWhatsApp');
  const previewWaIcon = document.getElementById('previewWhatsappIcon');

  const rawNumber = numberInput ? numberInput.value.trim() : '';
  const cleanNumber = rawNumber.replace(/[^\d]/g, '');
  const msg = (msgInput ? msgInput.value.trim() : '') || 'Hello! I have an inquiry from PhonesDaddy.';
  const isWaActive = (waToggle ? waToggle.checked : true) && !!cleanNumber;

  if (testWaBtn) {
    if (isWaActive) {
      testWaBtn.href = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
      testWaBtn.style.opacity = '1';
      testWaBtn.style.pointerEvents = 'auto';
    } else {
      testWaBtn.removeAttribute('href');
      testWaBtn.style.opacity = '0.35';
      testWaBtn.style.pointerEvents = 'none';
    }
  }
  if (previewWaIcon) {
    previewWaIcon.style.opacity = isWaActive ? '1' : '0.25';
  }

  // 2. Facebook
  const fbInput = document.getElementById('facebook_url');
  const fbToggle = document.getElementById('facebook_enabled');
  const testFbBtn = document.getElementById('btnTestFacebook');
  const previewFbIcon = document.getElementById('previewFacebookIcon');

  const fbUrl = fbInput ? fbInput.value.trim() : '';
  const isFbActive = (fbToggle ? fbToggle.checked : true) && !!fbUrl;

  if (testFbBtn) {
    if (isFbActive) {
      testFbBtn.href = fbUrl;
      testFbBtn.style.opacity = '1';
      testFbBtn.style.pointerEvents = 'auto';
    } else {
      testFbBtn.removeAttribute('href');
      testFbBtn.style.opacity = '0.35';
      testFbBtn.style.pointerEvents = 'none';
    }
  }
  if (previewFbIcon) {
    previewFbIcon.style.opacity = isFbActive ? '1' : '0.25';
  }

  // 3. TikTok
  const ttInput = document.getElementById('tiktok_url');
  const ttToggle = document.getElementById('tiktok_enabled');
  const testTtBtn = document.getElementById('btnTestTikTok');
  const previewTtIcon = document.getElementById('previewTiktokIcon');

  const ttUrl = ttInput ? ttInput.value.trim() : '';
  const isTtActive = (ttToggle ? ttToggle.checked : true) && !!ttUrl;

  if (testTtBtn) {
    if (isTtActive) {
      testTtBtn.href = ttUrl;
      testTtBtn.style.opacity = '1';
      testTtBtn.style.pointerEvents = 'auto';
    } else {
      testTtBtn.removeAttribute('href');
      testTtBtn.style.opacity = '0.35';
      testTtBtn.style.pointerEvents = 'none';
    }
  }
  if (previewTtIcon) {
    previewTtIcon.style.opacity = isTtActive ? '1' : '0.25';
  }

  // 4. YouTube
  const ytInput = document.getElementById('youtube_url');
  const ytToggle = document.getElementById('youtube_enabled');
  const testYtBtn = document.getElementById('btnTestYouTube');
  const previewYtIcon = document.getElementById('previewYoutubeIcon');

  const ytUrl = ytInput ? ytInput.value.trim() : '';
  const isYtActive = (ytToggle ? ytToggle.checked : true) && !!ytUrl;

  if (testYtBtn) {
    if (isYtActive) {
      testYtBtn.href = ytUrl;
      testYtBtn.style.opacity = '1';
      testYtBtn.style.pointerEvents = 'auto';
    } else {
      testYtBtn.removeAttribute('href');
      testYtBtn.style.opacity = '0.35';
      testYtBtn.style.pointerEvents = 'none';
    }
  }
  if (previewYtIcon) {
    previewYtIcon.style.opacity = isYtActive ? '1' : '0.25';
  }

  // 5. Instagram
  const igInput = document.getElementById('instagram_url');
  const igToggle = document.getElementById('instagram_enabled');
  const testIgBtn = document.getElementById('btnTestInstagram');
  const previewIgIcon = document.getElementById('previewInstagramIcon');

  const igUrl = igInput ? igInput.value.trim() : '';
  const isIgActive = (igToggle ? igToggle.checked : true) && !!igUrl;

  if (testIgBtn) {
    if (isIgActive) {
      testIgBtn.href = igUrl;
      testIgBtn.style.opacity = '1';
      testIgBtn.style.pointerEvents = 'auto';
    } else {
      testIgBtn.removeAttribute('href');
      testIgBtn.style.opacity = '0.35';
      testIgBtn.style.pointerEvents = 'none';
    }
  }
  if (previewIgIcon) {
    previewIgIcon.style.opacity = isIgActive ? '1' : '0.25';
  }

  // Summary
  const summary = document.getElementById('socialDockStatusSummary');
  if (summary) {
    const activeList = [];
    if (isYtActive) activeList.push('YouTube (Top)');
    if (isIgActive) activeList.push('Instagram');
    if (isTtActive) activeList.push('TikTok');
    if (isFbActive) activeList.push('Facebook');
    if (isWaActive) activeList.push('WhatsApp (Bottom)');
    if (activeList.length > 0) {
      summary.innerHTML = `<span style="color: #10b981; font-weight: 700;">Active Badges:</span> ${activeList.join(' &rarr; ')} (stacked vertically above Scroll-To-Top)`;
    } else {
      summary.innerHTML = `<span style="color: #f59e0b; font-weight: 700;">All Badges Inactive:</span> Enable switches and provide valid links or phone number above.`;
    }
  }
}
window.updateSocialChannelsPreview = updateSocialChannelsPreview;
window.updateWhatsAppPreview = updateSocialChannelsPreview;

function applyAdPreset(slotKey, sizeType) {
  const txt = document.getElementById(slotKey);
  if (!txt) return;

  const pubInput = document.getElementById('google_adsense_client');
  const pubId = (pubInput && pubInput.value.trim()) ? pubInput.value.trim() : 'ca-pub-XXXXXXXXXXXXXXXX';

  let code = '';
  switch (sizeType) {
    case '728x90':
      code = `<!-- Google AdSense Leaderboard (728x90) -->\n<ins class="adsbygoogle"\n     style="display:inline-block;width:728px;height:90px"\n     data-ad-client="${pubId}"\n     data-ad-slot="1234567890"></ins>\n<script>\n     (adsbygoogle = window.adsbygoogle || []).push({});\n</script>`;
      break;
    case '300x250':
      code = `<!-- Google AdSense Medium Rectangle (300x250) -->\n<ins class="adsbygoogle"\n     style="display:inline-block;width:300px;height:250px"\n     data-ad-client="${pubId}"\n     data-ad-slot="1234567890"></ins>\n<script>\n     (adsbygoogle = window.adsbygoogle || []).push({});\n</script>`;
      break;
    case '336x280':
      code = `<!-- Google AdSense Large Rectangle (336x280) -->\n<ins class="adsbygoogle"\n     style="display:inline-block;width:336px;height:280px"\n     data-ad-client="${pubId}"\n     data-ad-slot="1234567890"></ins>\n<script>\n     (adsbygoogle = window.adsbygoogle || []).push({});\n</script>`;
      break;
    case '320x100':
      code = `<!-- Google AdSense Large Mobile Banner (320x100) -->\n<ins class="adsbygoogle"\n     style="display:inline-block;width:320px;height:100px"\n     data-ad-client="${pubId}"\n     data-ad-slot="1234567890"></ins>\n<script>\n     (adsbygoogle = window.adsbygoogle || []).push({});\n</script>`;
      break;
    case 'in-article':
      code = `<!-- Google AdSense In-Article Native Ad Unit -->\n<ins class="adsbygoogle"\n     style="display:block; text-align:center;"\n     data-ad-layout="in-article"\n     data-ad-format="fluid"\n     data-ad-client="${pubId}"\n     data-ad-slot="1234567890"></ins>\n<script>\n     (adsbygoogle = window.adsbygoogle || []).push({});\n</script>`;
      break;
    case 'responsive':
    default:
      code = `<!-- Google AdSense Responsive Unit -->\n<ins class="adsbygoogle"\n     style="display:block"\n     data-ad-client="${pubId}"\n     data-ad-slot="1234567890"\n     data-ad-format="auto"\n     data-full-width-responsive="true"></ins>\n<script>\n     (adsbygoogle = window.adsbygoogle || []).push({});\n</script>`;
      break;
  }

  txt.value = code;
  txt.dispatchEvent(new Event('input'));
  txt.focus();

  showSettingsAlert(`Applied ${sizeType} template to ${slotKey}! Replace the sample data-ad-slot with your real slot ID.`, 'info');
}

// Dummy Ads Presets for local testing
const DUMMY_ADS = {
  ad_phone_top: `<!-- Google AdSense Responsive Leaderboard Test Unit -->
<div style="width:100%;max-width:728px;min-height:90px;background:linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%);border:1px dashed #0d9488;border-radius:8px;display:flex;align-items:center;justify-content:space-between;padding:12px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin:0 auto;box-sizing:border-box;position:relative;overflow:hidden;">
  <div style="position:absolute;top:4px;right:8px;font-size:9px;color:#94a3b8;font-weight:700;letter-spacing:0.5px;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#0d9488;color:#fff;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;">i</span>
  </div>
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:48px;height:48px;background:#0d9488;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;"><svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg></div>
    <div style="text-align:left;">
      <div style="font-weight:800;font-size:15px;color:#0f172a;line-height:1.2;">Top Smartphone Deals 2026 — Up to 40% Off</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">Compare flagship phones, trade-in offers &amp; exclusive carrier discounts.</div>
    </div>
  </div>
  <div style="flex-shrink:0;text-align:right;">
    <span style="display:inline-block;padding:7px 14px;background:#0d9488;color:#fff;font-weight:700;font-size:12px;border-radius:6px;">Check Deals →</span>
    <div style="font-size:10px;color:#94a3b8;margin-top:3px;">728×90 Leaderboard (Test Ad)</div>
  </div>
</div>`,

  ad_phone_mid: `<!-- Google AdSense Large Rectangle Test Unit -->
<div style="width:100%;max-width:336px;min-height:280px;background:linear-gradient(135deg, #ffffff 0%, #f1f5f9 100%);border:1px dashed #3b82f6;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:18px;box-shadow:0 4px 12px rgba(0,0,0,0.06);margin:0 auto;box-sizing:border-box;position:relative;text-align:center;">
  <div style="position:absolute;top:6px;right:8px;font-size:9px;color:#94a3b8;font-weight:700;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#3b82f6;color:#fff;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;">i</span>
  </div>
  <div style="width:100%;text-align:left;font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;">Sponsored Advertisement</div>
  <div style="margin:10px 0;">
    <div style="width:54px;height:54px;background:#3b82f6;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#fff;margin:0 auto 10px;">⚡</div>
    <div style="font-weight:800;font-size:16px;color:#0f172a;line-height:1.3;">Ultra Fast 65W GaN Charger</div>
    <div style="font-size:12.5px;color:#64748b;margin-top:6px;line-height:1.4;">Charge your phone 0 to 80% in 20 minutes. Universal dual-port USB-C.</div>
  </div>
  <div style="width:100%;">
    <span style="display:block;width:100%;padding:9px 0;background:#3b82f6;color:#fff;font-weight:700;font-size:13px;border-radius:6px;">Shop Now — $29.99</span>
    <div style="font-size:10px;color:#94a3b8;margin-top:4px;">336×280 Large Rectangle (Test Ad)</div>
  </div>
</div>`,

  ad_phone_spec_2: `<!-- Google AdSense In-Specs Large Rectangle Test Unit 2 -->
<div style="width:100%;max-width:336px;min-height:280px;background:linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);border:1px dashed #ca8a04;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:18px;box-shadow:0 4px 12px rgba(0,0,0,0.06);margin:0 auto;box-sizing:border-box;position:relative;text-align:center;">
  <div style="position:absolute;top:6px;right:8px;font-size:9px;color:#a16207;font-weight:700;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#ca8a04;color:#fff;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;">i</span>
  </div>
  <div style="width:100%;text-align:left;font-size:10px;color:#a16207;font-weight:700;text-transform:uppercase;">Sponsored In-Specs Unit</div>
  <div style="margin:10px 0;">
    <div style="width:54px;height:54px;background:#fde68a;border:1px solid #ca8a04;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#92400e;margin:0 auto 10px;">🔋</div>
    <div style="font-weight:800;font-size:16px;color:#0f172a;line-height:1.3;">10000mAh Power Bank Pro</div>
    <div style="font-size:12.5px;color:#64748b;margin-top:6px;line-height:1.4;">Ultra-slim 22.5W fast charge. Charges 3 devices. USB-C & Lightning.</div>
  </div>
  <div style="width:100%;">
    <span style="display:block;width:100%;padding:9px 0;background:#ca8a04;color:#fff;font-weight:700;font-size:13px;border-radius:6px;">Buy Now — $24.99</span>
    <div style="font-size:10px;color:#a16207;margin-top:4px;">336×280 Large Rectangle (Test Ad)</div>
  </div>
</div>`,

  ad_phone_bottom: `<!-- Google AdSense Bottom Leaderboard Test Unit -->
<div style="width:100%;max-width:728px;min-height:90px;background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);border:1px dashed #6366f1;border-radius:8px;display:flex;align-items:center;justify-content:space-between;padding:12px 20px;box-shadow:0 4px 14px rgba(15,23,42,0.15);margin:0 auto;box-sizing:border-box;position:relative;color:#fff;">
  <div style="position:absolute;top:4px;right:8px;font-size:9px;color:#94a3b8;font-weight:700;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#6366f1;color:#fff;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;">i</span>
  </div>
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:48px;height:48px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">🎧</div>
    <div style="text-align:left;">
      <div style="font-weight:800;font-size:15px;color:#f8fafc;line-height:1.2;">Next-Gen Wireless Noise-Cancelling Earbuds</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:2px;">Spatial audio, 40hr battery, lossless codec &amp; IPX7 water resistance.</div>
    </div>
  </div>
  <div style="flex-shrink:0;text-align:right;">
    <span style="display:inline-block;padding:7px 14px;background:#6366f1;color:#fff;font-weight:700;font-size:12px;border-radius:6px;">Learn More →</span>
    <div style="font-size:10px;color:#94a3b8;margin-top:3px;">728×90 Leaderboard (Test Ad)</div>
  </div>
</div>`,

  ad_sidebar_top: `<!-- Google AdSense 300x250 Medium Rectangle Sidebar Test Unit -->
<div style="width:100%;max-width:300px;min-height:250px;background:linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);border:1px dashed #0284c7;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:16px;box-shadow:0 3px 10px rgba(0,0,0,0.06);margin:0 auto;box-sizing:border-box;position:relative;text-align:center;">
  <div style="position:absolute;top:6px;right:8px;font-size:9px;color:#64748b;font-weight:700;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#0284c7;color:#fff;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;">i</span>
  </div>
  <div style="width:100%;text-align:left;font-size:9.5px;color:#0284c7;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Sidebar Sponsored Unit</div>
  <div style="margin:8px 0;">
    <div style="width:50px;height:50px;background:#e0f2fe;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:26px;color:#0284c7;margin:0 auto 8px;">🎮</div>
    <div style="font-weight:800;font-size:15px;color:#0f172a;line-height:1.25;">Mobile Cloud Gaming Pass</div>
    <div style="font-size:12px;color:#64748b;margin-top:4px;line-height:1.35;">Stream 500+ AAA games instantly on your smartphone with zero install.</div>
  </div>
  <div style="width:100%;">
    <span style="display:block;width:100%;padding:8px 0;background:#0284c7;color:#fff;font-weight:700;font-size:12px;border-radius:6px;">Start 30-Day Free Trial</span>
    <div style="font-size:9.5px;color:#94a3b8;margin-top:4px;">300×250 Medium Rect (Test Ad)</div>
  </div>
</div>`,

  ad_sidebar_bottom: `<!-- Google AdSense 300x600 Half-Page Sticky Sidebar Test Unit -->
<div style="width:100%;max-width:300px;min-height:380px;background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%);border:1px dashed #f59e0b;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:18px;box-shadow:0 6px 18px rgba(0,0,0,0.18);margin:0 auto;box-sizing:border-box;position:relative;color:#fff;text-align:center;">
  <div style="position:absolute;top:6px;right:8px;font-size:9px;color:#94a3b8;font-weight:700;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#f59e0b;color:#0f172a;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;font-weight:800;">i</span>
  </div>
  <div style="width:100%;text-align:left;font-size:9.5px;color:#f59e0b;font-weight:800;text-transform:uppercase;letter-spacing:0.5px;">Sticky Sidebar Unit</div>
  <div style="margin:12px 0;">
    <div style="width:58px;height:58px;background:rgba(245,158,11,0.2);border:1px solid #f59e0b;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#f59e0b;margin:0 auto 12px;"><svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg></div>
    <div style="font-weight:800;font-size:16px;color:#f8fafc;line-height:1.25;">Total Phone Privacy &amp; Secure VPN</div>
    <div style="font-size:12px;color:#94a3b8;margin-top:8px;line-height:1.45;">Bank-grade encryption, malware ad-blocker &amp; ultra-fast servers across 90 countries.</div>
  </div>
  <div style="width:100%;">
    <span style="display:block;width:100%;padding:10px 0;background:#f59e0b;color:#0f172a;font-weight:800;font-size:13px;border-radius:6px;">Claim 70% Off Today →</span>
    <div style="font-size:9.5px;color:#94a3b8;margin-top:4px;">300×600 Half-Page Unit (Test Ad)</div>
  </div>
</div>`,

  ad_article_top: `<!-- Google AdSense Article Top Leaderboard Test Unit -->
<div style="width:100%;max-width:728px;min-height:90px;background:linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);border:1px dashed #16a34a;border-radius:8px;display:flex;align-items:center;justify-content:space-between;padding:12px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin:0 auto;box-sizing:border-box;position:relative;">
  <div style="position:absolute;top:4px;right:8px;font-size:9px;color:#64748b;font-weight:700;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#16a34a;color:#fff;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;">i</span>
  </div>
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:48px;height:48px;background:#16a34a;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;"><svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg></div>
    <div style="text-align:left;">
      <div style="font-weight:800;font-size:15px;color:#0f172a;line-height:1.2;">Military-Grade Smartphone Protection Cases</div>
      <div style="font-size:12px;color:#475569;margin-top:2px;">Drop tested from 15ft. Slim ergonomic grip with MagSafe compatibility.</div>
    </div>
  </div>
  <div style="flex-shrink:0;text-align:right;">
    <span style="display:inline-block;padding:7px 14px;background:#16a34a;color:#fff;font-weight:700;font-size:12px;border-radius:6px;">View Cases →</span>
    <div style="font-size:10px;color:#64748b;margin-top:3px;">728×90 Leaderboard (Test Ad)</div>
  </div>
</div>`,

  ad_article_mid: `<!-- Google AdSense In-Article Native Test Unit -->
<div style="width:100%;max-width:680px;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid #ea580c;border-radius:8px;padding:16px 20px;margin:16px auto;box-sizing:border-box;position:relative;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
    <span style="font-size:11px;font-weight:800;color:#ea580c;text-transform:uppercase;letter-spacing:0.5px;">Recommended For You</span>
    <span style="font-size:9px;color:#94a3b8;font-weight:700;">ADS BY GOOGLE</span>
  </div>
  <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
    <div style="width:44px;height:44px;background:#fed7aa;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">📶</div>
    <div style="flex:1;min-width:200px;">
      <div style="font-weight:800;font-size:14.5px;color:#0f172a;">Switch to 5G Unlimited Plan — Save $200/Year</div>
      <div style="font-size:12px;color:#64748b;margin-top:2px;">Unlimited high-speed data, free roaming, and no contracts.</div>
    </div>
    <span style="display:inline-block;padding:6px 14px;background:#ea580c;color:#fff;font-weight:700;font-size:12px;border-radius:6px;flex-shrink:0;">Explore Plans</span>
  </div>
  <div style="text-align:right;font-size:9.5px;color:#94a3b8;margin-top:6px;">Google In-Article Native Ad (Test Unit)</div>
</div>`,

  ad_article_bottom: `<!-- Google AdSense Bottom Leaderboard Test Unit -->
<div style="width:100%;max-width:728px;min-height:90px;background:linear-gradient(135deg, #fdf4ff 0%, #fae8ff 100%);border:1px dashed #c026d3;border-radius:8px;display:flex;align-items:center;justify-content:space-between;padding:12px 20px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin:0 auto;box-sizing:border-box;position:relative;">
  <div style="position:absolute;top:4px;right:8px;font-size:9px;color:#701a75;font-weight:700;display:flex;align-items:center;gap:3px;">
    <span>ADS BY GOOGLE</span>
    <span style="background:#c026d3;color:#fff;border-radius:50%;width:11px;height:11px;display:inline-flex;align-items:center;justify-content:center;font-size:8px;">i</span>
  </div>
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:48px;height:48px;background:#c026d3;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;flex-shrink:0;">⌚</div>
    <div style="text-align:left;">
      <div style="font-weight:800;font-size:15px;color:#0f172a;line-height:1.2;">Smartwatch Pro Series 2026 — ECG &amp; AMOLED</div>
      <div style="font-size:12px;color:#475569;margin-top:2px;">All-day health tracking, titanium frame, 14 days battery life.</div>
    </div>
  </div>
  <div style="flex-shrink:0;text-align:right;">
    <span style="display:inline-block;padding:7px 14px;background:#c026d3;color:#fff;font-weight:700;font-size:12px;border-radius:6px;">Order Now →</span>
    <div style="font-size:10px;color:#701a75;margin-top:3px;">728×90 Leaderboard (Test Ad)</div>
  </div>
</div>`
};

function switchSettingsSection(section) {
  const secBrand = document.getElementById('settingsSectionBranding');
  const secGen = document.getElementById('settingsSectionGeneral');
  const secAds = document.getElementById('settingsSectionAds');
  const secProf = document.getElementById('settingsSectionProfile');
  const secUsers = document.getElementById('settingsSectionUsers');
  const tabBrand = document.getElementById('tabBtnBranding');
  const tabGen = document.getElementById('tabBtnGeneral');
  const tabAds = document.getElementById('tabBtnAds');
  const tabProf = document.getElementById('tabBtnProfile');
  const tabUsers = document.getElementById('tabBtnUsers');
  const sideBrand = document.getElementById('sideNavBranding');
  const sideGen = document.getElementById('sideNavGeneral');
  const sideAds = document.getElementById('sideNavAds');
  const sideProf = document.getElementById('sideNavProfile');
  const sideUsers = document.getElementById('sideNavUsers');
  const btnTestingAdsTop = document.getElementById('btnTestingAdsTop');
  const topbarTitle = document.getElementById('topbarTitle');
  const topbarSubtitle = document.getElementById('topbarSubtitle');
  const btnPreviewTop = document.getElementById('btnPreviewTop');
  const btnSaveSettingsTop = document.getElementById('btnSaveSettingsTop');
  const btnSaveProfileTop = document.getElementById('btnSaveProfileTop');
  const btnAddUserTop = document.getElementById('btnAddUserTop');
  const settingsBottomActions = document.getElementById('settingsBottomActions');

  // Hide all sections first
  if (secBrand) secBrand.style.display = 'none';
  if (secGen) secGen.style.display = 'none';
  if (secAds) secAds.style.display = 'none';
  if (secProf) secProf.style.display = 'none';
  if (secUsers) secUsers.style.display = 'none';
  if (btnAddUserTop) btnAddUserTop.style.display = 'none';

  // Remove active from all tabs & side links
  [tabBrand, tabGen, tabAds, tabProf, tabUsers, sideBrand, sideGen, sideAds, sideProf, sideUsers].forEach(el => el && el.classList.remove('active'));

  if (section === 'branding') {
    if (secBrand) secBrand.style.display = 'block';
    if (tabBrand) tabBrand.classList.add('active');
    if (sideBrand) sideBrand.classList.add('active');
    if (btnTestingAdsTop) btnTestingAdsTop.style.display = 'none';
    if (topbarTitle) topbarTitle.innerText = 'Site Identity, Domain & Brand Assets';
    if (topbarSubtitle) topbarSubtitle.innerText = 'Customize your website brand name, domain URL, logo, and favicon for complete white-label ownership.';
    if (btnPreviewTop) btnPreviewTop.style.display = 'none';
    if (btnSaveSettingsTop) btnSaveSettingsTop.style.display = 'inline-flex';
    if (btnSaveProfileTop) btnSaveProfileTop.style.display = 'none';
    if (settingsBottomActions) settingsBottomActions.style.display = 'flex';
    if (window.location.hash !== '#branding') {
      history.replaceState(null, null, '#branding');
    }
  } else if (section === 'ads') {
    if (secAds) secAds.style.display = 'block';
    if (tabAds) tabAds.classList.add('active');
    if (sideAds) sideAds.classList.add('active');
    if (btnTestingAdsTop) btnTestingAdsTop.style.display = 'inline-flex';
    if (topbarTitle) topbarTitle.innerText = 'Site Settings & Ad Management';
    if (topbarSubtitle) topbarSubtitle.innerText = 'Manage head snippets, tracking codes, and targeted Google AdSense placements for mobile posts, sidebars, and articles.';
    if (btnPreviewTop) btnPreviewTop.style.display = 'inline-flex';
    if (btnSaveSettingsTop) btnSaveSettingsTop.style.display = 'inline-flex';
    if (btnSaveProfileTop) btnSaveProfileTop.style.display = 'none';
    if (settingsBottomActions) settingsBottomActions.style.display = 'flex';
    if (window.location.hash !== '#ad-placements') {
      history.replaceState(null, null, '#ad-placements');
    }
  } else if (section === 'profile') {
    if (secProf) secProf.style.display = 'block';
    if (tabProf) tabProf.classList.add('active');
    if (sideProf) sideProf.classList.add('active');
    if (btnTestingAdsTop) btnTestingAdsTop.style.display = 'none';
    if (topbarTitle) topbarTitle.innerText = 'Admin Profile & Security Credentials';
    if (topbarSubtitle) topbarSubtitle.innerText = 'View active credentials, copy current password, or securely update your login credentials.';
    if (btnPreviewTop) btnPreviewTop.style.display = 'none';
    if (btnSaveSettingsTop) btnSaveSettingsTop.style.display = 'none';
    if (btnSaveProfileTop) btnSaveProfileTop.style.display = 'inline-flex';
    if (settingsBottomActions) settingsBottomActions.style.display = 'none';
    if (window.location.hash !== '#profile') {
      history.replaceState(null, null, '#profile');
    }
    loadAdminProfile();
  } else if (section === 'users') {
    if (secUsers) secUsers.style.display = 'block';
    if (tabUsers) tabUsers.classList.add('active');
    if (sideUsers) sideUsers.classList.add('active');
    if (btnTestingAdsTop) btnTestingAdsTop.style.display = 'none';
    if (topbarTitle) topbarTitle.innerText = 'Team Members & Staff Access';
    if (topbarSubtitle) topbarSubtitle.innerText = 'Manage staff accounts with specific roles: Article Writers, Mobile Phone Managers, or Full Administrators.';
    if (btnPreviewTop) btnPreviewTop.style.display = 'none';
    if (btnSaveSettingsTop) btnSaveSettingsTop.style.display = 'none';
    if (btnSaveProfileTop) btnSaveProfileTop.style.display = 'none';
    if (btnAddUserTop) btnAddUserTop.style.display = 'inline-flex';
    if (settingsBottomActions) settingsBottomActions.style.display = 'none';
    if (window.location.hash !== '#users') {
      history.replaceState(null, null, '#users');
    }
    loadTeamUsers();
  } else {
    if (secGen) secGen.style.display = 'block';
    if (tabGen) tabGen.classList.add('active');
    if (sideGen) sideGen.classList.add('active');
    if (btnTestingAdsTop) btnTestingAdsTop.style.display = 'none';
    if (topbarTitle) topbarTitle.innerText = 'General Head & Body Snippets';
    if (topbarSubtitle) topbarSubtitle.innerText = 'Manage head snippets, tracking codes, and verification tags.';
    if (btnPreviewTop) btnPreviewTop.style.display = 'inline-flex';
    if (btnSaveSettingsTop) btnSaveSettingsTop.style.display = 'inline-flex';
    if (btnSaveProfileTop) btnSaveProfileTop.style.display = 'none';
    if (settingsBottomActions) settingsBottomActions.style.display = 'flex';
    if (window.location.hash !== '#general') {
      history.replaceState(null, null, '#general');
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// White-Label Site Identity & Branding Controller
// ─────────────────────────────────────────────────────────────────────────────

let selectedLogoFile = null;
let selectedFaviconFile = null;
let currentBrandingState = {
  site_name: 'PhonesDaddy',
  site_tagline: '',
  site_url: '',
  site_description: '',
  site_logo: '',
  site_favicon: '',
  footer_copyright: '',
  footer_about: ''
};

function toggleCanvasBg(canvasId, btn) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  canvas.classList.toggle('light-mode');
  if (btn) {
    btn.classList.toggle('light');
  }
}

function updateLogoPreview(logoUrl) {
  const container = document.getElementById('logoPreviewContent');
  const btnRemove = document.getElementById('btnRemoveLogo');
  const btnUpload = document.getElementById('btnUploadLogo');
  const dropText = document.getElementById('logoDropzoneText');

  if (!container) return;

  if (logoUrl) {
    container.innerHTML = `<img src="${logoUrl}?t=${Date.now()}" alt="Logo Preview" style="max-height: 52px; max-width: 240px; object-fit: contain;">`;
    if (btnRemove) btnRemove.style.display = 'inline-flex';
    if (btnUpload) btnUpload.style.display = 'none';
    if (dropText) dropText.innerText = 'Click or Drop New File to Replace Logo';
  } else {
    const siteName = (document.getElementById('site_name')?.value || currentBrandingState.site_name || 'PhonesDaddy').trim();
    const initial = siteName.charAt(0).toUpperCase() || 'P';
    container.innerHTML = `
      <div style="display: inline-flex; align-items: center; gap: 10px;">
        <div style="width: 38px; height: 38px; border-radius: 8px; background: linear-gradient(135deg, #0d9488, #059669); color: #fff; font-weight: 800; font-size: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(13, 148, 136, 0.4);">${escapeHtml(initial)}</div>
        <span style="font-size: 18px; font-weight: 800; color: #f1f5f9; letter-spacing: -0.5px;">${escapeHtml(siteName)}</span>
      </div>`;
    if (btnRemove) btnRemove.style.display = 'none';
    if (dropText) dropText.innerText = 'Click or Drag & Drop Logo Here';
  }
}

function updateFaviconPreview(faviconUrl) {
  const tabFavicon = document.getElementById('tabSimFavicon');
  const btnRemove = document.getElementById('btnRemoveFavicon');
  const btnUpload = document.getElementById('btnUploadFavicon');
  const dropText = document.getElementById('faviconDropzoneText');

  if (!tabFavicon) return;

  if (faviconUrl) {
    tabFavicon.innerHTML = `<img src="${faviconUrl}?t=${Date.now()}" alt="Favicon" style="width: 16px; height: 16px; object-fit: contain; border-radius: 2px;">`;
    if (btnRemove) btnRemove.style.display = 'inline-flex';
    if (btnUpload) btnUpload.style.display = 'none';
    if (dropText) dropText.innerText = 'Click or Drop New File to Replace Favicon';
  } else {
    tabFavicon.innerHTML = window.ICONS ? ICONS.phone : '';
    if (btnRemove) btnRemove.style.display = 'none';
    if (dropText) dropText.innerText = 'Click or Drag & Drop Favicon Here';
  }
}

function updateBrandMockups() {
  const nameInput = document.getElementById('site_name');
  const taglineInput = document.getElementById('site_tagline');
  const copyInput = document.getElementById('footer_copyright');
  const aboutInput = document.getElementById('footer_about');

  const siteName = (nameInput ? nameInput.value : currentBrandingState.site_name) || 'PhonesDaddy';
  const siteTagline = taglineInput ? taglineInput.value : currentBrandingState.site_tagline;
  const currentYear = new Date().getFullYear();
  let copyright = copyInput ? copyInput.value : currentBrandingState.footer_copyright;
  if (!copyright) copyright = `© ${currentYear} ${siteName}. All rights reserved.`;
  copyright = copyright.replace(/\{YEAR\}/gi, currentYear);
  const about = (aboutInput ? aboutInput.value : currentBrandingState.footer_about) || 'Your trusted destination for comprehensive mobile phone specifications...';

  // Simulated browser tab title
  const tabSimTitle = document.getElementById('tabSimTitle');
  if (tabSimTitle) {
    tabSimTitle.innerText = siteTagline ? `${siteName} — ${siteTagline}` : `${siteName} — Mobile Specs`;
  }

  // Header mockup
  const headerBrand = document.getElementById('mockupHeaderBrand');
  if (headerBrand) {
    if (currentBrandingState.site_logo) {
      headerBrand.innerHTML = `<img src="${currentBrandingState.site_logo}?t=${Date.now()}" alt="${escapeHtml(siteName)}" style="max-height: 28px; max-width: 140px; object-fit: contain;">`;
    } else {
      const initial = siteName.charAt(0).toUpperCase() || 'P';
      headerBrand.innerHTML = `
        <div style="width: 24px; height: 24px; border-radius: 5px; background: linear-gradient(135deg, #0d9488, #059669); color: #fff; font-weight: 800; font-size: 13px; display: flex; align-items: center; justify-content: center;">${escapeHtml(initial)}</div>
        <span style="font-weight: 800; font-size: 15px; color: #fff; letter-spacing: -0.5px;">${escapeHtml(siteName)}</span>
      `;
    }
  }

  // Mockup hero title
  const heroTitle = document.getElementById('mockupHeroTitle');
  if (heroTitle) {
    heroTitle.innerText = siteTagline ? `${siteName} — ${siteTagline}` : `${siteName} — Mobile Specs & Prices`;
  }

  // Footer mockup
  const footerBrand = document.getElementById('mockupFooterBrand');
  if (footerBrand) {
    if (currentBrandingState.site_logo) {
      footerBrand.innerHTML = `<img src="${currentBrandingState.site_logo}?t=${Date.now()}" alt="${escapeHtml(siteName)}" style="max-height: 24px; max-width: 130px; object-fit: contain;">`;
    } else {
      const initial = siteName.charAt(0).toUpperCase() || 'P';
      footerBrand.innerHTML = `
        <div style="width: 20px; height: 20px; border-radius: 4px; background: linear-gradient(135deg, #0d9488, #059669); color: #fff; font-weight: 800; font-size: 11px; display: flex; align-items: center; justify-content: center;">${escapeHtml(initial)}</div>
        <span style="font-weight: 800; font-size: 13px; color: #cbd5e1;">${escapeHtml(siteName)}</span>
      `;
    }
  }

  const footerAbout = document.getElementById('mockupFooterAbout');
  if (footerAbout) footerAbout.innerText = about;

  const mockupCopyright = document.getElementById('mockupCopyright');
  if (mockupCopyright) mockupCopyright.innerHTML = `<span>${escapeHtml(copyright)}</span><span>Designed for Buyers &amp; Admins</span>`;

  // Also update logo fallback canvas if no custom logo is uploaded
  if (!currentBrandingState.site_logo) {
    updateLogoPreview(null);
  }
}

function handleLogoSelect(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!validTypes.includes(file.type)) {
    showSettingsAlert('❌ Invalid logo format. Please upload PNG, SVG, WEBP, or JPG.', 'error');
    input.value = '';
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    showSettingsAlert('❌ Logo file size exceeds 2MB limit.', 'error');
    input.value = '';
    return;
  }

  selectedLogoFile = file;
  const dropText = document.getElementById('logoDropzoneText');
  if (dropText) dropText.innerText = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  const btnUpload = document.getElementById('btnUploadLogo');
  if (btnUpload) btnUpload.style.display = 'inline-flex';

  // Preview local file immediately in canvas
  const reader = new FileReader();
  reader.onload = (e) => {
    const container = document.getElementById('logoPreviewContent');
    if (container) {
      container.innerHTML = `<img src="${e.target.result}" alt="Preview" style="max-height: 52px; max-width: 240px; object-fit: contain;">`;
    }
  };
  reader.readAsDataURL(file);
}

async function triggerLogoUpload() {
  if (!selectedLogoFile) {
    showSettingsAlert('Please select a logo file first.', 'error');
    return;
  }

  const btn = document.getElementById('btnUploadLogo');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Uploading...';
  }

  try {
    const formData = new FormData();
    formData.append('logo', selectedLogoFile);

    const res = await fetch('/api/admin/settings/logo', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success && data.logoUrl) {
      currentBrandingState.site_logo = data.logoUrl;
      selectedLogoFile = null;
      updateLogoPreview(data.logoUrl);
      updateBrandMockups();
      updateAdminSidebarBrand(currentBrandingState);
      showSettingsAlert('Website logo uploaded and applied successfully!', 'success');
    } else {
      showSettingsAlert('❌ ' + (data.message || 'Failed to upload logo.'), 'error');
    }
  } catch (err) {
    console.error('Logo upload error:', err);
    showSettingsAlert('❌ Network error during logo upload.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⬆️ Upload Logo';
    }
  }
}

async function removeLogoFile() {
  if (!confirm('Are you sure you want to remove the custom website logo and return to the stylized brand fallback?')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/settings/logo', {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.success) {
      currentBrandingState.site_logo = '';
      selectedLogoFile = null;
      const fileInput = document.getElementById('logoFileInput');
      if (fileInput) fileInput.value = '';
      updateLogoPreview(null);
      updateBrandMockups();
      updateAdminSidebarBrand(currentBrandingState);
      showSettingsAlert('Custom logo removed. Default stylized brand text will be displayed.', 'success');
    } else {
      showSettingsAlert('❌ ' + (data.message || 'Failed to remove logo.'), 'error');
    }
  } catch (err) {
    console.error('Logo delete error:', err);
    showSettingsAlert('❌ Network error removing logo.', 'error');
  }
}

function handleFaviconSelect(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const validExts = ['.ico', '.png', '.svg'];
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  if (!validExts.includes(ext)) {
    showSettingsAlert('❌ Invalid favicon format. Please upload .ico, .png, or .svg.', 'error');
    input.value = '';
    return;
  }
  if (file.size > 1024 * 1024) {
    showSettingsAlert('❌ Favicon file size exceeds 1MB limit.', 'error');
    input.value = '';
    return;
  }

  selectedFaviconFile = file;
  const dropText = document.getElementById('faviconDropzoneText');
  if (dropText) dropText.innerText = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  const btnUpload = document.getElementById('btnUploadFavicon');
  if (btnUpload) btnUpload.style.display = 'inline-flex';

  const reader = new FileReader();
  reader.onload = (e) => {
    const tabFavicon = document.getElementById('tabSimFavicon');
    if (tabFavicon) {
      tabFavicon.innerHTML = `<img src="${e.target.result}" alt="Favicon" style="width: 16px; height: 16px; object-fit: contain; border-radius: 2px;">`;
    }
  };
  reader.readAsDataURL(file);
}

async function triggerFaviconUpload() {
  if (!selectedFaviconFile) {
    showSettingsAlert('Please select a favicon file first.', 'error');
    return;
  }

  const btn = document.getElementById('btnUploadFavicon');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Uploading...';
  }

  try {
    const formData = new FormData();
    formData.append('favicon', selectedFaviconFile);

    const res = await fetch('/api/admin/settings/favicon', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success && data.faviconUrl) {
      currentBrandingState.site_favicon = data.faviconUrl;
      selectedFaviconFile = null;
      updateFaviconPreview(data.faviconUrl);
      showSettingsAlert('Browser favicon uploaded and applied successfully!', 'success');
    } else {
      showSettingsAlert('❌ ' + (data.message || 'Failed to upload favicon.'), 'error');
    }
  } catch (err) {
    console.error('Favicon upload error:', err);
    showSettingsAlert('❌ Network error during favicon upload.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '⬆️ Upload Favicon';
    }
  }
}

async function removeFaviconFile() {
  if (!confirm('Are you sure you want to remove the custom favicon?')) {
    return;
  }

  try {
    const res = await fetch('/api/admin/settings/favicon', {
      method: 'DELETE'
    });
    const data = await res.json();

    if (data.success) {
      currentBrandingState.site_favicon = '';
      selectedFaviconFile = null;
      const fileInput = document.getElementById('faviconFileInput');
      if (fileInput) fileInput.value = '';
      updateFaviconPreview(null);
      showSettingsAlert('Favicon removed.', 'success');
    } else {
      showSettingsAlert('❌ ' + (data.message || 'Failed to remove favicon.'), 'error');
    }
  } catch (err) {
    console.error('Favicon delete error:', err);
    showSettingsAlert('❌ Network error removing favicon.', 'error');
  }
}

function initBrandingEvents() {
  // Live input events for real-time mockup updates
  ['site_name', 'site_tagline', 'footer_copyright', 'footer_about'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        updateBrandMockups();
      });
    }
  });

  // Setup drag-and-drop for Logo
  const logoDrop = document.getElementById('logoDropzone');
  if (logoDrop) {
    ['dragenter', 'dragover'].forEach(eventName => {
      logoDrop.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoDrop.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      logoDrop.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        logoDrop.classList.remove('dragover');
      });
    });
    logoDrop.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const fileInput = document.getElementById('logoFileInput');
        if (fileInput) {
          fileInput.files = files;
          handleLogoSelect(fileInput);
        }
      }
    });
  }

  // Setup drag-and-drop for Favicon
  const favDrop = document.getElementById('faviconDropzone');
  if (favDrop) {
    ['dragenter', 'dragover'].forEach(eventName => {
      favDrop.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        favDrop.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      favDrop.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        favDrop.classList.remove('dragover');
      });
    });
    favDrop.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        const fileInput = document.getElementById('faviconFileInput');
        if (fileInput) {
          fileInput.files = files;
          handleFaviconSelect(fileInput);
        }
      }
    });
  }
}

function updateAdminSidebarBrand(branding) {
  const brandEl = document.getElementById('adminSidebarBrand');
  if (!brandEl) return;

  const siteName = (branding.site_name || 'PhonesDaddy').trim();

  if (branding.site_logo) {
    brandEl.innerHTML = `<img src="${branding.site_logo}?t=${Date.now()}" alt="${escapeHtml(siteName)}" style="max-height: 28px; max-width: 140px; object-fit: contain;">`;
  } else {
    const initial = siteName.charAt(0).toUpperCase() || 'P';
    brandEl.innerHTML = `
      <div class="brand-icon" style="width: 28px; height: 28px; font-size: 16px;">${escapeHtml(initial)}</div>
      <span>${escapeHtml(siteName)}</span>
    `;
  }
}

async function initAdminBranding() {
  try {
    const res = await fetch('/api/settings/public');
    const data = await res.json();
    if (data.success && data.branding) {
      updateAdminSidebarBrand(data.branding);
    }
  } catch (err) {
    // Non-fatal if public branding can't be fetched
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Profile & Security Controller
// ─────────────────────────────────────────────────────────────────────────────

async function loadAdminProfile() {
  try {
    const res = await fetch('/api/admin/auth/profile');
    if (res.status === 401) {
      console.warn('Admin session expired or unauthorized.');
      return;
    }
    const json = await res.json();
    if (json.success && json.data) {
      const u = json.data;
      const unEl = document.getElementById('profileUsername');
      const dnEl = document.getElementById('profileDisplayName');
      const pwEl = document.getElementById('profileCurrentPassword');
      if (unEl) unEl.value = u.username || 'admin';
      if (dnEl) dnEl.value = u.name || 'PhonesDaddy Master Admin';
      if (pwEl) pwEl.value = u.current_password || 'admin123';
    }
  } catch (err) {
    console.error('Failed to load profile:', err);
  }
}

function toggleCurrentPasswordVisibility() {
  const pwInput = document.getElementById('profileCurrentPassword');
  const eyeIcon = document.getElementById('pwEyeIcon');
  const eyeText = document.getElementById('pwEyeText');
  if (!pwInput) return;
  if (pwInput.type === 'password') {
    pwInput.type = 'text';
    if (eyeIcon) eyeIcon.innerHTML = window.ICONS ? ICONS.eye : '';
    if (eyeText) eyeText.innerText = 'Hide Password';
  } else {
    pwInput.type = 'password';
    if (eyeIcon) eyeIcon.innerHTML = window.ICONS ? ICONS.eye : '';
    if (eyeText) eyeText.innerText = 'Show Password';
  }
}

function copyCurrentPassword() {
  const pwInput = document.getElementById('profileCurrentPassword');
  if (!pwInput) return;
  const pw = pwInput.value;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(pw).then(() => {
      showProfileAlert('Current password copied to clipboard!', 'success');
      showAdminToast('Password copied to clipboard!', 'info');
    }).catch(() => {
      fallbackCopy(pwInput);
    });
  } else {
    fallbackCopy(pwInput);
  }
}

function fallbackCopy(pwInput) {
  pwInput.select();
  document.execCommand('copy');
  showProfileAlert('Password copied to clipboard!', 'success');
  showAdminToast('Password copied to clipboard!', 'info');
}

function toggleInputPw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerHTML = window.ICONS ? ICONS.eye : '';
  } else {
    input.type = 'password';
    if (btn) btn.innerHTML = window.ICONS ? ICONS.eye : '';
  }
}

async function submitAdminProfile(e) {
  if (e) e.preventDefault();
  const un = document.getElementById('profileUsername')?.value?.trim();
  const name = document.getElementById('profileDisplayName')?.value?.trim();
  const newPw = document.getElementById('newAdminPassword')?.value?.trim();
  const confirmPw = document.getElementById('confirmAdminPassword')?.value?.trim();
  const btn = document.getElementById('btnSaveProfile');
  const btnTop = document.getElementById('btnSaveProfileTop');

  if (newPw || confirmPw) {
    if (newPw !== confirmPw) {
      showProfileAlert('❌ New passwords do not match! Please verify both fields.', 'error');
      showAdminToast('❌ New passwords do not match!', 'error');
      return;
    }
    if (newPw.length < 4) {
      showProfileAlert('❌ Password must be at least 4 characters long.', 'error');
      showAdminToast('❌ Password must be at least 4 characters long.', 'error');
      return;
    }
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Updating Profile...';
  }
  if (btnTop) {
    btnTop.disabled = true;
    btnTop.innerText = '⏳ Saving...';
  }

  try {
    const body = { username: un, name: name };
    if (newPw) body.new_password = newPw;

    const res = await fetch('/api/admin/auth/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();

    if (json.success) {
      showProfileAlert(json.message, 'success');
      showAdminToast(json.message, 'success');
      const pwInput = document.getElementById('profileCurrentPassword');
      if (pwInput && json.data && json.data.current_password) {
        pwInput.value = json.data.current_password;
      }
      const npw = document.getElementById('newAdminPassword');
      const cpw = document.getElementById('confirmAdminPassword');
      if (npw) npw.value = '';
      if (cpw) cpw.value = '';
    } else {
      showProfileAlert('❌ ' + (json.message || 'Failed to update profile'), 'error');
      showAdminToast('❌ ' + (json.message || 'Failed to update profile'), 'error');
    }
  } catch (err) {
    console.error('Error saving profile:', err);
    showProfileAlert('❌ Error communicating with server: ' + err.message, 'error');
    showAdminToast('❌ Error communicating with server', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '💾 Save Profile & Password Changes';
    }
    if (btnTop) {
      btnTop.disabled = false;
      btnTop.innerText = '💾 Save Changes';
    }
  }
}

function showProfileAlert(msg, type = 'success') {
  const alertEl = document.getElementById('profileAlert');
  if (!alertEl) return;
  alertEl.style.display = 'block';
  alertEl.innerText = msg;
  if (type === 'error') {
    alertEl.style.background = '#fee2e2';
    alertEl.style.color = '#991b1b';
    alertEl.style.border = '1px solid #f87171';
  } else {
    alertEl.style.background = '#ecfdf5';
    alertEl.style.color = '#065f46';
    alertEl.style.border = '1px solid #34d399';
  }
  setTimeout(() => {
    if (alertEl) alertEl.style.display = 'none';
  }, 4500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Team & User Management Controller
// ─────────────────────────────────────────────────────────────────────────────

let teamUsersCache = [];

async function loadTeamUsers() {
  const tbody = document.getElementById('teamUsersTableBody');
  const badge = document.getElementById('teamUsersCountBadge');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 36px 16px; color: #64748b;">
        <div style="font-size: 20px; margin-bottom: 8px;">⏳</div>
        <div>Loading team members...</div>
      </td>
    </tr>
  `;

  try {
    const res = await fetch('/api/admin/auth/users', { credentials: 'same-origin' });
    if (res.status === 401 || res.status === 403) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 24px 16px; color: #ef4444; font-weight: 600;">
            ⚠️ You must be logged in as Master Admin to view and manage team members.
          </td>
        </tr>
      `;
      if (badge) badge.innerText = 'Unauthorized';
      return;
    }

    const data = await res.json();
    if (data.success && Array.isArray(data.users)) {
      teamUsersCache = data.users;
      if (badge) badge.innerText = `${data.users.length} Account${data.users.length === 1 ? '' : 's'}`;
      renderTeamUsersTable(data.users);
    } else {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Failed to load users: ${data.message || 'Unknown error'}</td></tr>`;
    }
  } catch (err) {
    console.error('Failed to load team users:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Network error loading team members.</td></tr>`;
  }
}

function renderTeamUsersTable(users) {
  const tbody = document.getElementById('teamUsersTableBody');
  if (!tbody) return;

  if (users.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 36px 16px; color: #64748b;">
          No staff users found. Click "Add New Team Member" to register one.
        </td>
      </tr>
    `;
    return;
  }

  const roleMeta = {
    admin: { label: 'Administrator', bg: '#f3e8ff', color: '#7e22ce', icon: '👑', desc: 'Full Access' },
    writer: { label: 'Article Writer', bg: '#ecfdf5', color: '#047857', icon: '📝', desc: 'Blog & Categories' },
    phones: { label: 'Mobile Manager', bg: '#e0f2fe', color: '#0369a1', icon: '📱', desc: 'Phones & Specs' },
    contributor: { label: 'Contributor', bg: '#fef3c7', color: '#b45309', icon: '⚡', desc: 'Articles & Mobiles' }
  };

  tbody.innerHTML = users.map(u => {
    const isMaster = Number(u.id) === 1;
    const meta = roleMeta[u.role] || roleMeta.admin;
    const initial = (u.name || u.username || 'U').charAt(0).toUpperCase();
    const createdStr = u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'Initial';
    const isActive = u.status !== 'inactive';

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 14px 16px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 36px; height: 36px; border-radius: 50%; background: ${meta.bg}; color: ${meta.color}; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 1px solid rgba(0,0,0,0.06);">
              ${escapeHtml(initial)}
            </div>
            <div>
              <div style="font-weight: 700; color: #0f172a; font-size: 14px; display: flex; align-items: center; gap: 6px;">
                ${escapeHtml(u.name || u.username)}
                ${isMaster ? '<span style="font-size: 10px; background: #fef3c7; color: #92400e; padding: 1px 6px; border-radius: 4px; font-weight: 800;">MASTER</span>' : ''}
              </div>
              <div style="font-size: 12px; color: #64748b;">${escapeHtml(u.email || 'No email attached')}</div>
            </div>
          </div>
        </td>
        <td style="padding: 14px 16px; font-family: monospace; font-size: 13.5px; font-weight: 600; color: #334155;">
          @${escapeHtml(u.username)}
        </td>
        <td style="padding: 14px 16px;">
          <span style="display: inline-flex; align-items: center; gap: 6px; background: ${meta.bg}; color: ${meta.color}; padding: 4px 10px; border-radius: 14px; font-size: 12px; font-weight: 700;">
            <span>${meta.icon}</span>
            <span>${meta.label}</span>
          </span>
          <div style="font-size: 11px; color: #94a3b8; margin-top: 3px;">${meta.desc}</div>
        </td>
        <td style="padding: 14px 16px; text-align: center;">
          <span style="display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11.5px; font-weight: 700; background: ${isActive ? '#ecfdf5' : '#fee2e2'}; color: ${isActive ? '#047857' : '#b91c1c'};">
            ${isActive ? '● Active' : '○ Inactive'}
          </span>
        </td>
        <td style="padding: 14px 16px; font-size: 12.5px; color: #64748b;">
          ${escapeHtml(createdStr)}
        </td>
        <td style="padding: 14px 16px; text-align: right; white-space: nowrap;">
          <button type="button" onclick="editUser(${u.id})" class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 12px; margin-right: 6px;" title="Edit User">
            ✏️ Edit
          </button>
          ${isMaster ? `
            <button type="button" class="btn btn-sm" disabled style="padding: 4px 10px; font-size: 12px; opacity: 0.4; cursor: not-allowed; background: #e2e8f0; color: #94a3b8;" title="Master Admin cannot be deleted">
              🔒 Master
            </button>
          ` : `
            <button type="button" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')" class="btn btn-sm" style="padding: 4px 10px; font-size: 12px; background: #fee2e2; color: #dc2626; border: 1px solid #fecaca;" title="Delete User">
              🗑️ Delete
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

function openAddUserModal() {
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userModalForm');
  const alertEl = document.getElementById('userModalAlert');
  const title = document.getElementById('userModalTitle');
  const subtitle = document.getElementById('userModalSubtitle');
  const idInput = document.getElementById('userModalId');
  const nameInput = document.getElementById('userModalName');
  const unInput = document.getElementById('userModalUsername');
  const emailInput = document.getElementById('userModalEmail');
  const pwInput = document.getElementById('userModalPassword');
  const roleSelect = document.getElementById('userModalRole');
  const statusSelect = document.getElementById('userModalStatus');
  const pwLabel = document.getElementById('userModalPwLabel');
  const pwHelp = document.getElementById('userModalPwHelp');

  if (!modal) return;

  if (form) form.reset();
  if (alertEl) alertEl.style.display = 'none';
  if (idInput) idInput.value = '';
  if (title) title.innerText = 'Add New Team Member';
  if (subtitle) subtitle.innerText = 'Create a new staff login and assign specific management rights.';
  if (unInput) unInput.disabled = false;
  if (pwLabel) pwLabel.innerHTML = 'Password <span style="color: #ef4444;">*</span>';
  if (pwInput) {
    pwInput.required = true;
    pwInput.placeholder = 'Enter secure password (min 4 chars)';
  }
  if (pwHelp) pwHelp.innerText = 'Must be at least 4 characters long.';
  if (roleSelect) {
    roleSelect.value = 'writer';
    roleSelect.disabled = false;
  }
  if (statusSelect) {
    statusSelect.value = 'active';
    statusSelect.disabled = false;
  }

  modal.style.display = 'flex';
  if (nameInput) nameInput.focus();
}

function editUser(userId) {
  const user = teamUsersCache.find(u => Number(u.id) === Number(userId));
  if (!user) {
    showAdminToast('User not found in cache. Refreshing...', 'error');
    loadTeamUsers();
    return;
  }

  const modal = document.getElementById('userModal');
  const alertEl = document.getElementById('userModalAlert');
  const title = document.getElementById('userModalTitle');
  const subtitle = document.getElementById('userModalSubtitle');
  const idInput = document.getElementById('userModalId');
  const nameInput = document.getElementById('userModalName');
  const unInput = document.getElementById('userModalUsername');
  const emailInput = document.getElementById('userModalEmail');
  const pwInput = document.getElementById('userModalPassword');
  const roleSelect = document.getElementById('userModalRole');
  const statusSelect = document.getElementById('userModalStatus');
  const pwLabel = document.getElementById('userModalPwLabel');
  const pwHelp = document.getElementById('userModalPwHelp');

  if (!modal) return;

  if (alertEl) alertEl.style.display = 'none';
  if (idInput) idInput.value = user.id;
  if (title) title.innerText = `Edit Team Member: @${user.username}`;
  if (subtitle) subtitle.innerText = 'Update profile information, change assigned role, or set a new password.';
  if (nameInput) nameInput.value = user.name || '';
  if (unInput) {
    unInput.value = user.username || '';
    // Prevent changing username of master admin ID 1
    unInput.disabled = Number(user.id) === 1;
  }
  if (emailInput) emailInput.value = user.email || '';
  if (pwInput) {
    pwInput.value = '';
    pwInput.required = false;
    pwInput.placeholder = 'Leave blank to keep current password unchanged';
  }
  if (pwLabel) pwLabel.innerHTML = 'New Password (Optional)';
  if (pwHelp) pwHelp.innerText = 'Leave empty to keep existing password unchanged.';
  if (roleSelect) {
    roleSelect.value = user.role || 'writer';
    // Master admin ID 1 role cannot be changed from admin
    if (Number(user.id) === 1) {
      roleSelect.value = 'admin';
      roleSelect.disabled = true;
    } else {
      roleSelect.disabled = false;
    }
  }
  if (statusSelect) {
    statusSelect.value = user.status || 'active';
    // Master admin cannot be deactivated
    statusSelect.disabled = Number(user.id) === 1;
  }

  modal.style.display = 'flex';
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.style.display = 'none';
}

async function saveUserModal(e) {
  if (e) e.preventDefault();

  const id = document.getElementById('userModalId')?.value;
  const name = document.getElementById('userModalName')?.value?.trim();
  const username = document.getElementById('userModalUsername')?.value?.trim();
  const email = document.getElementById('userModalEmail')?.value?.trim();
  const password = document.getElementById('userModalPassword')?.value?.trim();
  const role = document.getElementById('userModalRole')?.value;
  const status = document.getElementById('userModalStatus')?.value;
  const btn = document.getElementById('btnSaveUserModal');

  if (!name || !username) {
    showUserModalAlert('Full Display Name and Username are required.', 'error');
    return;
  }

  if (!id && (!password || password.length < 4)) {
    showUserModalAlert('Password is required for new users and must be at least 4 characters.', 'error');
    return;
  }

  if (password && password.length < 4) {
    showUserModalAlert('Password must be at least 4 characters long.', 'error');
    return;
  }

  const payload = {
    name,
    username,
    email,
    role: role || 'writer',
    status: status || 'active'
  };
  if (password) {
    payload.password = password;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Saving...';
  }

  try {
    const isEdit = Boolean(id);
    const url = isEdit ? `/api/admin/auth/users/${id}` : '/api/admin/auth/users';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closeUserModal();
      showTeamAlert(`✅ User @${username} ${isEdit ? 'updated' : 'created'} successfully!`, 'success');
      showAdminToast(`User @${username} ${isEdit ? 'updated' : 'created'}!`, 'success');
      loadTeamUsers();
    } else {
      showUserModalAlert(`❌ ${data.message || 'Failed to save user.'}`, 'error');
    }
  } catch (err) {
    console.error('Error saving user:', err);
    showUserModalAlert('❌ Network error saving user.', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '💾 Save User';
    }
  }
}

async function deleteUser(userId, username) {
  if (Number(userId) === 1) {
    alert('Master Administrator account cannot be deleted.');
    return;
  }

  if (!confirm(`Are you sure you want to permanently delete the staff user "@${username}"? They will immediately lose admin access.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/auth/users/${userId}`, {
      method: 'DELETE',
      credentials: 'same-origin'
    });
    const data = await res.json();
    if (data.success) {
      showTeamAlert(`✅ User @${username} has been deleted.`, 'success');
      showAdminToast(`User @${username} deleted.`, 'info');
      loadTeamUsers();
    } else {
      showTeamAlert(`❌ ${data.message || 'Failed to delete user.'}`, 'error');
      showAdminToast(`❌ ${data.message || 'Failed to delete user.'}`, 'error');
    }
  } catch (err) {
    console.error('Failed to delete user:', err);
    showTeamAlert('❌ Network error while deleting user.', 'error');
  }
}

function toggleUserPwVisibility(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    if (btn) btn.innerText = '🙈';
  } else {
    input.type = 'password';
    if (btn) btn.innerText = '👁️';
  }
}

function showTeamAlert(msg, type = 'success') {
  const el = document.getElementById('teamAlert');
  if (!el) return;
  el.style.display = 'block';
  el.innerText = msg;
  if (type === 'error') {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.style.border = '1px solid #f87171';
  } else {
    el.style.background = '#ecfdf5';
    el.style.color = '#065f46';
    el.style.border = '1px solid #34d399';
  }
  setTimeout(() => {
    if (el) el.style.display = 'none';
  }, 4500);
}

function showUserModalAlert(msg, type = 'error') {
  const el = document.getElementById('userModalAlert');
  if (!el) return;
  el.style.display = 'block';
  el.innerText = msg;
  if (type === 'error') {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.style.border = '1px solid #f87171';
  } else {
    el.style.background = '#ecfdf5';
    el.style.color = '#065f46';
    el.style.border = '1px solid #34d399';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Role-Based Navigation & UI Access Controller
// ─────────────────────────────────────────────────────────────────────────────

async function initRoleAccessUI() {
  try {
    const res = await fetch('/api/admin/auth/check', { credentials: 'same-origin' });
    const data = await res.json();

    if (!data.authenticated || !data.user) {
      return;
    }

    const user = data.user;
    window.currentAdminUser = user;

    // Update sidebar footer
    const footerWrap = document.querySelector('.admin-sidebar-footer span');
    if (footerWrap) {
      let roleLabel = 'Admin';
      if (user.role === 'writer') roleLabel = 'Article Writer';
      else if (user.role === 'phones') roleLabel = 'Mobile Manager';
      else if (user.role === 'contributor') roleLabel = 'Contributor';
      footerWrap.innerHTML = `Logged in as <strong>${escapeHtml(user.displayName || user.username)}</strong> <span style="font-size: 11px; opacity: 0.85;">(${roleLabel})</span>`;
    }

    // Role-based sidebar menu visibility:
    const phonesLink = document.querySelector('.admin-nav a[href="/admin/phones"]')?.closest('li');
    const brandsLink = document.querySelector('.admin-nav a[href="/admin/brands"]')?.closest('li');
    const newsLink = document.querySelector('.admin-nav a[href="/admin/news"]')?.closest('li');
    const categoriesLink = document.querySelector('.admin-nav a[href="/admin/categories"]')?.closest('li');
    const pagesLink = document.querySelector('.admin-nav a[href="/admin/pages"]')?.closest('li');
    const settingsItem = document.getElementById('navSettingsDropdown');

    if (user.role === 'writer') {
      // Writer can only edit news and categories
      if (phonesLink) phonesLink.style.display = 'none';
      if (brandsLink) brandsLink.style.display = 'none';
      if (pagesLink) pagesLink.style.display = 'none';
      if (settingsItem) settingsItem.style.display = 'none';
    } else if (user.role === 'phones') {
      // Phones manager can only edit phones and brands
      if (newsLink) newsLink.style.display = 'none';
      if (categoriesLink) categoriesLink.style.display = 'none';
      if (pagesLink) pagesLink.style.display = 'none';
      if (settingsItem) settingsItem.style.display = 'none';
    } else if (user.role === 'contributor') {
      // Contributor can edit both phones and news, but not site settings
      if (pagesLink) pagesLink.style.display = 'none';
      if (settingsItem) settingsItem.style.display = 'none';
    }
  } catch (err) {
    // Non-fatal if check fails
  }
}

function insertDummyAds() {
  Object.entries(DUMMY_ADS).forEach(([key, val]) => {
    const el = document.getElementById(key);
    if (el) el.value = val;
    const chk = document.getElementById(`${key}_enabled`);
    if (chk) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change'));
    }
  });
  showSettingsAlert('🧪 Realistic dummy ads loaded into all 9 slots! Click "Save All Settings" to publish them.', 'info');
}

function enableAllAdSlots() {
  ['ad_phone_top', 'ad_phone_mid', 'ad_phone_spec_2', 'ad_phone_bottom', 'ad_sidebar_top', 'ad_sidebar_bottom', 'ad_article_top', 'ad_article_mid', 'ad_article_bottom'].forEach(key => {
    const chk = document.getElementById(`${key}_enabled`);
    if (chk) {
      chk.checked = true;
      chk.dispatchEvent(new Event('change'));
    }
  });
  showSettingsAlert('⚡ All 9 ad placement slots have been enabled!', 'info');
}

function showSettingsAlert(msg, type = 'success') {
  const alertBox = document.getElementById('settingsAlert');
  if (!alertBox) return;

  alertBox.style.display = 'block';
  alertBox.innerText = msg;

  if (type === 'success') {
    alertBox.style.background = '#dcfce7';
    alertBox.style.color = '#15803d';
    alertBox.style.border = '1px solid #86efac';
  } else {
    alertBox.style.background = '#fee2e2';
    alertBox.style.color = '#b91c1c';
    alertBox.style.border = '1px solid #fca5a5';
  }

  // Scroll to alert smoothly
  alertBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function appendPreset(presetKey) {
  const headInput = document.getElementById('head_snippets');
  if (!headInput) return;

  const snippet = SNIPPET_PRESETS[presetKey];
  if (!snippet) return;

  const currentVal = headInput.value.trim();
  if (currentVal.length > 0) {
    headInput.value = currentVal + '\n\n' + snippet;
  } else {
    headInput.value = snippet;
  }

  headInput.dispatchEvent(new Event('input'));
  headInput.focus();

  showSettingsAlert(`Snippet preset "${presetKey}" appended to head code box! Remember to replace placeholder IDs before saving.`, 'success');
}

function clearHeadCode() {
  const headInput = document.getElementById('head_snippets');
  if (!headInput) return;

  if (headInput.value.trim().length > 0 && !confirm('Are you sure you want to clear the <head> code box?')) {
    return;
  }

  headInput.value = '';
  headInput.dispatchEvent(new Event('input'));
  headInput.focus();
}

function copyHeadCode() {
  const headInput = document.getElementById('head_snippets');
  if (!headInput) return;

  if (!headInput.value.trim()) {
    alert('Code box is empty.');
    return;
  }

  navigator.clipboard.writeText(headInput.value)
    .then(() => alert('Code copied to clipboard!'))
    .catch(() => alert('Please select and copy manually.'));
}

function previewHeadInjection() {
  const modal = document.getElementById('previewModal');
  const codeBox = document.getElementById('previewModalCode');
  if (!modal || !codeBox) return;

  const isHeadEnabled = document.getElementById('is_head_code_enabled') ? document.getElementById('is_head_code_enabled').checked : true;
  const rawSnippets = document.getElementById('head_snippets') ? document.getElementById('head_snippets').value.trim() : '';
  const adsenseId = document.getElementById('google_adsense_client') ? document.getElementById('google_adsense_client').value.trim() : '';
  const gaId = document.getElementById('google_analytics_id') ? document.getElementById('google_analytics_id').value.trim() : '';
  const adsterra = document.getElementById('adsterra_code') ? document.getElementById('adsterra_code').value.trim() : '';

  if (!isHeadEnabled) {
    codeBox.innerText = '/* Head Snippet injection is currently DISABLED via the toggle switch.\n   Nothing will be injected into public pages until enabled. */';
    modal.style.display = 'flex';
    return;
  }

  const parts = [];

  if (gaId && !rawSnippets.includes(gaId)) {
    parts.push(`<!-- Google tag (gtag.js) - Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${gaId}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${gaId}');\n</script>`);
  }

  if (adsenseId && !rawSnippets.includes(adsenseId)) {
    parts.push(`<!-- Google AdSense -->\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseId}"\n     crossorigin="anonymous"></script>`);
  }

  if (adsterra && !rawSnippets.includes(adsterra)) {
    parts.push(`<!-- Adsterra Code -->\n${adsterra}`);
  }

  if (rawSnippets) {
    parts.push(rawSnippets);
  }

  if (parts.length === 0) {
    codeBox.innerText = '/* No snippets or IDs configured yet.\n   Add your AdSense, Analytics, or Adsterra code and click Save. */';
  } else {
    codeBox.innerText = parts.join('\n\n');
  }

  modal.style.display = 'flex';
}

function closePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin Reviews & Comments: Shared Thread Modal & Dashboard Replying
// ─────────────────────────────────────────────────────────────────────────────

let activeThreadId = null;

async function loadDashboardReviews() {
  const tbody = document.getElementById('dashboardReviewsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/admin/reviews/list?limit=6&page=1&status=all');
    const json = await res.json();

    if (!json.success || !json.data || json.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: #64748b; padding: 28px;">
            No reviews or comments yet. Feedback submitted by community will appear here.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = json.data.map(item => {
      const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric'
      }) : '—';

      const typeBadge = item.entity_type === 'phone'
        ? `<span style="background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">${window.ICONS ? ICONS.phone : ""} Mobile</span>`
        : `<span style="background: #f0fdfa; color: #0d9488; border: 1px solid #99f6e4; font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 4px;">${window.ICONS ? ICONS.newspaper : ""} Blog</span>`;

      let ratingHtml = '<span style="color: #94a3b8;">—</span>';
      if (item.rating) {
        ratingHtml = `<span style="color: #f59e0b; font-size: 12px;">${'★'.repeat(item.rating)}</span> <strong style="font-size: 11px;">${item.rating}/5</strong>`;
      }

      const statusBadge = item.status === 'approved'
        ? `<span style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🟢 Live</span>`
        : `<span style="background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;">🔴 Rejected</span>`;

      return `
        <tr style="cursor: pointer; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background=''" onclick="if (!event.target.closest('a') && !event.target.closest('button')) openThreadModal(${item.id})">
          <td>
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <strong style="color: #0f172a; font-size: 13px;">${escapeHtml(item.user_name)}</strong>
              <span style="font-size: 11px; color: #64748b;">${escapeHtml(item.user_email_phone)}</span>
            </div>
          </td>
          <td>
            <div style="font-weight: 600; font-size: 13px;">
              <a href="${item.item_url}" target="_blank" style="color: #0f172a; text-decoration: underline;" onclick="event.stopPropagation()">
                ${escapeHtml(item.item_title || 'View Item')}
              </a>
            </div>
          </td>
          <td>${typeBadge}</td>
          <td>${ratingHtml}</td>
          <td style="max-width: 280px;">
            <div class="dashboard-comment-preview" style="max-height: 48px; overflow: hidden; font-size: 12.5px; line-height: 1.5; color: #334155;">
              ${formatCommentMessage(item.message)}
            </div>
          </td>
          <td>${statusBadge}</td>
          <td style="font-size: 12px; color: #64748b; white-space: nowrap;">${dateStr}</td>
          <td style="text-align: right; white-space: nowrap;">
            <button onclick="event.stopPropagation(); openThreadModal(${item.id})" class="btn btn-primary btn-sm" style="padding: 4px 10px; font-size: 12px; font-weight: 700;">
              ${window.ICONS ? ICONS.comment : ""} View &amp; Reply ${item.reply_count > 0 ? `(${item.reply_count})` : ''}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading dashboard reviews:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #ef4444; padding: 20px;">Failed to load recent feedback</td></tr>`;
  }
}

async function openThreadModal(id) {
  activeThreadId = id;
  const modal = document.getElementById('threadModal');
  if (!modal) return;
  const body = document.getElementById('modalThreadBody');
  const subTitle = document.getElementById('modalItemSubtitle');

  modal.style.display = 'flex';
  body.innerHTML = `<div style="text-align: center; padding: 40px; color: #64748b;">Loading feedback thread...</div>`;
  const replyForm = document.getElementById('adminReplyForm');
  if (replyForm) replyForm.reset();

  try {
    const res = await fetch(`/api/admin/reviews/${id}`);
    const json = await res.json();

    if (!json.success || !json.data) {
      body.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 30px;">Failed to load thread details.</div>`;
      return;
    }

    const { item, replies, rootId } = json.data;
    activeThreadId = rootId; // Always reply to root

    if (subTitle) {
      subTitle.innerHTML = `Item: <a href="${item.item_url}" target="_blank" style="color: #0d9488; font-weight: 700; text-decoration: underline;">${escapeHtml(item.item_title || 'View Item')}</a> (${item.entity_type === 'phone' ? 'Smartphone Specs' : 'Blog Article'})`;
    }

    const dateStr = item.created_at ? new Date(item.created_at).toLocaleString() : '';
    const stars = item.rating ? '★'.repeat(item.rating) + '☆'.repeat(5 - item.rating) : '';

    let html = `
      <!-- Main Parent Review Box -->
      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <div>
            <strong style="font-size: 15px; color: #0f172a;">${escapeHtml(item.user_name)}</strong>
            <span style="font-size: 12px; color: #64748b; margin-left: 6px;">(${escapeHtml(item.user_email_phone)})</span>
            ${item.user_website ? `<br><a href="${escapeHtml(item.user_website)}" target="_blank" style="font-size: 12px; color: #0d9488; text-decoration: underline;">${escapeHtml(item.user_website)}</a>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${item.rating ? `<span style="color: #f59e0b; font-size: 14px;">${stars}</span>` : ''}
            <span style="font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; ${item.status === 'approved' ? 'background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0;' : 'background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;'}">
              ${item.status === 'approved' ? '🟢 Live' : '🔴 Rejected'}
            </span>
          </div>
        </div>
        <div class="modal-feedback-content" style="font-size: 14.5px; line-height: 1.7; color: #1e293b; margin: 0;">
          ${formatCommentMessage(item.message)}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          <span>${window.ICONS ? ICONS.calendar : ""} ${dateStr} • IP: <code>${escapeHtml(item.ip_address || '127.0.0.1')}</code></span>
          <button onclick="handleStatusChange(${item.id}, '${item.status === 'approved' ? 'rejected' : 'approved'}'); openThreadModal(${item.id});" class="btn btn-sm" style="font-size: 11.5px; padding: 2px 8px;">
            ${item.status === 'approved' ? 'Reject Feedback' : 'Approve Feedback'}
          </button>
        </div>
      </div>

      <!-- Replies Section -->
      <div>
        <h4 style="font-size: 14px; font-weight: 800; color: #334155; margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
          <span>${window.ICONS ? ICONS.comment : ""} Conversation Thread (${replies.length} ${replies.length === 1 ? 'reply' : 'replies'})</span>
        </h4>
    `;

    if (replies.length === 0) {
      html += `
        <div style="text-align: center; padding: 24px; background: #ffffff; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 13px;">
          No replies in this thread yet. Write an official response below!
        </div>
      `;
    } else {
      html += `<div style="display: flex; flex-direction: column; gap: 12px; padding-left: 16px; border-left: 3px solid #e2e8f0;">`;
      replies.forEach(rep => {
        const rDate = rep.created_at ? new Date(rep.created_at).toLocaleString() : '';
        const isAdmin = rep.is_admin === 1 || rep.is_admin === true;

        html += `
          <div style="background: ${isAdmin ? '#f0fdfa' : '#ffffff'}; border: 1px solid ${isAdmin ? '#99f6e4' : '#e2e8f0'}; border-radius: 8px; padding: 14px; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <strong style="font-size: 13.5px; color: ${isAdmin ? '#0f766e' : '#0f172a'};">${escapeHtml(rep.user_name)}</strong>
                ${isAdmin ? `<span style="background: #0d9488; color: #fff; font-size: 10px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">👑 OFFICIAL ADMIN</span>` : ''}
                <span style="font-size: 11.5px; color: #94a3b8;">${rDate}</span>
              </div>
              <div style="display: flex; gap: 6px;">
                <button onclick="handleDeleteFeedback(${rep.id}); openThreadModal(${rootId});" style="background: none; border: none; color: #ef4444; font-size: 12px; cursor: pointer;" title="Delete reply">🗑️</button>
              </div>
            </div>
            <div style="font-size: 13.5px; line-height: 1.6; color: #334155; margin: 0;">
              ${formatCommentMessage(rep.message)}
            </div>
          </div>
        `;
      });
      html += `</div>`;
    }

    html += `</div>`;
    body.innerHTML = html;
  } catch (err) {
    console.error('Error opening thread:', err);
    body.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 30px;">Error loading thread.</div>`;
  }
}

function closeThreadModal() {
  const modal = document.getElementById('threadModal');
  if (modal) modal.style.display = 'none';
  activeThreadId = null;
}

async function submitAdminReply(e) {
  e.preventDefault();
  if (!activeThreadId) return;

  const textarea = document.getElementById('adminReplyMessage');
  const submitBtn = document.getElementById('btnSendAdminReply');
  const msg = textarea ? textarea.value.trim() : '';

  if (!msg) return;

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
  }

  try {
    const res = await fetch(`/api/admin/reviews/${activeThreadId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });

    const json = await res.json();

    if (json.success) {
      showAdminToast('Official reply posted successfully!');
      if (textarea) textarea.value = '';
      openThreadModal(activeThreadId); // Refresh modal thread
      // Refresh dashboard list if present
      if (typeof loadDashboardReviews === 'function') loadDashboardReviews();
      // Refresh reviews page list if present
      if (typeof loadFeedbackList === 'function') loadFeedbackList();
      if (typeof loadFeedbackStats === 'function') loadFeedbackStats();
    } else {
      alert('Reply failed: ' + (json.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error posting admin reply:', err);
    alert('Server error posting reply');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Reply \u2192';
    }
  }
}

function insertAdminReplyFormat(tag) {
  const txt = document.getElementById('adminReplyMessage');
  if (!txt) return;
  const start = txt.selectionStart;
  const end = txt.selectionEnd;
  const val = txt.value;
  const selected = val.substring(start, end) || 'text';
  txt.value = val.substring(0, start) + `<${tag}>${selected}</${tag}>` + val.substring(end);
  txt.focus();
}

function insertAdminReplyLink() {
  const txt = document.getElementById('adminReplyMessage');
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

function insertAdminReplyImage() {
  const choice = confirm('Click OK to upload an image from your device, or Cancel to enter an image URL.');
  if (choice) {
    const fileInput = document.getElementById('adminReplyImgInput');
    if (fileInput) fileInput.click();
  } else {
    const url = prompt('Enter image URL:');
    if (url && url.trim()) {
      const txt = document.getElementById('adminReplyMessage');
      if (txt) {
        txt.value += `\n<img src="${url.trim()}">\n`;
        txt.focus();
      }
    }
  }
}

async function handleAdminReplyImageUpload(input) {
  const file = input.files[0];
  if (!file) return;
  input.value = '';

  const fd = new FormData();
  fd.append('image', file);

  try {
    showAdminToast('Uploading reply image...', 'info');
    const res = await fetch('/api/reviews/upload-image', {
      method: 'POST',
      body: fd
    });
    const json = await res.json();
    if (json.success && json.url) {
      const txt = document.getElementById('adminReplyMessage');
      if (txt) {
        txt.value += `\n<img src="${json.url}">\n`;
        txt.focus();
      }
      showAdminToast('Image uploaded and inserted into reply!');
    } else {
      alert('Upload failed: ' + (json.message || 'Error uploading image'));
    }
  } catch (err) {
    console.error(err);
    alert('Network error while uploading image');
  }
}

async function handleStatusChange(id, newStatus) {
  try {
    const res = await fetch(`/api/admin/reviews/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const json = await res.json();
    if (json.success) {
      showAdminToast(`Item has been ${newStatus === 'approved' ? 'approved (published live)' : 'rejected (hidden from public)'}`);
      if (typeof loadFeedbackList === 'function') loadFeedbackList();
      if (typeof loadFeedbackStats === 'function') loadFeedbackStats();
      if (typeof loadDashboardReviews === 'function') loadDashboardReviews();
    } else {
      alert('Action failed: ' + (json.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error changing status:', err);
    alert('Server error changing status');
  }
}

async function handleDeleteFeedback(id) {
  if (!confirm('Are you sure you want to permanently delete this review / comment?\n\nThis action cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showAdminToast('Feedback deleted successfully');
      if (typeof loadFeedbackList === 'function') loadFeedbackList();
      if (typeof loadFeedbackStats === 'function') loadFeedbackStats();
      if (typeof loadDashboardReviews === 'function') loadDashboardReviews();
      if (activeThreadId === id) {
        closeThreadModal();
      }
    } else {
      alert('Delete failed: ' + (json.message || 'Unknown error'));
    }
  } catch (err) {
    console.error('Error deleting feedback:', err);
    alert('Server error while deleting feedback');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Universal Mobile Responsive Navigation Controller
// ─────────────────────────────────────────────────────────────────────────────

function toggleAdminSidebar() {
  document.body.classList.toggle('admin-sidebar-open');
}

function openAdminSidebar() {
  document.body.classList.add('admin-sidebar-open');
}

function closeAdminSidebar() {
  document.body.classList.remove('admin-sidebar-open');
}

function initMobileNavigation() {
  // 1. Ensure Backdrop Overlay exists
  let backdrop = document.querySelector('.admin-sidebar-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'admin-sidebar-backdrop';
    document.body.appendChild(backdrop);
  }
  backdrop.addEventListener('click', closeAdminSidebar);

  // 2. Ensure Close button exists in Sidebar Brand
  const brandEl = document.querySelector('.admin-sidebar-brand');
  if (brandEl && !brandEl.querySelector('.admin-sidebar-close-btn')) {
    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'admin-sidebar-close-btn';
    closeBtn.innerHTML = window.ICONS ? ICONS.close : '&times;';
    closeBtn.setAttribute('aria-label', 'Close Menu');
    closeBtn.onclick = closeAdminSidebar;
    brandEl.appendChild(closeBtn);
  }

  // 3. Ensure Hamburger Button exists in Topbar
  const topbar = document.querySelector('.admin-topbar');
  if (topbar && !topbar.querySelector('.admin-hamburger-btn')) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'admin-hamburger-btn';
    btn.innerHTML = window.ICONS ? ICONS.menu : '&#9776;';
    btn.setAttribute('aria-label', 'Toggle Navigation Menu');
    btn.onclick = toggleAdminSidebar;

    const firstH2 = topbar.querySelector('h2');
    if (firstH2 && firstH2.parentElement === topbar) {
      const wrap = document.createElement('div');
      wrap.className = 'admin-topbar-title-wrap';
      topbar.insertBefore(wrap, firstH2);
      wrap.appendChild(btn);
      wrap.appendChild(firstH2);
    } else {
      topbar.insertBefore(btn, topbar.firstChild);
    }
  }

  // 4. Close drawer when clicking any sidebar navigation link on mobile
  const navLinks = document.querySelectorAll('.admin-nav-link, .admin-nav-sublink');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 992) {
        closeAdminSidebar();
      }
    });
  });

  // 5. Close drawer on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('admin-sidebar-open')) {
      closeAdminSidebar();
    }
  });

  // 6. Wrap all .admin-table instances in .admin-table-responsive if not already wrapped
  wrapAdminTables();
}

function wrapAdminTables() {
  const tables = document.querySelectorAll('.admin-table');
  tables.forEach(tbl => {
    const parent = tbl.parentElement;
    if (parent && !parent.classList.contains('admin-table-responsive') && !parent.classList.contains('table-responsive')) {
      const wrapper = document.createElement('div');
      wrapper.className = 'admin-table-responsive';
      parent.insertBefore(wrapper, tbl);
      wrapper.appendChild(tbl);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Collapsible Settings Navigation Dropdown Controller
// ─────────────────────────────────────────────────────────────────────────────

function toggleSettingsDropdown(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const dropdown = document.getElementById('navSettingsDropdown');
  if (dropdown) {
    dropdown.classList.toggle('collapsed');
    const isCollapsed = dropdown.classList.contains('collapsed');
    localStorage.setItem('admin_nav_settings_collapsed', isCollapsed ? '1' : '0');
  }
}

function initSettingsDropdown() {
  const dropdown = document.getElementById('navSettingsDropdown');
  if (!dropdown) return;

  // By default settings is collapsed; it only gets opened on user action
  let stored = null;
  try {
    stored = typeof localStorage !== 'undefined' ? localStorage.getItem('admin_nav_settings_collapsed') : null;
  } catch (e) {}
  if (stored === '0') {
    dropdown.classList.remove('collapsed');
  } else {
    dropdown.classList.add('collapsed');
  }
}

window.toggleAdminSidebar = toggleAdminSidebar;
window.openAdminSidebar = openAdminSidebar;
window.closeAdminSidebar = closeAdminSidebar;
window.wrapAdminTables = wrapAdminTables;
window.toggleSettingsDropdown = toggleSettingsDropdown;
window.switchSettingsSection = switchSettingsSection;
window.toggleCurrentPasswordVisibility = toggleCurrentPasswordVisibility;
window.copyCurrentPassword = copyCurrentPassword;
window.toggleInputPw = toggleInputPw;
window.submitAdminProfile = submitAdminProfile;
window.toggleCanvasBg = toggleCanvasBg;
window.handleLogoSelect = handleLogoSelect;
window.triggerLogoUpload = triggerLogoUpload;
window.removeLogoFile = removeLogoFile;
window.handleFaviconSelect = handleFaviconSelect;
window.triggerFaviconUpload = triggerFaviconUpload;
window.removeFaviconFile = removeFaviconFile;
// =============================================================================
// Bulk Phone Import Queue Controller
// =============================================================================
let bulkQueue = [];
let bulkQueueRunning = false;
let bulkQueuePaused = false;
let bulkQueueIndex = 0;
let bulkStats = { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 };

function openBulkImportModal() {
  const modal = document.getElementById('bulkImportModal');
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateBulkLinksCount();
  }
}

function closeBulkImportModal() {
  if (bulkQueueRunning && !bulkQueuePaused) {
    if (!confirm('The import queue is currently running. Are you sure you want to close and stop the queue?')) {
      return;
    }
    stopBulkQueue();
  }
  const modal = document.getElementById('bulkImportModal');
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function clearBulkQueueForm() {
  if (bulkQueueRunning) return;
  const textarea = document.getElementById('bulkImportUrlsInput');
  if (textarea) textarea.value = '';
  updateBulkLinksCount();
  const dash = document.getElementById('bulkQueueDashboard');
  if (dash) dash.style.display = 'none';
  const tbody = document.getElementById('bulkQueueTableBody');
  if (tbody) tbody.innerHTML = '';
  const bar = document.getElementById('bulkQueueProgressBar');
  if (bar) bar.style.width = '0%';
  const pct = document.getElementById('bulkQueuePercentText');
  if (pct) pct.textContent = '0%';
}

function parseBulkUrls(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];
  const regex = /https?:\/\/(?:www\.)?(?:whatmobile\.com\.pk|gsmarena\.com)[^\s"',;)<>]+/gi;
  const matches = rawText.match(regex) || [];
  const valid = [];
  const seen = new Set();

  for (let raw of matches) {
    let clean = raw.trim().replace(/^[("'\s<\[{]+|[)"'\s>,.\]}]+$/g, '');
    if (!clean) continue;
    try {
      const u = new URL(clean);
      const host = u.hostname.toLowerCase();
      if ((host.includes('whatmobile.com.pk') || host.includes('gsmarena.com')) && !seen.has(clean)) {
        seen.add(clean);
        valid.push(clean);
      }
    } catch (_) {}
  }
  return valid;
}

function updateBulkLinksCount() {
  const textarea = document.getElementById('bulkImportUrlsInput');
  const badge = document.getElementById('bulkUrlsCountBadge');
  if (!textarea || !badge) return;

  const urls = parseBulkUrls(textarea.value);
  badge.textContent = `${urls.length} link${urls.length === 1 ? '' : 's'} detected`;
  if (urls.length > 0) {
    badge.style.background = '#ecfdf5';
    badge.style.color = '#047857';
    badge.style.borderColor = '#a7f3d0';
  } else {
    badge.style.background = 'var(--admin-primary-light)';
    badge.style.color = 'var(--admin-primary)';
    badge.style.borderColor = 'var(--admin-primary-border)';
  }
}

async function startBulkQueue() {
  const textarea = document.getElementById('bulkImportUrlsInput');
  if (!textarea) return;

  const urls = parseBulkUrls(textarea.value);
  if (urls.length === 0) {
    alert('Please paste at least one valid phone URL from WhatMobile or GSMArena.');
    textarea.focus();
    return;
  }

  const defaultStatus = document.getElementById('bulkDefaultStatus')?.value || 'Available';
  const overwrite = document.getElementById('bulkOverwriteExisting')?.checked ?? true;
  const autoAddBrand = document.getElementById('bulkAutoAddBrand')?.checked ?? true;

  bulkQueue = urls.map((url, i) => ({
    id: i + 1,
    url,
    status: 'pending',
    result: null,
    error: null,
    defaultStatus,
    overwrite,
    autoAddBrand
  }));

  bulkStats = {
    total: bulkQueue.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0
  };

  bulkQueueRunning = true;
  bulkQueuePaused = false;
  bulkQueueIndex = 0;

  // Update UI to running state
  const dash = document.getElementById('bulkQueueDashboard');
  if (dash) dash.style.display = 'block';
  document.getElementById('btnStartBulkQueue').style.display = 'none';
  document.getElementById('btnPauseBulkQueue').style.display = 'inline-block';
  document.getElementById('btnResumeBulkQueue').style.display = 'none';
  document.getElementById('btnCancelBulkQueue').style.display = 'inline-block';
  document.getElementById('btnCloseBulkModal').disabled = true;
  document.getElementById('bulkImportUrlsInput').disabled = true;

  renderBulkQueueTable();
  updateBulkProgressUI();

  // Run the queue
  processNextQueueItem();
}

function renderBulkQueueTable() {
  const tbody = document.getElementById('bulkQueueTableBody');
  if (!tbody) return;

  tbody.innerHTML = bulkQueue.map((item, idx) => {
    let statusBadge = '<span style="color: #94a3b8; font-weight: 600;">⏳ Pending</span>';
    let detailsHtml = '<span style="color: #94a3b8;">Waiting in queue...</span>';
    let rowClass = 'bulk-queue-row';

    if (item.status === 'running') {
      statusBadge = '<span style="color: #0d9488; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><span style="display: inline-block;">🔄</span> Crawling...</span>';
      detailsHtml = '<span style="color: #0d9488; font-weight: 600;">Downloading specs &amp; optimizing gallery images...</span>';
      rowClass += ' running';
    } else if (item.status === 'created') {
      statusBadge = '<span style="background: #ecfdf5; color: #047857; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">✅ Added</span>';
      const p = item.result?.phone || {};
      detailsHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-weight: 700; color: #0f172a;">${escapeHtml(p.name || '')}</span>
          <div style="display: flex; gap: 6px;">
            <a href="/phone/${escapeAttr(p.slug)}" target="_blank" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 2px 8px; text-decoration: none;">View ↗</a>
          </div>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
          ${p.price > 0 ? (typeof formatPKR === 'function' ? formatPKR(p.price) : 'Rs. ' + Number(p.price).toLocaleString()) : 'Price N/A'} • ${p.imagesCount || 1} photo(s)
        </div>
      `;
      rowClass += ' success';
    } else if (item.status === 'updated') {
      statusBadge = '<span style="background: #eff6ff; color: #1d4ed8; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">🔁 Updated</span>';
      const p = item.result?.phone || {};
      detailsHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-weight: 700; color: #0f172a;">${escapeHtml(p.name || '')} (Updated)</span>
          <div style="display: flex; gap: 6px;">
            <a href="/phone/${escapeAttr(p.slug)}" target="_blank" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 2px 8px; text-decoration: none;">View ↗</a>
          </div>
        </div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
          ${p.price > 0 ? (typeof formatPKR === 'function' ? formatPKR(p.price) : 'Rs. ' + Number(p.price).toLocaleString()) : 'Price N/A'} • ${p.imagesCount || 1} photo(s)
        </div>
      `;
      rowClass += ' success';
    } else if (item.status === 'skipped') {
      statusBadge = '<span style="background: #fefce8; color: #854d0e; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">⚠️ Skipped</span>';
      detailsHtml = `<span style="color: #854d0e;">${escapeHtml(item.result?.message || 'Phone already exists')}</span>`;
      rowClass += ' skipped';
    } else if (item.status === 'failed') {
      statusBadge = '<span style="background: #fef2f2; color: #b91c1c; font-weight: 700; padding: 2px 8px; border-radius: 9999px;">❌ Failed</span>';
      detailsHtml = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="color: #b91c1c; font-size: 11.5px;">${escapeHtml(item.error || 'Failed to crawl phone.')}</span>
          <button type="button" class="btn btn-outline btn-sm" onclick="retryBulkQueueItem(${idx})" style="font-size: 11px; padding: 2px 8px;">Retry ↺</button>
        </div>
      `;
      rowClass += ' failed';
    }

    let domainTag = item.url.includes('whatmobile.com.pk')
      ? '<span style="background: #ecfdf5; color: #047857; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-right: 4px;">WhatMobile</span>'
      : '<span style="background: #eff6ff; color: #1d4ed8; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; margin-right: 4px;">GSMArena</span>';

    return `
      <tr class="${rowClass}" id="queueRow_${idx}">
        <td style="padding: 10px 14px; font-weight: 700; color: #64748b;">${idx + 1}</td>
        <td style="padding: 10px 14px;">
          <div>${domainTag}</div>
          <a href="${escapeAttr(item.url)}" target="_blank" style="color: #0369a1; text-decoration: none; word-break: break-all; font-family: monospace; font-size: 11.5px;">${escapeHtml(item.url)}</a>
        </td>
        <td style="padding: 10px 14px;">${statusBadge}</td>
        <td style="padding: 10px 14px;">${detailsHtml}</td>
      </tr>
    `;
  }).join('');
}

function updateBulkProgressUI() {
  const completed = bulkStats.created + bulkStats.updated + bulkStats.skipped + bulkStats.failed;
  const pct = bulkStats.total > 0 ? Math.round((completed / bulkStats.total) * 100) : 0;

  const bar = document.getElementById('bulkQueueProgressBar');
  if (bar) bar.style.width = `${pct}%`;
  const pctText = document.getElementById('bulkQueuePercentText');
  if (pctText) pctText.textContent = `${pct}% (${completed}/${bulkStats.total})`;

  const sTotal = document.getElementById('statBulkTotal');
  if (sTotal) sTotal.textContent = `Total: ${bulkStats.total}`;
  const sCreated = document.getElementById('statBulkCreated');
  if (sCreated) sCreated.textContent = `Added: ${bulkStats.created}`;
  const sUpdated = document.getElementById('statBulkUpdated');
  if (sUpdated) sUpdated.textContent = `Updated: ${bulkStats.updated}`;
  const sSkipped = document.getElementById('statBulkSkipped');
  if (sSkipped) sSkipped.textContent = `Skipped: ${bulkStats.skipped}`;
  const sFailed = document.getElementById('statBulkFailed');
  if (sFailed) sFailed.textContent = `Failed: ${bulkStats.failed}`;

  if (!bulkQueueRunning) {
    const statusText = document.getElementById('bulkQueueStatusText');
    if (statusText) statusText.innerHTML = `🎉 <strong>Queue Completed!</strong> (${completed}/${bulkStats.total} processed)`;
    const banner = document.getElementById('bulkCurrentTaskBanner');
    if (banner) banner.style.display = 'none';

    const pBtn = document.getElementById('btnPauseBulkQueue');
    if (pBtn) pBtn.style.display = 'none';
    const rBtn = document.getElementById('btnResumeBulkQueue');
    if (rBtn) rBtn.style.display = 'none';
    const cBtn = document.getElementById('btnCancelBulkQueue');
    if (cBtn) cBtn.style.display = 'none';

    const sBtn = document.getElementById('btnStartBulkQueue');
    if (sBtn) {
      sBtn.style.display = 'inline-block';
      sBtn.textContent = '▶ Import More Links';
    }
    const closeBtn = document.getElementById('btnCloseBulkModal');
    if (closeBtn) closeBtn.disabled = false;
    const txtArea = document.getElementById('bulkImportUrlsInput');
    if (txtArea) txtArea.disabled = false;

    // Refresh phone list table if function is present
    if (typeof loadAdminPhones === 'function') {
      loadAdminPhones();
    }
  }
}

async function processNextQueueItem() {
  if (!bulkQueueRunning || bulkQueuePaused) return;

  if (bulkQueueIndex >= bulkQueue.length) {
    bulkQueueRunning = false;
    updateBulkProgressUI();
    return;
  }

  const item = bulkQueue[bulkQueueIndex];
  item.status = 'running';
  renderBulkQueueTable();

  const banner = document.getElementById('bulkCurrentTaskBanner');
  if (banner) {
    banner.style.display = 'block';
    banner.innerHTML = `⏳ <strong>Processing Item ${bulkQueueIndex + 1} of ${bulkQueue.length}:</strong> Crawling specifications &amp; gallery photos from <code>${escapeHtml(item.url)}</code>...`;
  }

  // Scroll current row into view
  const row = document.getElementById(`queueRow_${bulkQueueIndex}`);
  if (row) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const cleanItemUrl = String(item.url || '').trim().replace(/^[("'\s<\[{]+|[)"'\s>,.\]}]+$/g, '');

  try {
    const res = await fetch('/api/phones/bulk-import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: cleanItemUrl,
        overwrite: item.overwrite,
        defaultStatus: item.defaultStatus,
        autoAddBrand: item.autoAddBrand
      })
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      item.status = 'failed';
      item.error = json.message || 'Server returned an error.';
      bulkStats.failed++;
    } else {
      item.result = json;
      if (json.action === 'created') {
        item.status = 'created';
        bulkStats.created++;
      } else if (json.action === 'updated') {
        item.status = 'updated';
        bulkStats.updated++;
      } else {
        item.status = 'skipped';
        bulkStats.skipped++;
      }
    }
  } catch (err) {
    console.error('Queue item error:', err);
    item.status = 'failed';
    item.error = err.message || 'Network error.';
    bulkStats.failed++;
  }

  bulkQueueIndex++;
  updateBulkProgressUI();
  renderBulkQueueTable();

  if (bulkQueueRunning && !bulkQueuePaused) {
    setTimeout(processNextQueueItem, 300);
  }
}

function pauseBulkQueue() {
  if (!bulkQueueRunning || bulkQueuePaused) return;
  bulkQueuePaused = true;
  document.getElementById('bulkQueueStatusText').innerHTML = '⏸ <strong>Queue Paused</strong>';
  document.getElementById('btnPauseBulkQueue').style.display = 'none';
  document.getElementById('btnResumeBulkQueue').style.display = 'inline-block';
  document.getElementById('bulkCurrentTaskBanner').innerHTML = '⏸ Queue is paused. Click <strong>Resume</strong> to continue processing.';
}

function resumeBulkQueue() {
  if (!bulkQueueRunning || !bulkQueuePaused) return;
  bulkQueuePaused = false;
  document.getElementById('bulkQueueStatusText').innerHTML = 'Queue in Progress...';
  document.getElementById('btnPauseBulkQueue').style.display = 'inline-block';
  document.getElementById('btnResumeBulkQueue').style.display = 'none';
  processNextQueueItem();
}

function stopBulkQueue() {
  if (!bulkQueueRunning) return;
  if (!confirm('Are you sure you want to stop the import queue? Remaining items will be cancelled.')) return;
  bulkQueueRunning = false;
  bulkQueuePaused = false;
  document.getElementById('bulkQueueStatusText').innerHTML = '⏹ <strong>Queue Stopped by User</strong>';
  updateBulkProgressUI();
}

async function retryBulkQueueItem(index) {
  if (index < 0 || index >= bulkQueue.length) return;
  const item = bulkQueue[index];
  item.status = 'running';
  item.error = null;
  renderBulkQueueTable();

  const cleanItemUrl = String(item.url || '').trim().replace(/^[("'\s<\[{]+|[)"'\s>,.\]}]+$/g, '');

  try {
    const res = await fetch('/api/phones/bulk-import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: cleanItemUrl,
        overwrite: item.overwrite,
        defaultStatus: item.defaultStatus,
        autoAddBrand: item.autoAddBrand
      })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      item.status = 'failed';
      item.error = json.message || 'Retry failed.';
    } else {
      item.result = json;
      item.status = json.action === 'created' ? 'created' : (json.action === 'updated' ? 'updated' : 'skipped');
      bulkStats.failed = Math.max(0, bulkStats.failed - 1);
      if (item.status === 'created') bulkStats.created++;
      else if (item.status === 'updated') bulkStats.updated++;
      else bulkStats.skipped++;
      updateBulkProgressUI();
    }
  } catch (err) {
    item.status = 'failed';
    item.error = err.message || 'Network error.';
  }
  renderBulkQueueTable();
}

function initBulkImportModalListener() {
  const textarea = document.getElementById('bulkImportUrlsInput');
  if (textarea) {
    textarea.addEventListener('input', updateBulkLinksCount);
    textarea.addEventListener('paste', () => setTimeout(updateBulkLinksCount, 50));
  }

  // Bind to any open buttons
  const openBtns = document.querySelectorAll('#btnOpenBulkImportModal, .btn-open-bulk-import');
  openBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      openBulkImportModal();
    });
  });

  // Check if URL has ?action=bulk-import
  const params = new URLSearchParams(window.location.search);
  if (params.get('action') === 'bulk-import') {
    openBulkImportModal();
  }
}

// Window global bindings
window.openBulkImportModal = openBulkImportModal;
window.closeBulkImportModal = closeBulkImportModal;
window.clearBulkQueueForm = clearBulkQueueForm;
window.startBulkQueue = startBulkQueue;
window.pauseBulkQueue = pauseBulkQueue;
window.resumeBulkQueue = resumeBulkQueue;
window.stopBulkQueue = stopBulkQueue;
window.retryBulkQueueItem = retryBulkQueueItem;
window.openAddUserModal = openAddUserModal;
window.editUser = editUser;
window.deleteUser = deleteUser;
window.closeUserModal = closeUserModal;
window.saveUserModal = saveUserModal;
window.toggleUserPwVisibility = toggleUserPwVisibility;
window.loadTeamUsers = loadTeamUsers;
window.initRoleAccessUI = initRoleAccessUI;

// ── PWA Active Installations Sidebar Badge Synchronizer ───────────────────────
async function initPwaSidebarBadge() {
  const badges = document.querySelectorAll('.pwa-installs-badge, #sidebarPwaInstallBadge');
  if (badges.length === 0) return;
  try {
    const res = await fetch('/api/pwa/stats');
    const json = await res.json();
    if (json.success && json.data) {
      const activeCount = json.data.active_installations || 0;
      badges.forEach(b => {
        b.textContent = activeCount;
      });
    }
  } catch (err) {
    // Non-blocking
  }
}
window.initPwaSidebarBadge = initPwaSidebarBadge;

document.addEventListener('DOMContentLoaded', () => {
  initMobileNavigation();
  initSettingsDropdown();
  initRoleAccessUI();
  initLoginForm();
  initDashboard();
  initPhonesList();
  initPhoneForm();
  initBrandsList();
  initSettings();
  initAdminBranding();
  initBulkImportModalListener();
  initPwaSidebarBadge();
});




