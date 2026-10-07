import { register, getEnabled } from '../core/registry.js';
import { createCard } from './cards.js';
import { initVideoModal, openVideoModal } from './video-modal.js';
import {
  getUserData,
  updateUserData,
  getSearchHistory,
  addSearchHistory,
  getSourceFilters
} from '../../core/user-data.js';

import openverse from '../connectors/openverse.js';
import wikimedia from '../connectors/wikimedia.js';
import pexels from '../connectors/pexels.js';
import peertube from '../connectors/peertube.js';
import { openWebSettings } from './web-settings.js';
import { initSourceFilter } from './source-filter.js';
import {
  markConnectorFailed,
  markConnectorSuccess,
  isConnectorCoolingDown
} from '../core/connector-cooldown.js';

register(openverse);
register(wikimedia);
register(pexels);
register(peertube);

let rootEl, gridEl, statusEl, emptyEl;
let initialized = false;

const DEFAULT_QUERIES = ['sea', 'nature', 'history'];
const BATCH = 16;
const PP_IMG = 8;
const PP_VID = 8;
const MAX_ITER = 15;

const S = {
  pools: new Map(),
  rendered: new Set(),
  filter: 'all',
  autoLoaded: false,
  filling: false,
  timer: null,
  online: navigator.onLine,
  loading: new Set()
};

/* ============ Init ============ */

export function initWebView(el) {
  if (initialized) return;
  initialized = true;
  rootEl = el;
  initVideoModal();

  el.innerHTML = `
    <div class="web-toolbar">
      <div class="web-filters">
        <button type="button" class="web-filter-btn active" data-filter="all" title="الكل" aria-label="الكل">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </button>
        <button type="button" class="web-filter-btn" data-filter="image" title="صور" aria-label="صور">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>
        </button>
        <button type="button" class="web-filter-btn" data-filter="video" title="فيديو" aria-label="فيديو">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="20" x="2" y="2" rx="2.18" ry="2.18"/><path d="M7 2v20"/><path d="M17 2v20"/><path d="M2 12h20"/><path d="M2 7h5"/><path d="M2 17h5"/><path d="M17 17h5"/><path d="M17 7h5"/></svg>
        </button>
      </div>
            <div id="web-status" class="web-status"></div>
      <div class="web-actions">
        <button type="button" class="web-settings-btn" id="web-settings-btn" title="إعدادات المصادر" aria-label="إعدادات المصادر">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button type="button" class="web-settings-btn web-source-filter-btn" id="web-source-filter-btn" title="فلترة المصادر" aria-label="فلترة المصادر">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        </button>
      </div>
    </div>
    <div id="web-results" class="web-grid"></div>
    <div id="web-empty" class="web-empty" style="display:none;"><p>جاري التحميل...</p></div>
  `;

  gridEl = el.querySelector('#web-results');
  statusEl = el.querySelector('#web-status');
  emptyEl = el.querySelector('#web-empty');

  el.querySelectorAll('.web-filter-btn').forEach((b) => {
    b.addEventListener('click', () => setFilter(b.dataset.filter));
  });

    const settingsBtn = el.querySelector('#web-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => openWebSettings());
  }

  const actionsWrap = el.querySelector('.web-actions');
  if (actionsWrap) {
    initSourceFilter(actionsWrap);
  }

    window.addEventListener('webby:sources-changed', () => {
    const filters = getSourceFilters();

    // 1) احذف بطاقات المصادر المعطلة
    Array.from(gridEl.children).forEach((card) => {
      const conn = card.getAttribute('data-connector');
      if (filters[conn] === false) {
        const id = card.getAttribute('data-id');
        if (id) S.rendered.delete(id);
        card.remove();
      }
    });

    // 2) أعد تعيين الجلب — لجلب نتائج جديدة من المصادر المُفعّلة
    S.pools.forEach((pool) => {
      pool.imgPage = 1;
      pool.vidPage = 1;
      pool.imgMore = true;
      pool.vidMore = true;
    });

    // 3) اعرض من الطوابير
    forceRenderNext();

    // 4) اجلب من المصادر
    scheduleFill();
  });


  gridEl.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('offline', () => { S.online = false; updateStatus(); });
  window.addEventListener('online', () => { S.online = true; updateStatus(); });
}

/* ============ Filter ============ */

function setFilter(f) {
  if (!['all', 'image', 'video'].includes(f)) return;
  if (S.filter === f) return;

  S.filter = f;
  rootEl.querySelectorAll('.web-filter-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.filter === f);
  });

  gridEl.innerHTML = '';
  S.rendered.clear();
  fillLoop();
}

/* ============ Auto-load ============ */

async function autoLoad() {
  if (S.autoLoaded) return;
  S.autoLoaded = true;

  let qs = getSearchHistory('web');
  if (qs.length === 0) {
    DEFAULT_QUERIES.forEach((q) => addSearchHistory(q, 'web'));
    qs = DEFAULT_QUERIES.slice();
  }
  qs = qs.slice(0, 3);

  if (emptyEl) emptyEl.style.display = 'flex';

  await Promise.all(qs.map((q) => addPool(q, true)));

  if (emptyEl) emptyEl.style.display = 'none';
  fillLoop();
}

