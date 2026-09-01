/* ═══════════════════════════════════════════════════════════════
   AudioVault — Kadio App Engine
   Full backend API integration for BloxFinder Audio Dashboard
   ═══════════════════════════════════════════════════════════════ */

(() => {
  'use strict';

  /* ─── STATE ──────────────────────────────────────────────── */
  const S = {
    tracks: [],
    filtered: [],
    favorites: new Set(),
    view: 'all',           // all | favorites | categories | pending | inflow
    activeCategory: null,
    searchQuery: '',
    sortMode: 'default',
    viewMode: 'grid',      // grid | list
    theme: localStorage.getItem('kadio-theme') || 'dark',
    lang: localStorage.getItem('kadio-lang') || localStorage.getItem('preferred_lang') || 'en',
    currentTrackIdx: -1,

    isPlaying: false,
    repeatMode: 'none',    // none | one | all
    shuffle: false,
    auth: { isLoggedIn: false, isGuildMember: false, tier: 'guest' },
    fuseInstance: null,
    searchHistory: JSON.parse(localStorage.getItem('kadio-search-history') || '[]'),
    categories: [],
    categoryImages: {},
    isSelectionMode: false,
    playHistory: [],
    batchSelected: new Set(),   // IDs selected for batch operations
    currentPage: 1,
    pageSize: parseInt(localStorage.getItem('kadio-pageSize'), 10) || 50,
    pendingSubFilters: { activePlayable: false, youtubeMapped: false },
    inflowStagingTracks: [],    // Newly inflowed real-time detected tracks
  };

  const PENDING_REVIEW_CATEGORY = '🛡️ 검토 대기';

  const audio = new Audio();
  audio.volume = 0.85;

  /* ─── DOM REFS ──────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const el = {
    sidebar: $('sidebar'),
    sidebarToggle: $('sidebarToggle'),
    searchInput: $('searchInput'),
    searchClear: $('searchClear'),
    searchHistory: $('searchHistory'),
    viewGrid: $('viewGrid'),
    viewList: $('viewList'),
    toggleSelectModeBtn: $('toggleSelectModeBtn'),
    sortSelect: $('sortSelect'),
    clearFavBtn: $('clearFavBtn'),
    themeToggle: $('themeToggle'),
    themeIcon: $('themeIcon'),
    langToggle: $('langToggle'),
    statsBar: $('statsBar'),
    totalCount: $('totalCount'),
    favCount: $('favCount'),
    catCount: $('catCount'),
    shownCount: $('shownCount'),
    navTotal: $('navTotal'),
    navFavs: $('navFavs'),
    navCats: $('navCats'),
    navCatsCount: $('navCatsCount'),
    navFavsCount: $('navFavsCount'),
    navPendingCount: $('navPendingCount'),
    navInflowCount: $('navInflowCount'),
    navAllTracks: $('navAllTracks'),
    navCategories: $('navCategories'),
    navPending: $('navPending'),
    navInflowStaging: $('navInflowStaging'),
    viewMainTitle: $('viewMainTitle'),
    viewSubTitle: $('viewSubTitle'),
    catChipsCarousel: $('catChipsCarousel'),
    categoryGalleryGrid: $('categoryGalleryGrid'),
    inflowReviewContainer: $('inflowReviewContainer'),
    inflowQueueCount: $('inflowQueueCount'),
    inflowQueueList: $('inflowQueueList'),
    inflowExistingCount: $('inflowExistingCount'),
    inflowExistingList: $('inflowExistingList'),
    inflowAlertBadgeBtn: $('inflowAlertBadgeBtn'),
    inflowAlertBadgeText: $('inflowAlertBadgeText'),
    activeFilter: $('activeFilter'),
    activeFilterVal: $('activeFilterVal'),
    filterClear: $('filterClear'),
    emptyState: $('emptyState'),
    noResults: $('noResults'),
    tracksGrid: $('tracksGrid'),
    contentArea: $('contentArea'),
    exportBtn: $('exportBtn'),
    categoryList: $('categoryList'),
    playlistList: $('playlistList'),
    loadSampleBtn: $('loadSampleBtn'),
    emptySampleBtn: $('emptySampleBtn'),
    // Bulk Action Bar & Modal
    bulkActionBar: $('bulkActionBar'),
    bulkSelectedCount: $('bulkSelectedCount'),
    bulkChangeCategoryBtn: $('bulkChangeCategoryBtn'),
    bulkApproveBtn: $('bulkApproveBtn'),
    bulkDeleteBtn: $('bulkDeleteBtn'),
    bulkSelectAllBtn: $('bulkSelectAllBtn'),
    bulkClearSelectionBtn: $('bulkClearSelectionBtn'),
    bulkCategoryModalBackdrop: $('bulkCategoryModalBackdrop'),
    bulkCategoryModal: $('bulkCategoryModal'),
    bulkCategoryModalClose: $('bulkCategoryModalClose'),
    bulkModalCount: $('bulkModalCount'),
    bulkCategorySelect: $('bulkCategorySelect'),
    bulkCategoryCustomInput: $('bulkCategoryCustomInput'),
    bulkCategoryCancelBtn: $('bulkCategoryCancelBtn'),
    bulkCategoryConfirmBtn: $('bulkCategoryConfirmBtn'),
    // Unified Admin Modal
    unifiedAdminModalBackdrop: $('unifiedAdminModalBackdrop'),
    unifiedAdminModal: $('unifiedAdminModal'),
    unifiedAdminModalClose: $('unifiedAdminModalClose'),
    openUnifiedAdminBtn: $('openUnifiedAdminBtn'),
    // Mini player
    miniPlayer: $('miniPlayer'),
    mpCoverImg: $('mpCoverImg'),
    mpCoverArea: $('mpCoverArea'),
    mpPlayBtn: $('mpPlayBtn'),
    mpPrevBtn: $('mpPrevBtn'),
    mpNextBtn: $('mpNextBtn'),
    mpShuffleBtn: $('mpShuffleBtn'),
    mpRepeatBtn: $('mpRepeatBtn'),
    mpEq: $('mpEq'),
    mpTitle: $('mpTitle'),
    mpId: $('mpId'),
    mpCurrent: $('mpCurrent'),
    mpTotal: $('mpTotal'),
    mpProgressTrack: $('mpProgressTrack'),
    mpProgressFill: $('mpProgressFill'),
    mpProgressHandle: $('mpProgressHandle'),
    mpStatus: $('mpStatus'),
    mpVolume: $('mpVolume'),
    mpCloseBtn: $('mpCloseBtn'),
    mpDownloadBtn: $('mpDownloadBtn'),
    mpDetailOpenBtn: $('mpDetailOpenBtn'),
    // Modal
    modalBackdrop: $('modalBackdrop'),
    trackModal: $('trackModal'),
    modalClose: $('modalClose'),
    modalBody: $('modalBody'),
    // Toast
    toastStack: $('toastStack'),
    // Drop
    dropOverlay: $('dropOverlay'),
    // Canvas
    bgCanvas: $('bgCanvas'),
  };

  /* ─── HELPERS ───────────────────────────────────────────── */
  function esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }
  const escapeHtml = esc;

  function fmtTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function toast(msg, type = 'info', onClick = null, duration = 4000) {
    const t = document.createElement('div');
    t.className = `toast toast-${type} ${onClick ? 'toast-clickable' : ''}`;
    if (onClick) {
      t.style.cursor = 'pointer';
      t.title = '클릭하여 해당 오디오로 이동';
      t.onclick = (e) => {
        t.remove();
        onClick(e);
      };
    }
    t.textContent = msg;
    el.toastStack.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      if (t.parentNode) {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
      }
    }, duration);
  }

  function jumpToAudio(audioId, openModal = true) {
    if (!audioId) return;
    const cleanId = String(audioId).replace(/^r_/, '').replace(/^a_/, '').trim();

    // Find track in S.tracks
    let track = S.tracks.find(t => String(t.id) === String(audioId) || String(t.audioAssetId) === String(audioId) || String(t.audioAssetId) === cleanId);
    if (!track) {
      toast('오디오를 목록에서 찾을 수 없습니다.', 'warning');
      return;
    }

    // Reset filters to ensure the track is in S.filtered
    S.searchQuery = '';
    if (el.searchInput) el.searchInput.value = '';
    if (el.searchClear) el.searchClear.classList.remove('visible');

    // If active category does not match, reset to all
    if (S.activeCategory && S.activeCategory !== track.category) {
      S.activeCategory = null;
      if (el.activeFilter) el.activeFilter.style.display = 'none';
      renderCategories();
    }

    S.view = 'all';
    setNavActive('all');
    renderTracks();

    // Calculate page
    const trackIdx = S.filtered.findIndex(t => t.id === track.id);
    if (trackIdx !== -1) {
      const targetPage = Math.floor(trackIdx / S.pageSize) + 1;
      S.currentPage = targetPage;
      renderTracks();

      // Smooth scroll & pulse animation
      setTimeout(() => {
        const card = el.tracksGrid.querySelector(`[data-id="${track.id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('highlight-pulse');
          setTimeout(() => card.classList.remove('highlight-pulse'), 3600);
        }
        if (openModal) {
          openTrackDetail(trackIdx);
        }
      }, 180);
    }
  }

  const reportedMediaErrors = new Set();
  function handleMediaError(audioId, title, errorType = 'IMAGE_404') {
    const isAdmin = S.auth && (S.auth.tier === 'admin' || S.auth.tier === 'owner');
    if (!isAdmin) return;
    if (reportedMediaErrors.has(audioId)) return;
    reportedMediaErrors.add(audioId);

    const trackTitle = title || `오디오 에셋 #${audioId}`;
    toast(`⚠️ [404 오류] 썸네일 로드 실패: "${trackTitle}" (클릭하여 이동 및 수정)`, 'error', () => {
      jumpToAudio(audioId, true);
    }, 7000);
  }

  async function fetchCategoryMetadata() {
    try {
      const res = await fetch('/api/audio/admin/categories');
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.categories)) {
        S.categoryMetadata = {};
        json.categories.forEach(c => {
          if (c.category) {
            S.categoryMetadata[c.category.toLowerCase()] = c;
          }
        });
      }
    } catch (e) {
      // Non-blocking fallback
      S.categoryMetadata = S.categoryMetadata || {};
    }
  }

  /* ─── INIT ──────────────────────────────────────────────── */
  async function init() {
    applyTheme();
    bindEvents();
    await fetchCategoryMetadata();
    await loadTracks();
    initCanvas();
    // Real-time Studio verification & live alerts auto-sync (every 3 seconds)
    setInterval(autoSyncStatus, 3000);
  }

  /* ─── API CALLS ─────────────────────────────────────────── */
  let isSyncing = false;
  let knownAudioIds = new Set();
  let knownPendingReportIds = new Set();
  let isInitialSync = true;

  async function autoSyncStatus() {
    if (isSyncing) return;
    try {
      isSyncing = true;
      const isAdmin = S.auth && (S.auth.tier === 'admin' || S.auth.tier === 'owner');

      const res = await fetch('/api/audio/list');
      const json = await res.json();
      if (json.status === 'success' && Array.isArray(json.data)) {
        let hasChanges = false;

        // Detect brand new audios (if not initial sync)
        if (!isInitialSync && isAdmin) {
          json.data.forEach(t => {
            if (!knownAudioIds.has(t.id)) {
              knownAudioIds.add(t.id);
              toast(`✨ 새 오디오 등록 감지: "${t.title}" (클릭하여 이동)`, 'success', () => {
                jumpToAudio(t.id, true);
              }, 7000);
              hasChanges = true;
            }
          });
        } else {
          json.data.forEach(t => knownAudioIds.add(t.id));
          isInitialSync = false;
        }

        json.data.forEach(t => {
          const existing = S.tracks.find(x => x.id === t.id);
          if (existing) {
            if (
              existing.serverPlayable !== t.serverPlayable ||
              existing.clientPlayable !== t.clientPlayable ||
              existing.duration !== t.duration ||
              existing.verificationStatus !== t.verificationStatus ||
              existing.isVerifiedLocked !== t.isVerifiedLocked ||
              existing.youtubeUrl !== t.youtubeUrl ||
              existing.imageUrl !== t.imageUrl
            ) {
              existing.serverPlayable = t.serverPlayable;
              existing.clientPlayable = t.clientPlayable;
              existing.duration = t.duration;
              existing.verificationStatus = t.verificationStatus;
              existing.lastVerifiedAt = t.lastVerifiedAt;
              existing.isVerifiedLocked = t.isVerifiedLocked;
              existing.youtubeUrl = t.youtubeUrl;
              existing.imageUrl = t.imageUrl;
              hasChanges = true;
            }
          }
        });

        if (hasChanges) {
          renderTracks();
        }
      }

      // Check Live Reports Alerts for Admin
      if (isAdmin) {
        try {
          const alertRes = await fetch('/api/audio/admin/live-alerts');
          const alertJson = await alertRes.json();
          if (alertJson.status === 'success' && Array.isArray(alertJson.data?.pendingReports)) {
            alertJson.data.pendingReports.forEach(rep => {
              if (!knownPendingReportIds.has(rep.reportId)) {
                knownPendingReportIds.add(rep.reportId);
                toast(`🚨 오디오 신고 접수: "${rep.title || rep.audioId}" (${rep.reason || '사유 미지정'}) (클릭하여 확인)`, 'warning', () => {
                  jumpToAudio(rep.audioId, true);
                }, 8000);
              }
            });
          }
        } catch (_) {}
      }
    } catch (err) {
      // silent
    } finally {
      isSyncing = false;
    }
  }

  async function loadTracks() {
    try {
      const res = await fetch('/api/audio/list');
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      S.auth = json.auth || S.auth;
      S.tracks = (json.data || []).map(t => ({
        id: t.id,
        title: t.title || 'Untitled',
        audioAssetId: t.audioAssetId,
        category: t.gameName || (t.type === 'global' ? 'Global' : '기타'),
        type: t.type,
        previewUrl: t.previewUrl,
        youtubeUrl: t.youtubeUrl,
        imageUrl: t.imageUrl || null,
        status: t.status,
        previewLocked: t.previewLocked,
        favorited: !!t.favorited,
        serverPlayable: t.serverPlayable,
        clientPlayable: t.clientPlayable,
        duration: t.duration,
        verificationStatus: t.verificationStatus,
        lastVerifiedAt: t.lastVerifiedAt,
        isVerifiedLocked: t.isVerifiedLocked || 0,
      }));



      S.favorites.clear();
      S.tracks.forEach(t => { if (t.favorited) S.favorites.add(t.id); });

      const isAdmin = S.auth.tier === 'admin' || S.auth.tier === 'owner';

      // Separate pending_review tracks from normal category grouping
      const activeTracks = S.tracks.filter(t => t.status !== 'pending_review');
      const pendingTracks = S.tracks.filter(t => t.status === 'pending_review');

      const allCats = [...new Set(activeTracks.map(t => t.category).filter(Boolean))].sort();
      let customOrder = [];
      try {
        customOrder = JSON.parse(localStorage.getItem('audio_category_order') || '[]');
      } catch (e) { }

      if (Array.isArray(customOrder) && customOrder.length > 0) {
        allCats.sort((a, b) => {
          const idxA = customOrder.indexOf(a);
          const idxB = customOrder.indexOf(b);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.localeCompare(b);
        });
      }

      // Admin-only: prepend pending review category if there are pending tracks
      if (isAdmin && pendingTracks.length > 0) {
        // Assign pending tracks to the special category
        pendingTracks.forEach(t => { t.category = PENDING_REVIEW_CATEGORY; });
        allCats.unshift(PENDING_REVIEW_CATEGORY);
      } else {
        // Non-admin: remove pending tracks from display entirely
        // (They're already filtered by backend, but just in case)
      }
      S.categories = allCats;

      if (typeof window.Fuse === 'function') {
        S.fuseInstance = new window.Fuse(S.tracks, {
          keys: ['title', 'category', 'audioAssetId', 'youtubeUrl', 'id'],
          threshold: 0.4,
          ignoreLocation: true
        });
      } else {
        S.fuseInstance = null;
      }

      render();
    } catch (e) {
      console.error('[Kadio] loadTracks error:', e);
      toast('오디오 목록 로드 실패', 'error');
    }
  }

  function requireAuth() {
    if (!S.auth || !S.auth.isLoggedIn) {
      const msg = (window.i18n && typeof window.i18n.t === 'function' ? window.i18n.t('nav.login_required') : null) || '로그인이 필요한 기능입니다';
      toast(msg, 'error');
      return false;
    }
    return true;
  }

  async function toggleFavorite(id, ev) {
    if (ev) ev.stopPropagation();
    if (!requireAuth()) return;

    try {
      const res = await fetch('/api/audio/favorites/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioId: id }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        if (json.favorited) S.favorites.add(id);
        else S.favorites.delete(id);

        const track = S.tracks.find(t => t.id === id);
        if (track) track.favorited = !!json.favorited;

        updateStats();
        renderTracks();
        toast(json.favorited ? '즐겨찾기 추가 ★' : '즐겨찾기 해제', 'info');
        return;
      } else {
        toast(json.message || '즐겨찾기 변경 실패', 'error');
      }
    } catch (e) {
      console.warn('[Kadio] Server favorite toggle failed:', e);
      toast('즐겨찾기 처리 중 오류가 발생했습니다', 'error');
    }
  }

  async function addAudio(data) {
    try {
      const res = await fetch('/api/audio/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast(json.message || '오디오 등록 완료', 'success');
      await loadTracks();
    } catch (e) {
      toast('등록 실패: ' + e.message, 'error');
    }
  }

  async function editAudio(id, data) {
    try {
      const res = await fetch(`/api/audio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast(json.message || '수정 완료', 'success');
      await loadTracks();
    } catch (e) {
      toast('수정 실패: ' + e.message, 'error');
    }
  }

  async function deleteAudio(id) {
    const trackToDelete = S.tracks.find(t => t.id === id);
    if (!trackToDelete) return;
    if (!confirm(`'${trackToDelete.title}' 오디오를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/audio/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      await loadTracks();
      toastWithUndo(`'${trackToDelete.title}' 삭제됨`, async () => {
        // Re-add track on Undo
        await addAudio({
          title: trackToDelete.title,
          audioAssetId: trackToDelete.audioAssetId,
          type: trackToDelete.type,
          gameName: trackToDelete.category,
          previewUrl: trackToDelete.previewUrl,
          youtubeUrl: trackToDelete.youtubeUrl
        });
      });
    } catch (e) {
      toast('삭제 실패: ' + e.message, 'error');
    }
  }

  function toastWithUndo(msg, undoFn) {
    const t = document.createElement('div');
    t.className = 'toast toast-info';
    t.style.display = 'flex';
    t.style.alignItems = 'center';
    t.style.gap = '12px';
    t.innerHTML = `<span>${esc(msg)}</span> <button id="undoBtn" style="background:var(--c-accent);color:#000;border:none;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:700;cursor:pointer">실행 취소 (Undo)</button>`;

    el.toastStack.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));

    const btn = t.querySelector('#undoBtn');
    btn.onclick = async () => {
      t.remove();
      if (undoFn) await undoFn();
      toast('삭제가 취소되었습니다', 'success');
    };

    setTimeout(() => {
      if (t.parentNode) {
        t.classList.remove('show');
        setTimeout(() => t.remove(), 300);
      }
    }, 5000);
  }

  async function searchYoutube(query) {
    try {
      const res = await fetch(`/api/audio/youtube-search?q=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      return json.data || [];
    } catch (e) {
      toast('유튜브 검색 실패', 'error');
      return [];
    }
  }

  async function reportAudio(id, reason) {
    try {
      const res = await fetch(`/api/audio/${id}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast('신고가 접수되었습니다', 'success');
    } catch (e) {
      toast('신고 실패: ' + e.message, 'error');
    }
  }

  /* ─── RENDER & VIEW ROUTING ────────────────────────────── */
  function render() {
    updateStats();
    renderCategories();
    renderCategoryChipsCarousel();

    if (S.view === 'categories') {
      renderCategoryGallery();
    } else if (S.view === 'inflow') {
      renderInflowStagingView();
    } else {
      renderTracks();
    }
  }

  function updateStats() {
    const total = S.tracks.length;
    const favs = S.favorites.size;
    const cats = S.categories.length;
    const pendingCount = S.tracks.filter(t => t.status === 'pending_review').length;
    const inflowCount = S.inflowStagingTracks.length + pendingCount;

    if (el.navTotal) el.navTotal.textContent = total;
    if (el.totalCount) el.totalCount.textContent = total;
    if (el.navFavs) el.navFavs.textContent = favs;
    if (el.navFavsCount) el.navFavsCount.textContent = favs;
    if (el.favCount) el.favCount.textContent = favs;
    if (el.navCats) el.navCats.textContent = cats;
    if (el.navCatsCount) el.navCatsCount.textContent = cats;
    if (el.catCount) el.catCount.textContent = cats;
    if (el.navPendingCount) el.navPendingCount.textContent = pendingCount;
    if (el.navInflowCount) el.navInflowCount.textContent = inflowCount;

    // Inflow badge alert button on top navbar
    if (el.inflowAlertBadgeBtn) {
      if (inflowCount > 0 && (S.auth.tier === 'admin' || S.auth.tier === 'owner')) {
        el.inflowAlertBadgeBtn.style.display = 'inline-flex';
        if (el.inflowAlertBadgeText) el.inflowAlertBadgeText.textContent = `신규 유입 ${inflowCount}개`;
      } else {
        el.inflowAlertBadgeBtn.style.display = 'none';
      }
    }
  }

  function switchView(viewName) {
    S.view = viewName;
    S.currentPage = 1;

    // Update Sidebar Navigation Active States
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      const v = btn.dataset.view;
      btn.classList.toggle('active', v === viewName);
    });

    if (viewName === 'categories') {
      if (el.tracksGrid) el.tracksGrid.style.display = 'none';
      if (el.inflowReviewContainer) el.inflowReviewContainer.style.display = 'none';
      if (el.catChipsCarousel) el.catChipsCarousel.style.display = 'none';
      if (el.categoryGalleryGrid) el.categoryGalleryGrid.style.display = 'grid';
      if (el.viewMainTitle) el.viewMainTitle.textContent = '카테고리별 탐색';
      if (el.viewSubTitle) el.viewSubTitle.textContent = `총 ${S.categories.length}개의 오디오 카테고리 갤러리`;
      renderCategoryGallery();
    } else if (viewName === 'inflow') {
      if (el.tracksGrid) el.tracksGrid.style.display = 'none';
      if (el.categoryGalleryGrid) el.categoryGalleryGrid.style.display = 'none';
      if (el.catChipsCarousel) el.catChipsCarousel.style.display = 'none';
      if (el.inflowReviewContainer) el.inflowReviewContainer.style.display = 'flex';
      if (el.viewMainTitle) el.viewMainTitle.textContent = '⚡ 실시간 신규 오디오 유입 및 스테이징 검토';
      if (el.viewSubTitle) el.viewSubTitle.textContent = '새로 감지된 오디오를 비교 검토하고 인라인 수정 후 즉시 승인합니다.';
      renderInflowStagingView();
    } else {
      if (el.categoryGalleryGrid) el.categoryGalleryGrid.style.display = 'none';
      if (el.inflowReviewContainer) el.inflowReviewContainer.style.display = 'none';
      if (el.catChipsCarousel) el.catChipsCarousel.style.display = 'flex';
      if (el.tracksGrid) el.tracksGrid.style.display = '';

      if (viewName === 'all') {
        if (el.viewMainTitle) el.viewMainTitle.textContent = '전체 오디오 라이브러리';
        if (el.viewSubTitle) el.viewSubTitle.textContent = `총 ${S.tracks.length}개의 오디오 에셋이 준비되어 있습니다.`;
      } else if (viewName === 'favorites') {
        if (el.viewMainTitle) el.viewMainTitle.textContent = '내 즐겨찾기 목록';
        if (el.viewSubTitle) el.viewSubTitle.textContent = `즐겨찾기로 등록한 ${S.favorites.size}개 오디오`;
      } else if (viewName === 'pending') {
        if (el.viewMainTitle) el.viewMainTitle.textContent = '검토 대기중인 오디오';
        if (el.viewSubTitle) el.viewSubTitle.textContent = '관리자의 확인 및 승인이 필요한 오디오 목록입니다.';
      }
      renderTracks();
    }
  }

  /* ─── Quick Category Chips Carousel ─── */
  function setupCarouselInteractions() {
    if (!el.catChipsCarousel || el.catChipsCarousel._hasInteractionsBound) return;
    el.catChipsCarousel._hasInteractionsBound = true;

    // Mouse wheel horizontal scroll
    el.catChipsCarousel.addEventListener('wheel', (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
        e.preventDefault();
        el.catChipsCarousel.scrollLeft += e.deltaY * 1.1;
      }
    }, { passive: false });

    // Drag-to-scroll
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasMoved = false;

    el.catChipsCarousel.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDown = true;
      hasMoved = false;
      el.catChipsCarousel.classList.add('is-dragging');
      startX = e.pageX - el.catChipsCarousel.offsetLeft;
      scrollLeft = el.catChipsCarousel.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      el.catChipsCarousel.classList.remove('is-dragging');
    });

    el.catChipsCarousel.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - el.catChipsCarousel.offsetLeft;
      const walk = (x - startX) * 1.4;
      if (Math.abs(walk) > 4) {
        hasMoved = true;
      }
      el.catChipsCarousel.scrollLeft = scrollLeft - walk;
    });

    el.catChipsCarousel.addEventListener('click', (e) => {
      if (hasMoved) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  }

  function scrollActiveCategoryIntoView() {
    if (!el.catChipsCarousel) return;
    const activePill = el.catChipsCarousel.querySelector('.cat-tag-pill.active');
    if (activePill) {
      activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function renderCategoryChipsCarousel() {
    if (!el.catChipsCarousel) return;
    const isAllActive = !S.activeCategory;

    // Pick top categories
    const topCats = S.categories.filter(c => c !== PENDING_REVIEW_CATEGORY).slice(0, 30);
    let html = `<div class="cat-tag-pill ${isAllActive ? 'active' : ''}" onclick="window._kadio.filterByChip('all')">전체 (${S.tracks.length})</div>`;

    topCats.forEach(cat => {
      const cnt = S.tracks.filter(t => t.category === cat).length;
      const isActive = S.activeCategory === cat;
      html += `<div class="cat-tag-pill ${isActive ? 'active' : ''}" onclick="window._kadio.filterByChip('${esc(cat)}')">${esc(tCategory(cat))} (${cnt})</div>`;
    });

    el.catChipsCarousel.innerHTML = html;
    setupCarouselInteractions();
    scrollActiveCategoryIntoView();
  }

  function filterByChip(cat) {
    // Reset search and sub-filters when switching category
    S.searchQuery = '';
    if (el.searchInput) el.searchInput.value = '';
    if (el.searchClearBtn) el.searchClearBtn.style.display = 'none';

    if (cat === 'all') {
      S.activeCategory = null;
    } else {
      S.activeCategory = cat;
    }
    if (el.activeFilter) el.activeFilter.style.display = S.activeCategory ? 'flex' : 'none';
    if (el.activeFilterVal) el.activeFilterVal.textContent = tCategory(S.activeCategory) || '';
    switchView('all');
    renderCategoryChipsCarousel();
    renderCategories();
  }

  /* ─── Category Gallery Grid ─── */
  function renderCategoryGallery() {
    if (!el.categoryGalleryGrid) return;
    const cats = S.categories.filter(c => c !== PENDING_REVIEW_CATEGORY);

    el.categoryGalleryGrid.innerHTML = cats.map(cat => {
      const tracksInCat = S.tracks.filter(t => t.category === cat);
      const cnt = tracksInCat.length;

      // Extract image: metadata or first youtube thumbnail
      let coverImg = S.categoryImages && S.categoryImages[cat];
      if (!coverImg) {
        const sampleWithYt = tracksInCat.find(t => t.youtubeUrl);
        if (sampleWithYt) {
          const m = sampleWithYt.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
          if (m) coverImg = `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
        }
      }

      const imgHtml = coverImg ? `<img src="${esc(coverImg)}" class="cat-card-bg-img" alt="${esc(cat)}" onerror="this.style.display='none'" />` : '';

      return `
        <div class="category-gallery-card" onclick="window._kadio.filterByChip('${esc(cat)}')">
          ${imgHtml}
          <div class="cat-card-title">${esc(tCategory(cat))}</div>
          <div class="cat-card-count">${cnt} Tracks</div>
        </div>
      `;
    }).join('');
  }

  /* ─── Live Inflow Review & Staging View ─── */
  function renderInflowStagingView() {
    if (!el.inflowReviewContainer) return;

    // Combine staging queue and pending tracks
    const pendingTracks = S.tracks.filter(t => t.status === 'pending_review');
    const allStaging = [...S.inflowStagingTracks];
    pendingTracks.forEach(pt => {
      if (!allStaging.some(st => String(st.id) === String(pt.id))) {
        allStaging.push(pt);
      }
    });

    if (el.inflowQueueCount) el.inflowQueueCount.textContent = allStaging.length;

    if (el.inflowQueueList) {
      if (allStaging.length === 0) {
        el.inflowQueueList.innerHTML = `
          <div style="padding:24px;text-align:center;color:var(--c-text3);font-size:13px;">
            🎉 현재 검토 대기 중인 신규 유입 오디오가 없습니다!
          </div>
        `;
      } else {
        el.inflowQueueList.innerHTML = allStaging.map(t => {
          let coverSrc = t.imageUrl || null;
          if (t.youtubeUrl && !coverSrc) {
            const m = t.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
            if (m) coverSrc = `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`;
          }

          return `
            <div class="inflow-card" id="inflowCard_${t.id}">
              <div class="inflow-card-row">
                <img src="${esc(coverSrc || (typeof DEFAULT_FALLBACK_IMG !== 'undefined' ? DEFAULT_FALLBACK_IMG : '/images/default-audio-cover.svg'))}" style="width:48px;height:48px;border-radius:8px;object-fit:cover;background:#161b22;" onerror="typeof handleImgError === 'function' ? handleImgError(this) : (this.src=(typeof DEFAULT_FALLBACK_IMG !== 'undefined' ? DEFAULT_FALLBACK_IMG : '/images/default-audio-cover.svg'))" />
                <div style="flex:1;overflow:hidden;">
                  <div style="font-size:11px;color:var(--c-accent);font-family:'DM Mono',monospace;margin-bottom:2px;">
                    🎵 ${esc(t.audioAssetId || t.id)}
                  </div>
                  <input type="text" class="inflow-inline-input" id="inflowTitle_${t.id}" value="${esc(t.title)}" placeholder="곡 제목" />
                </div>
              </div>
              <div class="inflow-card-row" style="margin-top:2px;">
                <div style="flex:1;">
                  <label style="font-size:10px;color:var(--c-text3);margin-bottom:2px;display:block;">카테고리 지정</label>
                  <input type="text" class="inflow-inline-input" id="inflowCat_${t.id}" value="${esc(t.category === PENDING_REVIEW_CATEGORY ? (t.gameName || 'Music') : (t.category || 'Music'))}" placeholder="카테고리명 (예: FNF, Vocaloid)" />
                </div>
              </div>
              <div class="inflow-card-actions">
                <button class="action-btn" onclick="window._kadio.playTrackById('${t.id}')" title="미리 듣기">▶ 재생</button>
                <button class="inflow-approve-btn" onclick="window._kadio.approveInflowTrack('${t.id}')">
                  ✓ 승인 & 카테고리로 이동
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Existing active library for reference
    const activeTracks = S.tracks.filter(t => t.status === 'active').slice(0, 30);
    if (el.inflowExistingCount) el.inflowExistingCount.textContent = S.tracks.filter(t => t.status === 'active').length;

    if (el.inflowExistingList) {
      el.inflowExistingList.innerHTML = activeTracks.map(t => `
        <div class="inflow-card" style="opacity:0.85;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:12px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;" title="${esc(t.title)}">${esc(t.title)}</span>
            <span style="font-size:10px;padding:2px 6px;border-radius:4px;background:rgba(0,229,255,0.1);color:var(--c-accent);">${esc(t.category)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:11px;font-family:'DM Mono',monospace;color:var(--c-text3);margin-top:2px;">
            <span>🎵 ${esc(t.audioAssetId)}</span>
            <span>${fmtTime(t.duration)}</span>
          </div>
        </div>
      `).join('');
    }
  }

  /* ─── Fast Approve & Category Jump ─── */
  async function approveInflowTrack(id) {
    try {
      const titleInput = document.getElementById(`inflowTitle_${id}`);
      const catInput = document.getElementById(`inflowCat_${id}`);
      const newTitle = titleInput ? titleInput.value.trim() : '';
      const newCategory = catInput ? catInput.value.trim() : 'Music';

      const res = await fetch(`/api/audio/approve-and-update/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          category: newCategory
        })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      // Remove from staging queue
      S.inflowStagingTracks = S.inflowStagingTracks.filter(t => String(t.id) !== String(id));

      // Reload tracks from server
      await loadTracks();

      toast(`'${newTitle || id}' 승인 완료! [${newCategory}] 카테고리로 이동합니다.`, 'success');

      // Jump to category view and highlight
      S.activeCategory = newCategory;
      switchView('all');
      setTimeout(() => {
        jumpToAudio(id, false);
      }, 250);
    } catch (e) {
      toast('승인 처리 실패: ' + e.message, 'error');
    }
  }

  async function refreshInflowTracks() {
    await loadTracks();
    toast('오디오 목록이 최신으로 새로고침되었습니다 🔄', 'info');
    if (S.view === 'inflow') renderInflowStagingView();
  }

  async function approveAllInflow() {
    const pendingTracks = S.tracks.filter(t => t.status === 'pending_review');
    const ids = pendingTracks.map(t => t.id);
    if (ids.length === 0) {
      toast('승인할 대기 중인 오디오가 없습니다.', 'info');
      return;
    }
    if (!confirm(`총 ${ids.length}개의 검토 대기 오디오를 모두 승인하시겠습니까?`)) return;

    try {
      const res = await fetch('/api/audio/bulk/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast(json.message || '전체 일괄 승인 완료 ✅', 'success');
      S.inflowStagingTracks = [];
      await loadTracks();
      if (S.view === 'inflow') renderInflowStagingView();
    } catch (e) {
      toast('일괄 승인 실패: ' + e.message, 'error');
    }
  }

  /* ─── Unified Admin Modal Manager ─── */
  function openAdminModal() {
    if (el.unifiedAdminModalBackdrop) {
      el.unifiedAdminModalBackdrop.style.display = 'flex';
      loadDbStats();
      loadCategoryMetadataForAdmin();
      loadAudioDbCategoryBlacklist();
      loadDeletedAudiosBlacklist();
    }
  }

  function closeAdminModal() {
    if (el.unifiedAdminModalBackdrop) {
      el.unifiedAdminModalBackdrop.style.display = 'none';
    }
  }

  function switchAdminTab(tabName) {
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    const panes = ['Stats', 'CatImg', 'Categories', 'Blacklist', 'Tools'];
    panes.forEach(p => {
      const elPane = document.getElementById(`adminTab${p}`);
      if (elPane) {
        elPane.style.display = p.toLowerCase() === tabName.toLowerCase() ? 'block' : 'none';
      }
    });
  }

  function renderCategories() {
    if (!el.categoryList) return;
    const catTitle = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('categories.title') : 'CATEGORIES';
    const isAdmin = S.auth.tier === 'admin' || S.auth.tier === 'owner';
    el.categoryList.innerHTML = `
      <div class="cat-section-label">${esc(catTitle)}</div>
      ${S.categories.map(cat => {
      const cnt = S.tracks.filter(t => t.category === cat).length;
      const isActive = S.activeCategory === cat;
      const isPending = cat === PENDING_REVIEW_CATEGORY;
      const displayName = isPending ? cat : tCategory(cat);
      const iconSvg = isPending
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="#ffaa00" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18V5l12-2v13"/></svg>';
      
      const catImg = S.categoryImages && S.categoryImages[cat];
      const hasImgClass = (catImg && !isPending) ? 'has-bg-img' : '';
      let styleAttr = '';
      if (isPending) {
        styleAttr = 'style="border-left:3px solid #ffaa00;background:rgba(255,170,0,0.08)"';
      } else if (catImg) {
        styleAttr = `style="--cat-bg-img: url('${esc(catImg)}');"`;
      }

      return `<button class="cat-item ${isActive ? 'active-cat' : ''} ${hasImgClass}" data-cat="${esc(cat)}" ${isPending ? '' : 'draggable="true" title="Drag to reorder category"'} ${styleAttr}>
          <span class="dot">${iconSvg}</span>
          <span class="cat-name">${esc(displayName)}</span>
          <span class="cat-cnt" ${isPending ? 'style="background:rgba(255,170,0,0.2);color:#ffaa00"' : ''}>${cnt}</span>
        </button>`;
    }).join('')}
    `;

    let draggedCat = null;

    el.categoryList.querySelectorAll('.cat-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        S.activeCategory = S.activeCategory === cat ? null : cat;
        S.currentPage = 1;
        setNavActive('categories');
        S.view = 'categories';
        el.activeFilter.style.display = S.activeCategory ? 'flex' : 'none';
        el.activeFilterVal.textContent = tCategory(S.activeCategory) || '';
        renderCategories();
        renderTracks();
      });

      // Drag & Drop Reordering Handlers
      btn.addEventListener('dragstart', (e) => {
        draggedCat = btn.dataset.cat;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggedCat);
        btn.classList.add('dragging');
      });

      btn.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (btn.dataset.cat !== draggedCat) {
          btn.classList.add('drag-over');
        }
      });

      btn.addEventListener('dragleave', () => {
        btn.classList.remove('drag-over');
      });

      btn.addEventListener('drop', (e) => {
        e.preventDefault();
        btn.classList.remove('drag-over');
        const targetCat = btn.dataset.cat;
        if (!draggedCat || draggedCat === targetCat) return;

        const fromIdx = S.categories.indexOf(draggedCat);
        const toIdx = S.categories.indexOf(targetCat);
        if (fromIdx !== -1 && toIdx !== -1) {
          S.categories.splice(fromIdx, 1);
          S.categories.splice(toIdx, 0, draggedCat);
          localStorage.setItem('audio_category_order', JSON.stringify(S.categories));
          renderCategories();
          toast('카테고리 순서가 구성되었습니다', 'info');
        }
      });

      btn.addEventListener('dragend', () => {
        el.categoryList.querySelectorAll('.cat-item').forEach(item => {
          item.classList.remove('dragging', 'drag-over');
        });
        draggedCat = null;
      });
    });
  }

  function isTempTitle(t) {
    if (!t || !t.title) return true;
    const title = String(t.title).trim();
    if (!title) return true;
    return /^(?:audio|scraped audio|unknown audio|untitled audio)(?:\s+\[?\d+\]?)?$/i.test(title);
  }

  function getPendingPriorityScore(t) {
    const hasYt = !!(t.youtubeUrl && String(t.youtubeUrl).trim());
    const isPlayable = t.serverPlayable === 1 || t.clientPlayable === 1 || (t.serverPlayable !== 0 && t.clientPlayable !== 0 && !!t.previewUrl);
    const isUnplayable = t.serverPlayable === 0 && t.clientPlayable === 0;
    const nameless = isTempTitle(t);

    // 1순위: 유튜브 맵핑된 거
    if (hasYt) return 1;

    // 2순위: 스튜디오에서 재생 확인된 거 (이름 있음)
    if (isPlayable && !nameless) return 2;

    // 3순위: 재생은 가능한데 이름 없는 거
    if (isPlayable && nameless) return 3;

    // 4순위: 재생 불가능한 거 (이름 있음)
    if (isUnplayable && !nameless) return 4;

    // 5순위: 재생 불가능 + 이름 없음
    if (isUnplayable && nameless) return 5;

    return 3; // Fallback middle
  }

  function getFilteredTracks() {
    let list = [...S.tracks];

    // View filter
    if (S.view === 'favorites') {
      list = list.filter(t => S.favorites.has(t.id));
    } else if (S.view === 'recent') {
      const recentIds = [...new Set(S.playHistory)];
      list = list.filter(t => recentIds.includes(t.id));
      list.sort((a, b) => recentIds.indexOf(a.id) - recentIds.indexOf(b.id));
    }

    // Category filter
    if (S.activeCategory) {
      list = list.filter(t => t.category === S.activeCategory);
    }

    // Pending review sub-filters (only when viewing pending review category)
    if (S.activeCategory === PENDING_REVIEW_CATEGORY) {
      const f = S.pendingSubFilters;
      if (f.activePlayable || f.youtubeMapped) {
        list = list.filter(t => {
          const matchActive = f.activePlayable && (t.serverPlayable === 1 || t.clientPlayable === 1);
          const matchYt = f.youtubeMapped && !!(t.youtubeUrl && String(t.youtubeUrl).trim());
          // OR logic: show track if it matches any active filter
          return matchActive || matchYt;
        });
      }
    }

    // Search
    if (S.searchQuery) {
      const q = S.searchQuery.trim().toLowerCase();
      if (S.fuseInstance) {
        const results = S.fuseInstance.search(q);
        const matchedIds = new Set(results.map(r => r.item.id));
        // Fallback plain substring match to guarantee exact/partial keyword hits
        list = list.filter(t =>
          matchedIds.has(t.id) ||
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.audioAssetId && String(t.audioAssetId).toLowerCase().includes(q)) ||
          (t.youtubeUrl && t.youtubeUrl.toLowerCase().includes(q))
        );
      } else {
        list = list.filter(t =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q)) ||
          (t.audioAssetId && String(t.audioAssetId).toLowerCase().includes(q)) ||
          (t.youtubeUrl && t.youtubeUrl.toLowerCase().includes(q))
        );
      }
    }

    // Sort
    if (S.activeCategory === PENDING_REVIEW_CATEGORY && (S.sortMode === 'default' || S.sortMode === 'recommended')) {
      list.sort((a, b) => {
        const scoreA = getPendingPriorityScore(a);
        const scoreB = getPendingPriorityScore(b);
        if (scoreA !== scoreB) return scoreA - scoreB;
        return (a.title || '').localeCompare(b.title || '');
      });
    } else {
      switch (S.sortMode) {
        case 'recommended':
        case 'default': {
          list.sort((a, b) => {
            const hasYtA = !!(a.youtubeUrl && String(a.youtubeUrl).trim());
            const hasYtB = !!(b.youtubeUrl && String(b.youtubeUrl).trim());
            const activeA = a.serverPlayable === 1 && a.clientPlayable === 1;
            const activeB = b.serverPlayable === 1 && b.clientPlayable === 1;
            if (activeA && hasYtA && !(activeB && hasYtB)) return -1;
            if (activeB && hasYtB && !(activeA && hasYtA)) return 1;
            if (activeA && !activeB) return -1;
            if (activeB && !activeA) return 1;
            if (hasYtA && !hasYtB) return -1;
            if (hasYtB && !hasYtA) return 1;
            return (a.title || '').localeCompare(b.title || '');
          });
          break;
        }
        case 'latest': {
          list.sort((a, b) => {
            const idA = parseInt(String(a.id || a.audioAssetId).replace(/\D/g, ''), 10) || 0;
            const idB = parseInt(String(b.id || b.audioAssetId).replace(/\D/g, ''), 10) || 0;
            return idB - idA;
          });
          break;
        }
        case 'oldest': {
          list.sort((a, b) => {
            const idA = parseInt(String(a.id || a.audioAssetId).replace(/\D/g, ''), 10) || 0;
            const idB = parseInt(String(b.id || b.audioAssetId).replace(/\D/g, ''), 10) || 0;
            return idA - idB;
          });
          break;
        }
        case 'title_asc': list.sort((a, b) => (a.title || '').localeCompare(b.title || '')); break;
        case 'title_desc': list.sort((a, b) => (b.title || '').localeCompare(a.title || '')); break;
        case 'duration_desc': list.sort((a, b) => (b.duration || 0) - (a.duration || 0)); break;
        case 'duration_asc': list.sort((a, b) => (a.duration || 0) - (b.duration || 0)); break;
        case 'asset_id_asc': {
          list.sort((a, b) => {
            const numA = BigInt(String(a.audioAssetId || a.id || '0').replace(/\D/g, '') || 0);
            const numB = BigInt(String(b.audioAssetId || b.id || '0').replace(/\D/g, '') || 0);
            return numA < numB ? -1 : numA > numB ? 1 : 0;
          });
          break;
        }
        case 'asset_id_desc': {
          list.sort((a, b) => {
            const numA = BigInt(String(a.audioAssetId || a.id || '0').replace(/\D/g, '') || 0);
            const numB = BigInt(String(b.audioAssetId || b.id || '0').replace(/\D/g, '') || 0);
            return numA > numB ? -1 : numA < numB ? 1 : 0;
          });
          break;
        }
        case 'yt_first': {
          list.sort((a, b) => {
            const hasYtA = !!(a.youtubeUrl && String(a.youtubeUrl).trim());
            const hasYtB = !!(b.youtubeUrl && String(b.youtubeUrl).trim());
            if (hasYtA !== hasYtB) return hasYtA ? -1 : 1;
            return (a.title || '').localeCompare(b.title || '');
          });
          break;
        }
        case 'yt_none': {
          list.sort((a, b) => {
            const hasYtA = !!(a.youtubeUrl && String(a.youtubeUrl).trim());
            const hasYtB = !!(b.youtubeUrl && String(b.youtubeUrl).trim());
            if (hasYtA !== hasYtB) return hasYtA ? 1 : -1;
            return (a.title || '').localeCompare(b.title || '');
          });
          break;
        }
        case 'active_first': {
          list.sort((a, b) => {
            const activeA = a.serverPlayable === 1 && a.clientPlayable === 1 ? 1 : (a.serverPlayable === 1 || a.clientPlayable === 1 ? 2 : 3);
            const activeB = b.serverPlayable === 1 && b.clientPlayable === 1 ? 1 : (b.serverPlayable === 1 || b.clientPlayable === 1 ? 2 : 3);
            if (activeA !== activeB) return activeA - activeB;
            return (a.title || '').localeCompare(b.title || '');
          });
          break;
        }
        case 'inactive_first': {
          list.sort((a, b) => {
            const inA = a.serverPlayable === 0 && a.clientPlayable === 0 ? 1 : 2;
            const inB = b.serverPlayable === 0 && b.clientPlayable === 0 ? 1 : 2;
            if (inA !== inB) return inA - inB;
            return (a.title || '').localeCompare(b.title || '');
          });
          break;
        }
        case 'category_asc': list.sort((a, b) => (a.category || '').localeCompare(b.category || '')); break;
      }
    }

    return list;
  }

  /* ─── BATCH OPERATIONS (Admin Pending Review) ──────────── */

  /* ─── BATCH OPERATIONS (Admin Bulk Actions & Category Change) ─── */

  function openBulkCategoryModal() {
    const ids = [...S.batchSelected];
    if (ids.length === 0) return toast('카테고리를 변경할 오디오를 1개 이상 선택해 주세요', 'warning');

    if (el.bulkModalCount) el.bulkModalCount.textContent = ids.length;

    if (el.bulkCategorySelect) {
      const cats = S.categories.filter(c => c !== PENDING_REVIEW_CATEGORY && c);
      el.bulkCategorySelect.innerHTML = `
        <option value="">-- 기존 카테고리 선택 --</option>
        ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      `;
    }
    if (el.bulkCategoryCustomInput) el.bulkCategoryCustomInput.value = '';

    if (el.bulkCategoryModalBackdrop) {
      el.bulkCategoryModalBackdrop.style.display = 'flex';
      el.bulkCategoryModalBackdrop.classList.add('open');
    }
  }

  function closeBulkCategoryModal() {
    if (el.bulkCategoryModalBackdrop) {
      el.bulkCategoryModalBackdrop.style.display = 'none';
      el.bulkCategoryModalBackdrop.classList.remove('open');
    }
  }

  async function executeBulkCategoryChange() {
    const ids = [...S.batchSelected];
    if (ids.length === 0) return toast('선택된 오디오가 없습니다', 'warning');

    const selectedVal = el.bulkCategorySelect ? el.bulkCategorySelect.value.trim() : '';
    const customVal = el.bulkCategoryCustomInput ? el.bulkCategoryCustomInput.value.trim() : '';
    const targetCategory = customVal || selectedVal;

    const subSelectVal = el.bulkSubCategorySelect ? el.bulkSubCategorySelect.value.trim() : '';
    const subCustomVal = el.bulkSubCategoryCustomInput ? el.bulkSubCategoryCustomInput.value.trim() : '';
    const targetSub = subSelectVal === '__custom__' ? (subCustomVal || null) : (subSelectVal || subCustomVal || null);

    if (!targetCategory && customVal === '') {
      return toast('변경할 카테고리를 선택하거나 직접 입력해 주세요', 'error');
    }

    try {
      const res = await fetch('/api/audio/bulk/category', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioIds: ids,
          category: targetCategory,
          subCategory: targetSub
        })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      toast(json.message || `${ids.length}개 오디오의 카테고리가 '${targetCategory}${targetSub ? ' > ' + targetSub : ''}'(으)로 변경되었습니다! ✅`, 'success');
      S.batchSelected.clear();
      closeBulkCategoryModal();
      await loadTracks();
    } catch (e) {
      toast('일괄 카테고리 변경 실패: ' + e.message, 'error');
    }
  }

  function renderBatchBar() {
    const isAdmin = S.auth.tier === 'admin' || S.auth.tier === 'owner';
    const isPendingView = S.activeCategory === PENDING_REVIEW_CATEGORY;
    const shouldShow = isAdmin && (isPendingView || S.isSelectionMode || S.batchSelected.size > 0);

    if (!shouldShow) {
      removeBatchBar();
      return;
    }

    let bar = document.getElementById('batchActionBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'batchActionBar';
      bar.className = 'batch-action-bar visible';
      el.tracksGrid.parentNode.insertBefore(bar, el.tracksGrid);
    } else {
      bar.classList.add('visible');
    }

    const selectedCount = S.batchSelected.size;
    const totalCurrent = S.filtered.length;
    const allSelected = totalCurrent > 0 && selectedCount === totalCurrent;

    const fActive = S.pendingSubFilters.activePlayable;
    const fYt = S.pendingSubFilters.youtubeMapped;

    bar.innerHTML = `
      <div class="batch-bar-inner">
        <div class="batch-bar-row batch-bar-top">
          <label class="batch-select-all-wrap" title="전체 선택/해제">
            <input type="checkbox" id="batchSelectAllCb" ${allSelected ? 'checked' : ''} />
            <span class="batch-select-all-label">전체 선택</span>
          </label>
          <span class="batch-bar-count" id="batchBarCount">${selectedCount}개 선택됨</span>
          <div class="batch-bar-actions">
            ${isPendingView ? `
            <button class="batch-btn batch-approve-btn" id="batchApproveBtn" ${selectedCount === 0 ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              선택 승인 (${selectedCount})
            </button>` : ''}
            <button class="batch-btn batch-category-btn" id="batchCategoryBtn" ${selectedCount === 0 ? 'disabled' : ''} style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              카테고리 변경 (${selectedCount})
            </button>
            <button class="batch-btn batch-delete-btn" id="batchDeleteBtn" ${selectedCount === 0 ? 'disabled' : ''}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              선택 삭제 (${selectedCount})
            </button>
            <button class="batch-btn" id="batchCloseSelectionBtn" style="background:rgba(255,255,255,0.08);color:var(--c-text3);border:none" title="선택 모드 닫기">✕</button>
          </div>
        </div>
        ${isPendingView ? `
        <div class="batch-bar-row batch-bar-filters">
          <span class="batch-filter-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            필터
          </span>
          <label class="batch-filter-toggle ${fActive ? 'active' : ''}" title="Roblox Studio 서버/클라이언트 재생 가능 오디오">
            <input type="checkbox" id="filterActivePlayable" ${fActive ? 'checked' : ''} />
            <span class="batch-filter-icon">🟢</span>
            <span class="batch-filter-text">활성화 오디오</span>
          </label>
          <label class="batch-filter-toggle ${fYt ? 'active' : ''}" title="YouTube URL이 매핑된 오디오">
            <input type="checkbox" id="filterYoutubeMapped" ${fYt ? 'checked' : ''} />
            <span class="batch-filter-icon">▶</span>
            <span class="batch-filter-text">유튜브 맵핑</span>
          </label>
        </div>` : ''}
      </div>
    `;

    // Bind events
    const selectAllCb = document.getElementById('batchSelectAllCb');
    if (selectAllCb) {
      selectAllCb.onchange = () => batchSelectAll(selectAllCb.checked);
    }
    const approveBtn = document.getElementById('batchApproveBtn');
    if (approveBtn) {
      approveBtn.onclick = handleBatchApprove;
    }
    const catBtn = document.getElementById('batchCategoryBtn');
    if (catBtn) {
      catBtn.onclick = openBulkCategoryModal;
    }
    const deleteBtn = document.getElementById('batchDeleteBtn');
    if (deleteBtn) {
      deleteBtn.onclick = handleBatchDelete;
    }
    const closeSelBtn = document.getElementById('batchCloseSelectionBtn');
    if (closeSelBtn) {
      closeSelBtn.onclick = () => {
        S.isSelectionMode = false;
        S.batchSelected.clear();
        renderTracks();
      };
    }

    // Sub-filter toggle bindings
    const filterActiveCb = document.getElementById('filterActivePlayable');
    if (filterActiveCb) {
      filterActiveCb.onchange = () => {
        S.pendingSubFilters.activePlayable = filterActiveCb.checked;
        S.batchSelected.clear();
        S.currentPage = 1;
        renderTracks();
      };
    }
    const filterYtCb = document.getElementById('filterYoutubeMapped');
    if (filterYtCb) {
      filterYtCb.onchange = () => {
        S.pendingSubFilters.youtubeMapped = filterYtCb.checked;
        S.batchSelected.clear();
        S.currentPage = 1;
        renderTracks();
      };
    }
  }

  function removeBatchBar() {
    const bar = document.getElementById('batchActionBar');
    if (bar) bar.remove();
  }

  function updateBatchBarCounts() {
    const bar = document.getElementById('batchActionBar');
    if (!bar) return;
    renderBatchBar();
  }

  function batchSelectAll(checked) {
    S.batchSelected.clear();
    if (checked) {
      S.filtered.forEach(t => S.batchSelected.add(t.id));
    }
    el.tracksGrid.querySelectorAll('.batch-checkbox').forEach(cb => {
      cb.checked = checked;
      const card = cb.closest('.track-card');
      if (card) card.classList.toggle('batch-selected', checked);
    });
    updateBatchBarCounts();
  }

  async function handleBatchApprove() {
    const ids = [...S.batchSelected];
    if (ids.length === 0) return;
    if (!confirm(`${ids.length}개의 오디오를 일괄 승인하시겠습니까?`)) return;

    try {
      const res = await fetch('/api/audio/batch-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast(`${json.updatedCount}개 오디오 일괄 승인 완료 ✅`, 'success');
      S.batchSelected.clear();
      await loadTracks();
    } catch (e) {
      toast('일괄 승인 실패: ' + e.message, 'error');
    }
  }

  async function handleBatchDelete() {
    const ids = [...S.batchSelected];
    if (ids.length === 0) return;
    if (!confirm(`⚠️ ${ids.length}개의 오디오를 일괄 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      const res = await fetch('/api/audio/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast(`${json.deletedCount}개 오디오 일괄 삭제 완료 🗑`, 'success');
      S.batchSelected.clear();
      await loadTracks();
    } catch (e) {
      toast('일괄 삭제 실패: ' + e.message, 'error');
    }
  }

  /* ─── PAGINATION HELPERS ─────────────────────────────────── */
  function getPagedTracks() {
    const total = S.filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / S.pageSize));
    if (S.currentPage > totalPages) S.currentPage = totalPages;
    if (S.currentPage < 1) S.currentPage = 1;
    const startIdx = (S.currentPage - 1) * S.pageSize;
    const endIdx = Math.min(startIdx + S.pageSize, total);
    return {
      items: S.filtered.slice(startIdx, endIdx),
      startIdx,
      endIdx,
      totalPages,
      totalFiltered: total,
    };
  }

  function renderPagination(paged) {
    let container = document.getElementById('paginationContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'paginationContainer';
      container.className = 'pagination-container';
      // Insert after tracksGrid
      el.tracksGrid.parentNode.insertBefore(container, el.tracksGrid.nextSibling);
    }

    const { startIdx, endIdx, totalPages, totalFiltered } = paged;
    if (totalPages <= 1 && totalFiltered <= S.pageSize) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';

    // Build page buttons (show max 7 page numbers with ellipsis)
    let pageButtons = '';
    const maxVisible = 7;
    let pages = [];
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      let start = Math.max(2, S.currentPage - 2);
      let end = Math.min(totalPages - 1, S.currentPage + 2);
      if (S.currentPage <= 3) { start = 2; end = 5; }
      if (S.currentPage >= totalPages - 2) { start = totalPages - 4; end = totalPages - 1; }
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    pages.forEach(p => {
      if (p === '...') {
        pageButtons += `<span class="page-ellipsis">…</span>`;
      } else {
        pageButtons += `<button class="page-btn ${p === S.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`;
      }
    });

    const pageSizeOptions = [50, 100, 150, 200].map(v =>
      `<option value="${v}" ${v === S.pageSize ? 'selected' : ''}>${v}개씩</option>`
    ).join('');

    container.innerHTML = `
      <div class="pagination-inner">
        <div class="pagination-info">
          <span>${startIdx + 1} – ${endIdx} / 총 ${totalFiltered}개</span>
        </div>
        <div class="pagination-nav">
          <button class="page-nav-btn" data-page="1" ${S.currentPage === 1 ? 'disabled' : ''} title="처음">«</button>
          <button class="page-nav-btn" data-page="${S.currentPage - 1}" ${S.currentPage === 1 ? 'disabled' : ''} title="이전">‹</button>
          ${pageButtons}
          <button class="page-nav-btn" data-page="${S.currentPage + 1}" ${S.currentPage === totalPages ? 'disabled' : ''} title="다음">›</button>
          <button class="page-nav-btn" data-page="${totalPages}" ${S.currentPage === totalPages ? 'disabled' : ''} title="마지막">»</button>
        </div>
        <div class="pagination-size">
          <select id="pageSizeSelect" class="page-size-select">${pageSizeOptions}</select>
        </div>
      </div>
    `;

    // Bind pagination events
    container.querySelectorAll('[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.dataset.page, 10);
        if (isNaN(p) || p < 1 || p > totalPages || p === S.currentPage) return;
        S.currentPage = p;
        renderTracks();
        // Scroll content area to top
        el.contentArea.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    const pageSizeSel = document.getElementById('pageSizeSelect');
    if (pageSizeSel) {
      pageSizeSel.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value, 10);
        if (!isNaN(newSize) && newSize > 0) {
          S.pageSize = newSize;
          localStorage.setItem('kadio-pageSize', String(newSize));
          S.currentPage = 1;
          renderTracks();
        }
      });
    }
  }

  function renderTracks() {
    S.filtered = getFilteredTracks();
    el.shownCount.textContent = S.filtered.length;

    if (S.tracks.length === 0) {
      el.emptyState.style.display = 'flex';
      el.noResults.style.display = 'none';
      el.tracksGrid.style.display = 'none';
      removeBatchBar();
      removePagination();
      return;
    }

    el.emptyState.style.display = 'none';

    if (S.filtered.length === 0) {
      el.noResults.style.display = 'flex';
      el.tracksGrid.style.display = 'none';
      removeBatchBar();
      removePagination();
      return;
    }

    el.noResults.style.display = 'none';
    el.tracksGrid.style.display = '';
    el.tracksGrid.className = S.viewMode === 'list' ? 'tracks-grid list-view' : 'tracks-grid';

    // Batch action bar
    const isPendingView = S.activeCategory === PENDING_REVIEW_CATEGORY;
    const isAdmin = S.auth.tier === 'admin' || S.auth.tier === 'owner';
    if (isAdmin && (isPendingView || S.isSelectionMode || S.batchSelected.size > 0)) {
      renderBatchBar();
    } else {
      removeBatchBar();
      if (!S.isSelectionMode) {
        S.batchSelected.clear();
      }
    }

    // Pagination: get only the current page slice
    const paged = getPagedTracks();
    const pagedItems = paged.items;

    const currentId = S.filtered[S.currentTrackIdx]?.id;

    el.tracksGrid.innerHTML = pagedItems.map((t, localIdx) => {
      // Use the real index in S.filtered (for playTrackByIndex)
      const filteredIdx = paged.startIdx + localIdx;
      const isFav = S.favorites.has(t.id);
      const isCurrentPlaying = currentId === t.id && S.isPlaying;

      // Extract Cover Image: Use t.imageUrl directly or fallback to YouTube Thumbnail if present
      let coverImgSrc = t.imageUrl || null;
      let ytVideoId = null;
      if (t.youtubeUrl) {
        const m = t.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
        if (m) {
          ytVideoId = m[1];
          if (!coverImgSrc) coverImgSrc = `https://img.youtube.com/vi/${ytVideoId}/hqdefault.jpg`;
        }
      }

      const ytBgHtml = coverImgSrc ? `<img class="track-youtube-bg" src="${esc(coverImgSrc)}" alt="Track Cover" onerror="this.style.display='none';window._kadio && window._kadio.handleMediaError && window._kadio.handleMediaError('${t.id}','${esc(t.title).replace(/'/g, "\\'")}','IMAGE_404')" />` : '';

      const showCheckbox = isAdmin;
      const isCheckboxPinned = isPendingView || S.isSelectionMode || S.batchSelected.size > 0;
      const isChecked = S.batchSelected.has(t.id);

      return `
        <div class="track-card ${isFav ? 'is-fav' : ''} ${isCurrentPlaying ? 'is-playing' : ''} ${isChecked ? 'batch-selected' : ''} ${showCheckbox ? 'has-batch-checkbox' : ''} ${isCheckboxPinned ? 'batch-checkbox-pinned' : ''}" data-idx="${filteredIdx}" data-id="${t.id}" tabindex="0">
          ${showCheckbox ? `<label class="batch-checkbox-wrap" onclick="event.stopPropagation()"><input type="checkbox" class="batch-checkbox" data-batch-id="${t.id}" ${isChecked ? 'checked' : ''} /><span class="batch-checkmark"></span></label>` : ''}
          ${ytBgHtml}
          <div class="card-header">
            <span class="track-category-pill">${esc(t.category)}</span>
            <div class="card-header-right">
              <button class="fav-star ${isFav ? 'active' : ''}" data-fav-id="${t.id}" title="즐겨찾기">${isFav ? '★' : '☆'}</button>
            </div>
          </div>
          <div class="track-title">${esc(t.title)}</div>
          <div class="track-meta">
            <span class="meta-chip"><span class="meta-icon">🎵</span>${esc(t.audioAssetId)}</span>
            ${t.youtubeUrl ? '<span class="meta-chip" style="color:var(--c-accent3);border-color:rgba(255,107,138,0.3);background:rgba(255,107,138,0.08)"><span class="meta-icon">▶</span>YouTube</span>' : ''}
            ${t.status === 'pending_review' ? '<span class="meta-chip" style="color:var(--c-gold)">⏳ 검토중</span>' : ''}
            ${t.isVerifiedLocked === 1 ? '<span class="meta-chip" style="background:rgba(255,170,0,0.12);border-color:rgba(255,170,0,0.3);color:#ffaa00" title="관리자 수동 잠금 (자동 재검증 제외)">🔒 수동 고정</span>' : ''}
            <span class="meta-chip" style="background:rgba(0,229,255,0.06);border-color:rgba(0,229,255,0.2)" title="Roblox Studio 검증 (Server / Client 재생 여부)">
              S: ${t.serverPlayable === 1 ? '🟢' : t.serverPlayable === 0 ? '🔴' : '⚪'} 
              C: ${t.clientPlayable === 1 ? '🔵' : t.clientPlayable === 0 ? '🔴' : '⚪'}
              ${t.duration > 0 ? ' | ' + t.duration.toFixed(1) + 's' : ''}
            </span>
          </div>

          <div class="card-actions">
            <button class="action-btn play-btn" data-play-idx="${filteredIdx}" title="재생">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                ${isCurrentPlaying ? '<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>' : '<path d="M8 5v14l11-7z"/>'}
              </svg>
            </button>
            <button class="action-btn copy-id-btn" data-copy-asset-id="${esc(t.audioAssetId)}" title="Asset ID 복사">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <a class="action-btn roblox-link" href="https://create.roblox.com/store/asset/${esc(t.audioAssetId)}" target="_blank" rel="noopener noreferrer" title="Roblox 스토어 열기">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
            ${isAdmin && t.status === 'pending_review' ? `
            <button class="action-btn approve-btn" data-approve-id="${t.id}" title="검토 승인" style="color:var(--c-green);border-color:rgba(57,232,140,0.3)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>` : ''}
            ${isAdmin ? `
            <button class="action-btn edit-btn" data-edit-id="${t.id}" title="수정">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="action-btn del-btn" data-del-id="${t.id}" title="삭제">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
            </button>` : ''}
            <button class="action-btn detail-btn" data-detail-idx="${filteredIdx}" title="상세 정보">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </button>
            <button class="action-btn reverify-btn" data-reverify-id="${esc(t.audioAssetId || t.id)}" title="Roblox Studio 인게임 검증 요청">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#00e5ff" stroke="#00ffff" stroke-width="1"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </button>

            <button class="action-btn report-btn" data-report-id="${t.id}" title="신고">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            </button>
          </div>
        </div>`;
    }).join('');

    // Bind card events via delegation
    el.tracksGrid.onclick = handleGridClick;

    // Render pagination controls
    renderPagination(paged);
  }

  function removePagination() {
    const c = document.getElementById('paginationContainer');
    if (c) c.style.display = 'none';
  }

  async function reverifyAudio(id) {
    try {
      let numAssetId = (id === 'all') ? 'all' : (String(id).replace(/\D/g, '') || String(id));
      const payloadId = (numAssetId !== 'all' && /^\d+$/.test(numAssetId)) ? Number(numAssetId) : numAssetId;

      const res = await fetch('/api/audio/studio/reverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioAssetId: payloadId, audioId: payloadId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        toast('🚀 Roblox Studio 인게임 검증 요청이 전송되었습니다!', 'success');
        await loadTracks();
      } else {
        toast(json.message || '검증 요청 실패', 'error');
      }
    } catch (e) {
      toast('검증 요청 오류: ' + e.message, 'error');
    }
  }


  async function approveAudio(id) {
    try {
      const res = await fetch(`/api/audio/approve/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast('오디오 승인 완료', 'success');
      await loadTracks();
    } catch (e) {
      toast('승인 실패: ' + e.message, 'error');
    }
  }

  function handleGridClick(e) {
    // Handle batch checkbox toggle
    if (e.target.classList.contains('batch-checkbox')) {
      const batchId = e.target.dataset.batchId;
      if (e.target.checked) {
        S.batchSelected.add(batchId);
      } else {
        S.batchSelected.delete(batchId);
      }
      // Update card highlight
      const card = e.target.closest('.track-card');
      if (card) card.classList.toggle('batch-selected', e.target.checked);
      updateBatchBarCounts();
      return;
    }

    const target = e.target.closest('[data-fav-id]') ||
      e.target.closest('[data-play-idx]') ||
      e.target.closest('[data-copy-asset-id]') ||
      e.target.closest('[data-detail-idx]') ||
      e.target.closest('[data-reverify-id]') ||
      e.target.closest('[data-approve-id]') ||
      e.target.closest('[data-edit-id]') ||
      e.target.closest('[data-del-id]') ||
      e.target.closest('[data-report-id]') ||
      e.target.closest('.track-card');

    if (!target) return;

    if (target.dataset.favId) {
      toggleFavorite(target.dataset.favId, e);
    } else if (target.dataset.playIdx !== undefined) {
      playTrackByIndex(parseInt(target.dataset.playIdx, 10));
    } else if (target.dataset.copyAssetId) {
      e.stopPropagation();
      navigator.clipboard.writeText(target.dataset.copyAssetId);
      toast(`Asset ID 복사됨: ${target.dataset.copyAssetId}`, 'success');
    } else if (target.dataset.detailIdx !== undefined) {
      e.stopPropagation();
      openTrackDetail(parseInt(target.dataset.detailIdx, 10));
    } else if (target.dataset.reverifyId) {
      e.stopPropagation();
      reverifyAudio(target.dataset.reverifyId);
    } else if (target.dataset.approveId) {
      approveAudio(target.dataset.approveId);
    } else if (target.dataset.editId) {
      openEditModal(target.dataset.editId);
    } else if (target.dataset.delId) {
      deleteAudio(target.dataset.delId);
    } else if (target.dataset.reportId) {
      openReportModal(target.dataset.reportId);
    } else if (target.classList.contains('track-card')) {
      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Click: Toggle batch checkbox
        const cb = target.querySelector('.batch-checkbox');
        if (cb) {
          cb.checked = !cb.checked;
          const batchId = cb.dataset.batchId;
          if (cb.checked) {
            S.batchSelected.add(batchId);
          } else {
            S.batchSelected.delete(batchId);
          }
          target.classList.toggle('batch-selected', cb.checked);
          updateBatchBarCounts();
        }
      } else {
        // Normal click: Open detail modal
        const idx = parseInt(target.dataset.idx, 10);
        openTrackDetail(idx);
      }
    }
  }



  /* ─── TRACK DETAIL MODAL ────────────────────────────────── */
  function openTrackDetail(idx) {
    const t = S.filtered[idx];
    if (!t) return;
    const isFav = S.favorites.has(t.id);
    const isAdmin = S.auth.tier === 'admin' || S.auth.tier === 'owner';

    el.modalBody.innerHTML = `
      <div style="margin-bottom:16px">
        <div class="track-category-pill" style="display:inline-block;margin-bottom:8px">${esc(t.category)}</div>
        <h2 style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700;margin-bottom:4px">${esc(t.title)}</h2>
        <p style="font-size:12px;color:var(--c-text3);font-family:'DM Mono',monospace">Asset ID: ${esc(t.audioAssetId)}</p>
      </div>
      ${t.youtubeUrl ? `<div style="margin-bottom:12px"><a href="${esc(t.youtubeUrl)}" target="_blank" style="color:var(--c-accent);font-size:13px">🎬 YouTube 링크 열기</a></div>` : ''}
      <div style="margin-bottom:16px;padding:12px;background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);border-radius:10px;font-size:12px">
        <div style="font-weight:700;margin-bottom:6px;color:#00e5ff">🚀 Roblox Studio 오디오 검증 상태</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div>서버(Server): ${t.serverPlayable === 1 ? '<span style="color:#39e88c;font-weight:700">🟢 재생 가능</span>' : t.serverPlayable === 0 ? '<span style="color:#ff4d4d;font-weight:700">🔴 재생 불가</span>' : '<span style="color:var(--c-text3)">⚪ 미검증</span>'}</div>
          <div>클라이언트(Client): ${t.clientPlayable === 1 ? '<span style="color:#54c7ff;font-weight:700">🔵 재생 가능</span>' : t.clientPlayable === 0 ? '<span style="color:#ff4d4d;font-weight:700">🔴 재생 불가</span>' : '<span style="color:var(--c-text3)">⚪ 미검증</span>'}</div>
          <div>재생 길이: <strong style="color:var(--c-text)">${t.duration > 0 ? t.duration.toFixed(2) + '초' : '미측정'}</strong></div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-primary" onclick="window._kadio.playIdx(${idx})">▶ 재생</button>
        <button class="btn-secondary" onclick="window._kadio.toggleFav('${t.id}')">${isFav ? '★ 즐겨찾기 해제' : '☆ 즐겨찾기 추가'}</button>
        <button class="btn-secondary" onclick="window._kadio.broadcastAudio('${t.id}')" style="color:#ffaa00;border-color:rgba(255,170,0,0.4)">📡 인게임 전송</button>
        <button class="btn-secondary" onclick="window._kadio.reverifyAudio('${t.id}')" style="color:#00e5ff;border-color:rgba(0,229,255,0.3)">⚡ Studio 인게임 검증 요청</button>
        ${isAdmin ? `<button class="btn-secondary" onclick="window._kadio.editModal('${t.id}')">✏ 수정</button>` : ''}
        <button class="btn-secondary" onclick="window._kadio.reportModal('${t.id}')">🚩 신고</button>
      </div>


    `;
    el.modalBackdrop.classList.add('open');
  }

  function closeModal() {
    el.modalBackdrop.classList.remove('open');
  }

  async function editAudio(id, data) {
    try {
      const res = await fetch(`/api/audio/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast('오디오 정보 및 검증 잠금이 수정되었습니다', 'success');
      await loadTracks();
    } catch (e) {
      toast('수정 실패: ' + e.message, 'error');
    }
  }

  /* ─── EDIT MODAL ────────────────────────────────────────── */
  function openEditModal(id) {
    const t = S.tracks.find(tr => tr.id === id);
    if (!t) return;

    const catOptions = S.categories.map(c => `<option value="${esc(c)}" ${t.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('');

    el.modalBody.innerHTML = `
      <h3 style="font-family:'Syne',sans-serif;font-size:18px;margin-bottom:16px">오디오 수정</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="font-size:12px;color:var(--c-text2)">제목</label>
        <input type="text" id="editTitle" value="${esc(t.title)}" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        <label style="font-size:12px;color:var(--c-text2)">카테고리 (드롭다운 선택 또는 직접 입력)</label>
        <div style="display:flex;gap:6px">
          <select id="editCategorySelect" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px;font-size:13px;outline:none;width:40%">
            <option value="">선택...</option>
            ${catOptions}
            <option value="__custom__">+ 직접 입력</option>
          </select>
          <input type="text" id="editCategory" value="${esc(t.category)}" placeholder="카테고리 직접 입력" style="flex:1;background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        </div>
        <label style="font-size:12px;color:var(--c-text2)">YouTube URL (선택)</label>
        <input type="text" id="editYoutube" value="${esc(t.youtubeUrl || '')}" placeholder="https://youtube.com/watch?v=..." style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        <label style="font-size:12px;color:var(--c-text2)">커버 이미지 URL (YouTube 외 직접 이미지 맵핑)</label>
        <input type="text" id="editImageUrl" value="${esc(t.imageUrl || '')}" placeholder="https://example.com/cover.png" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        
        <hr style="border:0;border-top:1px solid var(--c-border2);margin:8px 0 4px 0"/>
        <div style="font-size:12px;font-weight:700;color:#00e5ff">🛠️ 오디오 재생 상태 및 검증 잠금 설정 (관리자 전용)</div>
        <div style="display:flex;gap:10px">
          <div style="flex:1">
            <label style="font-size:11px;color:var(--c-text2)">서버 재생 (Server)</label>
            <select id="editServerPlayable" style="width:100%;background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:6px;font-size:12px">
              <option value="1" ${t.serverPlayable === 1 ? 'selected' : ''}>🟢 재생 가능 (Playable)</option>
              <option value="0" ${t.serverPlayable === 0 ? 'selected' : ''}>🔴 재생 불가 (Failed)</option>
              <option value="-1" ${t.serverPlayable === -1 ? 'selected' : ''}>⚪ 미검증 (Unchecked)</option>
            </select>
          </div>
          <div style="flex:1">
            <label style="font-size:11px;color:var(--c-text2)">클라이언트 재생 (Client)</label>
            <select id="editClientPlayable" style="width:100%;background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:6px;font-size:12px">
              <option value="1" ${t.clientPlayable === 1 ? 'selected' : ''}>🔵 재생 가능 (Playable)</option>
              <option value="0" ${t.clientPlayable === 0 ? 'selected' : ''}>🔴 재생 불가 (Failed)</option>
              <option value="-1" ${t.clientPlayable === -1 ? 'selected' : ''}>⚪ 미검증 (Unchecked)</option>
            </select>
          </div>
        </div>

        <div style="display:flex;gap:10px;align-items:center;margin-top:4px">
          <div style="flex:1">
            <label style="font-size:11px;color:var(--c-text2)">오디오 재생 길이 (초)</label>
            <input type="number" step="0.1" id="editDuration" value="${t.duration || 0}" style="width:100%;background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:6px 10px;font-size:12px"/>
          </div>
          <div style="flex:1;display:flex;align-items:center;gap:8px;padding-top:16px">
            <input type="checkbox" id="editIsVerifiedLocked" ${t.isVerifiedLocked === 1 ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer"/>
            <label for="editIsVerifiedLocked" style="font-size:12px;font-weight:700;color:#ffaa00;cursor:pointer" title="체크 시 Studio 자동 재검증 대상에서 제외되고 수동 설정이 고정됩니다.">🔒 수동 고정 (자동 재검증 방지)</label>
          </div>
        </div>

        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-secondary" id="editYtSearchBtn">🔍 유튜브 검색</button>
        </div>
        <div id="ytSearchResults" style="max-height:200px;overflow-y:auto"></div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-primary" id="editSaveBtn">저장</button>
          <button class="btn-secondary" onclick="window._kadio.closeModal()">취소</button>
        </div>
      </div>
    `;

    $('editCategorySelect').addEventListener('change', (e) => {
      if (e.target.value && e.target.value !== '__custom__') {
        $('editCategory').value = e.target.value;
      } else if (e.target.value === '__custom__') {
        $('editCategory').value = '';
        $('editCategory').focus();
      }
    });

    $('editSaveBtn').addEventListener('click', async () => {
      await editAudio(id, {
        title: $('editTitle').value.trim(),
        gameName: $('editCategory').value.trim(),
        youtubeUrl: $('editYoutube').value.trim(),
        imageUrl: $('editImageUrl').value.trim(),
        serverPlayable: parseInt($('editServerPlayable').value, 10),
        clientPlayable: parseInt($('editClientPlayable').value, 10),
        duration: parseFloat($('editDuration').value) || 0,
        isVerifiedLocked: $('editIsVerifiedLocked').checked ? 1 : 0
      });
      closeModal();
    });


    $('editYtSearchBtn').addEventListener('click', async () => {
      const q = $('editTitle').value.trim() || t.title;
      const results = await searchYoutube(q);
      $('ytSearchResults').innerHTML = results.map(r => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px;cursor:pointer;border-radius:var(--radius-sm);transition:background 0.15s" onmouseover="this.style.background='var(--c-surface3)'" onmouseout="this.style.background='transparent'" onclick="document.getElementById('editYoutube').value='${esc(r.videoUrl)}'">
          <img src="${esc(r.thumbnail)}" style="width:80px;height:45px;border-radius:4px;object-fit:cover" />
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--c-text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.title)}</div>
            <div style="font-size:11px;color:var(--c-text3)">${esc(r.author)} · ${esc(r.duration)}</div>
          </div>
        </div>
      `).join('') || '<div style="font-size:12px;color:var(--c-text3);padding:8px">검색 결과 없음</div>';
    });

    el.modalBackdrop.classList.add('open');
  }

  /* ─── ADD AUDIO MODAL ───────────────────────────────────── */
  function openAddModal() {
    el.modalBody.innerHTML = `
      <h3 style="font-family:'Syne',sans-serif;font-size:18px;margin-bottom:16px">신규 오디오 등록</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="font-size:12px;color:var(--c-text2)">제목 *</label>
        <input type="text" id="addTitle" placeholder="오디오 제목" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        <label style="font-size:12px;color:var(--c-text2)">Roblox Audio Asset ID *</label>
        <input type="text" id="addAssetId" placeholder="예: 12345678" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        <label style="font-size:12px;color:var(--c-text2)">카테고리</label>
        <input type="text" id="addCategory" placeholder="Global" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        <label style="font-size:12px;color:var(--c-text2)">커버 이미지 URL (선택)</label>
        <input type="text" id="addImageUrl" placeholder="https://example.com/cover.png" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none"/>
        <label style="font-size:12px;color:var(--c-text2)">타입</label>
        <select id="addType" style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none">
          <option value="global">Global</option>
          <option value="game">Game</option>
        </select>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-primary" id="addSaveBtn">등록</button>
          <button class="btn-secondary" onclick="window._kadio.closeModal()">취소</button>
        </div>
      </div>
    `;

    $('addSaveBtn').addEventListener('click', async () => {
      const title = $('addTitle').value.trim();
      const audioAssetId = $('addAssetId').value.trim();
      const gameName = $('addCategory').value.trim();
      const imageUrl = $('addImageUrl').value.trim();
      const type = $('addType').value;
      if (!title || !audioAssetId) return toast('제목과 Asset ID는 필수입니다', 'error');
      await addAudio({ title, audioAssetId, type, gameName, imageUrl, previewUrl: `/api/audio/preview/${audioAssetId}` });
      closeModal();
    });

    el.modalBackdrop.classList.add('open');
  }

  /* ─── CATEGORY IMAGE MANAGEMENT ─────────────────────────── */
  function openCatImgModal() {
    const isAdmin = S.auth.tier === 'admin' || S.auth.tier === 'owner';
    if (!isAdmin) return toast('관리자 권한이 필요합니다', 'error');

    const select = $('catImgTargetSelect');
    if (select) {
      const cats = S.categories.filter(c => c !== PENDING_REVIEW_CATEGORY && c);
      select.innerHTML = `
        <option value="">-- 카테고리 선택 --</option>
        ${cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
      `;
    }

    const urlInput = $('catImgUrlInput');
    const fileInput = $('catImgFileInput');
    const previewWrap = $('catImgPreviewWrap');
    const previewImg = $('catImgPreview');

    if (urlInput) urlInput.value = '';
    if (fileInput) fileInput.value = '';
    if (previewWrap) previewWrap.style.display = 'none';
    if (previewImg) previewImg.src = '';

    if (select) {
      select.onchange = () => {
        const selected = select.value;
        if (selected && S.categoryImages && S.categoryImages[selected]) {
          if (urlInput) urlInput.value = S.categoryImages[selected];
          if (previewImg) previewImg.src = S.categoryImages[selected];
          if (previewWrap) previewWrap.style.display = 'block';
        } else {
          if (urlInput) urlInput.value = '';
          if (previewWrap) previewWrap.style.display = 'none';
        }
      };
    }

    if (urlInput) {
      urlInput.oninput = (e) => {
        const val = e.target.value.trim();
        if (val) {
          if (previewImg) previewImg.src = val;
          if (previewWrap) previewWrap.style.display = 'block';
        } else {
          if (previewWrap) previewWrap.style.display = 'none';
        }
      };
    }

    if (fileInput) {
      fileInput.onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (previewImg) previewImg.src = ev.target.result;
          if (previewWrap) previewWrap.style.display = 'block';
        };
        reader.readAsDataURL(file);
      };
    }

    const backdrop = $('catImgModalBackdrop');
    if (backdrop) {
      backdrop.style.display = 'flex';
      backdrop.classList.add('open');
    }
  }

  function closeCatImgModal() {
    const backdrop = $('catImgModalBackdrop');
    if (backdrop) {
      backdrop.style.display = 'none';
      backdrop.classList.remove('open');
    }
  }

  async function saveCatImg() {
    const category_name = $('catImgTargetSelect')?.value?.trim();
    if (!category_name) return toast('대상 카테고리를 선택해 주세요', 'error');

    const file = $('catImgFileInput')?.files?.[0];
    let image_url = $('catImgUrlInput')?.value?.trim() || null;

    try {
      if (file) {
        const reader = new FileReader();
        const base64Data = await new Promise((resolve, reject) => {
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const uploadRes = await fetch('/api/audio/settings/categories/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category_name, fileData: base64Data, fileName: file.name })
        });
        const uploadJson = await uploadRes.json();
        if (uploadJson.status !== 'success') throw new Error(uploadJson.message || '파일 업로드 실패');
        image_url = uploadJson.url;
      }

      const res = await fetch('/api/audio/settings/categories/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_name, image_url })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      toast(`카테고리 '${category_name}' 이미지 저장 완료! 🖼️`, 'success');
      await fetchCategoryMetadata();
      closeCatImgModal();
    } catch (e) {
      toast('카테고리 이미지 저장 실패: ' + e.message, 'error');
    }
  }

  /* ─── REPORT MODAL ──────────────────────────────────────── */
  function openReportModal(id) {
    el.modalBody.innerHTML = `
      <h3 style="font-family:'Syne',sans-serif;font-size:18px;margin-bottom:16px">오디오 신고</h3>
      <div style="display:flex;flex-direction:column;gap:10px">
        <label style="font-size:12px;color:var(--c-text2)">신고 사유</label>
        <textarea id="reportReason" rows="3" placeholder="재생 불가, 잘못된 오디오 등..." style="background:var(--c-surface2);border:1px solid var(--c-border2);border-radius:var(--radius-md);color:var(--c-text);padding:8px 12px;font-size:13px;outline:none;resize:vertical"></textarea>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="btn-primary" id="reportSubmitBtn">신고 제출</button>
          <button class="btn-secondary" onclick="window._kadio.closeModal()">취소</button>
        </div>
      </div>
    `;

    $('reportSubmitBtn').addEventListener('click', async () => {
      const reason = $('reportReason').value.trim();
      if (!reason) return toast('사유를 입력해 주세요', 'error');
      await reportAudio(id, reason);
      closeModal();
    });

    el.modalBackdrop.classList.add('open');
  }

  /* ─── YOUTUBE IFRAME PLAYER INTEGRATION ─────────────────── */
  let ytPlayer = null;
  let ytPlayerReady = false;
  let isYtPlayingMode = false;

  window.onYouTubeIframeAPIReady = function () {
    try {
      ytPlayer = new YT.Player('ytEmbeddedPlayer', {
        height: '1',
        width: '1',
        playerVars: { autoplay: 1, controls: 0 },
        events: {
          onReady: () => { ytPlayerReady = true; },
          onStateChange: (event) => {
            if (event.data === YT.PlayerState.PLAYING) {
              S.isPlaying = true;
              updatePlayBtnIcon();
              renderTracks();
            } else if (event.data === YT.PlayerState.PAUSED) {
              S.isPlaying = false;
              updatePlayBtnIcon();
              renderTracks();
            } else if (event.data === YT.PlayerState.ENDED) {
              if (isYtPlayingMode) playNext();
            }
          }
        }
      });
    } catch (e) {
      console.warn('[Kadio] YT Player init exception:', e);
    }
  };


  /* ─── AUDIO PLAYBACK ────────────────────────────────────── */
  function playTrackByIndex(idx) {
    if (!requireAuth()) return;
    if (idx < 0 || idx >= S.filtered.length) return;
    const t = S.filtered[idx];
    S.currentTrackIdx = idx;
    t._ytFallbackAttempted = false;

    // Stop existing YouTube playback mode if active
    if (isYtPlayingMode && ytPlayer && ytPlayerReady && typeof ytPlayer.stopVideo === 'function') {
      try { ytPlayer.stopVideo(); } catch (e) { }
    }
    isYtPlayingMode = false;

    // Add to play history
    S.playHistory = [t.id, ...S.playHistory.filter(id => id !== t.id)].slice(0, 50);

    const previewUrl = `/api/audio/preview/${t.id}`;
    audio.src = previewUrl;
    audio.play().catch(e => {
      console.warn('[Kadio] Roblox Wolf API preview failed, trying inline YouTube fallback:', e);
      tryYoutubeFallback(t);
    });
    S.isPlaying = true;

    // Update mini player
    showMiniPlayer(t);
    renderTracks();
  }

  function tryYoutubeFallback(t) {
    if (!requireAuth()) return;
    if (t._ytFallbackAttempted) {
      el.mpStatus.textContent = '재생 실패';
      toast('오디오 재생 실패 (유튜브 연동 필요)', 'error');
      S.isPlaying = false;
      updatePlayBtnIcon();
      return;
    }
    t._ytFallbackAttempted = true;

    if (t.youtubeUrl) {
      let videoId = null;
      const m = t.youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
      if (m) videoId = m[1];

      if (videoId) {
        toast('Wolf API 재생 불가 - 웹 내 YouTube 플레이어로 전환', 'info');
        el.mpStatus.textContent = '▶ YouTube 웹 내 전환 재생';
        isYtPlayingMode = true;
        audio.pause();

        if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
          ytPlayer.loadVideoById(videoId);
          ytPlayer.setVolume(Math.floor(audio.volume * 100));
          S.isPlaying = true;
          updatePlayBtnIcon();
          renderTracks();
          return;
        } else {
          // If YT Player instance not ready, create iframe dynamically
          const container = document.getElementById('ytPlayerContainer');
          if (container) {
            container.innerHTML = `<iframe width="1" height="1" src="https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1" frameborder="0" allow="autoplay"></iframe>`;
            S.isPlaying = true;
            updatePlayBtnIcon();
            renderTracks();
            return;
          }
        }
      }
    }

    el.mpStatus.textContent = '재생 불가';
    toast('재생 실패: 대체 유튜브 음원이 없습니다', 'error');
    S.isPlaying = false;
    updatePlayBtnIcon();
    renderTracks();
  }

  function showMiniPlayer(t) {
    el.miniPlayer.classList.add('active');
    document.body.classList.add('has-mini-player');
    el.mpTitle.textContent = t.title;
    el.mpId.textContent = `ID: ${t.audioAssetId}`;
    el.mpStatus.textContent = '';
    el.mpDownloadBtn.href = `/api/audio/preview/${t.id}`;
    updatePlayBtnIcon();
    renderTracks();
  }

  function updatePlayBtnIcon() {
    el.mpPlayBtn.innerHTML = S.isPlaying
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';

    if (S.isPlaying) {
      el.miniPlayer.classList.add('is-playing');
    } else {
      el.miniPlayer.classList.remove('is-playing');
    }
  }


  function togglePlay() {
    if (!requireAuth()) return;
    if (S.currentTrackIdx < 0 && S.filtered.length > 0) {
      playTrackByIndex(0);
      return;
    }

    if (isYtPlayingMode && ytPlayer && typeof ytPlayer.getPlayerState === 'function') {
      try {
        const state = ytPlayer.getPlayerState();
        if (state === YT.PlayerState.PLAYING) {
          ytPlayer.pauseVideo();
          S.isPlaying = false;
        } else {
          ytPlayer.playVideo();
          S.isPlaying = true;
        }
      } catch (e) {
        console.warn('[Kadio] YT pause/play error:', e);
      }
    } else {
      if (S.isPlaying || !audio.paused) {
        audio.pause();
        S.isPlaying = false;
      } else {
        audio.play().then(() => { S.isPlaying = true; }).catch(e => console.warn('Audio play error:', e));
        S.isPlaying = true;
      }
    }
    updatePlayBtnIcon();
    renderTracks();
  }

  function playPrev() {
    if (S.filtered.length === 0) return;
    let idx = S.currentTrackIdx - 1;
    if (idx < 0) idx = S.filtered.length - 1;
    playTrackByIndex(idx);
  }

  function playNext() {
    if (S.filtered.length === 0) return;
    if (S.shuffle) {
      playTrackByIndex(Math.floor(Math.random() * S.filtered.length));
      return;
    }
    let idx = S.currentTrackIdx + 1;
    if (idx >= S.filtered.length) idx = 0;
    playTrackByIndex(idx);
  }

  function stopPlayback() {
    if (isYtPlayingMode && ytPlayer && typeof ytPlayer.stopVideo === 'function') {
      try { ytPlayer.stopVideo(); } catch (e) { }
    }
    isYtPlayingMode = false;
    audio.pause();
    audio.src = '';
    S.isPlaying = false;
    S.currentTrackIdx = -1;
    el.miniPlayer.classList.remove('active', 'is-playing');
    document.body.classList.remove('has-mini-player');
    renderTracks();
  }

  /* ─── AUDIO EVENTS ──────────────────────────────────────── */
  audio.addEventListener('error', () => {
    const t = S.filtered[S.currentTrackIdx];
    if (t) {
      console.warn('[Kadio] audio onerror event triggered, trying YouTube fallback');
      tryYoutubeFallback(t);
    } else {
      el.mpStatus.textContent = '재생 실패';
      S.isPlaying = false;
      updatePlayBtnIcon();
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    el.mpProgressFill.style.width = pct + '%';
    if (el.mpProgressHandle) el.mpProgressHandle.style.left = pct + '%';
    el.mpCurrent.textContent = fmtTime(audio.currentTime);
    el.mpTotal.textContent = fmtTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    if (S.repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play();
      return;
    }
    if (S.repeatMode === 'all' || S.currentTrackIdx < S.filtered.length - 1) {
      playNext();
    } else {
      S.isPlaying = false;
      updatePlayBtnIcon();
    }
  });

  audio.addEventListener('error', () => {
    el.mpStatus.textContent = '재생 실패';
    S.isPlaying = false;
    updatePlayBtnIcon();
  });

  /* ─── THEME ─────────────────────────────────────────────── */
  function applyTheme() {
    document.body.classList.toggle('light-theme', S.theme === 'light');
    if (el.themeIcon) {
      el.themeIcon.innerHTML = S.theme === 'dark'
        ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
    }
  }

  function toggleTheme() {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('kadio-theme', S.theme);
    applyTheme();
  }

  /* ─── i18n ──────────────────────────────────────────────── */
  function updateDOMTranslations() {
    localStorage.setItem('preferred_lang', S.lang);
    if (window.i18n && typeof window.i18n.setLanguage === 'function') {
      window.i18n.setLanguage(S.lang);
    }
  }

  function cycleLang() {
    const langs = ['ko', 'en', 'ru'];
    const idx = langs.indexOf(S.lang);
    S.lang = langs[(idx + 1) % langs.length];
    localStorage.setItem('kadio-lang', S.lang);
    if (el.langToggle) el.langToggle.textContent = S.lang.toUpperCase();
    updateDOMTranslations();
    toast(`언어 변경: ${S.lang.toUpperCase()}`, 'info');
  }

  /* ─── SIDEBAR NAV ───────────────────────────────────────── */
  function setNavActive(view) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(b => {
      b.classList.toggle('active', b.dataset.view === view);
    });
  }

  /* ─── SEARCH ────────────────────────────────────────────── */
  function onSearch(val) {
    S.searchQuery = val.trim();
    S.currentPage = 1;
    el.searchClear.classList.toggle('visible', !!S.searchQuery);
    renderTracks();
  }

  function addSearchHistory(q) {
    if (!q) return;
    S.searchHistory = [q, ...S.searchHistory.filter(x => x !== q)].slice(0, 10);
    localStorage.setItem('kadio-search-history', JSON.stringify(S.searchHistory));
  }

  /* ─── EXPORT FAVORITES ──────────────────────────────────── */
  function exportFavorites() {
    const favTracks = S.tracks.filter(t => S.favorites.has(t.id));
    if (favTracks.length === 0) return toast('즐겨찾기가 비어 있습니다', 'info');
    const data = JSON.stringify(favTracks, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audiovault_favorites.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('즐겨찾기 JSON 내보내기 완료', 'success');
  }

  /* ─── CANVAS BACKGROUND ─────────────────────────────────── */
  function initCanvas() {
    const canvas = el.bgCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w, h, particles = [];

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 60; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2 + 0.5,
        dx: (Math.random() - 0.5) * 0.4,
        dy: (Math.random() - 0.5) * 0.4,
        o: Math.random() * 0.3 + 0.1,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(62, 207, 255, ${p.o})`;
        ctx.fill();
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  /* ─── DRAG & DROP JSON ──────────────────────────────────── */
  function setupDragDrop() {
    let dragCounter = 0;
    const isFileDrag = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');

    document.addEventListener('dragenter', e => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounter++;
      el.dropOverlay.classList.add('active');
    });

    document.addEventListener('dragleave', e => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        el.dropOverlay.classList.remove('active');
        dragCounter = 0;
      }
    });

    document.addEventListener('dragover', e => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
    });

    document.addEventListener('drop', async e => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragCounter = 0;
      el.dropOverlay.classList.remove('active');
      const file = e.dataTransfer?.files?.[0];
      if (!file || !file.name.endsWith('.json')) return toast('JSON 파일만 지원합니다', 'error');
      try {
        const text = await file.text();
        const audios = JSON.parse(text);
        if (!Array.isArray(audios)) throw new Error('JSON은 배열이어야 합니다');
        const res = await fetch('/api/audio/import-json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audios }),
        });
        const json = await res.json();
        toast(json.message || 'Import 완료', json.status === 'success' ? 'success' : 'error');
        await loadTracks();
      } catch (err) {
        toast('JSON 파싱 실패: ' + err.message, 'error');
      }
    });
  }

  /* ─── PROGRESS BAR SEEK ─────────────────────────────────── */
  function setupProgressSeek() {
    if (!el.mpProgressTrack) return;
    el.mpProgressTrack.addEventListener('click', e => {
      const rect = el.mpProgressTrack.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;

      if (isYtPlayingMode && ytPlayer && typeof ytPlayer.getDuration === 'function') {
        const dur = ytPlayer.getDuration();
        if (dur) ytPlayer.seekTo(pct * dur, true);
      } else if (audio.duration) {
        audio.currentTime = pct * audio.duration;
      }
    });
  }

  // Periodic timer for YouTube progress bar and time updates
  setInterval(() => {
    if (isYtPlayingMode && ytPlayer && typeof ytPlayer.getCurrentTime === 'function' && typeof ytPlayer.getDuration === 'function') {
      try {
        const cur = ytPlayer.getCurrentTime() || 0;
        const dur = ytPlayer.getDuration() || 0;
        if (dur > 0) {
          const pct = (cur / dur) * 100;
          el.mpProgressFill.style.width = pct + '%';
          if (el.mpProgressHandle) el.mpProgressHandle.style.left = pct + '%';
          el.mpCurrent.textContent = fmtTime(cur);
          el.mpTotal.textContent = fmtTime(dur);
        }
      } catch (e) { }
    }
  }, 500);


  /* ─── BIND ALL EVENTS ───────────────────────────────────── */
  function bindEvents() {
    // Sidebar nav
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetView = btn.dataset.view || 'all';
        S.activeCategory = null;
        if (el.activeFilter) el.activeFilter.style.display = 'none';
        switchView(targetView);
      });
    });

    // Sidebar toggle (mobile)
    if (el.sidebarToggle) {
      el.sidebarToggle.addEventListener('click', () => {
        el.sidebar.classList.toggle('open');
      });
    }

    // Unified Admin Modal Events
    if (el.openUnifiedAdminBtn) {
      el.openUnifiedAdminBtn.addEventListener('click', openAdminModal);
    }
    if (el.unifiedAdminModalClose) {
      el.unifiedAdminModalClose.addEventListener('click', closeAdminModal);
    }
    if (el.unifiedAdminModalBackdrop) {
      el.unifiedAdminModalBackdrop.addEventListener('click', e => {
        if (e.target === el.unifiedAdminModalBackdrop) closeAdminModal();
      });
    }
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        switchAdminTab(btn.dataset.tab);
      });
    });

    // Search
    if (el.searchInput) {
      el.searchInput.addEventListener('input', e => onSearch(e.target.value));
      el.searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') { addSearchHistory(e.target.value.trim()); }
      });
      el.searchInput.addEventListener('focus', () => {
        if (S.searchHistory.length > 0) el.searchHistory.classList.add('open');
      });
      el.searchInput.addEventListener('blur', () => {
        setTimeout(() => el.searchHistory.classList.remove('open'), 200);
      });
    }
    if (el.searchClear) {
      el.searchClear.addEventListener('click', () => {
        el.searchInput.value = '';
        onSearch('');
      });
    }

    // Sort
    if (el.sortSelect) {
      el.sortSelect.addEventListener('change', e => {
        S.sortMode = e.target.value;
        S.currentPage = 1;
        renderTracks();
      });
    }

    // View toggle
    if (el.viewGrid) el.viewGrid.addEventListener('click', () => {
      S.viewMode = 'grid';
      el.viewGrid.classList.add('active');
      el.viewList.classList.remove('active');
      renderTracks();
    });
    if (el.viewList) el.viewList.addEventListener('click', () => {
      S.viewMode = 'list';
      el.viewList.classList.add('active');
      el.viewGrid.classList.remove('active');
      renderTracks();
    });
    if (el.toggleSelectModeBtn) {
      el.toggleSelectModeBtn.addEventListener('click', () => {
        const isAdmin = S.auth.tier === 'admin' || S.auth.tier === 'owner';
        if (!isAdmin) return toast('관리자 권한이 필요합니다', 'error');
        S.isSelectionMode = !S.isSelectionMode;
        el.toggleSelectModeBtn.classList.toggle('active', S.isSelectionMode);
        toast(S.isSelectionMode ? '오디오 다중 선택 모드가 켜졌습니다' : '오디오 다중 선택 모드가 꺼졌습니다', 'info');
        renderTracks();
      });
    }

    // Bulk Category Modal & Action Bar Events
    if (el.bulkChangeCategoryBtn) el.bulkChangeCategoryBtn.addEventListener('click', openBulkCategoryModal);
    if (el.bulkApproveBtn) el.bulkApproveBtn.addEventListener('click', handleBatchApprove);
    if (el.bulkDeleteBtn) el.bulkDeleteBtn.addEventListener('click', handleBatchDelete);
    if (el.bulkSelectAllBtn) el.bulkSelectAllBtn.addEventListener('click', () => batchSelectAll(true));
    if (el.bulkClearSelectionBtn) el.bulkClearSelectionBtn.addEventListener('click', () => batchSelectAll(false));
    if (el.bulkCategoryModalClose) el.bulkCategoryModalClose.addEventListener('click', closeBulkCategoryModal);
    if (el.bulkCategoryCancelBtn) el.bulkCategoryCancelBtn.addEventListener('click', closeBulkCategoryModal);
    if (el.bulkCategoryConfirmBtn) el.bulkCategoryConfirmBtn.addEventListener('click', executeBulkCategoryChange);
    if (el.bulkCategoryModalBackdrop) {
      el.bulkCategoryModalBackdrop.addEventListener('click', e => {
        if (e.target === el.bulkCategoryModalBackdrop) closeBulkCategoryModal();
      });
    }

    // Category Image Management Modal Events
    const openCatImgModalBtn = $('openCatImgModalBtn');
    if (openCatImgModalBtn) openCatImgModalBtn.addEventListener('click', openCatImgModal);
    const catImgModalClose = $('catImgModalClose');
    if (catImgModalClose) catImgModalClose.addEventListener('click', closeCatImgModal);
    const catImgCancelBtn = $('catImgCancelBtn');
    if (catImgCancelBtn) catImgCancelBtn.addEventListener('click', closeCatImgModal);
    const catImgSaveBtn = $('catImgSaveBtn');
    if (catImgSaveBtn) catImgSaveBtn.addEventListener('click', saveCatImg);
    const catImgModalBackdrop = $('catImgModalBackdrop');
    if (catImgModalBackdrop) {
      catImgModalBackdrop.addEventListener('click', e => {
        if (e.target === catImgModalBackdrop) closeCatImgModal();
      });
    }

    // Theme & Lang
    if (el.themeToggle) el.themeToggle.addEventListener('click', toggleTheme);
    if (el.langToggle) {
      el.langToggle.textContent = S.lang.toUpperCase();
      el.langToggle.addEventListener('click', cycleLang);
    }

    // Clear favorites
    if (el.clearFavBtn) el.clearFavBtn.addEventListener('click', () => {
      if (confirm('즐겨찾기를 전부 비우시겠습니까?')) {
        S.favorites.clear();
        S.tracks.forEach(t => t.favorited = false);
        updateStats();
        renderTracks();
        toast('즐겨찾기 전체 해제', 'info');
      }
    });

    // Export
    if (el.exportBtn) el.exportBtn.addEventListener('click', exportFavorites);

    // Filter clear
    if (el.filterClear) el.filterClear.addEventListener('click', () => {
      S.activeCategory = null;
      S.currentPage = 1;
      if (el.activeFilter) el.activeFilter.style.display = 'none';
      renderCategories();
      renderCategoryChipsCarousel();
      renderTracks();
    });

    // Mini player controls
    if (el.mpPlayBtn) el.mpPlayBtn.addEventListener('click', togglePlay);
    if (el.mpPrevBtn) el.mpPrevBtn.addEventListener('click', playPrev);
    if (el.mpNextBtn) el.mpNextBtn.addEventListener('click', playNext);
    if (el.mpVolume) el.mpVolume.addEventListener('input', e => {
      const vol = parseFloat(e.target.value);
      audio.volume = vol;
      if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
        try { ytPlayer.setVolume(Math.floor(vol * 100)); } catch (err) { }
      }
    });


    // Shuffle
    if (el.mpShuffleBtn) el.mpShuffleBtn.addEventListener('click', () => {
      S.shuffle = !S.shuffle;
      el.mpShuffleBtn.classList.toggle('active', S.shuffle);
      toast(S.shuffle ? '셔플 ON' : '셔플 OFF', 'info');
    });

    // Repeat
    if (el.mpRepeatBtn) el.mpRepeatBtn.addEventListener('click', () => {
      const modes = ['none', 'all', 'one'];
      const idx = modes.indexOf(S.repeatMode);
      S.repeatMode = modes[(idx + 1) % modes.length];
      el.mpRepeatBtn.classList.toggle('active', S.repeatMode !== 'none');
      const labels = { none: '반복 OFF', all: '전체 반복', one: '1곡 반복' };
      toast(labels[S.repeatMode], 'info');
    });

    // Modal close
    if (el.modalClose) el.modalClose.addEventListener('click', closeModal);
    if (el.modalBackdrop) el.modalBackdrop.addEventListener('click', e => {
      if (e.target === el.modalBackdrop) closeModal();
    });

    // Upload trigger (sidebar footer)
    const jsonInput = $('jsonInput');
    if (jsonInput) {
      jsonInput.addEventListener('change', async e => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const audios = JSON.parse(text);
          if (!Array.isArray(audios)) throw new Error('JSON은 배열이어야 합니다');
          const res = await fetch('/api/audio/import-json', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audios }),
          });
          const json = await res.json();
          toast(json.message || 'Import 완료', json.status === 'success' ? 'success' : 'error');
          await loadTracks();
        } catch (err) {
          toast('JSON 파싱 실패: ' + err.message, 'error');
        }
        jsonInput.value = '';
      });
    }

    // Admin: Add audio button in sidebar footer (repurpose sample-btn)
    const isAdmin = () => S.auth.tier === 'admin' || S.auth.tier === 'owner';
    if (el.loadSampleBtn) {
      el.loadSampleBtn.addEventListener('click', () => {
        if (isAdmin()) openAddModal();
        else toast('어드민 권한이 필요합니다', 'error');
      });
    }
    if (el.emptySampleBtn) {
      el.emptySampleBtn.addEventListener('click', () => {
        if (isAdmin()) openAddModal();
        else toast('어드민 권한이 필요합니다', 'error');
      });
    }

    // Drag & drop
    setupDragDrop();

    // Progress bar seek
    setupProgressSeek();

    // Studio script modal & heartbeat status check
    const studioScriptBtn = $('studioScriptBtn');
    if (studioScriptBtn) {
      studioScriptBtn.addEventListener('click', () => {
        el.modalBody.innerHTML = `
          <div style="margin-bottom:16px">
            <h2 style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:6px;color:#00e5ff">🚀 Roblox Studio 오디오 자동 검증 연동</h2>
            <p style="font-size:12px;color:var(--c-text2);line-height:1.5">
              Roblox Studio에서 오디오 객체(<code style="color:#54c7ff">Sound</code>)를 직접 동적 생성하여 <strong>Server / Client 환경별 재생 여부</strong>와 <strong>정확한 오디오 길이(TimeLength)</strong>를 자동 검증하는 스크립트입니다.
            </p>
          </div>

          <div style="margin-bottom:14px;padding:12px;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.2);border-radius:8px;font-size:12px">
            <strong style="color:var(--c-text)">📋 스크립트 파일 위치 (복붙용):</strong>
            <ul style="margin:8px 0 0 16px;padding:0;line-height:1.6">
              <li>서버 스크립트: <code style="color:#39e88c;font-family:monospace">roblox-studio/AudioCheckerServer.luau</code> ➔ <strong>ServerScriptService</strong>에 Script 생성</li>
              <li>클라이언트 스크립트: <code style="color:#54c7ff;font-family:monospace">roblox-studio/AudioCheckerClient.luau</code> ➔ <strong>StarterPlayerScripts</strong>에 LocalScript 생성</li>
            </ul>
          </div>

          <div style="margin-bottom:16px;padding:10px;background:rgba(255,255,255,0.03);border-radius:8px;font-size:11px;color:var(--c-text3)">
            💡 <strong>필수 설정:</strong> Roblox Studio > Home > Game Settings > Security > <strong>Allow HTTP Requests (HttpService) = ON</strong>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn-primary" onclick="window.open('/roblox-studio/README.md','_blank')">📁 README 가이드 보기</button>
            <button class="btn-secondary" onclick="window._kadio.reverifyAudio('all')" style="color:#00e5ff;border-color:rgba(0,229,255,0.3)">⚡ 전체 오디오 Studio 재검증 요청</button>
            <button class="btn-secondary" onclick="window._kadio.closeModal()">닫기</button>
          </div>
        `;
        el.modalBackdrop.classList.add('open');
      });
    }

    async function checkStudioStatus() {
      try {
        const res = await fetch('/api/audio/studio/status');
        const json = await res.json();
        const dot = $('studioDot');
        const text = $('studioText');
        if (dot && text && json.status === 'success') {
          const count = json.activeWorkers || 0;
          if (count > 0) {
            dot.style.background = '#39e88c';
            const msg = window.i18n ? window.i18n.t('Studio 연결됨 ({count})', { count }) : `Studio 연결됨 (${count})`;
            text.textContent = msg;
            text.style.color = '#39e88c';
          } else {
            dot.style.background = '#ff4d4d';
            const msg = window.i18n ? window.i18n.t('Studio 오프라인') : 'Studio 오프라인';
            text.textContent = msg;
            text.style.color = 'var(--c-text2)';
          }
        }
      } catch (e) {
        console.warn('[Kadio] Studio status check error:', e);
      }
    }


    async function checkLiveAlerts() {
      const isAdmin = S.auth && (S.auth.tier === 'admin' || S.auth.tier === 'owner');
      if (!isAdmin) return;

      try {
        const res = await fetch('/api/audio/admin/live-alerts');
        const json = await res.json();
        if (json.status === 'success' && json.alerts) {
          const { newAudios, newReports } = json.alerts;

          if (Array.isArray(newAudios) && newAudios.length > 0) {
            let newlyAddedCount = 0;
            newAudios.forEach(na => {
              if (!S.tracks.some(t => String(t.id) === String(na.id)) && !S.inflowStagingTracks.some(st => String(st.id) === String(na.id))) {
                S.inflowStagingTracks.push(na);
                newlyAddedCount++;
              }
            });

            if (newlyAddedCount > 0) {
              updateStats();
              toast(`⚡ ${newlyAddedCount}개의 새로운 오디오가 실시간 감지되었습니다! (클릭하여 검토)`, 'info', () => {
                switchView('inflow');
              }, 6000);
            }
          }

          if (Array.isArray(newReports) && newReports.length > 0) {
            newReports.forEach(rep => {
              toast(`🚨 오디오 신고 접수: "${esc(rep.title || rep.audioAssetId)}" (${esc(rep.reason || '사유 없음')})`, 'warning', () => {
                jumpToAudio(rep.audioAssetId || rep.audioId, true);
              }, 7000);
            });
          }
        }
      } catch (e) {
        // Silently catch polling error
      }
    }

    checkStudioStatus();
    setInterval(checkStudioStatus, 60000);

    checkLiveAlerts();
    setInterval(checkLiveAlerts, 15000);

    // Init Audio DB Settings Modal
    initAudioDbSettingsModal();

    // Init Fuse.js after load
    const waitFuse = setInterval(() => {
      if (typeof Fuse !== 'undefined') {
        clearInterval(waitFuse);
        S.fuseInstance = new Fuse(S.tracks, {
          keys: ['title', 'category', 'audioAssetId'],
          threshold: 0.35,
          distance: 200,
        });
      }
    }, 200);
  }

  /* ─── AUDIO DB SETTINGS & MANAGEMENT MODAL LOGIC ────────── */
  let audioDbBlacklistState = {
    page: 1,
    limit: 50,
    search: '',
    total: 0,
    items: [],
    selectedIds: new Set()
  };

  function initAudioDbSettingsModal() {
    const openBtn = document.getElementById('openAudioDbModalBtn');
    const backdrop = document.getElementById('audioDbModalBackdrop');
    const closeBtn = document.getElementById('audioDbModalClose');
    const closeFooterBtn = document.getElementById('audioDbModalCloseBtn');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        openAudioDbModal();
      });
    }

    const closeModal = () => {
      if (backdrop) {
        backdrop.style.display = 'none';
        backdrop.classList.remove('open');
      }
    };

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeFooterBtn) closeFooterBtn.addEventListener('click', closeModal);
    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) closeModal();
      });
    }

    // Sub Tabs Switching
    const tabBtns = document.querySelectorAll('.audio-db-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        switchAudioDbTab(targetTab);
      });
    });

    // Refresh Stats Button
    const refreshStatsBtn = document.getElementById('audioDbRefreshStatsBtn');
    if (refreshStatsBtn) {
      refreshStatsBtn.addEventListener('click', () => {
        loadAudioDbStats();
      });
    }

    // Category Blacklist Actions
    const saveCatBlacklistBtn = document.getElementById('saveCatBlacklistBtn');
    if (saveCatBlacklistBtn) {
      saveCatBlacklistBtn.addEventListener('click', saveAudioDbCategoryBlacklist);
    }

    const selectAllCatBtn = document.getElementById('catBlacklistSelectAll');
    if (selectAllCatBtn) {
      selectAllCatBtn.addEventListener('click', () => {
        document.querySelectorAll('.cat-blacklist-item input[type="checkbox"]').forEach(cb => cb.checked = true);
      });
    }

    const clearAllCatBtn = document.getElementById('catBlacklistClearAll');
    if (clearAllCatBtn) {
      clearAllCatBtn.addEventListener('click', () => {
        document.querySelectorAll('.cat-blacklist-item input[type="checkbox"]').forEach(cb => cb.checked = false);
      });
    }

    // Blacklist Actions
    const blRefreshBtn = document.getElementById('blacklistRefreshBtn');
    if (blRefreshBtn) blRefreshBtn.addEventListener('click', () => loadAudioDbBlacklist(audioDbBlacklistState.page));

    const blSearchInput = document.getElementById('blacklistSearchInput');
    if (blSearchInput) {
      let searchTimer;
      blSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          audioDbBlacklistState.search = blSearchInput.value.trim();
          audioDbBlacklistState.page = 1;
          loadAudioDbBlacklist(1);
        }, 300);
      });
    }

    const blPrevBtn = document.getElementById('blacklistPrevBtn');
    if (blPrevBtn) {
      blPrevBtn.addEventListener('click', () => {
        if (audioDbBlacklistState.page > 1) {
          loadAudioDbBlacklist(audioDbBlacklistState.page - 1);
        }
      });
    }

    const blNextBtn = document.getElementById('blacklistNextBtn');
    if (blNextBtn) {
      blNextBtn.addEventListener('click', () => {
        const maxPages = Math.ceil(audioDbBlacklistState.total / audioDbBlacklistState.limit);
        if (audioDbBlacklistState.page < maxPages) {
          loadAudioDbBlacklist(audioDbBlacklistState.page + 1);
        }
      });
    }

    const blSelectAllBox = document.getElementById('blacklistSelectAllBox');
    if (blSelectAllBox) {
      blSelectAllBox.addEventListener('change', () => {
        const checked = blSelectAllBox.checked;
        document.querySelectorAll('.bl-item-checkbox').forEach(cb => {
          cb.checked = checked;
          const assetId = cb.getAttribute('data-id');
          if (checked) audioDbBlacklistState.selectedIds.add(assetId);
          else audioDbBlacklistState.selectedIds.delete(assetId);
        });
      });
    }

    const blRestoreSelectedBtn = document.getElementById('blacklistRestoreSelectedBtn');
    if (blRestoreSelectedBtn) {
      blRestoreSelectedBtn.addEventListener('click', () => {
        const ids = Array.from(audioDbBlacklistState.selectedIds);
        if (ids.length === 0) {
          toast('복원할 블랙리스트 에셋을 선택해주세요.', 'warning');
          return;
        }
        restoreBlacklistAssets(ids);
      });
    }

    // Tools Actions
    const runVacuumBtn = document.getElementById('runDbVacuumBtn');
    if (runVacuumBtn) {
      runVacuumBtn.addEventListener('click', async () => {
        runVacuumBtn.disabled = true;
        runVacuumBtn.textContent = '최적화 진행 중...';
        try {
          const res = await fetch('/api/audio/admin/db-vacuum', { method: 'POST' });
          const json = await res.json();
          if (json.status !== 'success') throw new Error(json.message);
          toast(`✨ ${json.message}`, 'success');
          loadAudioDbStats();
        } catch (e) {
          toast('최적화 실패: ' + e.message, 'error');
        } finally {
          runVacuumBtn.disabled = false;
          runVacuumBtn.textContent = '최적화 실행';
        }
      });
    }

    const reverifyAllBtn = document.getElementById('reverifyAllAudioBtn');
    if (reverifyAllBtn) {
      reverifyAllBtn.addEventListener('click', async () => {
        if (!confirm('수동 고정(Lock)되지 않은 모든 오디오를 Studio 재검증 대기열로 등록하시겠습니까?')) return;
        reverifyAllBtn.disabled = true;
        try {
          const res = await fetch('/api/audio/studio/reverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audioAssetId: 'all' })
          });
          const json = await res.json();
          if (json.status !== 'success') throw new Error(json.message);
          toast('⚡ 전체 오디오 재검증 대기열 등록 완료!', 'success');
          loadAudioDbStats();
        } catch (e) {
          toast('재검증 등록 실패: ' + e.message, 'error');
        } finally {
          reverifyAllBtn.disabled = false;
        }
      });
    }
  }

  function openAudioDbModal() {
    const backdrop = document.getElementById('audioDbModalBackdrop');
    if (!backdrop) return;
    backdrop.style.display = 'flex';
    backdrop.classList.add('open');
    switchAudioDbTab('stats');
    loadAudioDbStats();
  }

  function switchAudioDbTab(tabName) {
    document.querySelectorAll('.audio-db-tab-btn').forEach(btn => {
      if (btn.getAttribute('data-tab') === tabName) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    const contents = {
      stats: document.getElementById('audioDbTabStats'),
      categories: document.getElementById('audioDbTabCategories'),
      blacklist: document.getElementById('audioDbTabBlacklist'),
      tools: document.getElementById('audioDbTabTools')
    };

    Object.keys(contents).forEach(key => {
      if (contents[key]) {
        contents[key].style.display = key === tabName ? 'block' : 'none';
      }
    });

    if (tabName === 'stats') loadAudioDbStats();
    if (tabName === 'categories') loadAudioDbCategoryBlacklist();
    if (tabName === 'blacklist') loadAudioDbBlacklist(1);
  }

  async function loadAudioDbStats() {
    try {
      const res = await fetch('/api/audio/admin/db-stats');
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      const d = json.data;
      const audios = d.audios || {};

      const setNum = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = Number(val || 0).toLocaleString();
      };

      setNum('dbStatTotal', audios.total);
      setNum('dbStatActive', audios.active);
      setNum('dbStatPending', audios.pending);
      setNum('dbStatVerified', audios.verified);
      setNum('dbStatFailed', audios.failed);
      setNum('dbStatYoutube', audios.mappedYoutube);
      setNum('dbStatCategories', d.totalCategoriesCount);

      const fsEl = document.getElementById('dbStatFileSize');
      if (fsEl) fsEl.textContent = `${d.dbSizeMB || 0} MB`;
    } catch (e) {
      console.error('[AudioDB] Error loading stats:', e);
      toast('DB 통계 로드 실패: ' + e.message, 'error');
    }
  }

  async function loadAudioDbCategoryBlacklist() {
    const container = document.getElementById('catBlacklistContainer');
    if (!container) return;
    container.innerHTML = '<div style="font-size:12px;color:var(--c-text3);">카테고리 불러오는 중...</div>';

    try {
      const [statsRes, settingsRes] = await Promise.all([
        fetch('/api/audio/admin/db-stats').then(r => r.json()),
        fetch('/api/audio/admin/settings').then(r => r.json())
      ]);

      const rawCategories = statsRes?.data?.categories || [];
      const hiddenCategories = (settingsRes?.data?.hiddenCategories || []).map(c => String(c).trim().toLowerCase());

      // Deduplicate categories case-insensitively while preserving original display casing
      const categoryMap = new Map();
      rawCategories.forEach(c => {
        const key = String(c).trim().toLowerCase();
        if (key && !categoryMap.has(key)) {
          categoryMap.set(key, c);
        }
      });

      const uniqueCategories = Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

      if (uniqueCategories.length === 0) {
        container.innerHTML = '<div style="font-size:12px;color:var(--c-text3);">등록된 카테고리가 없습니다.</div>';
        return;
      }

      container.innerHTML = '';
      uniqueCategories.forEach(cat => {
        const isHidden = hiddenCategories.includes(String(cat).trim().toLowerCase());
        const item = document.createElement('label');
        item.className = 'cat-blacklist-item';
        item.innerHTML = `
          <input type="checkbox" value="${escapeHtml(cat)}" ${isHidden ? 'checked' : ''} />
          <span class="cat-blacklist-name" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>
        `;
        container.appendChild(item);
      });
    } catch (e) {
      container.innerHTML = '<div style="font-size:12px;color:#ff778f;">카테고리 목록 로드 실패: ' + e.message + '</div>';
    }
  }

  async function saveAudioDbCategoryBlacklist() {
    const saveBtn = document.getElementById('saveCatBlacklistBtn');
    if (saveBtn) saveBtn.disabled = true;

    const checkboxes = document.querySelectorAll('#catBlacklistContainer input[type="checkbox"]:checked');
    const hiddenCategories = Array.from(checkboxes).map(cb => cb.value.trim()).filter(Boolean);

    try {
      const res = await fetch('/api/audio/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hiddenCategories })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      toast('✨ 카테고리 숨김 설정이 성공적으로 저장되었습니다.', 'success');
      // Reload main tracks to reflect hidden categories immediately
      if (typeof loadTracks === 'function') {
        loadTracks();
      }
    } catch (e) {
      toast('설정 저장 실패: ' + e.message, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  async function loadAudioDbBlacklist(page = 1) {
    audioDbBlacklistState.page = page;
    const tbody = document.getElementById('blacklistTableBody');
    const pageInfo = document.getElementById('blacklistPageInfo');
    const selectAllBox = document.getElementById('blacklistSelectAllBox');
    if (selectAllBox) selectAllBox.checked = false;
    audioDbBlacklistState.selectedIds.clear();

    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--c-text3);">블랙리스트 불러오는 중...</td></tr>';

    try {
      const query = encodeURIComponent(audioDbBlacklistState.search || '');
      const res = await fetch(`/api/audio/admin/blacklist?page=${page}&limit=${audioDbBlacklistState.limit}&q=${query}`);
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      const items = json.data || [];
      const pagination = json.pagination || { total: 0, totalPages: 1 };
      audioDbBlacklistState.total = pagination.total;
      audioDbBlacklistState.items = items;

      if (pageInfo) {
        pageInfo.textContent = `총 ${pagination.total}개 항목 (페이지 ${page} / ${pagination.totalPages || 1})`;
      }

      if (items.length === 0) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="padding:20px;text-align:center;color:var(--c-text3);">차단된 블랙리스트 에셋이 없습니다.</td></tr>';
        return;
      }

      if (tbody) {
        tbody.innerHTML = '';
        items.forEach(row => {
          const tr = document.createElement('tr');
          tr.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
          const formattedDate = row.deletedAt ? new Date(row.deletedAt).toLocaleString('ko-KR') : '-';
          
          tr.innerHTML = `
            <td style="padding:8px 10px;"><input type="checkbox" class="bl-item-checkbox" data-id="${row.audioAssetId}" /></td>
            <td style="padding:8px 10px;font-family:'DM Mono',monospace;color:var(--c-accent);">${escapeHtml(row.audioAssetId)}</td>
            <td style="padding:8px 10px;color:var(--c-text3);">${formattedDate}</td>
            <td style="padding:8px 10px;text-align:right;">
              <button class="bulk-btn bulk-btn-secondary bl-restore-single" data-id="${row.audioAssetId}" style="padding:3px 8px;font-size:11px;color:#3dd9a4;border-color:rgba(61,217,164,0.3);">차단 해제</button>
            </td>
          `;

          const cb = tr.querySelector('.bl-item-checkbox');
          cb.addEventListener('change', () => {
            if (cb.checked) audioDbBlacklistState.selectedIds.add(row.audioAssetId);
            else audioDbBlacklistState.selectedIds.delete(row.audioAssetId);
          });

          const restoreBtn = tr.querySelector('.bl-restore-single');
          restoreBtn.addEventListener('click', () => {
            restoreBlacklistAssets([row.audioAssetId]);
          });

          tbody.appendChild(tr);
        });
      }
    } catch (e) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="padding:20px;text-align:center;color:#ff778f;">블랙리스트 로드 실패: ${e.message}</td></tr>`;
    }
  }

  async function restoreBlacklistAssets(assetIds) {
    if (!confirm(`${assetIds.length}개 에셋을 삭제 블랙리스트에서 복원하시겠습니까? (이후 다시 등록/수집이 허용됩니다)`)) return;

    try {
      const res = await fetch('/api/audio/admin/blacklist/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);

      toast(`✨ ${json.message}`, 'success');
      loadAudioDbBlacklist(audioDbBlacklistState.page);
      loadAudioDbStats();
    } catch (e) {
      toast('복원 실패: ' + e.message, 'error');
    }
  }

  async function broadcastAudio(id) {
    const t = S.tracks.find(tr => tr.id === id);
    if (!t) return;
    try {
      const res = await fetch('/api/audio/studio/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioId: t.id,
          audioAssetId: t.audioAssetId,
          title: t.title,
          category: t.category
        })
      });
      const json = await res.json();
      if (json.status !== 'success') throw new Error(json.message);
      toast(`📡 Roblox 인게임 브로드캐스트 전송 완료! (${t.title})`, 'success');
    } catch (e) {
      toast('인게임 전송 실패: ' + e.message, 'error');
    }
  }

  function playTrackById(id) {
    const idx = S.tracks.findIndex(t => String(t.id) === String(id) || String(t.audioAssetId) === String(id));
    if (idx !== -1) {
      // Find filtered index or play directly
      const filteredIdx = S.filtered.findIndex(t => String(t.id) === String(id));
      if (filteredIdx !== -1) playTrackByIndex(filteredIdx);
      else playTrack(idx);
    }
  }

  /* ─── GLOBAL API (for modal onclick) ────────────────────── */
  window._kadio = {
    playIdx: playTrackByIndex,
    playTrackById,
    toggleFav: toggleFavorite,
    editModal: openEditModal,
    reportModal: openReportModal,
    openCatImgModal,
    openAudioDbModal,
    openAdminModal,
    closeAdminModal,
    switchAdminTab,
    switchView,
    filterByChip,
    approveInflowTrack,
    refreshInflowTracks,
    approveAllInflow,
    reverifyAudio,
    broadcastAudio,
    jumpToAudio,
    handleMediaError,
    closeModal,
  };

  /* ─── BOOT ──────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
