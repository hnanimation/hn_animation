import { register, getEnabled } from '../core/registry.js';
import { createCard } from './cards.js';
import {
  getUserData,
  updateUserData,
  getSearchHistory,
  addSearchHistory
} from '../../core/user-data.js';

import openverse from '../connectors/openverse.js';
import wikimedia from '../connectors/wikimedia.js';

register(openverse);
register(wikimedia);

let initialized = false;
let rootEl = null;
let gridEl = null;
let statusEl = null;
let emptyEl = null;

const DEFAULT_QUERIES = ['sea', 'tree', 'sky'];
const BATCH_SIZE = 16;
const PER_PAGE = 8;
const MAX_FILL_ITERATIONS = 20;

const state = {
  pools: new Map(),
  seenIds: new Set(),
  userSearched: new Set(),
  loadingQueries: new Set(),
  autoLoaded: false,
  isFilling: false,
  checkTimer: null,
  fillTimer: null,
  online: navigator.onLine
};

export function initWebView(root) {
  if (initialized) return;
  initialized = true;
  rootEl = root;

  root.innerHTML = `
    <div id="web-status" class="web-status"></div>
    <div id="web-results" class="web-grid"></div>
    <div id="web-empty" class="web-empty" style="display:none;">
      <p>جاري التحميل...</p>
    </div>
  `;

  gridEl = root.querySelector('#web-results');
  statusEl = root.querySelector('#web-status');
  emptyEl = root.querySelector('#web-empty');

  gridEl.addEventListener('scroll', onScroll, { passive: true });

  window.addEventListener('offline', () => {
    state.online = false;
    updateStatus();
  });
  window.addEventListener('online', () => {
    state.online = true;
    updateStatus();
  });
}

function loadSeenIds() {
  // جلسة فقط — لا نحفظ في localStorage
  state.seenIds = new Set();
}

/* ============ Auto-load ============ */

async function autoLoad() {
  if (state.autoLoaded) return;
  state.autoLoaded = true;

  loadSeenIds();

  let queries = getSearchHistory('web');

  if (queries.length === 0) {
    console.log('[Webby] first run → seeding defaults');
    DEFAULT_QUERIES.forEach((q) => addSearchHistory(q, 'web'));
    queries = DEFAULT_QUERIES.slice();
  }

  queries = queries.slice(0, 3);
  console.log('[Webby] auto-load:', queries);

  if (emptyEl) {
    emptyEl.style.display = 'flex';
    emptyEl.innerHTML = '<p>جاري التحميل...</p>';
  }

  for (const q of queries) {
    await addPool(q, { silent: true });
  }

  if (emptyEl) emptyEl.style.display = 'none';

  // ابدأ حلقة التعبئة
  scheduleCheck();
}

export function showWebView() {
  if (!state.autoLoaded) {
    autoLoad();
  } else {
    scheduleCheck();
  }
}

/* ============ Scroll ============ */

function onScroll() {
  if (state.isFilling) return;

  const { scrollTop, clientHeight, scrollHeight } = gridEl;
  const distance = scrollHeight - (scrollTop + clientHeight);

  if (distance > 800) return;

  // 1) إذا فيه طوابير → ارسم
  const hasQueue = Array.from(state.pools.values()).some(
    (p) => p.queue.length > 0
  );

  if (hasQueue) {
    renderNext();
    return;
  }

  // 2) وإلا → اجلب من pool التي لديها hasMore (الأقل عناصر)
  const fetchable = Array.from(state.pools.values())
    .filter((p) => p.hasMore && !state.loadingQueries.has(p.query));

  if (fetchable.length === 0) return;

  fetchable.sort((a, b) => a.items.length - b.items.length);
  const target = fetchable[0];

  fetchNextPage(target, { silent: true }).then(() => {
    renderNext();
    scheduleCheck();
  });
}

/* ============ Core Fill Loop ============ */

function scheduleCheck() {
  clearTimeout(state.checkTimer);
  state.checkTimer = setTimeout(ensureScreenFilled, 100);
}

async function ensureScreenFilled() {
  if (state.isFilling) return;
  state.isFilling = true;

  try {
    let iterations = 0;

    while (iterations++ < MAX_FILL_ITERATIONS) {
      if (!state.online) break;

      const shown = gridEl.children.length;
      const scrollable = gridEl.scrollHeight > gridEl.clientHeight + 50;

      // الشرط الأدنى: 24 بطاقة + قابل للتمرير
      if (shown >= 24 && scrollable) break;

      // 1) ارسم من الطوابير
      const hasQueue = Array.from(state.pools.values()).some(
        (p) => p.queue.length > 0
      );

      if (hasQueue) {
        renderNext();
        continue;
      }

      // 2) اجلب من المصادر
      const fetchable = Array.from(state.pools.values())
        .filter((p) => p.hasMore && !state.loadingQueries.has(p.query));

      if (fetchable.length === 0) break;

      fetchable.sort((a, b) => a.items.length - b.items.length);
      const target = fetchable[0];

      const before = target.items.length;
      await fetchNextPage(target, { silent: true });
      const after = target.items.length;

      if (after === before) target.hasMore = false;
    }
  } finally {
    state.isFilling = false;
    updateStatus();
  }
}

/* ============ Pools ============ */

async function addPool(query, options = {}) {
  const q = String(query || '').trim();
  if (!q) return;
  if (state.pools.has(q)) return;

  const pool = {
    query: q,
    items: [],
    queue: [],
    page: 1,
    hasMore: true
  };
  state.pools.set(q, pool);

  if (!options.silent) {
    try {
      const data = getUserData();
      if (!data.preferences) data.preferences = {};
      data.preferences.last_web_query = q;
      updateUserData({ preferences: data.preferences });
    } catch { /* ignore */ }
  }

  await fetchNextPage(pool, options);
}