export function showWebView() {
  if (!S.autoLoaded) autoLoad();
  else fillLoop();
}

/* ============ Scroll ============ */

let scrollThrottle = 0;

function onScroll() {
  if (S.filling) return;

  const now = Date.now();
  if (now - scrollThrottle < 300) return;

  const { scrollTop, clientHeight, scrollHeight } = gridEl;
  if (scrollHeight - (scrollTop + clientHeight) > 800) return;

  scrollThrottle = now;
  loadMore();
}

async function loadMore() {
  if (S.filling) return;
  S.filling = true;

  try {
    if (renderBatch()) return;
    if (await fetchOneNeeded()) renderBatch();
  } finally {
    S.filling = false;
    updateStatus();
  }
}

/* ============ Loop ============ */

function scheduleFill() {
  clearTimeout(S.timer);
  S.timer = setTimeout(() => {
    if (S.filling) {
      scheduleFill();
      return;
    }
    fillLoop();
  }, 150);
}

async function fillLoop() {
  if (S.filling) return;
  S.filling = true;

  try {
    let iter = 0;
    let retries = 0;

    while (iter++ < MAX_ITER) {
      if (!S.online) break;

      const shown = gridEl.children.length;
      const scrollable = gridEl.scrollHeight > gridEl.clientHeight + 50;

      if (shown >= BATCH && scrollable) break;
      if (shown >= BATCH * 3) break;

      if (renderBatch()) {
        retries = 0;
        continue;
      }

      const more = await fetchOneNeeded();
      if (more) {
        retries = 0;
        continue;
      }

      // fetchOneNeeded فشل — تحقق: هل هناك pools قد تُنتج لاحقًا؟
      const anyMore = Array.from(S.pools.values()).some(
        (p) => p.imgMore || p.vidMore
      );
      if (!anyMore) break;

      // انتظر قليلًا ثم أعد المحاولة
      await new Promise((r) => setTimeout(r, 250));
      if (++retries > 3) break;
    }
  } finally {
    S.filling = false;
    updateStatus();
  }
}

/* ============ Pools ============ */

async function addPool(query, silent = false) {
  const q = String(query || '').trim();
  if (!q || S.pools.has(q)) return;

  const pool = {
    query: q,
    images: [],
    videos: [],
    imgPage: 1,
    vidPage: 1,
    imgMore: true,
    vidMore: true
  };
  S.pools.set(q, pool);

  if (!silent) {
    try {
      const data = getUserData();
      if (!data.preferences) data.preferences = {};
      data.preferences.last_web_query = q;
      updateUserData({ preferences: data.preferences });
    } catch {}
  }

  await Promise.all([fetchImages(pool), fetchVideos(pool)]);
}

export async function runSearch(query, options = {}) {
  if (!initialized) return;
  const q = String(query || '').trim();
  if (!q) return;

  if (S.pools.has(q)) {
    if (!options.silent) {
      const pool = S.pools.get(q);
      if (pool.imgMore && pool.images.length < 8) await fetchImages(pool);
      if (pool.vidMore && pool.videos.length < 8) await fetchVideos(pool);
      scheduleFill();
    }
    return;
  }

  if (!options.silent && emptyEl) emptyEl.style.display = 'none';

  await addPool(q, options.silent);
  if (!options.silent) scheduleFill();
}

/* ============ Fetch ============ */

async function fetchImages(pool) {
  const key = `${pool.query}::img`;
  if (!pool.imgMore || S.loading.has(key)) return false;
  S.loading.add(key);
  try {
    const items = await searchConnectors(pool.query, pool.imgPage, PP_IMG, 'image');
    const existing = new Set(pool.images.map((i) => i.id));
    const fresh = items.filter((i) => i.type === 'image' && !existing.has(i.id));
    pool.images.push(...fresh);
    pool.imgPage++;

    // ← الإصلاح: حسب items (raw API) وليس fresh (بعد الفلترة)
    if (items.length < 3) pool.imgMore = false;

    return fresh.length > 0;
  } catch {
    pool.imgMore = false;
    return false;
  } finally {
    S.loading.delete(key);
  }
}

async function fetchVideos(pool) {
  const key = `${pool.query}::vid`;
  if (!pool.vidMore || S.loading.has(key)) return false;
  S.loading.add(key);
  try {
    const items = await searchConnectors(pool.query, pool.vidPage, PP_VID, 'video');
    const existing = new Set(pool.videos.map((i) => i.id));
    const fresh = items.filter((i) => i.type === 'video' && !existing.has(i.id));
    pool.videos.push(...fresh);
    pool.vidPage++;

    // ← الإصلاح
    if (items.length < 2) pool.vidMore = false;

    return fresh.length > 0;
  } catch {
    pool.vidMore = false;
    return false;
  } finally {
    S.loading.delete(key);
  }
}

