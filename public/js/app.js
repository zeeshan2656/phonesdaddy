// PhonesDaddy - Global Application Script

// Debounce helper
function debounce(func, delay = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
}

// Format price in PKR currency
function formatPKR(num) {
  if (!num) return 'Price on Request';
  return 'Rs. ' + parseFloat(num).toLocaleString('en-PK');
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

// Global Search Autocomplete Setup
function initSearch(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  const performSearch = debounce(async (query) => {
    if (!query || query.trim().length < 2) {
      dropdown.innerHTML = '';
      dropdown.classList.remove('show');
      return;
    }

    try {
      const res = await fetch(`/api/phones/search?q=${encodeURIComponent(query.trim())}`);
      const json = await res.json();

      if (json.success && json.data.length > 0) {
        dropdown.innerHTML = json.data.map(p => `
          <a href="/phone/${p.slug}" class="search-item">
            <img src="${p.image || '/images/placeholder.svg'}" alt="${p.name}" class="search-thumb" width="36" height="48" loading="lazy" decoding="async">
            <div class="search-item-info">
              <div class="search-item-name">${p.name}</div>
              <div class="search-item-meta">${p.brand_name} • ${p.status}</div>
            </div>
            <div class="search-item-price">${p.price > 0 ? formatPKR(p.price) : 'Rumored'}</div>
          </a>
        `).join('');
        dropdown.classList.add('show');
      } else {
        dropdown.innerHTML = `<div style="padding: 16px; text-align: center; color: #64748b; font-size: 13px;">No phones matching "<strong>${query}</strong>"</div>`;
        dropdown.classList.add('show');
      }
    } catch (err) {
      console.error('Search error:', err);
    }
  }, 250);

  input.addEventListener('input', (e) => {
    performSearch(e.target.value);
  });

  input.addEventListener('focus', (e) => {
    if (e.target.value.trim().length >= 2) {
      performSearch(e.target.value);
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

// Comparison Basket Helpers (localStorage)
const CompareBasket = {
  KEY: 'phonesdaddy_compare_basket',
  get() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },
  add(slug) {
    let list = this.get();
    if (!list.includes(slug)) {
      if (list.length >= 4) {
        alert('You can compare up to 4 phones simultaneously.');
        return false;
      }
      list.push(slug);
      localStorage.setItem(this.KEY, JSON.stringify(list));
    }
    return true;
  },
  remove(slug) {
    let list = this.get().filter(s => s !== slug);
    localStorage.setItem(this.KEY, JSON.stringify(list));
  },
  clear() {
    localStorage.removeItem(this.KEY);
  }
};

// Mobile navigation toggle & header search setup
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('mobileToggle');
  const navLinks = document.getElementById('navLinks');
  const searchWrapper = document.getElementById('headerSearchWrapper') || document.querySelector('.header-search');
  const searchInput = document.getElementById('headerSearchInput');

  // Ensure mobile search toggle button exists
  let searchToggleBtn = document.getElementById('mobileSearchToggle');
  if (!searchToggleBtn && toggleBtn && searchWrapper) {
    searchToggleBtn = document.createElement('button');
    searchToggleBtn.className = 'mobile-search-toggle';
    searchToggleBtn.id = 'mobileSearchToggle';
    searchToggleBtn.setAttribute('aria-label', 'Toggle Search');
    searchToggleBtn.innerHTML = ICONS.search;
    toggleBtn.parentNode.insertBefore(searchToggleBtn, toggleBtn);
  }

  // Mobile search toggle handler (Appears below header)
  if (searchToggleBtn && searchWrapper) {
    searchToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = searchWrapper.classList.toggle('mobile-open');
      searchToggleBtn.classList.toggle('active', isOpen);
      searchToggleBtn.innerHTML = isOpen ? ICONS.close : ICONS.search;

      // Close mobile navigation drawer if open
      if (isOpen && navLinks && navLinks.classList.contains('show')) {
        navLinks.classList.remove('show');
        if (toggleBtn) {
          toggleBtn.innerHTML = ICONS.menu;
          toggleBtn.setAttribute('aria-expanded', 'false');
        }
      }

      // Auto-focus input when opened
      if (isOpen && searchInput) {
        setTimeout(() => {
          searchInput.focus();
        }, 80);
      }
    });

    // Close mobile search on outside click
    document.addEventListener('click', (e) => {
      if (searchWrapper.classList.contains('mobile-open') &&
          !searchWrapper.contains(e.target) &&
          !searchToggleBtn.contains(e.target)) {
        searchWrapper.classList.remove('mobile-open');
        searchToggleBtn.classList.remove('active');
        searchToggleBtn.innerHTML = ICONS.search;
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchWrapper.classList.contains('mobile-open')) {
        searchWrapper.classList.remove('mobile-open');
        searchToggleBtn.classList.remove('active');
        searchToggleBtn.innerHTML = ICONS.search;
      }
    });
  }

  // Mobile navigation hamburger drawer
  if (toggleBtn && navLinks) {
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();

      // Close mobile search if open
      if (searchWrapper && searchWrapper.classList.contains('mobile-open')) {
        searchWrapper.classList.remove('mobile-open');
        if (searchToggleBtn) {
          searchToggleBtn.classList.remove('active');
          searchToggleBtn.innerHTML = ICONS.search;
        }
      }

      const isOpen = navLinks.classList.toggle('show');
      toggleBtn.innerHTML = isOpen ? ICONS.close : ICONS.menu;
      toggleBtn.setAttribute('aria-expanded', String(isOpen));
    });

    // Close menu when a nav link is clicked
    navLinks.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('show');
        toggleBtn.innerHTML = ICONS.menu;
        toggleBtn.setAttribute('aria-expanded', 'false');
      });
    });

    // Close menu on outside click
    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('show') &&
          !navLinks.contains(e.target) &&
          !toggleBtn.contains(e.target)) {
        navLinks.classList.remove('show');
        toggleBtn.innerHTML = ICONS.menu;
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Initialize header search autocomplete (serves both desktop and mobile dropdown)
  initSearch('headerSearchInput', 'headerSearchDropdown');

  // Load dynamic footer legal/company pages
  loadDynamicFooterPages();
});

async function loadDynamicFooterPages() {
  const footerContainer = document.getElementById('dynamicFooterPages');
  if (!footerContainer) return;

  try {
    const res = await fetch('/api/pages/footer');
    const json = await res.json();
    if (json.success && Array.isArray(json.data) && json.data.length > 0) {
      footerContainer.innerHTML = json.data.map(p => {
        const url = ['about-us', 'contact-us', 'privacy-policy', 'disclaimer'].includes(p.slug)
          ? `/${p.slug}`
          : `/page/${p.slug}`;
        return `<li><a href="${url}">${escapeHtml(p.title)}</a></li>`;
      }).join('');
    }
  } catch (err) {
    // Fail silently; static links remain if already there
    console.debug('Footer pages load error:', err);
  }
}

