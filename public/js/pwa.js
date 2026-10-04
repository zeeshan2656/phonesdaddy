/**
 * PhonesDaddy - PWA Integration Controller
 * Handles Service Worker registration, in-app install banner, update toasts, and offline indicators.
 */

(function () {
  'use strict';

  // Strictly disable PWA controller on all Admin panel pages
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
    return;
  }

  var deferredPrompt = null;
  var DISMISS_DAYS = 7;
  var STORAGE_KEY = 'phonesdaddy_pwa_dismissed';

  // Check if app is running in standalone PWA mode
  var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                     window.navigator.standalone === true;

  if (isStandalone) {
    document.documentElement.classList.add('pwa-standalone');
    if (document.body) document.body.classList.add('pwa-standalone');
  }

  // PWA Device Identifier & Installation / Launch Tracker
  function getPwaDeviceId() {
    try {
      var id = localStorage.getItem('phonesdaddy_pwa_device_id');
      if (!id) {
        id = 'pwa-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('phonesdaddy_pwa_device_id', id);
      }
      return id;
    } catch (_) {
      return 'pwa-anon-' + Math.random().toString(36).substring(2, 9);
    }
  }

  function detectClientPlatform() {
    var ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'Android';
    if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Unknown';
  }

  function detectClientBrowser() {
    var ua = navigator.userAgent || '';
    if (/samsung/i.test(ua)) return 'Samsung Internet';
    if (/edg/i.test(ua)) return 'Microsoft Edge';
    if (/opr|opera/i.test(ua)) return 'Opera';
    if (/chrome|crios/i.test(ua)) return 'Google Chrome';
    if (/firefox|fxios/i.test(ua)) return 'Firefox';
    if (/safari/i.test(ua)) return 'Safari';
    return 'Browser';
  }

  function trackPwaEvent(action) {
    try {
      var deviceId = getPwaDeviceId();
      var platform = detectClientPlatform();
      var browser = detectClientBrowser();
      var mode = isStandalone ? 'standalone' : (window.location.search.includes('source=pwa') ? 'standalone' : 'browser');

      fetch('/api/pwa/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          action: action,
          device_uuid: deviceId,
          platform: platform,
          browser: browser,
          display_mode: mode
        })
      }).catch(function() {});
    } catch (_) {}
  }

  // Record active PWA launch once per session if running in standalone mode or ?source=pwa
  try {
    if (isStandalone || window.location.search.includes('source=pwa')) {
      if (!sessionStorage.getItem('pwa_session_tracked')) {
        sessionStorage.setItem('pwa_session_tracked', '1');
        trackPwaEvent('launch');
      }
    }
  } catch (_) {}

  // Inject PWA Banner & Toast CSS
  function injectPwaStyles() {
    if (document.getElementById('pwa-styles')) return;
    var style = document.createElement('style');
    style.id = 'pwa-styles';
    style.textContent = `
      /* PWA Floating Install Bar / Toast */
      .pwa-install-banner {
        position: fixed;
        bottom: 24px;
        left: 20px;
        right: 20px;
        max-width: 440px;
        margin: 0 auto;
        background: #0f172a;
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 14px;
        box-shadow: 0 16px 36px -8px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(20, 184, 166, 0.25);
        z-index: 99999;
        transform: translateY(120px);
        opacity: 0;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
        backdrop-filter: blur(12px);
      }
      .pwa-install-banner.visible {
        transform: translateY(0);
        opacity: 1;
      }
      .pwa-banner-icon {
        width: 46px;
        height: 46px;
        border-radius: 12px;
        background: linear-gradient(135deg, #0d9488, #14b8a6);
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.4);
      }
      .pwa-banner-icon img {
        width: 32px;
        height: 32px;
        object-fit: contain;
      }
      .pwa-banner-content {
        flex: 1;
        min-width: 0;
      }
      .pwa-banner-title {
        font-size: 14.5px;
        font-weight: 700;
        color: #ffffff;
        letter-spacing: -0.2px;
        margin-bottom: 2px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .pwa-badge {
        font-size: 10px;
        background: rgba(20, 184, 166, 0.2);
        color: #2dd4bf;
        padding: 2px 6px;
        border-radius: 999px;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .pwa-banner-subtitle {
        font-size: 12.5px;
        color: #94a3b8;
        line-height: 1.35;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pwa-banner-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .pwa-btn-install {
        background: linear-gradient(135deg, #0d9488, #14b8a6);
        color: #ffffff;
        border: none;
        padding: 8px 14px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(13, 148, 136, 0.35);
      }
      .pwa-btn-install:hover {
        background: linear-gradient(135deg, #0f766e, #0d9488);
        transform: translateY(-1px);
      }
      .pwa-btn-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        width: 30px;
        height: 30px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .pwa-btn-close:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }

      /* PWA Floating Connection & Update Toasts */
      .pwa-toast {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-80px);
        background: #0f172a;
        color: #ffffff;
        padding: 10px 18px;
        border-radius: 9999px;
        font-size: 13.5px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 10px 30px -4px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.12);
        z-index: 100000;
        opacity: 0;
        pointer-events: none;
        transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;
      }
      .pwa-toast.visible {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
        pointer-events: auto;
      }
      .pwa-toast.offline {
        border-color: rgba(245, 158, 11, 0.5);
        background: #1e1b18;
      }
      .pwa-toast.online {
        border-color: rgba(16, 185, 129, 0.5);
        background: #06241b;
      }
      .pwa-toast.update-toast {
        border-color: rgba(20, 184, 166, 0.5);
        padding: 10px 14px 10px 18px;
      }
      .pwa-toast-btn {
        background: #14b8a6;
        color: #0f172a;
        font-size: 12px;
        font-weight: 700;
        border: none;
        padding: 5px 10px;
        border-radius: 999px;
        cursor: pointer;
        margin-left: 6px;
      }
      .pwa-toast-btn:hover {
        background: #2dd4bf;
      }

      /* Adjust when mobile bottom bar is present */
      @media (max-width: 640px) {
        .pwa-install-banner {
          bottom: 16px;
          left: 12px;
          right: 12px;
          padding: 12px 14px;
        }
        .pwa-banner-title {
          font-size: 13.5px;
        }
        .pwa-banner-subtitle {
          font-size: 11.5px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Toast Notification Helper
  function showToast(message, type, duration, actionBtn) {
    injectPwaStyles();
    var existing = document.getElementById('pwa-global-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'pwa-global-toast';
    toast.className = 'pwa-toast ' + (type || '');

    var iconHtml = '';
    if (type === 'offline') {
      iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';
    } else if (type === 'online') {
      iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    } else if (type === 'update-toast') {
      iconHtml = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>';
    }

    toast.innerHTML = iconHtml + '<span>' + message + '</span>';

    if (actionBtn) {
      var btn = document.createElement('button');
      btn.className = 'pwa-toast-btn';
      btn.textContent = actionBtn.text;
      btn.addEventListener('click', actionBtn.onClick);
      toast.appendChild(btn);
    }

    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });

    if (duration) {
      setTimeout(function () {
        toast.classList.remove('visible');
        setTimeout(function () { toast.remove(); }, 350);
      }, duration);
    }
  }

  // Prompt Dismissal Storage
  function isPromptDismissed() {
    var dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (!dismissedAt) return false;
    var days = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }

  function markPromptDismissed() {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  }

  // Create In-App Install Banner
  function showInstallBanner() {
    if (isStandalone || isPromptDismissed()) return;
    if (document.getElementById('pwa-install-banner')) return;

    injectPwaStyles();

    var banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install PhonesDaddy Application');

    banner.innerHTML = `
      <div class="pwa-banner-icon">
        <img src="/icon-192x192.png" alt="PhonesDaddy Logo" width="32" height="32" loading="eager">
      </div>
      <div class="pwa-banner-content">
        <div class="pwa-banner-title">
          PhonesDaddy <span class="pwa-badge">APP</span>
        </div>
        <div class="pwa-banner-subtitle">Fast mobile specs & offline tools</div>
      </div>
      <div class="pwa-banner-actions">
        <button class="pwa-btn-install" id="pwaBtnInstall">Install</button>
        <button class="pwa-btn-close" id="pwaBtnDismiss" aria-label="Dismiss">✕</button>
      </div>
    `;

    document.body.appendChild(banner);

    // Fade in banner smoothly after slight delay
    setTimeout(function () {
      banner.classList.add('visible');
    }, 1200);

    var installBtn = banner.querySelector('#pwaBtnInstall');
    var closeBtn = banner.querySelector('#pwaBtnDismiss');

    if (installBtn) {
      installBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function (choiceResult) {
          if (choiceResult.outcome === 'accepted') {
            console.log('[PWA] User accepted install prompt');
          }
          deferredPrompt = null;
          banner.classList.remove('visible');
          setTimeout(function () { banner.remove(); }, 400);
        });
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        markPromptDismissed();
        banner.classList.remove('visible');
        setTimeout(function () { banner.remove(); }, 400);
      });
    }
  }

  // 1. Service Worker Registration & Lifecycle
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function (registration) {
          console.log('[PWA] Service Worker registered with scope:', registration.scope);

          // Handle new Service Worker waiting
          if (registration.waiting) {
            promptWorkerUpdate(registration.waiting);
          }

          registration.addEventListener('updatefound', function () {
            var newWorker = registration.installing;
            if (!newWorker) return;
            newWorker.addEventListener('statechange', function () {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                promptWorkerUpdate(newWorker);
              }
            });
          });
        })
        .catch(function (error) {
          console.warn('[PWA] Service Worker registration failed:', error);
        });

      // Reload on controller change ONLY when user explicitly clicks Update
      var refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (window.__pwaUpdateTriggered && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }

  function promptWorkerUpdate(worker) {
    showToast('New update available!', 'update-toast', 0, {
      text: 'Update',
      onClick: function () {
        window.__pwaUpdateTriggered = true;
        worker.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  }

  // 2. Intercept BeforeInstallPrompt Event
  window.addEventListener('beforeinstallprompt', function (e) {
    // Prevent standard Chrome mini-infobar
    e.preventDefault();
    deferredPrompt = e;
    showInstallBanner();
  });

  // 3. App Installed Event
  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    var banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
    showToast('PhonesDaddy installed successfully!', 'online', 3500);
    trackPwaEvent('install');
  });

  // 4. Online & Offline Connectivity Listeners
  window.addEventListener('offline', function () {
    showToast('You are currently offline. Showing cached pages.', 'offline', 4000);
  });

  window.addEventListener('online', function () {
    showToast('Back online! Reconnected.', 'online', 3000);
  });

  // Dynamic Install App Links in Navigation and Footer
  function injectInstallButtons() {
    if (isStandalone) return;

    // A. Footer link under System
    var footerSystem = document.querySelector('.site-footer .footer-col:last-child .footer-links');
    if (footerSystem && !document.getElementById('pwa-footer-install-link')) {
      var li = document.createElement('li');
      li.id = 'pwa-footer-install-link';
      li.innerHTML = '<a href="javascript:void(0)" style="color: #2dd4bf; display: inline-flex; align-items: center; gap: 5px;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Install App</a>';
      li.addEventListener('click', function (e) {
        e.preventDefault();
        window.PhonesDaddyPWA.install();
      });
      footerSystem.appendChild(li);
    }

    // B. Mobile Nav link
    var navLinks = document.getElementById('navLinks');
    if (navLinks && !document.getElementById('pwa-nav-install-link')) {
      var navLi = document.createElement('li');
      navLi.id = 'pwa-nav-install-link';
      navLi.className = 'mobile-only-link';
      navLi.innerHTML = '<a href="javascript:void(0)" class="nav-link" style="white-space: nowrap;"><svg class="svg-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/></svg> Install App</a>';
      navLi.addEventListener('click', function (e) {
        e.preventDefault();
        window.PhonesDaddyPWA.install();
      });
      navLinks.appendChild(navLi);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectInstallButtons);
  } else {
    injectInstallButtons();
  }

  // Global trigger for manual install buttons (e.g. in footer or settings)
  window.PhonesDaddyPWA = {
    install: function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
      } else {
        alert('To install PhonesDaddy on your device, tap the browser menu (⋮ or Share icon) and select "Install app" or "Add to Home Screen".');
      }
    },
    isStandalone: isStandalone
  };

})();
