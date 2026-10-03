import { register, getEnabled } from '../core/registry.js';
import { createCard } from './cards.js';
import { getUserData } from '../../core/user-data.js';

import openverse from '../connectors/openverse.js';
import wikimedia from '../connectors/wikimedia.js';

register(openverse);
register(wikimedia);

let initialized = false;
let rootEl = null;
let gridEl = null;
let statusEl = null;

const state = {
  query: '',
  page: 1,
  isLoading: false,
  controller: null,
  hasMore: true
};

const PER_PAGE = 8;

export function initSearchView(root) {
  if (initialized) return;
  initialized = true;
  rootEl = root;

  root.innerHTML = `
    <div id="search-status" class="web-status"></div>
    <div id="search-results" class="web-grid"></div>
  `;

  gridEl = root.querySelector('#search-results');
  statusEl = root.querySelector('#search-status');

  gridEl.addEventListener('scroll', onScroll, { passive: true });
}

function onScroll() {
  if (!state.query || state.isLoading || !state.hasMore) return;

  const { scrollTop, clientHeight, scrollHeight } = gridEl;
  const distance = scrollHeight - (scrollTop + clientHeight);

  if (distance < 500) {
    fetchPage(state.page + 1);
  }
}

export function showSearchView() {}

export function resetSearchView() {
  if (!initialized) return;
  state.query = '';
  state.page = 1;
  state.isLoading = false;
  state.hasMore = true;
  if (state.controller) state.controller.abort();
  if (gridEl) gridEl.innerHTML = '';
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'web-status';
  }
}

export async function runSearch(query) {
  if (!initialized) return;
  state.query = query;
  state.page = 1;
  state.hasMore = true;
  state.isLoading = false;

  gridEl.innerHTML = '';
  await fetchPage(1);
}

async function fetchPage(page) {
  if (state.isLoading || !state.query) return;
  if (page > 1 && !state.hasMore) return;

  if (state.controller) state.controller.abort();
  state.controller = new AbortController();
  const signal = state.controller.signal;

  state.isLoading = true;
  state.page = page;

  statusEl.textContent = page === 1 ? 'جاري البحث...' : `صفحة ${page}...`;
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
        c.search(state.query, { page, perPage: PER_PAGE, signal, apiKeys })
          .then((items) => ({ id: c.id, items, error: null }))
          .catch((err) => ({ id: c.id, items: [], error: err.message }))
      )
    );

    if (signal.aborted) return;

    const allItems = [];
    const errors = [];
    const perSource = {};

    results.forEach((r) => {
      if (r.status !== 'fulfilled') return;
      const { id, items, error } = r.value;
      perSource[id] = items.length;
      allItems.push(...items);
      if (error) errors.push(`${id}: ${error}`);
    });

    for (let i = allItems.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allItems[i], allItems[j]] = [allItems[j], allItems[i]];
    }

    if (page === 1) gridEl.innerHTML = '';

    allItems.forEach((item) => {
      gridEl.appendChild(createCard(item, openItem));
    });

    if (allItems.length < 6) state.hasMore = false;

    if (page === 1) {
      const stats = Object.entries(perSource).map(([id, n]) => `${id}: ${n}`).join(' | ');
      statusEl.textContent = errors.length > 0
        ? `⚠️ ${errors.join(' • ')}`
        : `✅ ${allItems.length} نتيجة (${stats})`;
      statusEl.className = errors.length > 0 ? 'web-status error' : 'web-status success';
    } else {
      statusEl.textContent = `+${allItems.length} نتيجة إضافية`;
      statusEl.className = 'web-status success';
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

function openItem(item) {
  const url = item.original_url || item.media_url;
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}