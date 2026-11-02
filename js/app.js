/**
 * Interactive Learning Platform Application (HTML/CSS/JS)
 * Graphic Design & Photo Editing - Basic Adobe Photoshop 2022
 * Regional Polytechnic Institute Techo Sen Siem Reap (RPITSSR)
 */

(function () {
  'use strict';

  // State Management
  const state = {
    currentLessonId: 'lesson-01',
    currentView: 'lesson', // 'lesson', 'home', 'preface', 'intro', 'references'
    completedLessons: new Set(),
    theme: 'light',
    fontScale: 1, // 0.92, 1, 1.15
    searchQuery: '',
    lightboxImg: null,
    lightboxZoom: 1,
    mobileSidebarOpen: false,
    sidebarCollapsed: false
  };

  // DOM Elements cache
  const el = {};

  // Khmer numerals for lesson / page / count labels
  const KH_DIGITS = '០១២៣៤៥៦៧៨៩';
  function kh(value) {
    return String(value).replace(/[0-9]/g, d => KH_DIGITS[d]);
  }

  // Study duration label matching the official 45-hour Course Outline (1 ពេល = 90 នាទី)
  function studyTimeLabel(lesson) {
    if (!lesson) return '';
    if (lesson.isAppendix) {
      if (lesson.id === 'lesson-17') return 'កម្រងចម្លើយផ្លូវការ';
      return 'ឯកសារយោងជំនួយ';
    }
    if (lesson.durationLabel) return lesson.durationLabel;
    if (lesson.sessions) {
      if (lesson.sessions === 1) return `${kh(1)} ពេល (៩០ នាទី)`;
      if (lesson.sessions === 3) return `${kh(3)} ពេល (៤ ម៉ោង ៣០ នាទី)`;
      return `${kh(lesson.sessions)} ពេល (${kh(lesson.hours || (lesson.sessions * 1.5))} ម៉ោង)`;
    }
    return 'ឯកសារយោងជំនួយ';
  }

  // Table cells helper
  function cellText(c) {
    return typeof c === 'string' ? c : (c && c.text) || '';
  }
  function tableCell(tag, c) {
    const span = c && typeof c === 'object' && c.colspan > 1 ? ` colspan="${c.colspan}"` : '';
    return `<${tag}${span}>${formatInlineContent(cellText(c))}</${tag}>`;
  }

  function completeButtonInner(isDone) {
    return isDone
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> បានរៀនរួច`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> សម្គាល់ថាបានរៀន`;
  }

  // Scroll the sidebar so the active item is visible
  function scrollSidebarToActive() {
    const active = el.sidebar && el.sidebar.querySelector('.lesson-nav-btn.active, .nav-item-link.active');
    if (!active) return;
    let box = active.parentElement;
    while (box && box !== document.body) {
      const oy = getComputedStyle(box).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && box.scrollHeight > box.clientHeight) break;
      box = box.parentElement;
    }
    if (!box || box === document.body) return;
    const a = active.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    box.scrollTop += (a.top - b.top) - (b.height / 2) + (a.height / 2);
  }

  function applyPlatformShortcutHint() {
    const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
    const key = document.getElementById('searchShortcutModKey');
    if (key && isApple) key.textContent = '⌘';
  }

  function init() {
    cacheDom();
    applyPlatformShortcutHint();
    loadPreferences();
    bindEvents();
    renderSidebar();
    handleRoute();
    updateProgressTracker();
    registerServiceWorker();
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('Photoshop 2022 ServiceWorker active for offline study:', reg.scope);
        }).catch((err) => {
          console.log('ServiceWorker note:', err);
        });
      });
    }
  }

  function cacheDom() {
    el.html = document.documentElement;
    el.themeToggleBtn = document.getElementById('themeToggleBtn');
    el.themeIcon = document.getElementById('themeIcon');
    el.btnFontDec = document.getElementById('btnFontDec');
    el.btnFontReset = document.getElementById('btnFontReset');
    el.btnFontInc = document.getElementById('btnFontInc');
    el.mobileSearchBtn = document.getElementById('mobileSearchBtn');
    el.sidebar = document.getElementById('sidebar');
    el.sidebarToggleBtn = document.getElementById('sidebarToggleBtn') || document.getElementById('mobileMenuBtn');
    el.sidebarMinimizeBtn = document.getElementById('sidebarMinimizeBtn');
    el.floatingSidebarBtn = document.getElementById('floatingSidebarBtn');
    el.appContainer = document.querySelector('.app-container');
    el.mainContent = document.getElementById('mainContent');
    el.searchTriggerBtn = document.getElementById('searchTriggerBtn');
    el.searchModal = document.getElementById('searchModal');
    el.searchInput = document.getElementById('searchInput');
    el.searchResults = document.getElementById('searchResults');
    el.closeSearchBtn = document.getElementById('closeSearchBtn');
    el.lightboxModal = document.getElementById('lightboxModal');
    el.lightboxImage = document.getElementById('lightboxImage');
    el.lightboxCaption = document.getElementById('lightboxCaption');
    el.closeLightboxBtn = document.getElementById('closeLightboxBtn');
    el.progressFill = document.getElementById('progressFill');
    el.progressText = document.getElementById('progressText');
    el.toastContainer = document.getElementById('toastContainer');
    el.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    el.mbarMenuBtn = document.getElementById('mbarMenuBtn');
    el.mbarPrevBtn = document.getElementById('mbarPrevBtn');
    el.mbarNextBtn = document.getElementById('mbarNextBtn');
    el.mbarSearchBtn = document.getElementById('mbarSearchBtn');
    el.mbarTopBtn = document.getElementById('mbarTopBtn');
  }

  function loadPreferences() {
    // Theme
    const savedTheme = localStorage.getItem('rpitssr_theme');
    if (savedTheme) {
      state.theme = savedTheme;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      state.theme = 'dark';
    } else {
      state.theme = 'light';
    }
    applyTheme(state.theme);

    // Sidebar Collapsed Preference (Desktop)
    const savedCollapsed = localStorage.getItem('rpitssr_sidebar_collapsed');
    if (savedCollapsed === 'true' && window.innerWidth > 768) {
      setSidebarCollapsed(true, false);
    }

    // Font Scale
    const savedScale = localStorage.getItem('rpitssr_font_scale');
    if (savedScale) {
      applyFontScale(parseFloat(savedScale));
    } else {
      applyFontScale(1);
    }

    // Completed Lessons
    try {
      const savedCompleted = JSON.parse(localStorage.getItem('rpitssr_completed_lessons') || '[]');
      state.completedLessons = new Set(savedCompleted);
    } catch (e) {
      state.completedLessons = new Set();
    }
  }

  function applyFontScale(scale) {
    state.fontScale = scale;
    el.html.style.setProperty('--font-scale', scale);
    localStorage.setItem('rpitssr_font_scale', scale);
    if (el.btnFontDec && el.btnFontReset && el.btnFontInc) {
      el.btnFontDec.classList.toggle('active', scale < 0.98);
      el.btnFontReset.classList.toggle('active', Math.abs(scale - 1) < 0.05);
      el.btnFontInc.classList.toggle('active', scale > 1.05);
    }
  }

  function applyTheme(theme) {
    state.theme = theme;
    el.html.setAttribute('data-theme', theme);
    localStorage.setItem('rpitssr_theme', theme);
    if (el.themeIcon) {
      if (theme === 'dark') {
        el.themeIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`;
      } else {
        el.themeIcon.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      }
    }
  }

  function toggleTheme() {
    applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  }

  function setMobileSidebar(open) {
    state.mobileSidebarOpen = open;
    if (el.sidebar) el.sidebar.classList.toggle('mobile-open', open);
    if (el.sidebarBackdrop) el.sidebarBackdrop.classList.toggle('active', open);
    document.body.style.overflow = (open && window.innerWidth <= 768) ? 'hidden' : '';
    if (open) requestAnimationFrame(scrollSidebarToActive);
  }

  function setSidebarCollapsed(collapsed, save = true) {
    state.sidebarCollapsed = collapsed;
    if (el.appContainer) {
      el.appContainer.classList.toggle('sidebar-collapsed', collapsed);
    }
    if (el.sidebarToggleBtn) {
      el.sidebarToggleBtn.classList.toggle('collapsed', collapsed);
      el.sidebarToggleBtn.setAttribute('title', collapsed ? 'ពង្រីកផ្ទាំងមាតិកា (Expand Sidebar)' : 'បង្រួញផ្ទាំងមាតិកា (Minimize Sidebar)');
    }
    if (el.floatingSidebarBtn) {
      el.floatingSidebarBtn.style.display = (collapsed && window.innerWidth > 768) ? 'inline-flex' : 'none';
    }
    if (save) {
      localStorage.setItem('rpitssr_sidebar_collapsed', collapsed ? 'true' : 'false');
    }
  }

  function toggleSidebar() {
    if (window.innerWidth <= 768) {
      setMobileSidebar(!state.mobileSidebarOpen);
    } else {
      setSidebarCollapsed(!state.sidebarCollapsed);
    }
  }

  function bindEvents() {
    if (el.themeToggleBtn) el.themeToggleBtn.addEventListener('click', toggleTheme);
    if (el.btnFontDec) el.btnFontDec.addEventListener('click', () => applyFontScale(0.92));
    if (el.btnFontReset) el.btnFontReset.addEventListener('click', () => applyFontScale(1));
    if (el.btnFontInc) el.btnFontInc.addEventListener('click', () => applyFontScale(1.15));

    if (el.sidebarToggleBtn) el.sidebarToggleBtn.addEventListener('click', toggleSidebar);
    if (el.floatingSidebarBtn) {
      el.floatingSidebarBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) setMobileSidebar(true);
        else setSidebarCollapsed(false);
      });
    }
    if (el.sidebarBackdrop) {
      el.sidebarBackdrop.addEventListener('click', () => setMobileSidebar(false));
    }

    document.addEventListener('click', (e) => {
      if (e.target.closest('#sidebarMinimizeBtn')) {
        if (window.innerWidth <= 768) setMobileSidebar(false);
        else setSidebarCollapsed(true);
      }
      if (e.target.closest('#sidebarMobileCloseBtn') || (e.target.closest('#sidebar a') && window.innerWidth <= 768)) {
        setMobileSidebar(false);
      }
    });

    if (el.mbarMenuBtn) el.mbarMenuBtn.addEventListener('click', () => setMobileSidebar(true));
    if (el.mbarSearchBtn) el.mbarSearchBtn.addEventListener('click', openSearchModal);
    if (el.mbarTopBtn) el.mbarTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    if (el.mbarPrevBtn) el.mbarPrevBtn.addEventListener('click', navigatePrevLesson);
    if (el.mbarNextBtn) el.mbarNextBtn.addEventListener('click', navigateNextLesson);

    window.addEventListener('hashchange', handleRoute);

    if (el.searchTriggerBtn) el.searchTriggerBtn.addEventListener('click', openSearchModal);
    if (el.mobileSearchBtn) el.mobileSearchBtn.addEventListener('click', openSearchModal);
    if (el.closeSearchBtn) el.closeSearchBtn.addEventListener('click', closeSearchModal);
    if (el.searchModal) {
      el.searchModal.addEventListener('click', (e) => {
        if (e.target === el.searchModal) closeSearchModal();
      });
    }
    if (el.searchInput) {
      el.searchInput.addEventListener('input', (e) => {
        performSearch(e.target.value.trim());
      });
    }

    document.addEventListener('keydown', (e) => {
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== el.searchInput)) {
        e.preventDefault();
        openSearchModal();
      } else if (e.key === 'Escape') {
        closeSearchModal();
        closeLightbox();
      }
    });

    if (el.closeLightboxBtn) el.closeLightboxBtn.addEventListener('click', closeLightbox);
    if (el.lightboxModal) {
      el.lightboxModal.addEventListener('click', (e) => {
        if (e.target === el.lightboxModal) closeLightbox();
      });
    }
  }

  function navigatePrevLesson() {
    const data = window.COURSE_DATA;
    if (!data || !data.lessons) return;
    const currentId = window.location.hash.replace('#', '') || 'home';
    if (currentId === 'references') {
      window.location.hash = `#${data.lessons[data.lessons.length - 1].id}`;
      return;
    }
    const idx = data.lessons.findIndex(l => l.id === currentId);
    if (idx > 0) {
      window.location.hash = `#${data.lessons[idx - 1].id}`;
    } else if (idx === 0) {
      window.location.hash = '#intro';
    } else if (currentId === 'intro') {
      window.location.hash = '#preface';
    } else if (currentId === 'preface') {
      window.location.hash = '#home';
    }
  }

  function navigateNextLesson() {
    const data = window.COURSE_DATA;
    if (!data || !data.lessons) return;
    const currentId = window.location.hash.replace('#', '') || 'home';
    if (currentId === 'home') {
      window.location.hash = '#preface';
    } else if (currentId === 'preface') {
      window.location.hash = '#intro';
    } else if (currentId === 'intro') {
      window.location.hash = `#${data.lessons[0].id}`;
    } else {
      const idx = data.lessons.findIndex(l => l.id === currentId);
      if (idx !== -1) {
        if (idx < data.lessons.length - 1) {
          window.location.hash = `#${data.lessons[idx + 1].id}`;
        } else if (idx === data.lessons.length - 1) {
          window.location.hash = '#references';
        }
      }
    }
  }

  function handleRoute() {
    const hash = window.location.hash.replace('#', '') || 'home';

    state.mobileSidebarOpen = false;
    if (el.sidebar) el.sidebar.classList.remove('mobile-open');
    if (el.sidebarBackdrop) el.sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';

    if (hash === 'home') {
      state.currentView = 'home';
      renderHomeView();
    } else if (hash === 'preface') {
      state.currentView = 'preface';
      renderPrefaceView();
    } else if (hash === 'intro') {
      state.currentView = 'intro';
      renderIntroView();
    } else if (hash === 'references') {
      state.currentView = 'references';
      renderReferencesView();
    } else if (hash.startsWith('lesson-')) {
      state.currentView = 'lesson';
      state.currentLessonId = hash;
      renderLessonView(hash);
    } else {
      state.currentView = 'home';
      renderHomeView();
    }

    updateActiveSidebarItem();
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  // Sidebar Rendering - 100% Faithful to Word Document TOC
  function renderSidebar() {
    const data = window.COURSE_DATA;
    if (!data) return;

    const coreLessons = data.lessons.filter(l => !l.isAppendix);
    const appendices = data.lessons.filter(l => l.isAppendix);

    let html = `
      <div class="sidebar-mobile-header">
        <div class="sidebar-mobile-title">
          <img src="images/logo.webp" alt="Logo" style="width:24px; height:24px; object-fit:contain;">
          <span>មាតិកាសៀវភៅ (${kh(coreLessons.length)} មេរៀន + ${kh(appendices.length)} ឧបសម្ព័ន្ធ)</span>
        </div>
        <button class="sidebar-mobile-close-btn" id="sidebarMobileCloseBtn" aria-label="បិទមាតិកា">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div class="sidebar-content">
        <div>
          <div class="sidebar-header-row">
            <div class="sidebar-section-title">ព័ត៌មានទូទៅ</div>
            <button class="sidebar-minimize-btn" id="sidebarMinimizeBtn" title="បង្រួញផ្ទាំងមាតិកា (Minimize Sidebar)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="11 19 4 12 11 5"></polyline><polyline points="18 19 11 12 18 5"></polyline></svg>
            </button>
          </div>
          <a href="#home" class="nav-item-link" id="nav-home">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            ទំព័រដើម & ក្របសៀវភៅ
          </a>
          <a href="#preface" class="nav-item-link" id="nav-preface">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            អារម្ភកថា (Preface)
          </a>
          <a href="#intro" class="nav-item-link" id="nav-intro">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            សេចក្តីផ្តើមនៃមុខវិជ្ជា
          </a>
        </div>

        <div>
          <div class="sidebar-section-title">មាតិកាមេរៀន (${kh(coreLessons.length)} មេរៀន)</div>
    `;

    coreLessons.forEach(les => {
      const isDone = state.completedLessons.has(les.id);
      const hasSections = les.sections && les.sections.length > 0;
      html += `
        <div class="lesson-accordion" id="acc-${les.id}">
          <div class="lesson-nav-btn" id="nav-${les.id}">
            <a href="#${les.id}" class="lesson-nav-left" style="text-decoration:none; color:inherit;">
              <span class="lesson-pill-num">${kh(String(les.number).padStart(2, '0'))}</span>
              <span class="lesson-nav-title">${les.title}</span>
            </a>
            ${hasSections ? `
            <button class="lesson-expand-btn" onclick="window.toggleLessonSubsections('${les.id}', event)" title="បង្ហាញចំណុចរង">
              <svg class="lesson-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>` : ''}
            <div class="lesson-status-check ${isDone ? 'completed' : ''}" 
                 onclick="window.toggleLessonComplete('${les.id}', event)"
                 title="${isDone ? 'បានរៀនរួច' : 'ចុចដើម្បីសម្គាល់ថារៀនរួច'}">
              ${isDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </div>
          </div>
          ${hasSections ? `
          <ul class="lesson-subsections-list">
            ${les.sections.map((sec, sIdx) => `
              <li>
                <a href="#${les.id}" onclick="window.jumpToResult('${les.id}', ${sIdx})" class="lesson-sub-link" title="${escapeHtml(sec.title)}">
                  ${formatInlineContent(sec.title)}
                </a>
              </li>
            `).join('')}
          </ul>` : ''}
        </div>
      `;
    });

    html += `
        </div>

        <div>
          <div class="sidebar-section-title">ឧបសម្ព័ន្ធ (${kh(appendices.length)} ឧបសម្ព័ន្ធ)</div>
    `;

    appendices.forEach(app => {
      const isDone = state.completedLessons.has(app.id);
      html += `
        <div class="lesson-nav-btn" id="nav-${app.id}">
          <a href="#${app.id}" class="lesson-nav-left" style="text-decoration:none; color:inherit;">
            <span class="lesson-pill-num" style="color:#7c3aed; border-color:rgba(124, 58, 237, 0.35);">ឧប.${kh(app.appendixNum)}</span>
            <span class="lesson-nav-title">${app.title}</span>
          </a>
          <div class="lesson-status-check ${isDone ? 'completed' : ''}" 
               onclick="window.toggleLessonComplete('${app.id}', event)"
               title="${isDone ? 'បានរៀនរួច' : 'ចុចដើម្បីសម្គាល់ថារៀនរួច'}">
            ${isDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </div>
        </div>
      `;
    });

    html += `
        </div>

        <div>
          <div class="sidebar-section-title">ឯកសារ & ឥណទាន</div>
          <a href="#references" class="nav-item-link" id="nav-references">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            ឯកសារយោង & ឥណទាន
          </a>
        </div>
      </div>
    `;

    el.sidebar.innerHTML = html;
  }

  window.toggleLessonSubsections = function (lessonId, e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const acc = document.getElementById(`acc-${lessonId}`);
    if (acc) {
      acc.classList.toggle('open');
    }
  };

  window.toggleLessonComplete = function (lessonId, e) {
    if (e) e.stopPropagation();
    const isNowDone = !state.completedLessons.has(lessonId);
    if (isNowDone) {
      state.completedLessons.add(lessonId);
      showToast('អបអរសាទរ! បានសម្គាល់ថារៀនចប់មេរៀននេះ');
    } else {
      state.completedLessons.delete(lessonId);
      showToast('បានដកចេញពីបញ្ជីរៀនរួច');
    }
    localStorage.setItem('rpitssr_completed_lessons', JSON.stringify(Array.from(state.completedLessons)));

    const navBtn = document.getElementById(`nav-${lessonId}`);
    if (navBtn) {
      const check = navBtn.querySelector('.lesson-status-check');
      if (check) {
        check.classList.toggle('completed', isNowDone);
        check.setAttribute('title', isNowDone ? 'បានរៀនរួច' : 'ចុចដើម្បីសម្គាល់ថារៀនរួច');
        check.innerHTML = isNowDone ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : '';
      }
    }

    updateActiveSidebarItem();
    updateProgressTracker();

    if (state.currentLessonId === lessonId) {
      ['btnHeaderComplete', 'btnFooterComplete'].forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.toggle('completed', isNowDone);
        btn.innerHTML = completeButtonInner(isNowDone);
      });
    }
  };

  function updateActiveSidebarItem() {
    document.querySelectorAll('.nav-item-link, .lesson-nav-btn').forEach(btn => btn.classList.remove('active'));

    if (state.currentView === 'home') {
      const b = document.getElementById('nav-home');
      if (b) b.classList.add('active');
    } else if (state.currentView === 'preface') {
      const b = document.getElementById('nav-preface');
      if (b) b.classList.add('active');
    } else if (state.currentView === 'intro') {
      const b = document.getElementById('nav-intro');
      if (b) b.classList.add('active');
    } else if (state.currentView === 'references') {
      const b = document.getElementById('nav-references');
      if (b) b.classList.add('active');
    } else if (state.currentView === 'lesson') {
      const b = document.getElementById(`nav-${state.currentLessonId}`);
      if (b) b.classList.add('active');

      document.querySelectorAll('.lesson-accordion').forEach(acc => {
        acc.classList.toggle('open', acc.id === `acc-${state.currentLessonId}`);
      });
    }
    requestAnimationFrame(scrollSidebarToActive);
  }

  function updateProgressTracker() {
    const lessons = (window.COURSE_DATA && window.COURSE_DATA.lessons) || [];
    const total = lessons.length || 1;
    const completed = lessons.filter(l => state.completedLessons.has(l.id)).length;
    const percent = Math.round((completed / total) * 100);

    if (el.progressFill) {
      el.progressFill.style.width = `${percent}%`;
    }
    if (el.progressText) {
      el.progressText.textContent = `${kh(completed)}/${kh(total)} (${kh(percent)}%)`;
    }
  }

  // Quiz Interaction Handlers
  window.checkQuizAnswer = function (btn, correctKey, selectedKey) {
    const card = btn.closest('.quiz-card');
    if (!card) return;
    const allBtns = card.querySelectorAll('.quiz-opt-btn');
    allBtns.forEach(b => {
      b.disabled = true;
      const optBadge = b.querySelector('.quiz-opt-badge');
      const key = optBadge ? optBadge.textContent.trim() : '';
      if (key === correctKey) {
        b.classList.add('correct');
        const icon = b.querySelector('.quiz-opt-icon');
        if (icon) icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';
      }
    });

    if (selectedKey === correctKey) {
      showToast('ចម្លើយត្រឹមត្រូវ! (Correct answer)');
    } else {
      btn.classList.add('wrong');
      const icon = btn.querySelector('.quiz-opt-icon');
      if (icon) icon.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
      showToast('ចម្លើយមិនទាន់ត្រឹមត្រូវទេ! (Incorrect, see correct option)');
    }

    const ansBox = card.querySelector('.quiz-answer-box');
    if (ansBox) ansBox.style.display = 'block';
  };

  window.toggleQuizAnswer = function (btnId, ansBoxId) {
    const box = document.getElementById(ansBoxId);
    const btn = document.getElementById(btnId);
    if (!box || !btn) return;
    const isHidden = box.style.display === 'none';
    box.style.display = isHidden ? 'block' : 'none';
    btn.innerHTML = isHidden
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg> លាក់ចម្លើយ'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg> បង្ហាញចម្លើយត្រឹមត្រូវ';
  };

  // Render Lesson View
  function renderLessonView(lessonId) {
    const data = window.COURSE_DATA;
    if (!data) return;

    const lesson = data.lessons.find(l => l.id === lessonId);
    if (!lesson) {
      el.mainContent.innerHTML = `<div class="empty-state-card">រកមិនឃើញមេរៀននេះទេ</div>`;
      return;
    }

    const isCompleted = state.completedLessons.has(lesson.id);
    const isApp = !!lesson.isAppendix;
    const categoryName = isApp ? 'ឧបសម្ព័ន្ធ' : 'មាតិកាមេរៀន';

    // Find Prev and Next Lessons
    const currentIndex = data.lessons.findIndex(l => l.id === lessonId);
    const prevLesson = currentIndex > 0 ? data.lessons[currentIndex - 1] : null;
    const nextLesson = currentIndex < data.lessons.length - 1 ? data.lessons[currentIndex + 1] : null;

    let html = `
      <!-- Breadcrumb -->
      <nav class="breadcrumb-bar">
        <a href="#home" class="breadcrumb-item">ទំព័រដើម</a>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item">${categoryName}</span>
        <span class="breadcrumb-separator">/</span>
        <span class="breadcrumb-item" style="color:var(--text-main); font-weight:600;">${lesson.label}</span>
      </nav>

      <!-- Lesson Header Card -->
      <header class="lesson-header-card">
        <div class="lesson-header-top">
          <div class="lesson-meta-tags">
            <span class="tag-badge" style="color:${isApp ? '#7c3aed' : 'var(--primary)'}; font-weight:700;">
              ${isApp ? 'ឧបសម្ព័ន្ធ' : 'មេរៀនគ្រឹះទី ' + kh(lesson.number)}
            </span>
            <span class="tag-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              ទំព័រ ${kh(lesson.pageStart)} ដល់ ${kh(lesson.pageEnd)}
            </span>
          </div>

          <button class="btn-complete-toggle ${isCompleted ? 'completed' : ''}" id="btnHeaderComplete" onclick="window.toggleLessonComplete('${lesson.id}')">
            ${completeButtonInner(isCompleted)}
          </button>
        </div>

        <h1 class="lesson-header-title">${lesson.fullTitle}</h1>

        <div class="lesson-action-bar">
          <span style="font-size:0.85rem; color:var(--text-muted); display:flex; align-items:center; gap:0.4rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            ${lesson.sessionRange ? `កាលវិភាគ៖ <strong>${lesson.sessionRange}</strong> • ${studyTimeLabel(lesson)}` : (lesson.isAppendix ? `ប្រភេទឯកសារ៖ <strong>${studyTimeLabel(lesson)}</strong>` : `រយៈពេលសិក្សា៖ ${studyTimeLabel(lesson)}`)}
          </span>
          <button class="btn-copy-formula" onclick="window.print()" style="margin-left:auto;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline; margin-right:4px;"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
            បោះពុម្ពមេរៀន (Print)
          </button>
        </div>
      </header>
    `;

    // Objectives Box if present
    if (lesson.objectives && lesson.objectives.length > 0) {
      html += `
        <div class="objectives-card">
          <div class="objectives-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            គោលបំណងនៃមេរៀន (Learning Objectives)
          </div>
          <ul class="objectives-list">
      `;
      lesson.objectives.forEach(obj => {
        html += `
          <li class="objective-item">
            <svg class="objective-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${obj}</span>
          </li>
        `;
      });
      html += `
          </ul>
        </div>
      `;
    }

    // Sections Rendering
    lesson.sections.forEach((sec, sIdx) => {
      html += `
        <article class="section-card" id="section-${sIdx}">
          <h2 class="section-heading">
            <span>${sec.title}</span>
            <a href="#section-${sIdx}" style="color:var(--text-subtle); text-decoration:none; font-size:1rem;" title="ចម្លងតំណភ្ជាប់">#</a>
          </h2>
          <div class="section-content">
      `;

      sec.items.forEach(item => {
        if (item.type === 'quiz') {
          html += `
            <div class="quiz-container">
              <div class="quiz-container-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                <span>${item.title}</span>
              </div>
          `;
          item.questions.forEach((q) => {
            const ansId = `ans-${lesson.id}-${q.number}`;
            const btnId = `btn-${lesson.id}-${q.number}`;
            html += `
              <div class="quiz-card" id="q-${lesson.id}-${q.number}">
                <div class="quiz-q-row">
                  <span class="quiz-q-num">${q.numberKh}</span>
                  <div class="quiz-q-text">${formatInlineContent(q.question)}</div>
                </div>
                <div class="quiz-options-list">
                  ${q.options.map(opt => `
                    <button type="button" class="quiz-opt-btn" onclick="window.checkQuizAnswer(this, '${escapeForJs(q.answer)}', '${escapeForJs(opt.key)}')">
                      <span class="quiz-opt-badge">${opt.key}</span>
                      <span class="quiz-opt-text">${formatInlineContent(opt.text)}</span>
                      <span class="quiz-opt-icon"></span>
                    </button>
                  `).join('')}
                </div>
                <div class="quiz-card-footer">
                  <button type="button" class="quiz-ans-toggle-btn" id="${btnId}" onclick="window.toggleQuizAnswer('${btnId}', '${ansId}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                    បង្ហាញចម្លើយត្រឹមត្រូវ
                  </button>
                  <div class="quiz-answer-box" id="${ansId}" style="display:none;">
                    ចម្លើយត្រឹមត្រូវ ៖ <strong>${escapeHtml(q.answer)}${q.answerNote ? ' (' + escapeHtml(q.answerNote) + ')' : ''}</strong>
                  </div>
                </div>
              </div>
            `;
          });
          html += `</div>`;
        } else if (item.type === 'short-questions') {
          html += `
            <div class="short-q-container">
              <div class="short-q-title">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>${item.title}</span>
              </div>
          `;
          item.questions.forEach((q) => {
            html += `
              <div class="short-q-item">
                <span class="short-q-num">${q.numberKh}</span>
                <div class="short-q-text">${formatInlineContent(q.question)}</div>
              </div>
            `;
          });
          html += `</div>`;
        } else if (item.type === 'subsection') {
          html += `<h3 class="subsection-heading">${formatInlineContent(item.title)}</h3>`;
        } else if (item.type === 'subtopic') {
          html += `<h4 class="subtopic-heading">${formatInlineContent(item.title)}</h4>`;
        } else if (item.type === 'table') {
          html += `
            <div class="table-container">
              ${item.title ? `<div class="table-header-title">${formatInlineContent(item.title)}</div>` : ''}
              <div style="overflow-x:auto;">
                <table class="data-table">
                  ${item.headers && item.headers.length ? `<thead><tr>${item.headers.map(h => tableCell('th', h)).join('')}</tr></thead>` : ''}
                  <tbody>
                    ${item.rows.map(r => `<tr>${r.map(c => tableCell('td', c)).join('')}</tr>`).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        } else if (item.type === 'paragraph') {
          html += `<p class="prose-text">${formatInlineContent(item.text)}</p>`;
        } else if (item.type === 'steps') {
          const validSteps = (item.steps || []).filter(st => {
            if (!st) return false;
            const cleaned = st.replace(/^(?:[០-៩\d]+\.|\-|\▪|\✓|\•|\*|\–|\s|\u200b|\u00a0)+/, '').trim();
            return cleaned.length > 0;
          });
          if (validSteps.length > 0) {
            html += `<div class="steps-container">`;
            validSteps.forEach((st, stepIdx) => {
              // Properly match both Khmer [០-៩] and ASCII [0-9] and letters without duplicating!
              const numMatch = st.match(/^([០-៩\d]+|[a-zA-Z])\.\s*([\s\S]*)$/);
              const stepNumber = numMatch ? numMatch[1] : (stepIdx + 1);
              const cleanStep = numMatch ? numMatch[2] : st.replace(/^([០-៩\d]+|[a-zA-Z])\.\s*/, '').replace(/^(?:\d+\.|\-|\▪|\✓|\•|\*|\–)\s*/, '');
              const trimmed = cleanStep.trim();
              if (trimmed.length > 0) {
                html += `
                  <div class="step-row">
                    <span class="step-number-pill">${kh(stepNumber)}</span>
                    <div>${formatInlineContent(trimmed)}</div>
                  </div>
                `;
              }
            });
            html += `</div>`;
          }
        } else if (item.type === 'bullets') {
          const validBullets = (item.items || []).filter(it => {
            if (!it) return false;
            const cleaned = it.replace(/^[\-\▪\✓\•\*\–\s\u200b\u00a0]+/, '').trim();
            return cleaned.length > 0;
          });
          if (validBullets.length > 0) {
            html += `<ul class="bullets-container">`;
            validBullets.forEach(it => {
              const cleanBullet = it.replace(/^[\-\▪\✓\•\*\–\s\u200b\u00a0]+/, '').trim();
              if (cleanBullet.length > 0) {
                html += `
                  <li class="bullet-row">
                    <span class="bullet-dot">•</span>
                    <div>${formatInlineContent(cleanBullet)}</div>
                  </li>
                `;
              }
            });
            html += `</ul>`;
          }
        } else if (item.type === 'callout') {
          const kind = item.kind || 'note';
          const icon = kind === 'tip'
            ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
            : (kind === 'warning'
              ? `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
              : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`);
          html += `
            <div class="callout-box ${kind}">
              <div class="callout-icon">${icon}</div>
              <div class="callout-content">
                ${formatInlineContent(item.text)}
              </div>
            </div>
          `;
        } else if (item.type === 'image') {
          html += `
            <figure class="image-card">
              <div class="image-wrapper" onclick="window.openLightbox('${item.src}', '${escapeForJs(item.caption || '')}')">
                <img class="content-screenshot" src="${item.src}" alt="${escapeHtml(item.caption || '')}" loading="lazy" />
                <div class="zoom-overlay-hint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  ចុចពង្រីក (Zoom)
                </div>
              </div>
              ${item.caption ? `<figcaption class="image-caption">${item.caption}</figcaption>` : ''}
            </figure>
          `;
        }
      });

      html += `
          </div>
        </article>
      `;
    });

    // Previous & Next Lesson Navigation
    const prevNav = prevLesson ? {
      url: '#' + prevLesson.id,
      title: prevLesson.fullTitle,
      badge: 'មុន'
    } : {
      url: '#intro',
      title: 'សេចក្តីផ្តើមនៃមុខវិជ្ជា',
      badge: 'មុន'
    };

    const nextNav = nextLesson ? {
      url: '#' + nextLesson.id,
      title: nextLesson.fullTitle,
      badge: 'បន្ទាប់'
    } : {
      url: '#references',
      title: 'ឯកសារយោង & ឥណទាន',
      badge: 'បន្ទាប់'
    };

    // End-of-lesson completion prompt
    html += `
      <div class="lesson-complete-card">
        <span class="lesson-complete-text">អានចប់${lesson.label} ហើយឬនៅ?</span>
        <button class="btn-complete-toggle ${isCompleted ? 'completed' : ''}" id="btnFooterComplete" onclick="window.toggleLessonComplete('${lesson.id}')">
          ${completeButtonInner(isCompleted)}
        </button>
      </div>
    `;

    html += renderNavigationFooter(prevNav, nextNav);
    el.mainContent.innerHTML = html;
  }

  // Home / Cover View - 14 Lessons + 4 Appendices
  function renderHomeView() {
    const data = window.COURSE_DATA;
    if (!data) return;

    const coreLessons = data.lessons.filter(l => !l.isAppendix);
    const appendices = data.lessons.filter(l => l.isAppendix);

    let html = `
      <div class="document-container">
        
        <!-- Hero Card -->
        <div class="home-hero-card">
          <div class="home-hero-content">
            <div style="display:inline-flex; align-items:center; gap:0.5rem; padding:0.35rem 0.85rem; background-color:var(--bg-surface); border:1px solid var(--border-color); border-radius:9999px; font-size:0.8rem; font-weight:700; color:var(--primary); margin-bottom:1rem;">
              <span style="width:8px; height:8px; border-radius:50%; background-color:#10b981;"></span>
              កាលវិភាគសិក្សា៖ ៤៥ ម៉ោង (៣០ ពេល • ១ ពេល = ៩០ នាទី)
            </div>

            <h1 style="font-size:clamp(1.6rem, 1.3rem + 1vw, 2.2rem); font-weight:800; line-height:1.45; color:var(--text-main); margin-bottom:0.75rem;">
              ${data.meta.titleKh}
            </h1>
            <p style="font-size:1.1rem; font-weight:600; color:var(--text-muted); margin-bottom:1.25rem;">
              ${data.meta.titleEn}
            </p>

            <div style="display:flex; flex-direction:column; gap:0.4rem; font-size:0.95rem; color:var(--text-muted); margin-bottom:1.75rem;">
              <div><strong>គ្រឹះស្ថាន៖</strong> ${data.meta.institutionKh}</div>
              <div><strong>រៀបចំដោយ៖</strong> ${data.meta.author}</div>
              <div><strong>ឆ្នាំបោះពុម្ព៖</strong> ឆ្នាំ${data.meta.year}</div>
            </div>

            <div style="display:flex; align-items:center; gap:1rem; flex-wrap:wrap;">
              <a href="#lesson-01" class="btn-complete-toggle" style="background-color:var(--primary); color:#ffffff; border-color:var(--primary); padding:0.75rem 1.5rem; font-size:1rem; text-decoration:none;">
                ចាប់ផ្តើមរៀនមេរៀនទី១
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </a>
              <a href="#preface" class="btn-complete-toggle" style="padding:0.75rem 1.25rem; font-size:1rem; text-decoration:none;">
                អានអារម្ភកថា
              </a>
            </div>
          </div>

          <div class="home-hero-logo">
            <img src="${data.meta.logoImage}" alt="RPITSSR Emblem" />
          </div>
        </div>

        <!-- 14 Core Lessons Grid -->
        <div>
          <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
            <h2 style="font-size:1.45rem; font-weight:700; margin:0; color:var(--text-main);">
              មាតិកាមេរៀនទាំង ${kh(coreLessons.length)} នៃមុខវិជ្ជា
            </h2>
            <span style="font-size:0.88rem; color:var(--text-muted); font-weight:600;">
              សរុប ១៤ មេរៀនគ្រឹះ
            </span>
          </div>

          <div class="home-lessons-grid">
    `;

    coreLessons.forEach((l) => {
      const isDone = state.completedLessons.has(l.id);
      html += `
        <a href="#${l.id}" class="home-lesson-card">
          <div>
            <div class="home-lesson-card-top">
              <span class="home-lesson-pill">${l.label}</span>
              <span class="home-lesson-pages">ទំព័រ ${kh(l.pageStart)} - ${kh(l.pageEnd)}</span>
            </div>
            <div class="home-lesson-title">${l.title}</div>
          </div>
          <div class="home-lesson-meta">
            <span>${kh(l.sections.length)} ចំណុចមេរៀន</span>
            <span style="margin: 0 0.35rem;">•</span>
            <span style="color:var(--primary); font-weight:600;">${studyTimeLabel(l)}</span>
            ${isDone ? '<span style="margin-left:auto; color:#10b981; font-weight:700; font-size:0.8rem;">✓ រៀនរួច</span>' : ''}
          </div>
        </a>
      `;
    });

    html += `
          </div>
        </div>

        <!-- 4 Appendices Grid -->
        <div style="margin-top:2rem;">
          <div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
            <h2 style="font-size:1.45rem; font-weight:700; margin:0; color:var(--text-main);">
              ឧបសម្ព័ន្ធជំនួយ (Course Appendices)
            </h2>
            <span style="font-size:0.88rem; color:#7c3aed; font-weight:600;">
              សរុប ${kh(appendices.length)} ឧបសម្ព័ន្ធ
            </span>
          </div>

          <div class="home-appendices-grid">
    `;

    appendices.forEach((app) => {
      const isDone = state.completedLessons.has(app.id);
      html += `
        <a href="#${app.id}" class="home-appendix-card">
          <div>
            <div class="home-lesson-card-top">
              <span class="home-appendix-pill">${app.label}</span>
              <span class="home-lesson-pages">ទំព័រ ${kh(app.pageStart)} - ${kh(app.pageEnd)}</span>
            </div>
            <div class="home-lesson-title">${app.title}</div>
          </div>
          <div class="home-lesson-meta" style="color:#7c3aed;">
            <span>${app.id === 'lesson-17' ? 'កម្រងចម្លើយផ្លូវការ' : (app.id === 'lesson-16' ? 'វចនានុក្រមបច្ចេកទេស' : 'តារាងផ្លូវកាត់ក្តារចុច')}</span>
            ${isDone ? '<span style="margin-left:auto; color:#10b981; font-weight:700; font-size:0.8rem;">✓ រៀនរួច</span>' : ''}
          </div>
        </a>
      `;
    });

    html += `
          </div>
        </div>

        <!-- Mobile Study & PWA Installation Guide -->
        <div class="install-guide-card" style="background-color:var(--bg-card); border:1px solid var(--border-color); border-radius:16px; padding:1.75rem; box-shadow:var(--shadow-sm); margin-top:1.5rem;">
          <div style="display:flex; align-items:center; gap:0.85rem; margin-bottom:1rem;">
            <div style="width:44px; height:44px; border-radius:12px; background:linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15)); display:flex; align-items:center; justify-content:center; color:var(--primary); flex-shrink:0;">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="3" ry="3"/>
                <path d="M12 18h.01"/>
                <path d="M9 10l3 3 3-3"/>
                <path d="M12 6v7"/>
              </svg>
            </div>
            <div>
              <h3 style="font-size:1.15rem; font-weight:700; color:var(--text-main); margin:0;">របៀបបើក និងរៀនលើទូរស័ព្ទដៃ (iOS & Android)</h3>
              <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">អាចរៀនបានគ្រប់ទីកន្លែង ទោះបីគ្មានអ៊ីនធឺណិត (Offline Mode)</p>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:1rem; margin-top:1.25rem;">
            <div style="padding:1.15rem; background-color:var(--bg-subtle); border-radius:12px; border:1px solid var(--border-color);">
              <div style="font-weight:700; font-size:1rem; color:var(--text-main); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
                <span style="width:28px; height:28px; border-radius:8px; background:var(--bg-card); border:1px solid var(--border-color); display:inline-flex; align-items:center; justify-content:center; color:var(--text-main); box-shadow:0 1px 2px rgba(0,0,0,0.05); flex-shrink:0;">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.61-.74 1.04-1.77.92-2.8-.9.04-2 .61-2.65 1.37-.58.67-.99 1.73-.85 2.75 1.01.08 1.98-.55 2.58-1.32z"/>
                  </svg>
                </span>
                <span>សម្រាប់ iPhone / iPad (iOS)</span>
              </div>
              <ol style="margin:0; padding-left:1.25rem; font-size:0.88rem; color:var(--text-body); line-height:1.75;">
                <li>បើកតាមកម្មវិធី <strong>Safari</strong> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; vertical-align:-2px; margin-left:2px;"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg></li>
                <li>ចុចប៊ូតុង <strong>Share</strong> (សញ្ញាព្រួញឡើងលើ) <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; vertical-align:-2px; margin-left:2px;"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></li>
                <li>ជ្រើសយក <strong>«Add to Home Screen»</strong> (បន្ថែមទៅអេក្រង់ដើម) <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; vertical-align:-2px; margin-left:2px;"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg></li>
                <li>វានឹងក្លាយជា App មួយនៅលើទូរស័ព្ទ ងាយស្រួលបើករៀនគ្រប់ពេល</li>
              </ol>
            </div>

            <div style="padding:1.15rem; background-color:var(--bg-subtle); border-radius:12px; border:1px solid var(--border-color);">
              <div style="font-weight:700; font-size:1rem; color:var(--text-main); margin-bottom:0.75rem; display:flex; align-items:center; gap:0.5rem;">
                <span style="width:28px; height:28px; border-radius:8px; background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); display:inline-flex; align-items:center; justify-content:center; color:#10b981; box-shadow:0 1px 2px rgba(16,185,129,0.08); flex-shrink:0;">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 18c0 .55.45 1 1 1h1v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h2v3.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5V19h1c.55 0 1-.45 1-1V8H6v10zM3.5 8C2.67 8 2 8.67 2 9.5v6c0 .83.67 1.5 1.5 1.5S5 16.33 5 15.5v-6C5 8.67 4.33 8 3.5 8zm17 0c-.83 0-1.5.67-1.5 1.5v6c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5v-6c0-.83-.67-1.5-1.5-1.5zm-4.97-4.84l1.3-1.3c.2-.2.2-.51 0-.71-.2-.2-.51-.2-.71 0l-1.48 1.48C13.85 2.23 12.95 2 12 2c-.96 0-1.86.23-2.66.63L7.85 1.15c-.2-.2-.51-.2-.71 0-.2.2-.2.51 0 .71l1.31 1.31C6.97 4.26 5.91 5.97 5.86 8h12.28c-.05-2.03-1.11-3.74-2.61-4.84zM9 6c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                  </svg>
                </span>
                <span>សម្រាប់ទូរស័ព្ទ Android</span>
              </div>
              <ol style="margin:0; padding-left:1.25rem; font-size:0.88rem; color:var(--text-body); line-height:1.75;">
                <li>បើកតាមកម្មវិធី <strong>Google Chrome</strong> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; vertical-align:-2px; margin-left:2px;"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/><line x1="10.88" y1="21.94" x2="15.46" y2="14"/></svg></li>
                <li>ចុចសញ្ញាចុចបី <strong>(⋮)</strong> នៅជ្រុងខាងស្តាំលើ <svg width="14" height="14" viewBox="0 0 24 24" fill="#10b981" style="display:inline; vertical-align:-2px; margin-left:2px;"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></li>
                <li>ជ្រើសយក <strong>«Install app»</strong> ឬ <strong>«Add to Home screen»</strong> (ដំឡើងកម្មវិធី) <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display:inline; vertical-align:-2px; margin-left:2px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></li>
                <li>កម្មវិធីនឹងដំឡើងចូលក្នុងទូរស័ព្ទ និងដំណើរការបានពេញលេញ</li>
              </ol>
            </div>
          </div>
        </div>

      </div>
    `;

    el.mainContent.innerHTML = html;
  }

  // Navigation Footer Helper
  function renderNavigationFooter(prev, next) {
    let prevHtml = '';
    if (prev) {
      prevHtml = `
        <a href="${prev.url}" class="nav-lesson-btn nav-prev" aria-label="${escapeHtml(prev.label || prev.title)}">
          <div class="nav-btn-icon-box">
            <svg class="nav-arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </div>
          <div class="nav-btn-content">
            <span class="nav-btn-meta">
              <span class="nav-btn-badge">${prev.badge || 'មុន'}</span>
            </span>
            <span class="nav-btn-title">${prev.title}</span>
          </div>
        </a>
      `;
    } else {
      prevHtml = '<div class="nav-lesson-empty"></div>';
    }

    let nextHtml = '';
    if (next) {
      nextHtml = `
        <a href="${next.url}" class="nav-lesson-btn nav-next" aria-label="${escapeHtml(next.label || next.title)}">
          <div class="nav-btn-content">
            <span class="nav-btn-meta">
              <span class="nav-btn-badge">${next.badge || 'បន្ទាប់'}</span>
            </span>
            <span class="nav-btn-title">${next.title}</span>
          </div>
          <div class="nav-btn-icon-box">
            <svg class="nav-arrow-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </div>
        </a>
      `;
    } else {
      nextHtml = '<div class="nav-lesson-empty"></div>';
    }

    return `
      <footer class="lesson-navigation-footer">
        ${prevHtml}
        ${nextHtml}
      </footer>
    `;
  }

  // Preface View
  function renderPrefaceView() {
    const data = window.COURSE_DATA;
    if (!data || !data.preface) return;

    let html = `
      <article class="section-card document-article">
        <h1 style="font-size:2rem; font-weight:800; color:var(--text-main); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border-color);">
          ${data.preface.title}
        </h1>
        <div style="display:flex; flex-direction:column; gap:1.25rem; font-size:1.025rem; line-height:1.85; text-align:justify;">
          ${data.preface.content.split('\n\n').map(p => `<p class="prose-text">${formatInlineContent(p)}</p>`).join('')}
        </div>

        <div style="margin-top:2.5rem; padding-top:1.5rem; border-top:1px solid var(--border-color); text-align:right;">
          <div style="font-size:0.95rem; color:var(--text-muted);">${data.preface.signOff.location}, ${data.preface.signOff.date}</div>
          ${data.preface.signOff.role ? `<div style="font-size:0.95rem; color:var(--text-muted); margin-top:0.35rem;">${data.preface.signOff.role}</div>` : ''}
          <div style="font-size:1.1rem; font-weight:700; color:var(--text-main); margin-top:0.35rem;">
            ${data.preface.signOff.author}
          </div>
        </div>
      </article>
    `;

    html += renderNavigationFooter(
      { url: '#home', title: 'ទំព័រដើម & ក្របសៀវភៅ', badge: 'មុន' },
      { url: '#intro', title: data.courseIntro ? data.courseIntro.title : 'សេចក្តីផ្តើមនៃមុខវិជ្ជា', badge: 'បន្ទាប់' }
    );

    el.mainContent.innerHTML = html;
  }

  // Intro View
  function renderIntroView() {
    const data = window.COURSE_DATA;
    if (!data || !data.courseIntro) return;

    let html = `
      <article class="section-card document-article">
        <h1 style="font-size:2rem; font-weight:800; color:var(--text-main); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border-color);">
          ${data.courseIntro.title}
        </h1>
        <div style="display:flex; flex-direction:column; gap:1.25rem; font-size:1.025rem; line-height:1.85; text-align:justify;">
          ${data.courseIntro.content.split('\n\n').map(p => p.startsWith('## ')
            ? `<h2 class="subsection-heading" style="margin-top:0.5rem;">${formatInlineContent(p.slice(3))}</h2>`
            : `<p class="prose-text">${formatInlineContent(p)}</p>`).join('')}
        </div>
      </article>
    `;

    const firstLesson = data.lessons && data.lessons.length > 0 ? data.lessons[0] : null;
    html += renderNavigationFooter(
      { url: '#preface', title: 'អារម្ភកថា (Preface)', badge: 'មុន' },
      firstLesson ? { url: `#${firstLesson.id}`, title: firstLesson.fullTitle, badge: 'មេរៀនបន្ទាប់' } : null
    );

    el.mainContent.innerHTML = html;
  }

  // References View
  function renderReferencesView() {
    const data = window.COURSE_DATA;
    if (!data) return;

    let html = `
      <article class="section-card document-article">
        <h1 style="font-size:2rem; font-weight:800; color:var(--text-main); margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:2px solid var(--border-color);">
          ឯកសារយោង & ឥណទាន (References & Credits)
        </h1>

        <div style="margin-bottom:2rem;">
          <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1rem; color:var(--primary);">
            ឯកសារពិគ្រោះ និងយោង (Reference Books)
          </h2>
          <div style="display:flex; flex-direction:column; gap:0.75rem;">
    `;

    data.references.forEach((ref, idx) => {
      html += `
        <div style="padding:1rem 1.25rem; background-color:var(--bg-subtle); border:1px solid var(--border-color); border-radius:10px;">
          <div style="font-weight:700; color:var(--text-main); font-size:1rem;">${kh(idx + 1)}. "${ref.title}" (${ref.year})</div>
          <div style="font-size:0.875rem; color:var(--text-muted); margin-top:0.25rem;">
            អ្នកនិពន្ធ៖ ${ref.author} | បោះពុម្ពផ្សាយដោយ៖ ${ref.publisher}
          </div>
        </div>
      `;
    });

    html += `
          </div>
        </div>

        <div style="margin-top:2.5rem; padding-top:1.5rem; border-top:1px solid var(--border-color);">
          <h2 style="font-size:1.25rem; font-weight:700; margin-bottom:1rem; color:var(--text-main);">
            គណៈកម្មការរៀបចំ និងកែសម្រួល
          </h2>
          <p class="prose-text" style="margin-bottom:1rem;">
            ឯកសារបង្រៀន និងវេទិកាសិក្សាឌីជីថលនេះ ត្រូវបានរៀបចំឡើង និងធ្វើបច្ចុប្បន្នភាពសម្រាប់កម្មវិធី Adobe Photoshop 2022 ដោយ៖
          </p>
          <div style="padding:1.25rem; background-color:var(--primary-light); border:1px solid var(--primary-border); border-radius:12px; font-size:1.1rem; font-weight:700; color:var(--primary);">
            ${data.meta.author}
            <div style="font-size:0.95rem; font-weight:500; color:var(--text-muted); margin-top:0.35rem;">
              ${data.meta.institutionKh} (${data.meta.institutionEn})
            </div>
          </div>
        </div>
      </article>
    `;

    const lastLesson = data.lessons && data.lessons.length > 0 ? data.lessons[data.lessons.length - 1] : null;
    html += renderNavigationFooter(
      lastLesson ? { url: `#${lastLesson.id}`, title: lastLesson.fullTitle, badge: 'មេរៀនមុន' } : null,
      { url: '#home', title: 'ទំព័រដើម & ក្របសៀវភៅ', badge: 'ត្រឡប់ទៅដើម' }
    );

    el.mainContent.innerHTML = html;
  }

  // Formatting Helpers
  function formatInlineContent(str) {
    if (!str) return '';

    const allowed = [];
    let clean = str.replace(/<\/?(?:strong|b|em|i)>/gi, function (match) {
      allowed.push(match);
      return '___SAFE_TAG_' + (allowed.length - 1) + '___';
    });

    clean = clean.replace(/<kbd[^>]*>(.*?)<\/kbd>/gi, '');
    clean = clean.replace(/<([A-Za-z0-9\+\s]+)>/g, '');
    let res = escapeHtml(clean);

    allowed.forEach(function (tag, idx) {
      res = res.replace('___SAFE_TAG_' + idx + '___', tag);
    });

    const kbdTokens = [];
    res = res.replace(/\b(Ctrl|Alt|Shift|Windows)\s*\+\s*(?:(Ctrl|Alt|Shift)\s*\+\s*)?([A-Za-z0-9\+]+)\b/gi, function (match) {
      kbdTokens.push(match.trim());
      return '___KBD_TAG_' + (kbdTokens.length - 1) + '___';
    });

    res = res.replace(/\b(F[1-9]|F1[0-2]|Enter|Esc|Tab|Delete|Backspace|Home|End|Page Up|Page Down)\b/g, function (match, _k, offset, full) {
      const before = full.slice(0, offset);
      const after = full.slice(offset + match.length);
      if (match === 'Tab') return match;
      if (/^F\d/.test(match) && (/[(,=:$]$/.test(before) || /^[&,):]/.test(after))) return match;
      const afterKeyWord = /\bkey\s*$/i.test(before);
      if ((!afterKeyWord && /[A-Za-z]\s*$/.test(before)) || /^\s+(?!key\b)[A-Za-z]/i.test(after)) return match;
      kbdTokens.push(match.trim());
      return '___KBD_TAG_' + (kbdTokens.length - 1) + '___';
    });

    kbdTokens.forEach(function (token, idx) {
      res = res.replace('___KBD_TAG_' + idx + '___', '<kbd class="kbd-badge">' + token + '</kbd>');
    });

    res = res.replace(/\n\s*[\-\▪\✓\•]\s*/g, '<br/>• ');
    res = res.replace(/\n/g, '<br/>');
    return res;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function escapeForJs(str) {
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
  }

  // Search Engine
  function openSearchModal() {
    el.searchModal.classList.add('active');
    el.searchInput.value = '';
    el.searchInput.focus();
    performSearch('');
  }

  function closeSearchModal() {
    el.searchModal.classList.remove('active');
  }

  let searchIndexCache = null;
  function toPlainText(str) {
    return String(str || '').replace(/<[^>]+>/g, '').replace(/[​‌‍﻿]/g, '');
  }

  function buildSearchIndex(data) {
    const index = [];
    data.lessons.forEach(lesson => {
      index.push({
        lessonId: lesson.id, sectionIdx: null, title: lesson.fullTitle,
        text: toPlainText([lesson.title, ...(lesson.objectives || [])].join(' '))
      });
      lesson.sections.forEach((sec, sIdx) => {
        const parts = [sec.title];
        sec.items.forEach(it => {
          if (it.title) parts.push(it.title);
          if (it.text) parts.push(it.text);
          if (it.steps) parts.push(...it.steps);
          if (it.items) parts.push(...it.items);
          if (it.headers) parts.push(...it.headers.map(cellText));
          if (it.rows) it.rows.forEach(r => parts.push(...r.map(cellText)));
          if (it.caption) parts.push(it.caption);
          if (it.type === 'quiz' && it.questions) {
            it.questions.forEach(q => {
              parts.push(q.question);
              if (q.options) parts.push(...q.options.map(o => o.text));
            });
          }
          if (it.type === 'short-questions' && it.questions) {
            it.questions.forEach(q => parts.push(q.question));
          }
        });
        index.push({
          lessonId: lesson.id, sectionIdx: sIdx, title: toPlainText(sec.title),
          text: toPlainText(parts.join(' ')).replace(/\s+/g, ' ')
        });
      });
    });
    return index;
  }

  function snippetAround(text, q) {
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return text.slice(0, 140);
    const start = Math.max(0, i - 50);
    return (start > 0 ? '… ' : '') + text.slice(start, i + q.length + 90) + (i + q.length + 90 < text.length ? ' …' : '');
  }

  function performSearch(query) {
    const data = window.COURSE_DATA;
    if (!data || !data.lessons) return;
    if (!searchIndexCache) searchIndexCache = buildSearchIndex(data);
    query = toPlainText(query).trim();

    if (!query) {
      let html = `<div style="padding:0.75rem 1rem; font-size:0.8rem; font-weight:700; color:var(--text-subtle); text-transform:uppercase;">មេរៀនណែនាំ</div>`;
      data.lessons.slice(0, 8).forEach(l => {
        html += `
          <li class="search-result-item" onclick="window.jumpToResult('${l.id}')">
            <div class="result-title">${l.fullTitle}</div>
            <div class="result-snippet">ទំព័រ ${kh(l.pageStart)} ដល់ ${kh(l.pageEnd)}</div>
          </li>
        `;
      });
      el.searchResults.innerHTML = html;
      return;
    }

    const q = query.toLowerCase();
    const matches = searchIndexCache.filter(item => {
      return item.title.toLowerCase().includes(q) || item.text.toLowerCase().includes(q);
    }).slice(0, 30);

    if (matches.length === 0) {
      el.searchResults.innerHTML = `<li style="padding:2rem; text-align:center; color:var(--text-muted); font-size:0.95rem;">មិនមានលទ្ធផលស្វែងរកសម្រាប់ "${escapeHtml(query)}"</li>`;
      return;
    }

    let html = '';
    matches.forEach(item => {
      const owner = data.lessons.find(l => l.id === item.lessonId);
      const ownerLabel = owner && item.sectionIdx !== null
        ? `<div class="result-lesson-label">${escapeHtml(toPlainText(owner.fullTitle))}</div>`
        : '';
      html += `
        <li class="search-result-item" onclick="window.jumpToResult('${item.lessonId}', ${item.sectionIdx === null ? 'null' : item.sectionIdx})">
          ${ownerLabel}
          <div class="result-title">${highlightQuery(item.title, q)}</div>
          <div class="result-snippet">${highlightQuery(snippetAround(item.text, q), q)}</div>
        </li>
      `;
    });
    el.searchResults.innerHTML = html;
  }

  function highlightQuery(text, query) {
    if (!query) return escapeHtml(text);
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark style="background-color:rgba(250, 204, 21, 0.4); border-radius:2px; padding:0 2px;">$1</mark>');
  }

  window.jumpToResult = function (lessonId, sectionIdx) {
    closeSearchModal();
    const scrollToSection = () => {
      if (sectionIdx === null || sectionIdx === undefined) return;
      const target = document.getElementById(`section-${sectionIdx}`);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    if (window.location.hash === `#${lessonId}`) {
      scrollToSection();
    } else {
      window.location.hash = `#${lessonId}`;
      setTimeout(scrollToSection, 60);
    }
  };

  // Lightbox Modal
  window.openLightbox = function (src, caption) {
    state.lightboxZoom = 1;
    el.lightboxImage.src = src;
    el.lightboxImage.style.transform = `scale(${state.lightboxZoom})`;
    el.lightboxCaption.textContent = caption || '';
    el.lightboxModal.classList.add('active');
  };

  function closeLightbox() {
    el.lightboxModal.classList.remove('active');
  }

  window.copyFormula = function (formula) {
    navigator.clipboard.writeText(formula).then(() => {
      showToast('បានចម្លងដោយជោគជ័យ!');
    }).catch(() => {
      showToast('មិនអាចចម្លងបាន');
    });
  };

  // Toast System
  function showToast(msg) {
    if (!el.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = msg;
    el.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, 2500);
  }

  // Initialize when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