export async function runSearch(query, options = {}) {
  if (!initialized) return;

  const q = String(query || '').trim();
  if (!q) return;

  if (state.pools.has(q)) {
    // إذا المستخدم بحث بشكل صريح، اسمح بإعادة استخدام العناصر
    if (!options.silent) {
      state.userSearched.add(q);
      const pool = state.pools.get(q);
      // أعد ما لم يُعرض
      if (pool.queue.length === 0 && pool.hasMore) {
        await fetchNextPage(pool, { silent: true });
      }
      scheduleCheck();
      return;
    }
    return;
  }

  if (!options.silent && emptyEl) {
    emptyEl.style.display = 'none';
  }

  if (!options.silent) state.userSearched.add(q);

  await addPool(q, options);

  if (!options.silent) scheduleCheck();
}

/* ============ Fetch ============ */

async function fetchNextPage(pool, options = {}) {
  if (!pool || !pool.hasMore) return;
  if (state.loadingQueries.has(pool.query)) return;

  state.loadingQueries.add(pool.query);

  const controller = new AbortController();
  const signal = controller.signal;
  const timeout = setTimeout(() => controller.abort(), 15000);

  const apiKeys = {};
  try {
    const data = getUserData();
    Object.assign(apiKeys, data.api_keys || {});
  } catch { /* ignore */ }

  const connectors = getEnabled(apiKeys);
  if (connectors.length === 0) {
    clearTimeout(timeout);
    state.loadingQueries.delete(pool.query);
    pool.hasMore = false;
    return;
  }

  try {
    const results = await Promise.allSettled(
      connectors.map((c) =>
        c
          .search(pool.query, {
            page: pool.page,
            perPage: PER_PAGE,
            signal,
            apiKeys
          })
          .then((items) => ({ id: c.id, items, error: null }))
          .catch((err) => ({ id: c.id, items: [], error: err.message }))
      )
    );

    if (signal.aborted) return;

    let newItems = [];
    const errors = [];

    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      const { items, error } = r.value;
      newItems.push(...items);
      if (error) errors.push(error);
    });

    // فلترة
    const otherIds = new Set();
    state.pools.forEach((p, q) => {
      if (q === pool.query) return;
      p.items.forEach((it) => otherIds.add(it.id));
    });
    const poolIds = new Set(pool.items.map((it) => it.id));

    newItems = newItems.filter((it) => {
      if (state.seenIds.has(it.id)) return false;
      if (poolIds.has(it.id)) return false;
      if (otherIds.has(it.id)) return false;
      return true;
    });

    pool.items.push(...newItems);
    pool.queue.push(...newItems);
    pool.page += 1;

    if (newItems.length < 4) pool.hasMore = false;

    if (errors.length > 0 && !options.silent) {
      console.warn('[Webby] errors:', errors);
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[Webby] fetch error:', err);
    }
    pool.hasMore = false;
  } finally {
    clearTimeout(timeout);
    state.loadingQueries.delete(pool.query);
  }
}

/* ============ Render ============ */

function renderNext() {
  const available = Array.from(state.pools.values()).filter(
    (p) => p.queue.length > 0
  );

  if (available.length === 0) return false;

  const n = available.length;
  const base = Math.floor(BATCH_SIZE / n);
  const remainder = BATCH_SIZE % n;

  const batch = [];
  available.forEach((pool, i) => {
    const take = base + (i < remainder ? 1 : 0);
    if (take <= 0) return;
    const slice = pool.queue.splice(0, take);
    batch.push(...slice);
  });

  if (batch.length === 0) return false;

  shuffle(batch);

  const seenIds = [];
  batch.forEach((item) => {
    state.seenIds.add(item.id);
    seenIds.push(item.id);
    gridEl.appendChild(createCard(item, openItem));
  });

  // لا نحفظ في localStorage — للجلسة فقط

  updateStatus();
  return true;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function updateStatus() {
  const pools = Array.from(state.pools.values());
  const total = pools.reduce((sum, p) => sum + p.items.length, 0);

  if (!state.online) {
    statusEl.textContent = '⚠️ لا يوجد اتصال بالإنترنت';
    statusEl.className = 'web-status error';
    return;
  }

  if (total === 0) {
    statusEl.textContent = state.isFilling ? 'جاري التحميل...' : '';
    statusEl.className = 'web-status';
    return;
  }

  const summary = pools.map((p) => `${p.query} (${p.items.length})`).join(' + ');
  const shown = gridEl.children.length;

  statusEl.textContent = `✅ ${total} نتيجة — معروض ${shown} — ${summary}`;
  statusEl.className = 'web-status success';
}

/* ============ Public API ============ */

export function clearWebFeed() {
  state.pools.clear();
  state.userSearched.clear();
  if (gridEl) gridEl.innerHTML = '';
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'web-status';
  }
  if (emptyEl) emptyEl.style.display = 'none';
}

export function removeFeedPool(query) {
  const q = String(query || '').trim();
  if (!q) return;

  for (const key of state.pools.keys()) {
    if (key.toLowerCase() === q.toLowerCase()) {
      state.pools.delete(key);
      break;
    }
  }

  state.userSearched.delete(q);
  gridEl.innerHTML = '';
  scheduleCheck();
}

export function resetWebView() {
  state.autoLoaded = false;
}

function openItem(item) {
  const url = item.original_url || item.media_url;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}