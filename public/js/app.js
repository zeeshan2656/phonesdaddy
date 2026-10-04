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

// Standalone SVG icons for core UI navigation (allows app.js to run without icons.js)
const UI_ICONS = {
  search: '<svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  menu: '<svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
  close: '<svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>'
};
function getUiIcon(name) {
  if (typeof ICONS !== 'undefined' && ICONS && ICONS[name]) return ICONS[name];
  return UI_ICONS[name] || '';
}

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
    searchToggleBtn.innerHTML = getUiIcon('search');
    toggleBtn.parentNode.insertBefore(searchToggleBtn, toggleBtn);
  }

  // Mobile search toggle handler (Appears below header)
  if (searchToggleBtn && searchWrapper) {
    searchToggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = searchWrapper.classList.toggle('mobile-open');
      searchToggleBtn.classList.toggle('active', isOpen);
      searchToggleBtn.innerHTML = isOpen ? getUiIcon('close') : getUiIcon('search');

      // Close mobile navigation drawer if open
      if (isOpen && navLinks && navLinks.classList.contains('show')) {
        navLinks.classList.remove('show');
        if (toggleBtn) {
          toggleBtn.innerHTML = getUiIcon('menu');
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
        searchToggleBtn.innerHTML = getUiIcon('search');
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && searchWrapper.classList.contains('mobile-open')) {
        searchWrapper.classList.remove('mobile-open');
        searchToggleBtn.classList.remove('active');
        searchToggleBtn.innerHTML = getUiIcon('search');
      }
    });
  }

  // ── Mobile Navigation Menu ──
  if (toggleBtn && navLinks) {
    // Create backdrop overlay (appended to site-header for correct stacking)
    let navBackdrop = document.querySelector('.nav-drawer-backdrop');
    if (!navBackdrop) {
      navBackdrop = document.createElement('div');
      navBackdrop.className = 'nav-drawer-backdrop';
      const siteHeader = document.querySelector('.site-header');
      if (siteHeader) siteHeader.appendChild(navBackdrop);
      else document.body.appendChild(navBackdrop);
    }

    // Inject drawer header with branding + close button (once)
    if (!navLinks.querySelector('.nav-drawer-header')) {
      const pageLogo = document.querySelector('.brand-logo');
      const logoHTML = pageLogo ? pageLogo.innerHTML : '<div class="brand-icon">P</div><span>PhonesDaddy</span>';

      const headerDiv = document.createElement('div');
      headerDiv.className = 'nav-drawer-header';
      headerDiv.innerHTML = `
        <a href="/" class="nav-drawer-brand">${logoHTML}</a>
        <button class="nav-drawer-close" aria-label="Close menu">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      `;
      navLinks.insertBefore(headerDiv, navLinks.firstChild);

      const sectionLabel = document.createElement('div');
      sectionLabel.className = 'nav-drawer-section-label';
      sectionLabel.textContent = 'Menu';
      headerDiv.insertAdjacentElement('afterend', sectionLabel);

      // Add icons to nav links
      const NAV_ICONS = {
        'Home': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
        'Mobiles': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg>',
        'Brands': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"/><path d="M7 7h.01"/></svg>',
        'Compare': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" x2="18" y1="20" y2="10"/><line x1="12" x2="12" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="14"/></svg>',
        'News': '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/></svg>',
      };
      navLinks.querySelectorAll('.nav-link').forEach(link => {
        if (link.querySelector('svg')) return;
        const text = link.textContent.trim().split(/\s+/)[0];
        const icon = NAV_ICONS[text];
        if (icon) link.insertAdjacentHTML('afterbegin', icon);
      });
    }

    function openMenu() {
      navLinks.classList.add('show');
      navBackdrop.classList.add('show');
      toggleBtn.innerHTML = getUiIcon('close');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      navLinks.classList.remove('show');
      navBackdrop.classList.remove('show');
      toggleBtn.innerHTML = getUiIcon('menu');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (searchWrapper && searchWrapper.classList.contains('mobile-open')) {
        searchWrapper.classList.remove('mobile-open');
        if (searchToggleBtn) { searchToggleBtn.classList.remove('active'); searchToggleBtn.innerHTML = getUiIcon('search'); }
      }
      navLinks.classList.contains('show') ? closeMenu() : openMenu();
    });

    navLinks.addEventListener('click', (e) => {
      if (e.target.closest('.nav-drawer-close') || e.target.closest('.nav-link')) closeMenu();
    });

    navBackdrop.addEventListener('click', closeMenu);

    document.addEventListener('click', (e) => {
      if (navLinks.classList.contains('show') &&
          !navLinks.contains(e.target) &&
          !toggleBtn.contains(e.target)) closeMenu();
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

// ==========================================================================
//  Scroll To Top Button — global, injected on every page
// ==========================================================================
(function initScrollToTop() {
  // Create the button element
  const btn = document.createElement('button');
  btn.id = 'scrollToTopBtn';
  btn.setAttribute('aria-label', 'Scroll to top');
  btn.setAttribute('title', 'Back to top');
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M18 15l-6-6-6 6"/>
    </svg>`;
  document.body.appendChild(btn);

  // Show button after scrolling 300px down
  const THRESHOLD = 300;
  let ticking = false;

    function updateScrollState() {
    const isScrolled = window.scrollY > THRESHOLD;
    if (isScrolled) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
    const waBtn = document.getElementById('whatsappFloatBtn');
    if (waBtn) {
      if (isScrolled) {
        waBtn.classList.add('has-scroll-btn');
      } else {
        waBtn.classList.remove('has-scroll-btn');
      }
    }
  }

  function onScroll() {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateScrollState();
        ticking = false;
      });
      ticking = true;
    }
  }
  updateScrollState();

  window.addEventListener('scroll', onScroll, { passive: true });

  // Smooth scroll to top + ripple effect on click
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Trigger ripple
    btn.classList.add('ripple');
    setTimeout(() => btn.classList.remove('ripple'), 450);
  });
})();

// ==========================================================================
//  Floating Social Channels Dock (TikTok, Facebook, WhatsApp)
// ==========================================================================
(function initSocialDock() {
  function syncSocialDock() {
    const dock = document.getElementById('floatingSocialDock');
    const wa = document.getElementById('whatsappFloatBtn');
    const topBtn = document.getElementById('scrollToTopBtn');
    const isScrolled = window.scrollY > 300 || (topBtn && topBtn.classList.contains('visible'));
    if (dock) {
      if (isScrolled) dock.classList.add('has-scroll-btn');
      else dock.classList.remove('has-scroll-btn');
    } else if (wa) {
      if (isScrolled) wa.classList.add('has-scroll-btn');
      else wa.classList.remove('has-scroll-btn');
    }
  }

  window.addEventListener('scroll', syncSocialDock, { passive: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncSocialDock);
  } else {
    syncSocialDock();
  }
})();

// ==========================================================================
//  PhonesDaddy PWA Loader (Guarantees PWA service worker on every page)
// ==========================================================================
(function initPwaLoader() {
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) return;
  if ('serviceWorker' in navigator && !window.PhonesDaddyPWA && !document.querySelector('script[src*="pwa.js"]')) {
    var s = document.createElement('script');
    s.src = '/js/pwa.js?v=1.0.1';
    s.defer = true;
    document.head.appendChild(s);
  }
})();

// ==========================================================================
//  Announcement Popup — Professional themed popup for site visitors
// ==========================================================================
(function initAnnouncementPopup() {
  if (window.location.pathname.startsWith('/admin')) return;

  const STORAGE_KEY = 'pd_ann_dismissed';

  function injectStyles() {
    if (document.getElementById('ann-popup-styles')) return;
    const style = document.createElement('style');
    style.id = 'ann-popup-styles';
    style.textContent = `
      #annPopupOverlay {
        position: fixed; inset: 0; z-index: 99999;
        background: rgba(15,23,42,0.45);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        animation: annOverlayIn 0.25s ease forwards;
      }
      @keyframes annOverlayIn { from{opacity:0} to{opacity:1} }
      @keyframes annCardIn {
        from { opacity:0; transform: translateY(24px) scale(0.96); }
        to   { opacity:1; transform: translateY(0) scale(1); }
      }
      @keyframes annCardOut {
        from { opacity:1; transform: translateY(0) scale(1); }
        to   { opacity:0; transform: translateY(18px) scale(0.97); }
      }
      #annPopupCard {
        background: #ffffff;
        border-radius: 14px;
        max-width: 460px;
        width: 100%;
        box-shadow: 0 24px 64px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
        animation: annCardIn 0.32s cubic-bezier(0.16,1,0.3,1) forwards;
        overflow: hidden;
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      #annPopupCard.closing {
        animation: annCardOut 0.22s ease forwards;
      }
      /* Accent top bar — uses the admin-set bg color */
      .ann-card-accent {
        height: 4px;
        width: 100%;
      }
      .ann-card-body {
        padding: 24px 24px 20px;
        display: flex;
        align-items: flex-start;
        gap: 16px;
      }
      .ann-card-icon-wrap {
        width: 44px; height: 44px;
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .ann-card-icon-wrap svg {
        width: 22px; height: 22px;
      }
      .ann-card-content { flex: 1; min-width: 0; }
      .ann-card-label {
        font-size: 10px; font-weight: 800; letter-spacing: 1px;
        text-transform: uppercase; margin-bottom: 4px;
      }
      .ann-card-title {
        font-size: 16px; font-weight: 800; color: #0f172a;
        line-height: 1.35; margin-bottom: 8px;
      }
      .ann-card-msg {
        font-size: 13.5px; color: #475569; line-height: 1.65;
        white-space: pre-wrap;
      }
      .ann-close-btn {
        position: absolute; top: 14px; right: 14px;
        width: 28px; height: 28px; border-radius: 50%;
        background: #f1f5f9; border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: #64748b; transition: background 0.15s, color 0.15s;
        flex-shrink: 0;
      }
      .ann-close-btn:hover { background: #e2e8f0; color: #0f172a; }
      .ann-close-btn svg { width: 14px; height: 14px; }
      .ann-card-footer {
        padding: 14px 24px 20px;
        display: flex; align-items: center; gap: 12px;
        border-top: 1px solid #f1f5f9;
      }
      .ann-cta-btn {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 9px 20px; border-radius: 8px;
        font-size: 13px; font-weight: 700;
        text-decoration: none; border: none; cursor: pointer;
        transition: opacity 0.15s, transform 0.12s;
        color: #ffffff;
      }
      .ann-cta-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      .ann-cta-btn svg { width: 13px; height: 13px; }
      .ann-dismiss-btn {
        font-size: 12px; color: #94a3b8; cursor: pointer;
        background: none; border: none; text-decoration: none;
        transition: color 0.15s; padding: 0;
      }
      .ann-dismiss-btn:hover { color: #64748b; }
      @media (max-width: 480px) {
        #annPopupCard { border-radius: 12px; }
        .ann-card-body { padding: 20px 18px 16px; gap: 12px; }
        .ann-card-footer { padding: 12px 18px 18px; }
        .ann-card-title { font-size: 15px; }
      }
    `;
    document.head.appendChild(style);
  }

  // Megaphone SVG icon (colorless, stroked)
  const ICON_MEGAPHONE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z"/></svg>`;
  const ICON_ARROW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
  const ICON_CLOSE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

  function closePopup(annId, showOnce) {
    const overlay = document.getElementById('annPopupOverlay');
    const card = document.getElementById('annPopupCard');
    if (!overlay) return;
    if (showOnce) sessionStorage.setItem(STORAGE_KEY, String(annId));
    card.classList.add('closing');
    setTimeout(() => overlay.remove(), 250);
  }

  function renderPopup(ann) {
    if (ann.show_once) {
      if (sessionStorage.getItem(STORAGE_KEY) === String(ann.id)) return;
    }

    injectStyles();

    const accentColor = ann.bg_color || '#0d9488';
    // Make icon bg a very light tint of the accent
    const iconBg = accentColor + '18'; // ~10% opacity

    const overlay = document.createElement('div');
    overlay.id = 'annPopupOverlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', ann.title || 'Announcement');

    const hasCta = ann.cta_text && ann.cta_text.trim();

    overlay.innerHTML = `
      <div id="annPopupCard">
        <!-- Accent bar -->
        <div class="ann-card-accent" style="background:${accentColor};"></div>

        <!-- Close button -->
        <button class="ann-close-btn" id="annCloseBtn" aria-label="Close">${ICON_CLOSE}</button>

        <!-- Body -->
        <div class="ann-card-body">
          <div class="ann-card-icon-wrap" style="background:${iconBg}; color:${accentColor};">
            ${ICON_MEGAPHONE}
          </div>
          <div class="ann-card-content">
            <div class="ann-card-label" style="color:${accentColor};">Announcement</div>
            <div class="ann-card-title">${ann.title || ''}</div>
            <div class="ann-card-msg">${ann.message || ''}</div>
          </div>
        </div>

        ${hasCta ? `
        <div class="ann-card-footer">
          <a href="${ann.cta_url || '#'}" class="ann-cta-btn" style="background:${accentColor};"
            ${ann.cta_url ? 'target="_blank" rel="noopener"' : ''}>
            ${ICON_ARROW}
            ${ann.cta_text}
          </a>
          <button class="ann-dismiss-btn" id="annDismissBtn">Dismiss</button>
        </div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);

    // Handlers
    const dismiss = () => closePopup(ann.id, ann.show_once);
    document.getElementById('annCloseBtn').addEventListener('click', dismiss);
    const dismissBtn = document.getElementById('annDismissBtn');
    if (dismissBtn) dismissBtn.addEventListener('click', dismiss);
    overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
    document.addEventListener('keydown', function escH(e) {
      if (e.key === 'Escape') { dismiss(); document.removeEventListener('keydown', escH); }
    });
  }

  function fetchAndShow() {
    fetch('/api/announcements/active')
      .then(r => r.json())
      .then(json => { if (json.success && json.announcement) renderPopup(json.announcement); })
      .catch(() => {});
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fetchAndShow);
  } else {
    setTimeout(fetchAndShow, 700);
  }
})();