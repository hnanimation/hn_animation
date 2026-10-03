import { register, getEnabled } from '../core/registry.js';
import { createCard } from './cards.js';
import { getUserData, updateUserData } from '../../core/user-data.js';

import openverse from '../connectors/openverse.js';
import wikimedia from '../connectors/wikimedia.js';

register(openverse);
register(wikimedia);

let initialized = false;
let rootEl = null;
let gridEl = null;
let statusEl = null;
let emptyEl = null;

const INITIAL_LIMIT = 16;
const LIMIT_STEP = 16;

const state = {
  pools: new Map(),       // query -> { query, items, page, hasMore }
  isLoading: false,
  controller: null,
  displayLimit: INITIAL_LIMIT
};

const PER_PAGE = 8;

export function initWebView(root) {
  if (initialized) return;
  initialized = true;
  rootEl = root;

  root.innerHTML = `
    <div id="web-status" class="web-status"></div>
    <div id="web-results" class="web-grid"></div>
    <div id="web-empty" class="web-empty" style="display:none;">
      <p>اكتب في شريط البحث بالأعلى وابدأ.</p>
    </div>
  `;

  gridEl = root.querySelector('#web-results');
  statusEl = root.querySelector('#web-status');
  emptyEl = root.querySelector('#web-empty');

  gridEl.addEventListener('scroll', onScroll, { passive: true });
}

function onScroll() {
  if (state.isLoading) return;
  if (state.pools.size === 0) return;

  const { scrollTop, clientHeight, scrollHeight } = gridEl;
  if (scrollHeight - (scrollTop + clientHeight) > 500) return;

  // 1) أولًا: وسّع العرض إذا كان هناك المزيد من العناصر في المجمّعات
  const totalPoolItems = Array.from(state.pools.values()).reduce(
    (sum, p) => sum + p.items.length,
    0
  );

  if (state.displayLimit < totalPoolItems) {
    state.displayLimit += LIMIT_STEP;
    renderMixed();
    return;
  }

  // 2) ثانيًا: حمّل المزيد من المجمّعات التي لا تزال تملك المزيد
  const candidates = Array.from(state.pools.values()).filter((p) => p.hasMore);
  if (candidates.length === 0) return;

  // اختر الأقل عناصر (للتوازن)
  candidates.sort((a, b) => a.items.length - b.items.length);
  fetchNextPage(candidates[0]);
}

export function showWebView() {}

export async function runSearch(query) {
  if (!initialized) return;

  const q = String(query || '').trim();
  if (!q) return;

  const existing = state.pools.get(q);
  if (existing) {
    console.log('[Webby] query already in pool:', q);
    return;
  }

  emptyEl.style.display = 'none';

  const pool = { query: q, items: [], page: 1, hasMore: true };
  state.pools.set(q, pool);

  try {
    const data = getUserData();
    if (!data.preferences) data.preferences = {};
    data.preferences.last_web_query = q;
    updateUserData({ preferences: data.preferences });
  } catch { /* ignore */ }

  await fetchNextPage(pool);
}

async function fetchNextPage(pool) {
  if (state.isLoading || !pool || !pool.hasMore) return;

  if (state.controller) state.controller.abort();
  state.controller = new AbortController();
  const signal = state.controller.signal;

  state.isLoading = true;
  statusEl.textContent = `جاري البحث في "${pool.query}"...`;
  statusEl.className = 'web-status loading';

  const apiKeys = {};
  try {
    const data = getUserData();
    Object.assign(apiKeys, data.api_keys || {});
  } catch { /* ignore */ }

  const connectors = getEnabled(apiKeys);
  if (connectors.length === 0) {
    statusEl.textContent = 'لا توجد مصادر مفعّلة.';
    statusEl.className = 'web-status error';
    state.isLoading = false;
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

    const newItems = [];
    const errors = [];

    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      const { items, error } = r.value;
      newItems.push(...items);
      if (error) errors.push(error);
    });

    pool.items.push(...newItems);
    pool.page += 1;

    if (newItems.length < 6) pool.hasMore = false;

    renderMixed();

    if (errors.length > 0) {
      statusEl.textContent = `⚠️ ${errors.join(' • ')}`;
      statusEl.className = 'web-status error';
    }
  } catch (err) {
    if (err.name !== 'AbortError') {
      statusEl.textContent = `خطأ: ${err.message}`;
      statusEl.className = 'web-status error';
    }
  } finally {
    state.isLoading = false;
  }
}

/**
 * يعرض `state.displayLimit` عنصرًا، موزّعين بالتساوي على المجمّعات،
 * ومرتّبين عشوائيًا.
 */
function renderMixed() {
  gridEl.innerHTML = '';

  const pools = Array.from(state.pools.values()).filter((p) => p.items.length > 0);
  if (pools.length === 0) {
    updateStatus();
    return;
  }

  const n = pools.length;
  const limit = state.displayLimit;
  const base = Math.floor(limit / n);
  const remainder = limit % n;

  // اختر عيّنة من كل مجمّع
  const sample = [];
  pools.forEach((pool, i) => {
    const take = base + (i < remainder ? 1 : 0);
    if (take <= 0) return;
    const slice = pool.items.slice(0, take);
    sample.push(...slice);
  });

  // shuffle (Fisher-Yates)
  for (let i = sample.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sample[i], sample[j]] = [sample[j], sample[i]];
  }

  // render
  sample.forEach((item) => {
    gridEl.appendChild(createCard(item, openItem));
  });

  updateStatus();
}

function updateStatus() {
  const pools = Array.from(state.pools.values());
  const total = pools.reduce((sum, p) => sum + p.items.length, 0);

  if (total === 0) {
    statusEl.textContent = '';
    statusEl.className = 'web-status';
    return;
  }

  const summary = pools
    .map((p) => `${p.query} (${p.items.length})`)
    .join(' + ');

  const shown = Math.min(state.displayLimit, total);

  statusEl.textContent = `✅ ${total} نتيجة — معروض ${shown} — ${summary}`;
  statusEl.className = 'web-status success';
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

  renderMixed();
}

export function clearWebFeed() {
  state.pools.clear();
  state.displayLimit = INITIAL_LIMIT;
  if (gridEl) gridEl.innerHTML = '';
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'web-status';
  }
  if (emptyEl) emptyEl.style.display = 'none';
}

function openItem(item) {
  const url = item.original_url || item.media_url;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}