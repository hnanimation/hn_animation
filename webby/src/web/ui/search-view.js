import { register, getEnabled } from '../core/registry.js';
import { createCard } from './cards.js';
import { initVideoModal, openVideoModal } from './video-modal.js';
import { getUserData, getSourceFilters } from '../../core/user-data.js';

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

let rootEl, gridEl, statusEl;
let initialized = false;

const BATCH = 16;
const PP_IMG = 8;
const PP_VID = 8;
const MAX_ITER = 15;

const S = {
  pool: null,
  rendered: new Set(),
  filter: 'all',
  filling: false,
  online: navigator.onLine,
  loading: new Set()
};

export function initSearchView(el) {
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
            <div id="search-status" class="web-status"></div>
      <div class="web-actions">
        <button type="button" class="web-settings-btn" id="search-settings-btn" title="إعدادات المصادر" aria-label="إعدادات المصادر">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
        <button type="button" class="web-settings-btn web-source-filter-btn" id="search-source-filter-btn" title="فلترة المصادر" aria-label="فلترة المصادر">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
        </button>
      </div>
    </div>
    <div id="search-results" class="web-grid"></div>
  `;

  gridEl = el.querySelector('#search-results');
  statusEl = el.querySelector('#search-status');

  el.querySelectorAll('.web-filter-btn').forEach((b) => {
    b.addEventListener('click', () => setFilter(b.dataset.filter));
  });

  gridEl.addEventListener('scroll', onScroll, { passive: true });

  const settingsBtn = el.querySelector('#search-settings-btn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => openWebSettings());
  }

  const actionsWrap = el.querySelector('.web-actions');
  if (actionsWrap) {
    initSourceFilter(actionsWrap);
  }

  window.addEventListener('webby:sources-changed', () => {
    if (!S.pool) return;
    const filters = getSourceFilters();

    Array.from(gridEl.children).forEach((card) => {
      const conn = card.getAttribute('data-connector');
      if (filters[conn] === false) {
        const id = card.getAttribute('data-id');
        if (id) S.rendered.delete(id);
        card.remove();
      }
    });

    // إعادة تعيين الجلب
    S.pool.imgPage = 1;
    S.pool.vidPage = 1;
    S.pool.imgMore = true;
    S.pool.vidMore = true;

    forceRenderNext();
    fillLoop();
  });
}

function setFilter(f) {
  if (!['all', 'image', 'video'].includes(f) || S.filter === f) return;
  S.filter = f;
  rootEl.querySelectorAll('.web-filter-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.filter === f);
  });
  gridEl.innerHTML = '';
  S.rendered.clear();
  fillLoop();
}

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
  if (S.filling || !S.pool) return;
  S.filling = true;
  try {
    if (renderBatch()) return;
    if (await fetchOneNeeded()) renderBatch();
  } finally {
    S.filling = false;
    updateStatus();
  }
}

async function fillLoop() {
  if (!S.pool) return;
  if (S.filling) {
    setTimeout(fillLoop, 150);
    return;
  }
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

      const anyMore = S.pool && (S.pool.imgMore || S.pool.vidMore);
      if (!anyMore) break;

      await new Promise((r) => setTimeout(r, 250));
      if (++retries > 3) break;
    }
  } finally {
    S.filling = false;
    updateStatus();
  }
}

async function fetchOneNeeded() {
  if (!S.pool) return false;
  const f = S.filter;

  if (f === 'all' || f === 'image') {
    if (S.pool.imgMore && !S.loading.has('img')) {
      if (await fetchImages()) return true;
    }
    if (f === 'image') return false;
  }

  if (f === 'all' || f === 'video') {
    if (S.pool.vidMore && !S.loading.has('vid')) {
      if (await fetchVideos()) return true;
    }
  }
  return false;
}

async function fetchImages() {
  if (!S.pool || !S.pool.imgMore || S.loading.has('img')) return false;
  S.loading.add('img');
  try {
    const items = await searchConnectors(S.pool.query, S.pool.imgPage, PP_IMG, 'image');
    const existing = new Set(S.pool.images.map((i) => i.id));
    const fresh = items.filter((i) => i.type === 'image' && !existing.has(i.id));
    S.pool.images.push(...fresh);
    S.pool.imgPage++;
    if (items.length < 3) S.pool.imgMore = false;
    return fresh.length > 0;
  } catch {
    S.pool.imgMore = false;
    return false;
  } finally {
    S.loading.delete('img');
  }
}

async function fetchVideos() {
  if (!S.pool || !S.pool.vidMore || S.loading.has('vid')) return false;
  S.loading.add('vid');
  try {
    const items = await searchConnectors(S.pool.query, S.pool.vidPage, PP_VID, 'video');
    const existing = new Set(S.pool.videos.map((i) => i.id));
    const fresh = items.filter((i) => i.type === 'video' && !existing.has(i.id));
    S.pool.videos.push(...fresh);
    S.pool.vidPage++;
    if (items.length < 2) S.pool.vidMore = false;
    return fresh.length > 0;
  } catch {
    S.pool.vidMore = false;
    return false;
  } finally {
    S.loading.delete('vid');
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

function renderBatch() {
  if (!S.pool) return false;

  const filters = getSourceFilters();
  const freshImages = S.pool.images.filter((i) => {
    if (S.rendered.has(i.id)) return false;
    if (filters[i.connector_id] === false) return false;
    return true;
  });
  const freshVideos = S.pool.videos.filter((i) => {
    if (S.rendered.has(i.id)) return false;
    if (filters[i.connector_id] === false) return false;
    return true;
  });

  shuffle(freshImages);
  shuffle(freshVideos);

  let pick = [];

  if (S.filter === 'all') {
    const half = Math.floor(BATCH / 2);
    pick = [...freshImages.slice(0, half), ...freshVideos.slice(0, half)];
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
  if (!S.pool) {
    statusEl.textContent = '';
    statusEl.className = 'web-status';
    return;
  }
  const shown = gridEl.children.length;
  statusEl.textContent = shown > 0 ? `${shown}` : '';
  statusEl.className = shown > 0 ? 'web-status success' : 'web-status';
}

export function showSearchView() {}

export async function runSearch(query) {
  if (!initialized) return;
  const q = String(query || '').trim();
  if (!q) return;

  gridEl.innerHTML = '';
  S.rendered.clear();
  S.filling = false;

  S.pool = {
    query: q,
    images: [],
    videos: [],
    imgPage: 1,
    vidPage: 1,
    imgMore: true,
    vidMore: true
  };

  await Promise.all([fetchImages(), fetchVideos()]);
  fillLoop();
}

export function resetSearchView() {
  if (!initialized) return;
  gridEl.innerHTML = '';
  S.pool = null;
  S.rendered.clear();
  statusEl.textContent = '';
  statusEl.className = 'web-status';
}