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
//  Floating WhatsApp Contact Button — directly above Scroll To Top Button
// ==========================================================================
(function initWhatsAppButton() {
  function injectStyles() {
    if (document.getElementById('waFloatBtnStyle')) return;
    const style = document.createElement('style');
    style.id = 'waFloatBtnStyle';
    style.textContent = `
#whatsappFloatBtn {
  transition: bottom 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
  position: fixed;
  bottom: 28px;
  right: 24px;
  z-index: 9998;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
  color: #fff;
  box-shadow: 0 4px 18px rgba(37, 211, 102, 0.42), 0 2px 8px rgba(0, 0, 0, 0.18);
  display: flex !important;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  cursor: pointer;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease;
  animation: waPulseSubtle 3s infinite ease-in-out;
}
#whatsappFloatBtn.has-scroll-btn { bottom: 86px; }
#whatsappFloatBtn:hover {
  transform: translateY(-3px) scale(1.08);
  background: linear-gradient(135deg, #2ae06e 0%, #0d796c 100%);
  box-shadow: 0 8px 28px rgba(37, 211, 102, 0.65), 0 4px 12px rgba(0, 0, 0, 0.22);
  color: #fff;
}
#whatsappFloatBtn svg, #whatsappFloatBtn .whatsapp-icon {
  width: 26px;
  height: 26px;
  fill: #fff;
  flex-shrink: 0;
}
#whatsappFloatBtn .whatsapp-tooltip {
  position: absolute;
  right: 58px;
  background: #0f172a;
  color: #ffffff;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 12px;
  border-radius: 20px;
  white-space: nowrap;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
  opacity: 0;
  visibility: hidden;
  transform: translateX(8px);
  transition: opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease;
  pointer-events: none;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
#whatsappFloatBtn:hover .whatsapp-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateX(0);
}
@media (max-width: 768px) {
  #whatsappFloatBtn {
    bottom: 68px;
    right: 14px;
    width: 42px;
    height: 42px;
  }
  #whatsappFloatBtn svg, #whatsappFloatBtn .whatsapp-icon {
    width: 22px;
    height: 22px;
  }
}
@keyframes waPulseSubtle {
  0%, 100% {
    box-shadow: 0 4px 18px rgba(37, 211, 102, 0.42), 0 2px 8px rgba(0, 0, 0, 0.18);
  }
  50% {
    box-shadow: 0 6px 24px rgba(37, 211, 102, 0.62), 0 0 0 8px rgba(37, 211, 102, 0.14);
  }
}
    `;
    document.head.appendChild(style);
  }

  function setupWhatsApp(number, message) {
    if (!number) return;
    const cleanNumber = String(number).replace(/[^\d]/g, '');
    if (!cleanNumber) return;

    injectStyles();

    let btn = document.getElementById('whatsappFloatBtn');
    const msg = message || 'Hello! I have an inquiry from PhonesDaddy.';
    const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;

    if (btn) {
      btn.href = waUrl;
      return;
    }

    btn = document.createElement('a');
    btn.id = 'whatsappFloatBtn';
    btn.className = 'whatsapp-float-btn';
    btn.href = waUrl;
    btn.target = '_blank';
    btn.rel = 'noopener noreferrer';
    btn.setAttribute('aria-label', 'Chat on WhatsApp');
    btn.setAttribute('title', 'Chat with Admin on WhatsApp');
    btn.innerHTML = `
      <svg class="whatsapp-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="28" height="28" fill="#ffffff" aria-hidden="true">
        <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2m.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.39-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.32a8.188 8.188 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24m-3.53 3.03c-.19 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.06 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.21-.24-.58-.49-.5-.67-.51l-.57-.01z"/>
      </svg>
      <span class="whatsapp-tooltip">Chat with us</span>`;
    document.body.appendChild(btn);
  }

  function run() {
    // 1. Check meta tags injected via SSR
    const metaNum = document.querySelector('meta[name="whatsapp-number"]')?.getAttribute('content');
    const metaMsg = document.querySelector('meta[name="whatsapp-message"]')?.getAttribute('content');

    if (metaNum) {
      setupWhatsApp(metaNum, metaMsg);
      return;
    }

    // 2. Fallback to public branding API if not injected in static HTML
    if (!document.getElementById('whatsappFloatBtn')) {
      fetch(`/api/settings/public?_=${Date.now()}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.success && data.branding && data.branding.whatsapp_number && data.branding.whatsapp_enabled !== '0') {
            setupWhatsApp(data.branding.whatsapp_number, data.branding.whatsapp_message);
          }
        })
        .catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();