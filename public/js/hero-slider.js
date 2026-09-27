// PhonesDaddy - Ultra-Modern Hero Flagship Slider (Dynamic Real Data & Fully Mobile Responsive)
(function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Theme glow accents for dynamic slides
  const GLOW_COLORS = [
    'rgba(13, 148, 136, 0.45)', // Cyan / Emerald (Honor)
    'rgba(99, 102, 241, 0.42)', // Indigo / Violet (Vivo)
    'rgba(245, 158, 11, 0.40)', // Warm Amber / Gold (Realme)
    'rgba(16, 185, 129, 0.40)', // Aurora Green (Infinix)
    'rgba(244, 63, 94, 0.40)'   // Crimson Rose (Infinix Pro)
  ];

  function buildSlideHTML(phone, index) {
    const brand = phone.brand_name || 'Brand';
    let model = phone.name || 'Smartphone';
    if (model.toLowerCase().startsWith(brand.toLowerCase())) {
      model = model.substring(brand.length).trim() || model;
    }

    const priceNum = parseFloat(phone.price);
    const priceFormatted = priceNum > 0
      ? 'Rs. ' + Math.round(priceNum).toLocaleString('en-PK')
      : 'Price On Arrival';

    const specs = phone.quick_specs || {};
    const displayVal = specs.display || 'Full HD+ Display';
    const cameraVal = specs.camera || 'High-Res Camera';
    const chipVal = specs.chipset
      ? specs.chipset + (specs.ram ? ' • ' + specs.ram.replace(/\s*RAM/i, '') : '')
      : (specs.ram || 'High Performance');
    const batteryVal = specs.battery || 'Long-lasting Battery';

    // Build concise, premium description
    let desc = phone.short_description ? phone.short_description.replace(/\r?\n+/g, ' ').trim() : '';
    if (!desc || desc.length < 25 || /price in pakistan/i.test(desc)) {
      const parts = [];
      if (specs.display) parts.push(`a ${specs.display} display`);
      if (specs.chipset) parts.push(`powered by the ${specs.chipset}`);
      if (specs.camera) parts.push(`${specs.camera}`);
      if (specs.battery) parts.push(`an ultra-capacity ${specs.battery}`);
      desc = `The all-new ${brand} ${model} features ${parts.length ? parts.join(', ') : 'flagship specifications and intelligent hardware design'} for seamless daily performance.`;
    } else if (desc.length > 150) {
      desc = desc.slice(0, 145) + '...';
    }

    const accentColor = GLOW_COLORS[index % GLOW_COLORS.length];
    const statusText = phone.status || 'Available';
    const chipOrBrand = specs.chipset ? specs.chipset : brand;

    return `
      <article class="hero-slide ${index === 0 ? 'active' : ''}" data-index="${index}" style="--slide-accent: ${accentColor};" aria-hidden="${index === 0 ? 'false' : 'true'}">
        <div class="hero-slide-grid">
          <div class="hero-slide-content">
            <div class="hero-spotlight-pill">
              <span class="pulsing-beacon"></span>
              <span>Latest Release • ${escapeHtml(brand)}</span>
            </div>
            <h1 class="hero-phone-heading">
              ${escapeHtml(brand)} <span class="gradient-text">${escapeHtml(model)}</span>
            </h1>
            <div class="hero-meta-strip">
              <span class="hero-price-badge">${escapeHtml(priceFormatted)}</span>
              <span class="hero-status-pill ${statusText.toLowerCase() === 'upcoming' ? 'upcoming' : ''}">
                ${escapeHtml(statusText)} • ${escapeHtml(chipOrBrand)}
              </span>
            </div>
            <p class="hero-desc-text">
              ${escapeHtml(desc)}
            </p>
            
            <!-- Specs HUD Grid -->
            <div class="hero-specs-hud">
              <div class="spec-hud-card">
                <div class="spec-hud-icon">
                  <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></svg>
                </div>
                <div class="spec-hud-info">
                  <div class="spec-hud-label">Display</div>
                  <div class="spec-hud-val" title="${escapeAttr(displayVal)}">${escapeHtml(displayVal)}</div>
                </div>
              </div>

              <div class="spec-hud-card">
                <div class="spec-hud-icon">
                  <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                </div>
                <div class="spec-hud-info">
                  <div class="spec-hud-label">Camera</div>
                  <div class="spec-hud-val" title="${escapeAttr(cameraVal)}">${escapeHtml(cameraVal)}</div>
                </div>
              </div>

              <div class="spec-hud-card">
                <div class="spec-hud-icon">
                  <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>
                </div>
                <div class="spec-hud-info">
                  <div class="spec-hud-label">Chipset &amp; RAM</div>
                  <div class="spec-hud-val" title="${escapeAttr(chipVal)}">${escapeHtml(chipVal)}</div>
                </div>
              </div>

              <div class="spec-hud-card">
                <div class="spec-hud-icon">
                  <svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><line x1="22" x2="22" y1="11" y2="13"/><line x1="6" x2="6" y1="11" y2="13"/><line x1="10" x2="10" y1="11" y2="13"/><line x1="14" x2="14" y1="11" y2="13"/></svg>
                </div>
                <div class="spec-hud-info">
                  <div class="spec-hud-label">Battery &amp; Power</div>
                  <div class="spec-hud-val" title="${escapeAttr(batteryVal)}">${escapeHtml(batteryVal)}</div>
                </div>
              </div>
            </div>

            <!-- CTA Buttons -->
            <div class="hero-slide-actions">
              <a href="/phone/${escapeAttr(phone.slug)}" class="btn-hero-primary">
                Explore Full Specs &rarr;
              </a>
              <button type="button" class="btn-hero-secondary btn-slide-compare" data-slug="${escapeAttr(phone.slug)}">
                + Compare
              </button>
            </div>
          </div>

          <!-- Right 3D Showcase Stage -->
          <div class="hero-phone-stage">
            <div class="phone-halo-glow"></div>
            <div class="hero-phone-card">
              <img src="${escapeAttr(phone.image || '/images/placeholder.svg')}" alt="${escapeAttr(brand + ' ' + model)}" class="hero-phone-img" width="460" height="460" decoding="async" loading="${index === 0 ? 'eager' : 'lazy'}">
            </div>
            <div class="floating-callout-badge badge-top-right">
              <span>🎯</span> ${escapeHtml(specs.camera ? specs.camera.split(',')[0].trim() : '50MP Camera')}
            </div>
            <div class="floating-callout-badge badge-bot-right">
              <span>⚡</span> ${escapeHtml(specs.battery ? specs.battery.split(',')[0].trim() : (specs.display || 'Fast Battery'))}
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function buildTabHTML(phone, index) {
    const brand = phone.brand_name || 'Brand';
    let model = phone.name || 'Smartphone';
    if (model.toLowerCase().startsWith(brand.toLowerCase())) {
      model = model.substring(brand.length).trim() || model;
    }
    const num = String(index + 1).padStart(2, '0');

    return `
      <button class="hero-slider-tab ${index === 0 ? 'active' : ''}" role="tab" aria-selected="${index === 0 ? 'true' : 'false'}" data-slide="${index}">
        <div class="hero-tab-index">${num} • ${escapeHtml(brand.toUpperCase())}</div>
        <div class="hero-tab-title" title="${escapeAttr(model)}">${escapeHtml(model)}</div>
        <div class="hero-tab-progress-wrap">
          <div class="hero-tab-progress"></div>
        </div>
      </button>
    `;
  }

  async function initHeroSlider() {
    const slider = document.getElementById('heroSliderSection');
    if (!slider) return;

    const wrapper = document.getElementById('heroSlidesWrapper');
    const tabsContainer = slider.querySelector('.hero-slider-tabs');
    const prevBtn = document.getElementById('heroPrevBtn');
    const nextBtn = document.getElementById('heroNextBtn');
    const ambientGlow = slider.querySelector('.hero-ambient-glow');

    // If slides are already present in DOM (SSR / Static), use them without extra network fetch
    let slides = Array.from(slider.querySelectorAll('.hero-slide'));
    let tabs = Array.from(slider.querySelectorAll('.hero-slider-tab'));

    if (slides.length === 0) {
      try {
        const res = await fetch('/api/phones/latest?limit=5');
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          const phones = json.data;
          if (wrapper) {
            wrapper.innerHTML = phones.map((p, i) => buildSlideHTML(p, i)).join('');
          }
          if (tabsContainer) {
            tabsContainer.innerHTML = phones.map((p, i) => buildTabHTML(p, i)).join('');
          }
          slides = Array.from(slider.querySelectorAll('.hero-slide'));
          tabs = Array.from(slider.querySelectorAll('.hero-slider-tab'));
        }
      } catch (err) {
        console.warn('Hero slider dynamic fetch fallback:', err);
      }
    }

    if (slides.length === 0) return;

    let currentIndex = 0;
    let timer = null;
    const SLIDE_DURATION = 6000; // 6 seconds per slide
    let isPaused = false;

    function goToSlide(index) {
      if (index < 0) index = slides.length - 1;
      if (index >= slides.length) index = 0;

      currentIndex = index;

      // Update slides active state
      slides.forEach((slide, i) => {
        if (i === currentIndex) {
          slide.classList.add('active');
          slide.setAttribute('aria-hidden', 'false');
        } else {
          slide.classList.remove('active');
          slide.setAttribute('aria-hidden', 'true');
        }
      });

      // Update tabs active state (CSS keyframe automatically animates progress bar)
      tabs.forEach((tab, i) => {
        if (i === currentIndex) {
          tab.classList.add('active');
          tab.setAttribute('aria-selected', 'true');
        } else {
          tab.classList.remove('active');
          tab.setAttribute('aria-selected', 'false');
        }
      });

      // Smooth auto-scroll active tab into view on mobile
      const activeTab = tabs[currentIndex];
      if (activeTab && typeof activeTab.scrollIntoView === 'function') {
        activeTab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }

      // Update ambient dynamic glow
      const currentGlow = GLOW_COLORS[currentIndex % GLOW_COLORS.length];
      if (ambientGlow && currentGlow) {
        ambientGlow.style.setProperty('--current-glow', currentGlow);
      }

      // Reset auto-play timer
      resetAutoPlay();
    }

    function nextSlide() {
      goToSlide(currentIndex + 1);
    }

    function prevSlide() {
      goToSlide(currentIndex - 1);
    }

    function resetAutoPlay() {
      if (timer) clearInterval(timer);
      if (!isPaused) {
        timer = setInterval(() => {
          if (!isPaused) {
            nextSlide();
          }
        }, SLIDE_DURATION);
      }
    }

    // Attach Tab Clicks
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => {
        goToSlide(i);
      });
    });

    // Attach Arrow Buttons
    if (prevBtn) {
      prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        prevSlide();
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        nextSlide();
      });
    }

    // Pause on Hover
    slider.addEventListener('mouseenter', () => {
      isPaused = true;
    });

    slider.addEventListener('mouseleave', () => {
      isPaused = false;
      resetAutoPlay();
    });

    // Touch Swipe Navigation for Mobile/Tablet
    let touchStartX = 0;
    let touchStartY = 0;

    slider.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    slider.addEventListener('touchend', (e) => {
      if (e.changedTouches && e.changedTouches.length > 0) {
        const diffX = e.changedTouches[0].clientX - touchStartX;
        const diffY = e.changedTouches[0].clientY - touchStartY;

        // If swipe is primarily horizontal and > 35px
        if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
          if (diffX < 0) {
            nextSlide();
          } else {
            prevSlide();
          }
        }
      }
    }, { passive: true });

    // Keyboard Arrow Navigation
    document.addEventListener('keydown', (e) => {
      if (document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
        return;
      }
      const rect = slider.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        if (e.key === 'ArrowRight') {
          nextSlide();
        } else if (e.key === 'ArrowLeft') {
          prevSlide();
        }
      }
    });

    // Quick Compare Handlers on Slide Buttons
    slider.querySelectorAll('.btn-slide-compare').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const slug = btn.getAttribute('data-slug');
        if (!slug) return;

        if (typeof CompareBasket !== 'undefined') {
          const added = CompareBasket.add(slug);
          if (added) {
            btn.innerHTML = `<svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Added!`;
            btn.style.borderColor = 'var(--primary)';
            btn.style.color = 'var(--primary)';

            const list = CompareBasket.get();
            if (list.length >= 2) {
              setTimeout(() => {
                window.location.href = `/compare?phones=${list.join(',')}`;
              }, 600);
            } else {
              setTimeout(() => {
                btn.innerHTML = `+ Compare`;
                btn.style.borderColor = '';
                btn.style.color = '';
              }, 2500);
            }
          }
        }
      });
    });

    // Initialize first slide
    goToSlide(0);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroSlider);
  } else {
    initHeroSlider();
  }
})();
