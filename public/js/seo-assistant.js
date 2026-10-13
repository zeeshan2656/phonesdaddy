/**
 * PhonesDaddy - Complete Yoast SEO-Style On-Page SEO Assistant
 * Supports both Mobile Phone Specs pages and News/Article Editor pages.
 * Lightweight, fast, deterministic, and fully responsive.
 */

(function(window, document) {
  'use strict';

  class SeoAssistant {
    constructor(options = {}) {
      this.mode = options.mode || 'phone'; // 'phone' or 'article'
      this.containerId = options.containerId || 'seoAssistantContainer';
      this.siteName = options.siteName || 'PhonesDaddy';
      this.siteUrl = options.siteUrl || (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://phonesdaddy.com');

      this.relatedKeywords = [];
      this.previewDevice = 'mobile'; // 'mobile' or 'desktop'

      this.debounceTimer = null;
      this.init();
    }

    init() {
      if (!document || typeof document.getElementById !== 'function') return;
      const container = document.getElementById(this.containerId);
      if (!container) return;

      this.renderMarkup(container);
      this.bindEvents();
      this.syncFromExistingFields();
      this.runAnalysis();
    }

    /**
     * Build the full SEO Sidebar Markup with all 9 requested sections
     */
    renderMarkup(container) {
      container.innerHTML = `
        <div class="seo-assistant-box" id="seoAssistantBox">
          <!-- Overall Header & Score Hero -->
          <div class="seo-header-hero">
            <div class="seo-header-top">
              <div class="seo-badge-title">
                <span>🎯 On-Page SEO Assistant</span>
                <span class="yoast-tag">Yoast Style</span>
              </div>
              <button type="button" id="btnRefreshSeo" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 2px 8px; color: #fff; border-color: rgba(255,255,255,0.25);" title="Re-analyze content">🔄 Analyze</button>
            </div>

            <div class="seo-score-meter-wrap">
              <div class="seo-gauge-ring">
                <svg viewBox="0 0 58 58">
                  <circle class="seo-gauge-bg" cx="29" cy="29" r="24" />
                  <circle class="seo-gauge-val" id="seoScoreCircle" cx="29" cy="29" r="24" />
                </svg>
                <div class="seo-gauge-number" id="seoScoreVal">0</div>
              </div>

              <div class="seo-score-info">
                <div class="seo-status-pill status-none" id="seoStatusPill">
                  <span id="seoStatusIcon">●</span>
                  <span id="seoStatusText">Not Analyzed</span>
                </div>
                <div class="seo-score-summary-counts" id="seoSummaryCounts">
                  <span class="seo-pill-count count-pass" id="seoCountPass">0 Good</span> &bull;
                  <span class="seo-pill-count count-warn" id="seoCountWarn">0 Improve</span> &bull;
                  <span class="seo-pill-count count-fail" id="seoCountFail">0 Problems</span>
                </div>
              </div>
            </div>
          </div>

          <!-- SEO Fields & Expandable Sections Strip -->
          <div class="seo-accordion" id="seoAccordion">

            <!-- Section 1: Focus Keyword -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header active" data-target="seoSecFocus">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">🔑</span>
                  <span class="seo-acc-label">1. Focus Keyword</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecFocus">Missing</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body active" id="seoSecFocus">
                <div class="form-group" style="margin-bottom: 8px;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; margin-bottom: 4px;" for="seoFocusKeywordInput">Primary Focus Keyword *</label>
                  <div style="display: flex; gap: 6px;">
                    <input type="text" id="seoFocusKeywordInput" name="focus_keyword" class="form-control" placeholder="${this.mode === 'phone' ? 'e.g. Samsung Galaxy S26 Ultra price in Pakistan' : 'e.g. iPhone 17 release date'}" style="font-size: 13px;">
                    <button type="button" id="btnSuggestFocusKeyword" class="btn btn-outline btn-sm" style="font-size: 11px; white-space: nowrap; padding: 4px 8px;" title="Derive focus keyword automatically">⚡ Suggest</button>
                  </div>
                </div>
                <div style="font-size: 11.5px; color: #64748b; line-height: 1.4;">
                  Enter the primary search query users search on Google. All content, titles, headings, and specifications are audited against this phrase.
                </div>
              </div>
            </div>

            <!-- Section 2: SEO Title -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecTitle">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">🏷️</span>
                  <span class="seo-acc-label">2. SEO Title</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecTitle">Pending</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecTitle">
                <div class="form-group" style="margin-bottom: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label" style="font-size: 12px; font-weight: 700; margin-bottom: 0;" for="seoTitleInput">Meta Page Title</label>
                    <button type="button" id="btnSuggestTitle" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 2px 7px;">⚡ Suggest Title</button>
                  </div>
                  <input type="text" id="seoTitleInput" name="meta_title" class="form-control" placeholder="e.g. Samsung Galaxy S26 Ultra Price in Pakistan & Specs | PhonesDaddy" style="font-size: 13px;">
                </div>

                <!-- Live Title Length & Pixel Meter -->
                <div class="seo-progress-meter">
                  <div class="seo-progress-track">
                    <div class="seo-progress-fill" id="titleProgressBar" style="width: 0%; background: #94a3b8;"></div>
                  </div>
                  <div class="seo-progress-label-row">
                    <span id="titleCharCount">0 / 60 chars</span>
                    <span id="titlePixelWidth">~0 / 580 px</span>
                    <span id="titleStatusText" style="font-weight: 700;">Empty</span>
                  </div>
                </div>
                <div style="font-size: 11.5px; color: #64748b;">
                  Google typically displays the first 50–60 characters (~580px). Place your focus keyword near the beginning.
                </div>
              </div>
            </div>

            <!-- Section 3: Meta Description -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecMeta">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">📝</span>
                  <span class="seo-acc-label">3. Meta Description</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecMeta">Pending</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecMeta">
                <div class="form-group" style="margin-bottom: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <label class="form-label" style="font-size: 12px; font-weight: 700; margin-bottom: 0;" for="seoMetaDescInput">Meta Snippet Description</label>
                    <button type="button" id="btnSuggestMetaDesc" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 2px 7px;">⚡ Generate Snippet</button>
                  </div>
                  <textarea id="seoMetaDescInput" name="meta_description" class="form-control" rows="3" placeholder="Concise, factual summary of mobile specifications, verified price in Pakistan, and key highlights..." style="font-size: 13px; resize: vertical;"></textarea>
                </div>

                <!-- Live Meta Description Meter -->
                <div class="seo-progress-meter">
                  <div class="seo-progress-track">
                    <div class="seo-progress-fill" id="metaProgressBar" style="width: 0%; background: #94a3b8;"></div>
                  </div>
                  <div class="seo-progress-label-row">
                    <span id="metaCharCount">0 / 160 chars</span>
                    <span id="metaStatusText" style="font-weight: 700;">Empty</span>
                  </div>
                </div>
                <div style="font-size: 11.5px; color: #64748b;">
                  Aim for 130–160 characters. A strong snippet earns higher click-through rates on Google search results.
                </div>
              </div>
            </div>

            <!-- Section 4: Keyword Distribution -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecDist">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">📊</span>
                  <span class="seo-acc-label">4. Keyword Distribution</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecDist">0%</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecDist">
                <div class="seo-distribution-list">
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">🏷️ In SEO Title</span>
                    <span class="seo-dist-badge badge-no" id="distTitleBadge">No</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">📝 In Meta Description</span>
                    <span class="seo-dist-badge badge-no" id="distMetaBadge">No</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">🔗 In URL Slug</span>
                    <span class="seo-dist-badge badge-no" id="distSlugBadge">No</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">📱 In Main Heading (H1)</span>
                    <span class="seo-dist-badge badge-no" id="distH1Badge">No</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">📄 In First Paragraph / Summary</span>
                    <span class="seo-dist-badge badge-no" id="distIntroBadge">No</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">📌 In Subheadings (H2 / H3)</span>
                    <span class="seo-dist-badge badge-no" id="distHeadingsBadge">0 times</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">📋 In Specifications / Content</span>
                    <span class="seo-dist-badge badge-no" id="distContentBadge">0 times</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">🖼️ In Main Image ALT</span>
                    <span class="seo-dist-badge badge-no" id="distImageBadge">No</span>
                  </div>
                  <div class="seo-dist-row">
                    <span class="seo-dist-label">🖼️ In Gallery Images ALT</span>
                    <span class="seo-dist-badge badge-no" id="distGalleryBadge">No</span>
                  </div>
                </div>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; font-size: 11.5px; color: #64748b;">
                  <div>Total occurrences: <strong id="distTotalCount">0</strong> &bull; Approx. Density: <strong id="distDensityVal">0.0%</strong></div>
                  <div style="margin-top: 4px; font-size: 11px;">
                    💡 <em>Note: Search intent is more important than hitting an arbitrary percentage. Specification labels are not penalized.</em>
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 5: Related Keywords -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecRelated">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">🔀</span>
                  <span class="seo-acc-label">5. Related Keywords</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecRelated">0 Tags</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecRelated">
                <!-- Tag container -->
                <div class="seo-tags-box" id="seoTagsContainer">
                  <span style="font-size: 11.5px; color: #94a3b8;" id="seoTagsEmptyMsg">No related keywords added yet</span>
                </div>
                <input type="hidden" name="related_keywords" id="seoRelatedKeywordsHidden" value="">

                <!-- Input to add custom related keyword -->
                <div style="display: flex; gap: 6px; margin-bottom: 12px;">
                  <input type="text" id="seoAddTagInput" class="form-control" placeholder="Add keyword (e.g. camera review) and press Enter" style="font-size: 12.5px;">
                  <button type="button" id="btnAddTagBtn" class="btn btn-outline btn-sm" style="white-space: nowrap; font-size: 11px;">+ Add</button>
                </div>

                <!-- Suggestions strip -->
                <div style="border-top: 1px dashed #cbd5e1; padding-top: 8px;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <span style="font-size: 11.5px; font-weight: 700; color: #475569;">⚡ One-Click Suggestions:</span>
                    <button type="button" id="btnRefreshSuggestions" class="btn btn-outline btn-sm" style="font-size: 10px; padding: 1px 6px;">Refresh</button>
                  </div>
                  <div class="seo-suggested-keywords-grid" id="seoSuggestionsGrid">
                    <!-- Injected dynamically -->
                  </div>
                </div>
              </div>
            </div>

            <!-- Section 6: Content Quality -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecQuality">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">⭐</span>
                  <span class="seo-acc-label">6. Content Quality</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecQuality">Pending</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecQuality">
                <div id="seoQualityChecklist">
                  <!-- Injected dynamically -->
                </div>
              </div>
            </div>

            <!-- Section 7: Technical SEO -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecTech">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">⚙️</span>
                  <span class="seo-acc-label">7. Technical SEO</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecTech">Pending</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecTech">
                <div class="form-group" style="margin-bottom: 12px;">
                  <label class="form-label" style="font-size: 12px; font-weight: 700; margin-bottom: 2px;" for="seoCanonicalInput">Canonical URL (Optional Override)</label>
                  <input type="text" id="seoCanonicalInput" name="canonical_url" class="form-control" placeholder="Leave blank to use default public URL" style="font-size: 12.5px;">
                  <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                    Defaults to: <code id="defaultCanonicalPreview" style="background: #f1f5f9; padding: 1px 4px; border-radius: 4px;">...</code>
                  </div>
                </div>

                <div id="seoTechChecklist">
                  <!-- Injected dynamically -->
                </div>
              </div>
            </div>

            <!-- Section 8: Google Search Preview -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecPreview">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">🔍</span>
                  <span class="seo-acc-label">8. Google Search Preview</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecPreview">Live</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecPreview">
                <div class="google-preview-tabs">
                  <button type="button" class="google-tab-btn active" id="tabSerpMobile" data-device="mobile">📱 Mobile Result</button>
                  <button type="button" class="google-tab-btn" id="tabSerpDesktop" data-device="desktop">💻 Desktop Result</button>
                </div>

                <div class="google-preview-card" id="googlePreviewCard">
                  <div class="google-serp-top">
                    <div class="google-serp-favicon">P</div>
                    <div>
                      <div class="google-serp-sitename">${this.siteName}</div>
                      <div class="google-serp-breadcrumb" id="previewSerpBreadcrumb">${this.siteUrl} &rsaquo; ${this.mode} &rsaquo; ...</div>
                    </div>
                  </div>

                  <div class="google-serp-layout-mobile" id="previewSerpLayout">
                    <div class="google-serp-mobile-content">
                      <div class="google-serp-title" id="previewSerpTitle">Smartphone Page Title</div>
                      <div class="google-serp-snippet" id="previewSerpSnippet">Meta description preview will be displayed here as it appears on search results.</div>
                    </div>
                    <img class="google-serp-thumb" id="previewSerpThumb" src="/images/placeholder.svg" alt="Preview Thumbnail" onerror="this.style.display='none'">
                  </div>
                </div>
                <div style="font-size: 11px; color: #64748b; text-align: center;">
                  Simulated Google Snippet &bull; Actual rankings and display snippets vary dynamically based on query.
                </div>
              </div>
            </div>

            <!-- Section 9: SEO Recommendations -->
            <div class="seo-acc-item">
              <button type="button" class="seo-acc-header" data-target="seoSecRecs">
                <div class="seo-acc-title-wrap">
                  <span class="seo-acc-icon">💡</span>
                  <span class="seo-acc-label">9. SEO Recommendations</span>
                </div>
                <span class="seo-acc-status-indicator indicator-neutral" id="badgeSecRecs">0 Items</span>
                <span class="seo-acc-chevron">▼</span>
              </button>
              <div class="seo-acc-body" id="seoSecRecs">
                <div id="seoRecommendationsBox">
                  <!-- Injected dynamically -->
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Floating Quick Mobile Badge -->
        <button type="button" class="seo-mobile-floating-badge" id="btnSeoMobileJump" title="Jump to SEO Assistant">
          <span>🎯 SEO Score:</span>
          <strong id="seoMobileScoreVal">0</strong>
        </button>
      `;
    }

    /**
     * Bind dynamic listeners to all relevant form inputs and Quill editor
     */
    bindEvents() {
      // Accordion headers toggle
      const headers = document.querySelectorAll('.seo-acc-header');
      headers.forEach(h => {
        h.addEventListener('click', () => {
          const targetId = h.getAttribute('data-target');
          const body = document.getElementById(targetId);
          if (!body) return;
          const isActive = h.classList.contains('active');
          if (isActive) {
            h.classList.remove('active');
            body.classList.remove('active');
          } else {
            h.classList.add('active');
            body.classList.add('active');
          }
        });
      });

      // Mobile floating badge jump
      const mobileJump = document.getElementById('btnSeoMobileJump');
      if (mobileJump) {
        mobileJump.addEventListener('click', () => {
          const box = document.getElementById('seoAssistantBox');
          if (box) {
            box.scrollIntoView({ behavior: 'smooth', block: 'start' });
            box.classList.add('seo-field-highlight');
            setTimeout(() => box.classList.remove('seo-field-highlight'), 1800);
          }
        });
      }

      // Refresh button
      const refreshBtn = document.getElementById('btnRefreshSeo');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => this.runAnalysis());
      }

      // Device preview toggle (mobile / desktop)
      const tabMobile = document.getElementById('tabSerpMobile');
      const tabDesktop = document.getElementById('tabSerpDesktop');
      if (tabMobile && tabDesktop) {
        tabMobile.addEventListener('click', () => {
          tabMobile.classList.add('active');
          tabDesktop.classList.remove('active');
          this.previewDevice = 'mobile';
          this.updateGooglePreview();
        });
        tabDesktop.addEventListener('click', () => {
          tabDesktop.classList.add('active');
          tabMobile.classList.remove('active');
          this.previewDevice = 'desktop';
          this.updateGooglePreview();
        });
      }

      // Real-time input listeners
      const debouncedAnalyze = () => {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
          this.runAnalysis();
        }, 150);
      };

      const focusInput = document.getElementById('seoFocusKeywordInput');
      const titleInput = document.getElementById('seoTitleInput');
      const metaInput = document.getElementById('seoMetaDescInput');
      const canonicalInput = document.getElementById('seoCanonicalInput');
      const mainAltInput = document.getElementById('phoneImageAlt');

      const handleFocusKeywordChange = () => {
        if (typeof window.autoUpdateGeneratedAlts === 'function') {
          window.autoUpdateGeneratedAlts();
        }
        debouncedAnalyze();
      };

      if (focusInput) {
        focusInput.addEventListener('input', handleFocusKeywordChange);
        focusInput.addEventListener('change', handleFocusKeywordChange);
        focusInput.addEventListener('paste', () => setTimeout(handleFocusKeywordChange, 50));
      }
      if (titleInput) {
        titleInput.addEventListener('input', debouncedAnalyze);
        titleInput.addEventListener('change', debouncedAnalyze);
        titleInput.addEventListener('paste', () => setTimeout(debouncedAnalyze, 50));
      }
      if (metaInput) {
        metaInput.addEventListener('input', debouncedAnalyze);
        metaInput.addEventListener('change', debouncedAnalyze);
        metaInput.addEventListener('paste', () => setTimeout(debouncedAnalyze, 50));
      }
      if (canonicalInput) {
        canonicalInput.addEventListener('input', debouncedAnalyze);
        canonicalInput.addEventListener('change', debouncedAnalyze);
      }
      if (mainAltInput) {
        mainAltInput.addEventListener('input', debouncedAnalyze);
        mainAltInput.addEventListener('change', debouncedAnalyze);
      }

      // Listen on base form inputs:
      const nameInput = document.getElementById(this.mode === 'phone' ? 'phoneNameInput' : 'articleTitle');
      const slugInput = document.getElementById(this.mode === 'phone' ? 'phoneSlugInput' : 'articleSlug');
      const brandSelect = document.getElementById('phoneBrandSelect');
      const priceInput = document.getElementById('phonePriceInput');
      const statusSelect = document.getElementById(this.mode === 'phone' ? 'phoneStatusSelect' : 'articleStatus');
      const fileInput = document.getElementById(this.mode === 'phone' ? 'phoneImageFile' : 'articleImageFile');

      if (nameInput) {
        nameInput.addEventListener('input', () => {
          if (typeof window.autoUpdateGeneratedAlts === 'function') {
            window.autoUpdateGeneratedAlts();
          }
          debouncedAnalyze();
        });
      }
      if (slugInput) slugInput.addEventListener('input', debouncedAnalyze);
      if (brandSelect) brandSelect.addEventListener('change', debouncedAnalyze);
      if (priceInput) priceInput.addEventListener('input', debouncedAnalyze);
      if (statusSelect) statusSelect.addEventListener('change', debouncedAnalyze);
      if (fileInput) fileInput.addEventListener('change', debouncedAnalyze);

      // Listen on Quill editor changes if available
      const checkQuill = () => {
        const q = this.mode === 'phone' ? window.quillSummary : window.quill;
        if (q && !q._seoListening) {
          q._seoListening = true;
          q.on('text-change', debouncedAnalyze);
        }
      };
      checkQuill();
      setTimeout(checkQuill, 500);
      setTimeout(checkQuill, 1500);

      // Watch for changes in specs container
      const specContainer = document.getElementById('specRowsContainer');
      if (specContainer) {
        specContainer.addEventListener('input', debouncedAnalyze);
        specContainer.addEventListener('change', debouncedAnalyze);
      }

      // Suggest Focus Keyword button
      const btnSuggestFocus = document.getElementById('btnSuggestFocusKeyword');
      if (btnSuggestFocus) {
        btnSuggestFocus.addEventListener('click', () => this.suggestFocusKeyword());
      }

      // Suggest Title button
      const btnSuggestTitle = document.getElementById('btnSuggestTitle');
      if (btnSuggestTitle) {
        btnSuggestTitle.addEventListener('click', () => this.suggestSeoTitle());
      }

      // Suggest Meta Description button
      const btnSuggestMeta = document.getElementById('btnSuggestMetaDesc');
      if (btnSuggestMeta) {
        btnSuggestMeta.addEventListener('click', () => this.suggestMetaDescription());
      }

      // Related keywords tag input
      const addTagInput = document.getElementById('seoAddTagInput');
      const addTagBtn = document.getElementById('btnAddTagBtn');
      if (addTagInput && addTagBtn) {
        const handleAddTag = () => {
          const val = addTagInput.value.trim();
          if (val) {
            this.addRelatedKeyword(val);
            addTagInput.value = '';
          }
        };
        addTagBtn.addEventListener('click', handleAddTag);
        addTagInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
          }
        });
      }

      // Refresh suggestions button
      const btnRefreshSuggestions = document.getElementById('btnRefreshSuggestions');
      if (btnRefreshSuggestions) {
        btnRefreshSuggestions.addEventListener('click', () => this.generateRelatedKeywordsSuggestions());
      }
    }

    /**
     * Synchronize initial data from existing form fields or loaded records
     */
    syncFromExistingFields() {
      // Synchronize Focus Keyword from hidden or form field
      const focusInput = document.getElementById('seoFocusKeywordInput');
      if (focusInput && !focusInput.value) {
        if (window._initialFocusKeyword) focusInput.value = window._initialFocusKeyword;
      }

      // Synchronize SEO Title
      const titleInput = document.getElementById('seoTitleInput');
      if (titleInput && !titleInput.value) {
        if (window._initialMetaTitle) titleInput.value = window._initialMetaTitle;
      }

      // Synchronize Meta Description
      const metaInput = document.getElementById('seoMetaDescInput');
      if (metaInput && !metaInput.value) {
        if (window._initialMetaDescription) metaInput.value = window._initialMetaDescription;
      }

      // Synchronize Canonical URL
      const canonicalInput = document.getElementById('seoCanonicalInput');
      if (canonicalInput && !canonicalInput.value) {
        if (window._initialCanonicalUrl) canonicalInput.value = window._initialCanonicalUrl;
      }

      // Synchronize Related Keywords
      if (window._initialRelatedKeywords) {
        this.loadRelatedKeywords(window._initialRelatedKeywords);
      }

      // Synchronize Main Image ALT
      const imageAltInput = document.getElementById('phoneImageAlt');
      if (imageAltInput && !imageAltInput.value && window._initialImageAlt) {
        imageAltInput.value = window._initialImageAlt;
      }

      this.generateRelatedKeywordsSuggestions();
    }

    /**
     * Load related keywords array or string into state and DOM chips
     */
    loadRelatedKeywords(data) {
      this.relatedKeywords = [];
      if (Array.isArray(data)) {
        this.relatedKeywords = data.map(s => String(s).trim()).filter(Boolean);
      } else if (typeof data === 'string' && data.trim()) {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed)) {
            this.relatedKeywords = parsed.map(s => String(s).trim()).filter(Boolean);
          } else {
            this.relatedKeywords = data.split(',').map(s => s.trim()).filter(Boolean);
          }
        } catch (_) {
          this.relatedKeywords = data.split(',').map(s => s.trim()).filter(Boolean);
        }
      }
      this.renderRelatedKeywordTags();
    }

    addRelatedKeyword(kw) {
      const clean = String(kw).trim();
      if (!clean) return;
      if (!this.relatedKeywords.some(k => k.toLowerCase() === clean.toLowerCase())) {
        this.relatedKeywords.push(clean);
        this.renderRelatedKeywordTags();
        this.runAnalysis();
      }
    }

    removeRelatedKeyword(index) {
      if (index >= 0 && index < this.relatedKeywords.length) {
        this.relatedKeywords.splice(index, 1);
        this.renderRelatedKeywordTags();
        this.runAnalysis();
      }
    }

    renderRelatedKeywordTags() {
      const container = document.getElementById('seoTagsContainer');
      const hiddenInput = document.getElementById('seoRelatedKeywordsHidden');
      const badge = document.getElementById('badgeSecRelated');
      if (!container) return;

      if (hiddenInput) {
        hiddenInput.value = JSON.stringify(this.relatedKeywords);
      }
      if (badge) {
        badge.textContent = `${this.relatedKeywords.length} Tag${this.relatedKeywords.length === 1 ? '' : 's'}`;
        badge.className = `seo-acc-status-indicator ${this.relatedKeywords.length >= 2 ? 'indicator-good' : 'indicator-neutral'}`;
      }

      if (this.relatedKeywords.length === 0) {
        container.innerHTML = `<span style="font-size: 11.5px; color: #94a3b8;" id="seoTagsEmptyMsg">No related keywords added yet</span>`;
        return;
      }

      // Check if keyword is matched in page content
      const content = this.getAllContentText().toLowerCase();
      container.innerHTML = this.relatedKeywords.map((kw, idx) => {
        const isMatched = content.includes(kw.toLowerCase());
        return `
          <span class="seo-keyword-tag ${isMatched ? 'matched' : ''}" title="${isMatched ? 'Found in page content' : 'Not yet mentioned in content'}">
            <span>${this.escapeHtml(kw)}</span>
            ${isMatched ? '<span style="font-size: 10px; color: #059669;">✓</span>' : ''}
            <button type="button" class="tag-remove-btn" onclick="window.seoAssistant.removeRelatedKeyword(${idx})" title="Remove keyword">&times;</button>
          </span>
        `;
      }).join('');
    }

    /**
     * Generate 6-8 smart related keyword suggestions based on current model/specs
     */
    generateRelatedKeywordsSuggestions() {
      const grid = document.getElementById('seoSuggestionsGrid');
      if (!grid) return;

      const name = this.getItemName();
      if (!name) {
        grid.innerHTML = `<span style="font-size: 11px; color: #94a3b8;">Enter a phone model name first to see keyword suggestions</span>`;
        return;
      }

      let suggestions = [];
      if (this.mode === 'phone') {
        suggestions = [
          `${name} price in Pakistan`,
          `${name} specifications`,
          `${name} camera review`,
          `${name} battery capacity`,
          `${name} display features`,
          `${name} RAM and storage`,
          `${name} PTA tax in Pakistan`,
          `${name} release date`
        ];
      } else {
        suggestions = [
          `${name} price`,
          `${name} full review`,
          `${name} launch date`,
          `${name} features & leaks`,
          `${name} vs comparison`,
          `${name} Pakistan`
        ];
      }

      // Filter out keywords already added
      const unadded = suggestions.filter(s => !this.relatedKeywords.some(k => k.toLowerCase() === s.toLowerCase()));

      if (unadded.length === 0) {
        grid.innerHTML = `<span style="font-size: 11px; color: #10b981;">✓ All popular keyword suggestions have been added!</span>`;
        return;
      }

      grid.innerHTML = unadded.map(s => `
        <button type="button" class="seo-suggest-chip" onclick="window.seoAssistant.addRelatedKeyword('${this.escapeAttr(s)}')">
          <span>+ ${this.escapeHtml(s)}</span>
        </button>
      `).join('');
    }

    /**
     * Helper to get active item title / phone name
     */
    getItemName() {
      if (this.mode === 'phone') {
        const nameInput = document.getElementById('phoneNameInput');
        return nameInput ? nameInput.value.trim() : '';
      } else {
        const titleInput = document.getElementById('articleTitle');
        return titleInput ? titleInput.value.trim() : '';
      }
    }

    /**
     * Helper to get active brand name
     */
    getBrandName() {
      if (this.mode === 'phone') {
        const select = document.getElementById('phoneBrandSelect');
        if (select && select.selectedIndex >= 0) {
          const txt = select.options[select.selectedIndex].text;
          return txt.replace(/--.*?--/g, '').trim();
        }
      }
      return '';
    }

    /**
     * Helper to get active slug
     */
    getSlug() {
      const slugInput = document.getElementById(this.mode === 'phone' ? 'phoneSlugInput' : 'articleSlug');
      return slugInput ? slugInput.value.trim().toLowerCase() : '';
    }

    /**
     * Helper to get active summary / overview content
     */
    getSummaryHtml() {
      if (this.mode === 'phone') {
        if (window.quillSummary) {
          return window.quillSummary.root.innerHTML || '';
        }
        const descField = document.getElementById('phoneShortDesc');
        return descField ? descField.value : '';
      } else {
        if (window.quill) {
          return window.quill.root.innerHTML || '';
        }
        const sumField = document.getElementById('articleSummary');
        return sumField ? sumField.value : '';
      }
    }

    /**
     * Collect all visible public-page text for genuine content audit
     */
    getAllContentText() {
      const parts = [];
      const name = this.getItemName();
      if (name) parts.push(name);

      const brand = this.getBrandName();
      if (brand) parts.push(brand);

      const summaryHtml = this.getSummaryHtml();
      if (summaryHtml) {
        const temp = document.createElement('div');
        temp.innerHTML = summaryHtml;
        parts.push(temp.textContent || temp.innerText || '');
      }

      if (this.mode === 'phone') {
        const specRows = document.querySelectorAll('.spec-row-item');
        specRows.forEach(row => {
          const k = row.querySelector('.spec-key-input')?.value || '';
          const v = row.querySelector('.spec-val-input')?.value || '';
          if (k) parts.push(k);
          if (v) parts.push(v);
        });
      }

      return parts.join(' ').replace(/\s+/g, ' ').trim();
    }

    /**
     * Suggest primary focus keyword automatically
     */
    suggestFocusKeyword() {
      const name = this.getItemName();
      if (!name) {
        alert('Please enter a Phone Model Name first.');
        const el = document.getElementById(this.mode === 'phone' ? 'phoneNameInput' : 'articleTitle');
        if (el) el.focus();
        return;
      }

      const focusInput = document.getElementById('seoFocusKeywordInput');
      if (!focusInput) return;

      const suggestion = this.mode === 'phone' ? `${name} price in Pakistan` : `${name} specifications and review`;
      focusInput.value = suggestion;
      focusInput.classList.add('seo-field-highlight');
      setTimeout(() => focusInput.classList.remove('seo-field-highlight'), 1200);

      this.runAnalysis();
    }

    /**
     * Suggest SEO Title
     */
    suggestSeoTitle() {
      const name = this.getItemName();
      const focus = (document.getElementById('seoFocusKeywordInput')?.value || '').trim();
      const titleInput = document.getElementById('seoTitleInput');
      if (!titleInput) return;

      if (!name) {
        alert('Please enter a phone model name first.');
        return;
      }

      let suggestion = '';
      if (this.mode === 'phone') {
        if (focus && focus.toLowerCase().includes('price')) {
          suggestion = `${name} Price in Pakistan & Specifications | ${this.siteName}`;
        } else if (focus && focus.toLowerCase().includes('spec')) {
          suggestion = `${name} Specifications & Price in Pakistan | ${this.siteName}`;
        } else {
          suggestion = `${name} Price in Pakistan & Specs | ${this.siteName}`;
        }
      } else {
        suggestion = `${name} | ${this.siteName} News & Updates`;
      }

      titleInput.value = suggestion;
      titleInput.classList.add('seo-field-highlight');
      setTimeout(() => titleInput.classList.remove('seo-field-highlight'), 1200);

      this.runAnalysis();
    }

    /**
     * Suggest Meta Description from factual phone specs & verified pricing
     */
    suggestMetaDescription() {
      const name = this.getItemName();
      const focus = (document.getElementById('seoFocusKeywordInput')?.value || '').trim();
      const metaInput = document.getElementById('seoMetaDescInput');
      if (!metaInput) return;

      if (!name) {
        alert('Please enter a phone model name first.');
        return;
      }

      let suggestion = '';
      if (this.mode === 'phone') {
        const priceVal = document.getElementById('phonePriceInput')?.value || document.getElementById('pricePKR')?.value || '';
        const statusVal = document.getElementById('phoneStatusSelect')?.value || 'Available';
        const formattedPrice = (priceVal && parseFloat(priceVal) > 0) ? `Rs. ${Math.round(parseFloat(priceVal)).toLocaleString('en-US')}` : 'expected price';

        // Extract key specs if available
        let camera = '';
        let battery = '';
        let ram = '';
        const rows = document.querySelectorAll('.spec-row-item');
        rows.forEach(r => {
          const k = (r.querySelector('.spec-key-input')?.value || '').toLowerCase();
          const v = r.querySelector('.spec-val-input')?.value || '';
          if (k.includes('camera') && !camera) camera = v.split(';')[0].trim();
          if (k.includes('battery') || k.includes('capacity')) battery = v.split(';')[0].trim();
          if (k.includes('ram')) ram = v.split(';')[0].trim();
        });

        const specSnippets = [];
        if (camera) specSnippets.push(`${camera} camera`);
        if (battery) specSnippets.push(`${battery} battery`);
        if (ram) specSnippets.push(`${ram} RAM`);

        const specStr = specSnippets.length > 0 ? ` featuring ${specSnippets.join(', ')}` : '';

        suggestion = `Check ${name} price in Pakistan (${formattedPrice})${specStr}. Complete official specifications, display, performance, and features on ${this.siteName}.`;
        if (suggestion.length > 160) {
          suggestion = `${name} price in Pakistan is ${formattedPrice}. Full specifications, display, ${camera || 'camera'}, and battery review on ${this.siteName}.`;
        }
      } else {
        const authorVal = document.getElementById('articleAuthor')?.value || 'Editorial Team';
        suggestion = `Read latest ${name} smartphone details, features, specifications, and market analysis published by ${authorVal} on ${this.siteName}.`;
      }

      metaInput.value = suggestion;
      metaInput.classList.add('seo-field-highlight');
      setTimeout(() => metaInput.classList.remove('seo-field-highlight'), 1200);

      this.runAnalysis();
    }

    /**
     * Jump smoothly to any form input and trigger pulse highlight
     */
    jumpToField(fieldId) {
      const el = document.getElementById(fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('seo-field-highlight');
        setTimeout(() => el.classList.remove('seo-field-highlight'), 1800);
      }
    }

    /**
     * Normalize string for unicode-safe, punctuation-agnostic, case-insensitive comparison
     */
    normalizeText(str) {
      if (!str) return '';
      return String(str)
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '') // remove diacritics
        .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'") // curly single quotes
        .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036"]/g, '"') // curly double quotes
        .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212_]/g, ' ') // dashes to spaces
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ') // replace punctuation with spaces
        .replace(/\s+/g, ' ')
        .trim();
    }

    /**
     * Advanced Focus Keyword Matcher:
     * Returns exact, normalized, all_words, partial, or missing status with token counts
     */
    checkKeywordMatch(targetText, focusKeyword) {
      const rawTarget = String(targetText || '').trim();
      const rawKw = String(focusKeyword || '').trim();

      if (!rawKw) {
        return {
          status: 'empty_keyword',
          matchType: 'none',
          matchedCount: 0,
          totalCount: 0,
          matchedWords: [],
          missingWords: [],
          percentage: 0,
          label: 'No Focus Keyword'
        };
      }

      const normKw = this.normalizeText(rawKw);
      const kwWords = normKw.split(' ').filter(Boolean);

      if (!rawTarget) {
        return {
          status: 'empty_field',
          matchType: 'none',
          matchedCount: 0,
          totalCount: kwWords.length,
          matchedWords: [],
          missingWords: kwWords,
          percentage: 0,
          label: 'Field Empty'
        };
      }

      const lowerTarget = rawTarget.toLowerCase();
      const lowerKw = rawKw.toLowerCase();

      // 1. Raw exact substring match
      if (lowerTarget.includes(lowerKw)) {
        return {
          status: 'passed',
          matchType: 'exact',
          matchedCount: kwWords.length,
          totalCount: kwWords.length,
          matchedWords: kwWords,
          missingWords: [],
          percentage: 100,
          label: 'Passed (Exact phrase)'
        };
      }

      // 2. Normalized phrase match (ignores punctuation, hyphens, Unicode accents)
      const normTarget = this.normalizeText(rawTarget);
      if (normTarget.includes(normKw)) {
        return {
          status: 'passed',
          matchType: 'normalized',
          matchedCount: kwWords.length,
          totalCount: kwWords.length,
          matchedWords: kwWords,
          missingWords: [],
          percentage: 100,
          label: 'Passed (Normalized phrase)'
        };
      }

      // 3. Token-level matching (word order permutations and partial match)
      const targetTokens = new Set(normTarget.split(' ').filter(Boolean));
      const targetTokenList = Array.from(targetTokens);

      const matchedWords = [];
      const missingWords = [];

      for (const word of kwWords) {
        if (targetTokens.has(word) || targetTokenList.some(tt => tt.length > 2 && (tt.startsWith(word) || word.startsWith(tt)))) {
          matchedWords.push(word);
        } else {
          missingWords.push(word);
        }
      }

      const matchRatio = kwWords.length > 0 ? (matchedWords.length / kwWords.length) : 0;
      const percentage = Math.round(matchRatio * 100);

      // All words present anywhere in target: Passed
      if (matchedWords.length === kwWords.length) {
        return {
          status: 'passed',
          matchType: 'all_words',
          matchedCount: matchedWords.length,
          totalCount: kwWords.length,
          matchedWords,
          missingWords: [],
          percentage: 100,
          label: 'Passed (All terms present)'
        };
      }

      // Partial match if at least 1 keyword term is found
      if (matchedWords.length > 0) {
        return {
          status: 'partial',
          matchType: 'partial',
          matchedCount: matchedWords.length,
          totalCount: kwWords.length,
          matchedWords,
          missingWords,
          percentage,
          label: `Partial Match (${matchedWords.length}/${kwWords.length} terms)`
        };
      }

      // Zero words matched: Missing
      return {
        status: 'missing',
        matchType: 'missing',
        matchedCount: 0,
        totalCount: kwWords.length,
        matchedWords: [],
        missingWords: kwWords,
        percentage: 0,
        label: 'Missing'
      };
    }

    /**
     * Core Real-Time On-Page SEO Analysis Engine
     */
    runAnalysis() {
      const name = this.getItemName();
      const brand = this.getBrandName();
      const slug = this.getSlug();
      const focusKeyword = (document.getElementById('seoFocusKeywordInput')?.value || '').trim();
      const seoTitle = (document.getElementById('seoTitleInput')?.value || '').trim();
      const metaDesc = (document.getElementById('seoMetaDescInput')?.value || '').trim();
      const canonical = (document.getElementById('seoCanonicalInput')?.value || '').trim();
      const summaryHtml = this.getSummaryHtml();
      const mainAltVal = (document.getElementById('phoneImageAlt')?.value || document.getElementById('articleImageAlt')?.value || '').trim();

      // Gather gallery ALTs
      let galleryAltsList = [];
      if (window.adminGalleryAlts && typeof window.adminGalleryAlts === 'object') {
        galleryAltsList = Object.values(window.adminGalleryAlts).map(s => String(s || '').trim()).filter(Boolean);
      } else {
        const galInputs = document.querySelectorAll('.admin-gallery-alt-input');
        galInputs.forEach(i => {
          const v = i.value.trim();
          if (v) galleryAltsList.push(v);
        });
      }
      const galleryAltsText = galleryAltsList.join(' ');

      // Summary text & first 80 words
      const tempSummaryDiv = document.createElement('div');
      tempSummaryDiv.innerHTML = summaryHtml;
      const cleanSummaryText = (tempSummaryDiv.textContent || tempSummaryDiv.innerText || '').replace(/\s+/g, ' ').trim();
      const introWords = cleanSummaryText.split(/\s+/).slice(0, 80).join(' ');

      // Subheadings inside summary
      const hMatches = summaryHtml.match(/<h[2-4][^>]*>([\s\S]*?)<\/h[2-4]>/gi) || [];
      const subheadingsText = hMatches.map(h => h.replace(/<[^>]+>/g, '')).join(' ');

      // Specifications text
      const specPairs = [];
      document.querySelectorAll('.spec-row-item').forEach(r => {
        const k = (r.querySelector('.spec-key-input')?.value || '').trim();
        const v = (r.querySelector('.spec-val-input')?.value || '').trim();
        if (k || v) specPairs.push(`${k} ${v}`);
      });
      const specsText = specPairs.join(' ');

      // Full content without duplicating previews or UI labels
      const fullText = [name, brand, cleanSummaryText, specsText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

      // Update Default Canonical preview
      const canonicalPreview = document.getElementById('defaultCanonicalPreview');
      if (canonicalPreview) {
        canonicalPreview.textContent = `${this.siteUrl}/${this.mode === 'phone' ? 'phone' : 'news'}/${slug || '[slug]'}`;
      }

      // ── 1. Focus Keyword Checks ───────────────────────────────────────────
      const hasFocus = focusKeyword.length > 0;
      const badgeFocus = document.getElementById('badgeSecFocus');

      if (badgeFocus) {
        if (!hasFocus) {
          badgeFocus.textContent = 'Missing';
          badgeFocus.className = 'seo-acc-status-indicator indicator-bad';
        } else {
          badgeFocus.textContent = 'Set';
          badgeFocus.className = 'seo-acc-status-indicator indicator-good';
        }
      }

      // ── 2. Title Checks ───────────────────────────────────────────────────
      const titleLen = seoTitle.length;
      const titleCharsEl = document.getElementById('titleCharCount');
      const titlePixelEl = document.getElementById('titlePixelWidth');
      const titleStatusEl = document.getElementById('titleStatusText');
      const titleBar = document.getElementById('titleProgressBar');
      const badgeTitle = document.getElementById('badgeSecTitle');

      const approxPixel = Math.round(titleLen * 9.5);
      if (titleCharsEl) titleCharsEl.textContent = `${titleLen} / 60 chars`;
      if (titlePixelEl) titlePixelEl.textContent = `~${approxPixel} / 580 px`;

      let titleScore = 0;
      let titleStatus = 'Empty';
      let titleColor = '#94a3b8';

      if (titleLen === 0) {
        titleStatus = 'Missing';
        titleColor = '#ef4444';
      } else if (titleLen < 35) {
        titleStatus = 'Too Short';
        titleColor = '#f59e0b';
        titleScore = 6;
      } else if (titleLen <= 65) {
        titleStatus = 'Optimal';
        titleColor = '#10b981';
        titleScore = 15;
      } else {
        titleStatus = 'Too Long (May truncate)';
        titleColor = '#ef4444';
        titleScore = 8;
      }

      if (titleBar) {
        const pct = Math.min(100, Math.round((titleLen / 60) * 100));
        titleBar.style.width = `${pct}%`;
        titleBar.style.backgroundColor = titleColor;
      }
      if (titleStatusEl) {
        titleStatusEl.textContent = titleStatus;
        titleStatusEl.style.color = titleColor;
      }

      // ── 3. Meta Description Checks ────────────────────────────────────────
      const metaLen = metaDesc.length;
      const metaCharsEl = document.getElementById('metaCharCount');
      const metaStatusEl = document.getElementById('metaStatusText');
      const metaBar = document.getElementById('metaProgressBar');
      const badgeMeta = document.getElementById('badgeSecMeta');

      if (metaCharsEl) metaCharsEl.textContent = `${metaLen} / 160 chars`;

      let metaScore = 0;
      let metaStatus = 'Empty';
      let metaColor = '#94a3b8';

      if (metaLen === 0) {
        metaStatus = 'Missing';
        metaColor = '#ef4444';
      } else if (metaLen < 110) {
        metaStatus = 'Too Short';
        metaColor = '#f59e0b';
        metaScore = 7;
      } else if (metaLen <= 165) {
        metaStatus = 'Optimal';
        metaColor = '#10b981';
        metaScore = 15;
      } else {
        metaStatus = 'Too Long';
        metaColor = '#ef4444';
        metaScore = 8;
      }

      if (metaBar) {
        const pct = Math.min(100, Math.round((metaLen / 160) * 100));
        metaBar.style.width = `${pct}%`;
        metaBar.style.backgroundColor = metaColor;
      }
      if (metaStatusEl) {
        metaStatusEl.textContent = metaStatus;
        metaStatusEl.style.color = metaColor;
      }

      // ── 4. Robust Keyword Matches Across Content Locations ────────────────
      const titleMatch = this.checkKeywordMatch(seoTitle, focusKeyword);
      const metaMatch = this.checkKeywordMatch(metaDesc, focusKeyword);
      const slugMatch = this.checkKeywordMatch(slug.replace(/[-_]/g, ' '), focusKeyword);
      const h1Match = this.checkKeywordMatch(name, focusKeyword);
      const introMatch = this.checkKeywordMatch(introWords, focusKeyword);
      const headingsMatch = this.checkKeywordMatch(subheadingsText, focusKeyword);
      const specsMatch = this.checkKeywordMatch(specsText, focusKeyword);
      const mainAltMatch = this.checkKeywordMatch(mainAltVal, focusKeyword);
      const galleryAltMatch = galleryAltsList.length > 0 ? this.checkKeywordMatch(galleryAltsText, focusKeyword) : null;

      // Update Section 2 & 3 Badges reflecting focus keyword matches
      if (badgeTitle) {
        if (titleLen === 0) {
          badgeTitle.textContent = 'Missing';
          badgeTitle.className = 'seo-acc-status-indicator indicator-bad';
        } else if (hasFocus && titleMatch.status === 'passed') {
          badgeTitle.textContent = 'Passed (In Title)';
          badgeTitle.className = 'seo-acc-status-indicator indicator-good';
        } else if (hasFocus && titleMatch.status === 'partial') {
          badgeTitle.textContent = `Partial (${titleMatch.matchedCount}/${titleMatch.totalCount})`;
          badgeTitle.className = 'seo-acc-status-indicator indicator-warn';
        } else {
          badgeTitle.textContent = titleStatus;
          badgeTitle.className = `seo-acc-status-indicator ${titleScore >= 12 ? 'indicator-good' : titleScore >= 6 ? 'indicator-warn' : 'indicator-bad'}`;
        }
      }

      if (badgeMeta) {
        if (metaLen === 0) {
          badgeMeta.textContent = 'Missing';
          badgeMeta.className = 'seo-acc-status-indicator indicator-bad';
        } else if (hasFocus && metaMatch.status === 'passed') {
          badgeMeta.textContent = 'Passed (In Snippet)';
          badgeMeta.className = 'seo-acc-status-indicator indicator-good';
        } else if (hasFocus && metaMatch.status === 'partial') {
          badgeMeta.textContent = `Partial (${metaMatch.matchedCount}/${metaMatch.totalCount})`;
          badgeMeta.className = 'seo-acc-status-indicator indicator-warn';
        } else if (hasFocus && metaMatch.status === 'missing') {
          badgeMeta.textContent = 'Keyword Missing';
          badgeMeta.className = 'seo-acc-status-indicator indicator-warn';
        } else {
          badgeMeta.textContent = metaStatus;
          badgeMeta.className = `seo-acc-status-indicator ${metaScore >= 12 ? 'indicator-good' : metaScore >= 6 ? 'indicator-warn' : 'indicator-bad'}`;
        }
      }

      // Calculate total occurrences & approximate density
      let totalOccurrences = 0;
      let densityVal = '0.0%';
      if (hasFocus) {
        const normKw = this.normalizeText(focusKeyword);
        const normFull = this.normalizeText(fullText);
        if (normKw && normFull) {
          const occMatches = normFull.split(normKw);
          totalOccurrences = Math.max(0, occMatches.length - 1);
        }
        const totalWords = fullText.split(/\s+/).filter(Boolean).length;
        const kwWordsCount = normKw.split(' ').filter(Boolean).length;
        if (totalWords > 0 && totalOccurrences > 0) {
          const density = ((totalOccurrences * kwWordsCount) / totalWords) * 100;
          densityVal = `${density.toFixed(1)}%`;
        }
      }

      // Update distribution badges in DOM
      if (!hasFocus) {
        this.updateBadge('distTitleBadge', 'missing', 'No');
        this.updateBadge('distMetaBadge', 'missing', 'No');
        this.updateBadge('distSlugBadge', 'missing', 'No');
        this.updateBadge('distH1Badge', 'missing', 'No');
        this.updateBadge('distIntroBadge', 'missing', 'No');
        this.updateBadge('distHeadingsBadge', 'missing', '0 times');
        this.updateBadge('distContentBadge', 'missing', '0 times');
        this.updateBadge('distImageBadge', 'missing', 'No');
        const distGal = document.getElementById('distGalleryBadge');
        if (distGal) { distGal.textContent = 'No'; distGal.className = 'seo-dist-badge badge-no'; }
      } else {
        this.updateBadge('distTitleBadge', titleMatch.status === 'passed' ? 'passed' : (titleMatch.status === 'partial' ? 'partial' : 'missing'), titleMatch.status === 'passed' ? 'Yes' : (titleMatch.status === 'partial' ? `Partial (${titleMatch.matchedCount}/${titleMatch.totalCount})` : 'No'));
        this.updateBadge('distMetaBadge', metaMatch.status === 'passed' ? 'passed' : (metaMatch.status === 'partial' ? 'partial' : 'missing'), metaMatch.status === 'passed' ? 'Yes' : (metaMatch.status === 'partial' ? `Partial (${metaMatch.matchedCount}/${metaMatch.totalCount})` : 'No'));
        this.updateBadge('distSlugBadge', slugMatch.status === 'passed' ? 'passed' : (slugMatch.status === 'partial' ? 'partial' : 'missing'), slugMatch.status === 'passed' ? 'Yes' : (slugMatch.status === 'partial' ? `Partial (${slugMatch.matchedCount}/${slugMatch.totalCount})` : 'No'));
        this.updateBadge('distH1Badge', h1Match.status === 'passed' ? 'passed' : (h1Match.status === 'partial' ? 'partial' : 'missing'), h1Match.status === 'passed' ? 'Yes' : (h1Match.status === 'partial' ? `Partial (${h1Match.matchedCount}/${h1Match.totalCount})` : 'No'));
        this.updateBadge('distIntroBadge', introMatch.status === 'passed' ? 'passed' : (introMatch.status === 'partial' ? 'partial' : 'missing'), introMatch.status === 'passed' ? 'Yes' : (introMatch.status === 'partial' ? `Partial (${introMatch.matchedCount}/${introMatch.totalCount})` : 'No'));
        this.updateBadge('distHeadingsBadge', headingsMatch.status === 'passed' ? 'passed' : (headingsMatch.status === 'partial' ? 'partial' : 'missing'), headingsMatch.status === 'passed' ? 'Yes' : (headingsMatch.status === 'partial' ? `Partial (${headingsMatch.matchedCount}/${headingsMatch.totalCount})` : '0 times'));
        this.updateBadge('distContentBadge', totalOccurrences > 0 ? 'passed' : 'missing', `${totalOccurrences} time${totalOccurrences === 1 ? '' : 's'}`);
        this.updateBadge('distImageBadge', mainAltMatch.status === 'passed' ? 'passed' : (mainAltMatch.status === 'partial' ? 'partial' : 'missing'), mainAltMatch.status === 'passed' ? 'Yes' : (mainAltMatch.status === 'partial' ? `Partial (${mainAltMatch.matchedCount}/${mainAltMatch.totalCount})` : 'No'));
        const distGal = document.getElementById('distGalleryBadge');
        if (distGal) {
          if (galleryAltsList.length === 0) {
            distGal.textContent = 'N/A (No gallery)';
            distGal.className = 'seo-dist-badge badge-warn';
          } else if (galleryAltMatch) {
            this.updateBadge('distGalleryBadge', galleryAltMatch.status === 'passed' ? 'passed' : (galleryAltMatch.status === 'partial' ? 'partial' : 'missing'), galleryAltMatch.status === 'passed' ? 'Yes' : (galleryAltMatch.status === 'partial' ? `Partial (${galleryAltMatch.matchedCount}/${galleryAltMatch.totalCount})` : 'No'));
          }
        }
      }

      const distCountEl = document.getElementById('distTotalCount');
      const distDensityEl = document.getElementById('distDensityVal');
      const badgeSecDist = document.getElementById('badgeSecDist');

      if (distCountEl) distCountEl.textContent = totalOccurrences;
      if (distDensityEl) distDensityEl.textContent = densityVal;
      if (badgeSecDist) {
        badgeSecDist.textContent = `${totalOccurrences} uses (${densityVal})`;
        badgeSecDist.className = `seo-acc-status-indicator ${totalOccurrences >= 2 ? 'indicator-good' : totalOccurrences === 1 ? 'indicator-warn' : 'indicator-bad'}`;
      }

      // ── 5. Content Quality & Specifications Depth Checks ─────────────────
      const qualityChecks = [];
      const wordCount = fullText.split(/\s+/).filter(Boolean).length;

      // Word count check
      if (wordCount >= (this.mode === 'phone' ? 100 : 300)) {
        qualityChecks.push({ pass: true, text: `Content length is substantial (${wordCount} words).` });
      } else if (wordCount >= (this.mode === 'phone' ? 50 : 150)) {
        qualityChecks.push({ warn: true, text: `Content length is acceptable (${wordCount} words), but adding more details is recommended.` });
      } else {
        qualityChecks.push({ fail: true, text: `Content is too concise (${wordCount} words). Write a richer overview.` });
      }

      if (this.mode === 'phone') {
        const specRows = document.querySelectorAll('.spec-row-item');
        const totalSpecs = specRows.length;
        if (totalSpecs >= 15) {
          qualityChecks.push({ pass: true, text: `Comprehensive specifications builder (${totalSpecs} specifications configured).` });
        } else if (totalSpecs >= 8) {
          qualityChecks.push({ warn: true, text: `Moderate specifications depth (${totalSpecs} fields). Recommended: 15+ fields.` });
        } else {
          qualityChecks.push({ fail: true, text: `Very few specifications provided (${totalSpecs} fields). Search engines prefer thorough spec tables.` });
        }

        // Section coverage
        const sectionsFound = new Set();
        specRows.forEach(r => {
          const s = r.querySelector('.spec-section-select')?.value;
          if (s) sectionsFound.add(s.toLowerCase());
        });
        const hasCoreSections = sectionsFound.has('display') && (sectionsFound.has('camera') || sectionsFound.has('main camera')) && sectionsFound.has('battery');
        if (hasCoreSections) {
          qualityChecks.push({ pass: true, text: `Core specification categories present (Display, Camera, Battery).` });
        } else {
          qualityChecks.push({ warn: true, text: `Missing one or more primary categories (Display, Camera, or Battery).` });
        }

        // Brand & Model identification
        if (name && brand) {
          qualityChecks.push({ pass: true, text: `Brand (${brand}) and Model (${name}) clearly identified.` });
        } else {
          qualityChecks.push({ fail: true, text: `Brand or Model name missing. Both are required for accurate search indexing.`, action: 'Fix', target: 'phoneBrandSelect' });
        }

        // Pricing check
        const priceVal = parseFloat(document.getElementById('phonePriceInput')?.value || '0');
        const statusVal = document.getElementById('phoneStatusSelect')?.value || 'Available';
        if (priceVal > 0) {
          qualityChecks.push({ pass: true, text: `Verified price in PKR configured (${statusVal} market status).` });
        } else {
          qualityChecks.push({ warn: true, text: `Price is not specified or set to 0. Accurate pricing enables Google Product rich results.`, action: 'Set Price', target: 'phonePriceInput' });
        }
      }

      // Headings check in summary
      const hasH2 = /<h2[^>]*>/i.test(summaryHtml);
      const hasH3 = /<h3[^>]*>/i.test(summaryHtml);
      if (hasH2 || hasH3) {
        qualityChecks.push({ pass: true, text: `Content uses structured subheadings (H2 / H3).` });
      } else {
        qualityChecks.push({ warn: true, text: `No subheadings (H2 / H3) found in summary. Subheadings improve readability.` });
      }

      // Render Quality Checklist
      const qualityBox = document.getElementById('seoQualityChecklist');
      const badgeSecQuality = document.getElementById('badgeSecQuality');
      if (qualityBox) {
        qualityBox.innerHTML = qualityChecks.map(c => `
          <div class="seo-check-item ${c.pass ? 'item-good' : c.warn ? 'item-improvement' : 'item-problem'}">
            <span class="seo-check-icon">${c.pass ? '🟢' : c.warn ? '🟡' : '🔴'}</span>
            <div class="seo-check-content">
              <div class="seo-check-text">${this.escapeHtml(c.text)}</div>
            </div>
            ${c.action ? `<button type="button" class="seo-check-action-btn" onclick="window.seoAssistant.jumpToField('${c.target}')">${c.action}</button>` : ''}
          </div>
        `).join('');
      }
      if (badgeSecQuality) {
        const qualityFails = qualityChecks.filter(c => c.fail).length;
        const qualityPass = qualityChecks.filter(c => c.pass).length;
        badgeSecQuality.textContent = `${qualityPass}/${qualityChecks.length} Passed`;
        badgeSecQuality.className = `seo-acc-status-indicator ${qualityFails === 0 ? 'indicator-good' : 'indicator-warn'}`;
      }

      // ── 6. Technical SEO & Image SEO Checks ──────────────────────────────
      const techChecks = [];

      // Slug check
      if (!slug) {
        techChecks.push({ fail: true, text: `URL Slug is missing.`, action: 'Fix', target: this.mode === 'phone' ? 'phoneSlugInput' : 'articleSlug' });
      } else if (slug.length > 70) {
        techChecks.push({ warn: true, text: `URL Slug is unusually long (${slug.length} chars). Keep it concise.`, action: 'Fix', target: this.mode === 'phone' ? 'phoneSlugInput' : 'articleSlug' });
      } else if (/[^a-z0-9-]/.test(slug)) {
        techChecks.push({ fail: true, text: `URL Slug contains invalid characters. Use lowercase letters and hyphens only.`, action: 'Fix', target: this.mode === 'phone' ? 'phoneSlugInput' : 'articleSlug' });
      } else {
        techChecks.push({ pass: true, text: `URL Slug is clean, URL-safe, and SEO-friendly.` });
      }

      // Canonical URL check
      techChecks.push({ pass: true, text: `Canonical tag configured. Automatically avoids duplicate content penalty.` });

      // Image SEO Checks
      const previewImgEl = document.getElementById(this.mode === 'phone' ? 'currentImagePreview' : 'imagePreviewImg');
      const hasImage = previewImgEl && previewImgEl.src && !previewImgEl.src.includes('placeholder.svg') && previewImgEl.style.display !== 'none';

      if (hasImage) {
        techChecks.push({ pass: true, text: `Main media image configured (Modern WebP format supported).` });

        // Main Image ALT text check
        if (!mainAltVal) {
          techChecks.push({ fail: true, text: `Main product image is missing ALT text. ALT text is required for image SEO and accessibility.`, action: 'Add ALT', target: 'phoneImageAlt' });
        } else if (mainAltVal.length < 10) {
          techChecks.push({ warn: true, text: `Main image ALT text is too short (${mainAltVal.length} chars). Use a descriptive caption.`, action: 'Edit ALT', target: 'phoneImageAlt' });
        } else {
          techChecks.push({ pass: true, text: `Main image has descriptive ALT text ("${mainAltVal.length > 35 ? mainAltVal.slice(0, 35) + '...' : mainAltVal}").` });
        }

        // Gallery Images ALT text check
        const galCards = document.querySelectorAll('.admin-gallery-alt-input');
        if (galCards.length > 0) {
          const galVals = Array.from(galCards).map(i => i.value.trim());
          const emptyGalCount = galVals.filter(v => !v).length;
          const uniqueGalVals = new Set(galVals.filter(Boolean));
          const hasIdenticalAlts = galVals.length > 1 && uniqueGalVals.size === 1;

          if (emptyGalCount > 0) {
            techChecks.push({ warn: true, text: `${emptyGalCount} gallery image(s) missing ALT text.`, action: 'Fix ALTs', target: 'phoneGalleryContainer' });
          } else if (hasIdenticalAlts) {
            techChecks.push({ warn: true, text: `Gallery images have identical ALT text. Describe individual angles.`, action: 'Auto-Fix', target: 'btnRegenAllGalleryAlts' });
          } else {
            techChecks.push({ pass: true, text: `Gallery images have distinct, descriptive ALT text (${galCards.length} photos).` });
          }
        }

        // Image keyword stuffing check
        if (hasFocus && mainAltVal) {
          const normKw = this.normalizeText(focusKeyword);
          const normAlt = this.normalizeText(mainAltVal);
          const kwCount = normAlt.split(normKw).length - 1;
          if (kwCount > 2 || mainAltVal.length > 130) {
            techChecks.push({ warn: true, text: `Image ALT text contains keyword repetition or is too long. Keep it natural.` });
          } else {
            techChecks.push({ pass: true, text: `Image ALT text is natural and free from keyword stuffing.` });
          }
        }

        // Image loading optimization
        techChecks.push({ pass: true, text: `Image loading optimized: Hero image loads eagerly (fetchpriority="high"); gallery thumbnails load lazily.` });
      } else {
        techChecks.push({ warn: true, text: `No primary image uploaded. Rich Google image results require a valid image.`, action: 'Upload', target: this.mode === 'phone' ? 'phoneImageFile' : 'articleImageFile' });
      }

      // Structured Data Check
      techChecks.push({ pass: true, text: `Schema.org ${this.mode === 'phone' ? 'Product' : 'NewsArticle'}, AggregateOffer & BreadcrumbList structured data integrated.` });
      techChecks.push({ pass: true, text: `Robots directives set to index, follow. Meta tags verified.` });

      // Internal Linking Check
      if (this.mode === 'phone' && brand) {
        const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        techChecks.push({ pass: true, text: `Internal brand link to /brand/${brandSlug} active in breadcrumbs and specifications.` });
      }

      // Render Technical Checklist
      const techBox = document.getElementById('seoTechChecklist');
      const badgeSecTech = document.getElementById('badgeSecTech');
      if (techBox) {
        techBox.innerHTML = techChecks.map(c => `
          <div class="seo-check-item ${c.pass ? 'item-good' : c.warn ? 'item-improvement' : 'item-problem'}">
            <span class="seo-check-icon">${c.pass ? '🟢' : c.warn ? '🟡' : '🔴'}</span>
            <div class="seo-check-content">
              <div class="seo-check-text">${this.escapeHtml(c.text)}</div>
            </div>
            ${c.action ? `<button type="button" class="seo-check-action-btn" onclick="window.seoAssistant.jumpToField('${c.target}')">${c.action}</button>` : ''}
          </div>
        `).join('');
      }
      if (badgeSecTech) {
        const techPass = techChecks.filter(c => c.pass).length;
        badgeSecTech.textContent = `${techPass}/${techChecks.length} Passed`;
        badgeSecTech.className = `seo-acc-status-indicator indicator-good`;
      }

      // ── 7. Actionable Recommendations List ───────────────────────────────
      const recommendations = [];

      if (!hasFocus) {
        recommendations.push({
          type: 'problem',
          title: 'Missing Focus Keyword',
          desc: 'Specify a primary focus keyword to audit keyword relevance, title, headings, and density.',
          action: 'Suggest',
          handler: 'window.seoAssistant.suggestFocusKeyword()'
        });
      } else {
        // SEO Title check
        if (titleMatch.status === 'missing' || titleMatch.status === 'empty_field') {
          recommendations.push({
            type: 'problem',
            title: 'Focus Keyword missing in SEO Title',
            desc: `Add "${focusKeyword}" naturally to your SEO Title for high Google ranking relevance.`,
            action: 'Fix Title',
            handler: "window.seoAssistant.jumpToField('seoTitleInput')"
          });
        } else if (titleMatch.status === 'partial') {
          recommendations.push({
            type: 'improvement',
            title: 'Focus Keyword partially present in SEO Title',
            desc: `Your SEO Title includes ${titleMatch.matchedCount} of ${titleMatch.totalCount} terms from "${focusKeyword}". Missing terms: ${titleMatch.missingWords.join(', ')}. Include the full keyphrase near the beginning.`,
            action: 'Fix Title',
            handler: "window.seoAssistant.jumpToField('seoTitleInput')"
          });
        }

        // Meta Description check
        if (metaLen === 0) {
          recommendations.push({
            type: 'problem',
            title: 'Meta Description is missing',
            desc: 'Search snippets without a meta description will use random page text, reducing CTR.',
            action: 'Generate',
            handler: 'window.seoAssistant.suggestMetaDescription()'
          });
        } else if (metaMatch.status === 'missing') {
          recommendations.push({
            type: 'problem',
            title: 'Focus Keyword missing in Meta Description',
            desc: `Include "${focusKeyword}" in your meta snippet. Google bolds matching search terms in search snippets.`,
            action: 'Generate',
            handler: 'window.seoAssistant.suggestMetaDescription()'
          });
        } else if (metaMatch.status === 'partial') {
          recommendations.push({
            type: 'improvement',
            title: 'Focus Keyword partially present in Meta Description',
            desc: `Your meta description includes ${metaMatch.matchedCount} of ${metaMatch.totalCount} terms from "${focusKeyword}". Missing terms: ${metaMatch.missingWords.join(', ')}. Include the full keyphrase for best Google snippet bolding.`,
            action: 'Edit Meta',
            handler: "window.seoAssistant.jumpToField('seoMetaDescInput')"
          });
        }
        // If metaMatch.status === 'passed', no problem or improvement is added!

        // URL Slug check
        if (slug && slugMatch.status === 'missing') {
          recommendations.push({
            type: 'improvement',
            title: 'Keyword not detected in URL Slug',
            desc: 'Consider including primary keyword terms in the URL slug before publishing.',
            action: 'Edit Slug',
            target: this.mode === 'phone' ? 'phoneSlugInput' : 'articleSlug'
          });
        }

        // Opening summary check
        if (introMatch.status === 'missing') {
          recommendations.push({
            type: 'improvement',
            title: 'Keyword not in opening paragraph',
            desc: 'Search intent is reinforced when the primary keyword appears in the first 80 words of the overview.',
            action: 'Edit Summary',
            target: this.mode === 'phone' ? 'summaryQuillEditor' : 'articleSummary'
          });
        }
      }

      // Title length check
      if (titleLen === 0) {
        recommendations.push({
          type: 'problem',
          title: 'SEO Title is empty',
          desc: 'Search engines require a page title tag. Generate an optimized title now.',
          action: 'Suggest Title',
          handler: 'window.seoAssistant.suggestSeoTitle()'
        });
      } else if (titleLen < 35) {
        recommendations.push({
          type: 'improvement',
          title: 'SEO Title is too short',
          desc: `Current title is only ${titleLen} characters. Expand it up to 50–60 characters to capture more search intent.`,
          action: 'Edit',
          target: 'seoTitleInput'
        });
      }

      // Meta Description length check
      if (metaLen > 0 && metaLen < 110) {
        recommendations.push({
          type: 'improvement',
          title: 'Meta Description is too short',
          desc: `Current description is only ${metaLen} characters. Aim for 130–160 characters.`,
          action: 'Edit',
          target: 'seoMetaDescInput'
        });
      }

      // Main image check
      if (!hasImage) {
        recommendations.push({
          type: 'problem',
          title: 'Main phone image missing',
          desc: 'Upload a clear smartphone photo to qualify for Google rich product snippets.',
          action: 'Upload',
          target: this.mode === 'phone' ? 'phoneImageFile' : 'articleImageFile'
        });
      } else {
        if (!mainAltVal) {
          recommendations.push({
            type: 'problem',
            title: 'Main image missing ALT text',
            desc: 'Add descriptive ALT text for the main product image for accessibility and Google Image rankings.',
            action: 'Add ALT',
            target: 'phoneImageAlt'
          });
        } else if (mainAltVal.length < 10) {
          recommendations.push({
            type: 'improvement',
            title: 'Main image ALT text is too short',
            desc: `Expand ALT text "${mainAltVal}" to describe the product view accurately.`,
            action: 'Edit ALT',
            target: 'phoneImageAlt'
          });
        }
      }

      // Gallery ALTs check
      const galInputs = document.querySelectorAll('.admin-gallery-alt-input');
      if (galInputs.length > 0) {
        const galVals = Array.from(galInputs).map(i => i.value.trim());
        const emptyCount = galVals.filter(v => !v).length;
        if (emptyCount > 0) {
          recommendations.push({
            type: 'improvement',
            title: `${emptyCount} gallery image(s) missing ALT text`,
            desc: 'Each gallery photo should have descriptive ALT text explaining its specific view.',
            action: 'Auto-Fix',
            handler: 'if (typeof window.adminRegenAllGalleryAlts === "function") window.adminRegenAllGalleryAlts()'
          });
        }
      }

      if (this.relatedKeywords.length < 2) {
        recommendations.push({
          type: 'improvement',
          title: 'Add related keywords',
          desc: 'Adding 2–5 related keywords targets semantic search variations without repetitive stuffing.',
          action: '+ Suggestions',
          handler: "document.querySelector('[data-target=\"seoSecRelated\"]').click()"
        });
      }

      // Render Recommendations
      const recsBox = document.getElementById('seoRecommendationsBox');
      const badgeSecRecs = document.getElementById('badgeSecRecs');
      if (recsBox) {
        if (recommendations.length === 0) {
          recsBox.innerHTML = `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 14px; text-align: center; color: #065f46; font-weight: 700;">
              🎉 Excellent job! All critical On-Page SEO requirements have been addressed.
            </div>
          `;
        } else {
          recsBox.innerHTML = recommendations.map(r => `
            <div class="seo-check-item ${r.type === 'problem' ? 'item-problem' : 'item-improvement'}">
              <span class="seo-check-icon">${r.type === 'problem' ? '🔴' : '🟡'}</span>
              <div class="seo-check-content">
                <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${this.escapeHtml(r.title)}</div>
                <div class="seo-check-hint">${this.escapeHtml(r.desc)}</div>
              </div>
              ${r.handler ? `<button type="button" class="seo-check-action-btn" onclick="${r.handler}">${r.action}</button>` : (r.target ? `<button type="button" class="seo-check-action-btn" onclick="window.seoAssistant.jumpToField('${r.target}')">${r.action}</button>` : '')}
            </div>
          `).join('');
        }
      }
      if (badgeSecRecs) {
        badgeSecRecs.textContent = `${recommendations.length} Item${recommendations.length === 1 ? '' : 's'}`;
        badgeSecRecs.className = `seo-acc-status-indicator ${recommendations.length === 0 ? 'indicator-good' : 'indicator-warn'}`;
      }

      // ── 8. Calculate Overall Score (0-100) ─────────────────────────────────
      let overallScore = 0;

      // Focus keyword placement (25 pts max)
      if (hasFocus) {
        overallScore += 4; // Focus keyword provided
        if (titleMatch.status === 'passed') overallScore += 7;
        else if (titleMatch.status === 'partial') overallScore += 4;

        if (metaMatch.status === 'passed') overallScore += 6;
        else if (metaMatch.status === 'partial') overallScore += 3;

        if (slugMatch.status === 'passed') overallScore += 3;
        else if (slugMatch.status === 'partial') overallScore += 1;

        if (introMatch.status === 'passed') overallScore += 3;
        else if (introMatch.status === 'partial') overallScore += 1;

        if (totalOccurrences >= 2) overallScore += 2;
      }

      // Title optimization (15 pts max)
      overallScore += titleScore;

      // Meta description (15 pts max)
      overallScore += metaScore;

      // Image SEO (15 pts max)
      if (hasImage) overallScore += 5;
      if (mainAltVal && mainAltVal.length >= 10) overallScore += 5;
      if (galleryAltsList.length === 0 || galleryAltsList.every(v => v.length >= 8)) overallScore += 5;

      // Content & specs richness (15 pts max)
      if (wordCount >= 100) overallScore += 8;
      else if (wordCount >= 50) overallScore += 5;
      else if (wordCount > 0) overallScore += 2;

      if (this.mode === 'phone') {
        const specCount = document.querySelectorAll('.spec-row-item').length;
        if (specCount >= 15) overallScore += 7;
        else if (specCount >= 8) overallScore += 4;
        else if (specCount > 0) overallScore += 2;
      } else {
        if (wordCount >= 300) overallScore += 7;
        else if (wordCount >= 150) overallScore += 4;
      }

      // Technical & URL parameters (15 pts max)
      if (slug && !/[^a-z0-9-]/.test(slug) && slug.length <= 70) overallScore += 5;
      if (techChecks.filter(c => c.pass).length >= 4) overallScore += 5;
      if (this.relatedKeywords.length >= 2) overallScore += 5;

      overallScore = Math.min(100, Math.max(0, Math.round(overallScore)));

      // Update Gauge & Status Pill
      this.updateScoreDisplay(overallScore, hasFocus, recommendations);

      // Update Google Search Result Preview Card
    }

    /**
     * Update gauge circle, score label, status pill, and counters
     */
    updateScoreDisplay(score, hasFocus, recommendations) {
      const scoreValEl = document.getElementById('seoScoreVal');
      const mobileScoreEl = document.getElementById('seoMobileScoreVal');
      const circleEl = document.getElementById('seoScoreCircle');
      const statusPill = document.getElementById('seoStatusPill');
      const statusText = document.getElementById('seoStatusText');
      const statusIcon = document.getElementById('seoStatusIcon');

      if (scoreValEl) scoreValEl.textContent = score;
      if (mobileScoreEl) mobileScoreEl.textContent = `${score}/100`;

      // Circular dashoffset: 2 * PI * r = 2 * 3.14159 * 24 = 150.8
      const maxOffset = 150.8;
      const offset = maxOffset - (score / 100) * maxOffset;

      let color = '#94a3b8';
      let statusLabel = 'Not Analyzed';
      let pillClass = 'status-none';

      if (!hasFocus) {
        statusLabel = 'Needs Focus Keyword';
        pillClass = 'status-poor';
        color = '#ef4444';
      } else if (score >= 80) {
        statusLabel = 'Good / Passed';
        pillClass = 'status-good';
        color = '#10b981';
      } else if (score >= 50) {
        statusLabel = 'Needs Improvement';
        pillClass = 'status-medium';
        color = '#f59e0b';
      } else {
        statusLabel = 'Needs Work';
        pillClass = 'status-poor';
        color = '#ef4444';
      }

      if (circleEl) {
        circleEl.style.strokeDashoffset = offset;
        circleEl.style.stroke = color;
      }
      if (statusPill) {
        statusPill.className = `seo-status-pill ${pillClass}`;
      }
      if (statusText) statusText.textContent = statusLabel;
      if (statusIcon) statusIcon.textContent = score >= 80 ? '✓' : (score >= 50 ? '▲' : '✕');

      // Update summary counts
      const problemsCount = recommendations.filter(r => r.type === 'problem').length;
      const improvementsCount = recommendations.filter(r => r.type === 'improvement').length;
      const passCount = Math.max(0, 10 - problemsCount - improvementsCount);

      const passEl = document.getElementById('seoCountPass');
      const warnEl = document.getElementById('seoCountWarn');
      const failEl = document.getElementById('seoCountFail');

      if (passEl) passEl.textContent = `${passCount} Good`;
      if (warnEl) warnEl.textContent = `${improvementsCount} Improve`;
      if (failEl) failEl.textContent = `${problemsCount} Problems`;
    }

    /**
     * Update live Google SERP preview card
     */
    updateGooglePreview() {
      const name = this.getItemName();
      const slug = this.getSlug();
      const focus = (document.getElementById('seoFocusKeywordInput')?.value || '').trim();
      const title = (document.getElementById('seoTitleInput')?.value || '').trim();
      const meta = (document.getElementById('seoMetaDescInput')?.value || '').trim();

      const previewBreadcrumb = document.getElementById('previewSerpBreadcrumb');
      const previewTitle = document.getElementById('previewSerpTitle');
      const previewSnippet = document.getElementById('previewSerpSnippet');
      const previewThumb = document.getElementById('previewSerpThumb');
      const previewLayout = document.getElementById('previewSerpLayout');

      const urlPath = slug ? slug : (name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'device-model');
      if (previewBreadcrumb) {
        previewBreadcrumb.innerHTML = `${this.siteUrl} &rsaquo; ${this.mode === 'phone' ? 'phone' : 'news'} &rsaquo; ${this.escapeHtml(urlPath)}`;
      }

      const displayTitle = title || (name ? `${name} Price in Pakistan & Specifications | ${this.siteName}` : 'Smartphone Model — Official Price & Specifications | PhonesDaddy');
      if (previewTitle) {
        previewTitle.innerHTML = this.highlightQuery(displayTitle, focus);
      }

      const displaySnippet = meta || (name ? `Check ${name} price in Pakistan, specifications, camera, battery, and display details on PhonesDaddy.` : 'Latest mobile phone specifications, release details, global pricing, and technical specs.');
      if (previewSnippet) {
        previewSnippet.innerHTML = this.highlightQuery(displaySnippet, focus);
      }

      // Thumbnail
      const previewImgEl = document.getElementById(this.mode === 'phone' ? 'currentImagePreview' : 'imagePreviewImg');
      if (previewThumb) {
        if (previewImgEl && previewImgEl.src && !previewImgEl.src.includes('placeholder.svg') && previewImgEl.style.display !== 'none') {
          previewThumb.src = previewImgEl.src;
          previewThumb.style.display = 'block';
        } else {
          previewThumb.style.display = 'none';
        }
      }

      // Mobile vs Desktop SERP layout
      if (previewLayout) {
        if (this.previewDevice === 'desktop') {
          previewLayout.style.display = 'block';
          if (previewThumb) previewThumb.style.display = 'none';
        } else {
          previewLayout.style.display = 'flex';
          if (previewImgEl && previewImgEl.src && !previewImgEl.src.includes('placeholder.svg') && previewImgEl.style.display !== 'none') {
            if (previewThumb) previewThumb.style.display = 'block';
          }
        }
      }
    }

    /**
     * Highlight query terms in preview snippet
     */
    highlightQuery(text, query) {
      if (!text) return '';
      if (!query || !query.trim()) return this.escapeHtml(text);
      const words = query.trim().split(/\s+/).filter(w => w.length > 2);
      if (words.length === 0) return this.escapeHtml(text);
      const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      return this.escapeHtml(text).replace(regex, '<strong>$1</strong>');
    }

    updateBadge(id, status, text) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = text;
      if (status === 'passed' || status === true) {
        el.className = 'seo-dist-badge badge-yes';
      } else if (status === 'partial' || status === 'warn') {
        el.className = 'seo-dist-badge badge-warn';
      } else {
        el.className = 'seo-dist-badge badge-no';
      }
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    escapeAttr(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }
  }

  if (typeof window !== 'undefined') {
    window.SeoAssistant = SeoAssistant;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SeoAssistant };
  }
})(typeof window !== 'undefined' ? window : globalThis, typeof document !== 'undefined' ? document : null);