async function searchConnectors(query, page, perPage, filter) {
  let apiKeys = {};
  let sourceFilters = {};
  try {
    const data = getUserData();
    Object.assign(apiKeys, data.api_keys || {});
    sourceFilters = data.source_filters || {};
  } catch {}

  const enabled = getEnabled(apiKeys, sourceFilters);

  const tasks = enabled.map(async (c) => {
    if (isConnectorCoolingDown(c.id)) {
      return { id: c.id, items: [], error: 'cooldown' };
    }

    // PeerTube: timeout قصير
    const perTimeout = c.id === 'peertube' ? 4000 : 12000;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), perTimeout);

    try {
      const items = await c.search(query, {
        page,
        perPage,
        signal: controller.signal,
        apiKeys,
        filter
      });
      markConnectorSuccess(c.id);
      return { id: c.id, items: items || [], error: null };
    } catch (err) {
      if (err.name !== 'AbortError') {
        markConnectorFailed(c.id);
      }
      return { id: c.id, items: [], error: err.message };
    } finally {
      clearTimeout(timeout);
    }
  });

  const results = await Promise.all(tasks);

  const all = [];
  results.forEach((r) => {
    if (r.items && r.items.length > 0) all.push(...r.items);
  });
  return all;
}

/* ============ Fetch One ============ */

async function fetchOneNeeded() {
  const pools = Array.from(S.pools.values());
  if (pools.length === 0) return false;

  const f = S.filter;

  if (f === 'all' || f === 'image') {
    const imgs = pools.filter(
      (p) => p.imgMore && !S.loading.has(`${p.query}::img`)
    );
    imgs.sort((a, b) => a.images.length - b.images.length);
    for (const p of imgs) {
      if (await fetchImages(p)) return true;
    }
    if (f === 'image') return false;
  }

  if (f === 'all' || f === 'video') {
    const vids = pools.filter(
      (p) => p.vidMore && !S.loading.has(`${p.query}::vid`)
    );
    vids.sort((a, b) => a.videos.length - b.videos.length);
    for (const p of vids) {
      if (await fetchVideos(p)) return true;
    }
  }

  return false;
}

/* ============ Render ============ */

function renderBatch() {
  const pools = Array.from(S.pools.values());
  if (pools.length === 0) return false;

  const filters = getSourceFilters();
  const freshImages = [];
  const freshVideos = [];

  pools.forEach((p) => {
    p.images.forEach((it) => {
      if (S.rendered.has(it.id)) return;
      if (filters[it.connector_id] === false) return;
      freshImages.push(it);
    });
    p.videos.forEach((it) => {
      if (S.rendered.has(it.id)) return;
      if (filters[it.connector_id] === false) return;
      freshVideos.push(it);
    });
  });

  shuffle(freshImages);
  shuffle(freshVideos);

  let pick = [];

  if (S.filter === 'all') {
    const half = Math.floor(BATCH / 2);
    const imgs = freshImages.slice(0, half);
    const vids = freshVideos.slice(0, half);
    pick = [...imgs, ...vids];
    let need = BATCH - pick.length;
    if (need > 0 && freshImages.length > half) {
      pick.push(...freshImages.slice(half, half + need));
      need = BATCH - pick.length;
    }
    if (need > 0 && freshVideos.length > half) {
      pick.push(...freshVideos.slice(half, half + need));
    }
  } else if (S.filter === 'image') {
    pick = freshImages.slice(0, BATCH);
  } else {
    pick = freshVideos.slice(0, BATCH);
  }

  if (pick.length === 0) return false;

  shuffle(pick);
  pick.forEach((item) => {
    S.rendered.add(item.id);
    gridEl.appendChild(createCard(item, onCardClick));
  });

  updateStatus();
  return true;
}

function forceRenderNext() {
  let added = 0;
  for (let i = 0; i < 5; i++) {
    if (!renderBatch()) break;
    added++;
  }
  // إذا لم يُضف شيئًا (الطوابير فارغة)، اجلب من المصادر
  if (added === 0) {
    fetchOneNeeded().then((more) => {
      if (more) renderBatch();
    });
  }
}

function onCardClick(item) {
  if (item.type === 'video') openVideoModal(item);
  else {
    const url = item.original_url || item.media_url;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function updateStatus() {
  if (!S.online) {
    statusEl.textContent = '⚠️ بلا إنترنت';
    statusEl.className = 'web-status error';
    return;
  }

  const shown = gridEl.children.length;
  statusEl.textContent = shown > 0 ? `${shown}` : '';
  statusEl.className = shown > 0 ? 'web-status success' : 'web-status';
}

/* ============ Public ============ */

export function clearWebFeed() {
  S.pools.clear();
  S.rendered.clear();
  gridEl.innerHTML = '';
  statusEl.textContent = '';
  statusEl.className = 'web-status';
  emptyEl.style.display = 'none';
}

export function removeFeedPool(query) {
  const q = String(query || '').trim();
  if (!q) return;
  S.pools.delete(q);
  gridEl.innerHTML = '';
  S.rendered.clear();
  scheduleFill();
}

export function resetWebView() {
  S.autoLoaded = false;
}