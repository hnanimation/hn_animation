const STORAGE_KEY = 'webby_user_data_v1';

const DEFAULT_DATA = {
  version: 1,
  exported_at: null,
  bookmarks: [],
  subscriptions: [],
  api_keys: {},
  source_filters: {},
  preferences: {
    language: 'ar',
    theme: 'dark',
    preview_size: 'desktop'
  },
  communities: [],
  blocked_sources: [],
  history: [],
  search_history: [],
  search_history_web: [],
  seen_items: []
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_DATA);
    const data = JSON.parse(raw);
    return { ...structuredClone(DEFAULT_DATA), ...data };
  } catch (err) {
    console.warn('[Webby] failed to load user data:', err);
    return structuredClone(DEFAULT_DATA);
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (err) {
    console.error('[Webby] failed to save user data:', err);
    return false;
  }
}

export function getUserData() {
  return load();
}

export function updateUserData(patch) {
  const data = load();
  const merged = { ...data, ...patch };
  save(merged);
  return merged;
}

export function setPreference(key, value) {
  const data = load();
  data.preferences[key] = value;
  save(data);
  return data.preferences;
}

export function getPreference(key, fallback = null) {
  const data = load();
  return data.preferences[key] ?? fallback;
}

export function clearUserData() {
  localStorage.removeItem(STORAGE_KEY);
  return structuredClone(DEFAULT_DATA);
}

/* ============ Search History ============ */

const MAX_HISTORY = 30;

export function getSearchHistory(scope = 'default') {
  const data = load();
  const key = scope === 'web' ? 'search_history_web' : 'search_history';
  return Array.isArray(data[key]) ? data[key] : [];
}

export function addSearchHistory(query, scope = 'default') {
  const q = String(query || '').trim();
  if (!q || q.length < 2) return getSearchHistory(scope);

  const data = load();
  const key = scope === 'web' ? 'search_history_web' : 'search_history';
  let list = Array.isArray(data[key]) ? data[key] : [];

  list = list.filter((item) => item.toLowerCase() !== q.toLowerCase());
  list.unshift(q);

  if (list.length > MAX_HISTORY) list = list.slice(0, MAX_HISTORY);

  data[key] = list;
  save(data);
  return list;
}

export function removeSearchHistory(query, scope = 'default') {
  const q = String(query || '').trim();
  const data = load();
  const key = scope === 'web' ? 'search_history_web' : 'search_history';
  let list = Array.isArray(data[key]) ? data[key] : [];
  list = list.filter((item) => item !== q);
  data[key] = list;
  save(data);
  return list;
}

export function clearSearchHistory(scope = 'default') {
  const data = load();
  const key = scope === 'web' ? 'search_history_web' : 'search_history';
  data[key] = [];
  save(data);
  return [];
}

/* ============ Seen Items (Discovery History) ============ */

const MAX_SEEN = 2000;

export function getSeenItems() {
  const data = load();
  return Array.isArray(data.seen_items) ? data.seen_items : [];
}

export function isSeen(id) {
  if (!id) return false;
  const list = getSeenItems();
  return list.includes(String(id));
}

export function markAsSeen(id) {
  const s = String(id || '').trim();
  if (!s) return;

  const data = load();
  let list = Array.isArray(data.seen_items) ? data.seen_items : [];

  if (list.includes(s)) return;

  list.push(s);
  if (list.length > MAX_SEEN) list = list.slice(-MAX_SEEN);

  data.seen_items = list;
  save(data);
}

export function markManyAsSeen(ids) {
  const data = load();
  let list = Array.isArray(data.seen_items) ? data.seen_items : [];
  const set = new Set(list);

  ids.forEach((id) => {
    const s = String(id || '').trim();
    if (s && !set.has(s)) {
      set.add(s);
      list.push(s);
    }
  });

  if (list.length > MAX_SEEN) list = list.slice(-MAX_SEEN);
  data.seen_items = list;
  save(data);
}

export function clearSeenItems() {
  const data = load();
  data.seen_items = [];
  save(data);
}

export function exportUserData() {
  const data = load();
  return {
    ...data,
    exported_at: new Date().toISOString(),
    generator: 'Webby',
    generator_version: '1.0'
  };
}

export function importUserData(syncData, { merge = true } = {}) {
  if (!syncData || typeof syncData !== 'object') {
    throw new Error('ملف Sync غير صالح.');
  }
  if (!syncData.version) {
    throw new Error('الملف لا يحتوي على رقم إصدار.');
  }
  if (syncData.version > 1) {
    throw new Error(`إصدار الملف (${syncData.version}) غير مدعوم.`);
  }

  if (!merge) {
    save({ ...structuredClone(DEFAULT_DATA), ...syncData });
    return load();
  }

  const current = load();
  const merged = {
    ...current,
    version: Math.max(current.version || 1, syncData.version || 1),
    exported_at: syncData.exported_at || current.exported_at,
    bookmarks: mergeByUrl(current.bookmarks || [], syncData.bookmarks || []),
    subscriptions: mergeByUrl(
      current.subscriptions || [],
      syncData.subscriptions || []
    ),
    api_keys: {
      ...current.api_keys,
      ...(syncData.api_keys || {})
    },
    source_filters: {
      ...(current.source_filters || {}),
      ...(syncData.source_filters || {})
    },
    preferences: {
      ...current.preferences,
      ...(syncData.preferences || {})
    },
    communities: mergeByUrl(current.communities || [], syncData.communities || []),
    blocked_sources: dedupe([
      ...(current.blocked_sources || []),
      ...(syncData.blocked_sources || [])
    ]),
    history: mergeByTime(current.history || [], syncData.history || []),
    search_history: dedupe([
      ...(current.search_history || []),
      ...(syncData.search_history || [])
    ]),
    search_history_web: dedupe([
      ...(current.search_history_web || []),
      ...(syncData.search_history_web || [])
    ]),
    seen_items: dedupe([
      ...(current.seen_items || []),
      ...(syncData.seen_items || [])
    ])
  };

  save(merged);
  return merged;
}

function mergeByUrl(a = [], b = []) {
  const map = new Map();
  [...a, ...b].forEach((item) => {
    if (!item) return;
    const key = item.url || item.id;
    if (!key) return;
    map.set(key, { ...map.get(key), ...item });
  });
  return Array.from(map.values());
}

function mergeByTime(a = [], b = []) {
  const all = [...a, ...b];
  all.sort((x, y) => {
    const tx = new Date(x.timestamp || 0).getTime();
    const ty = new Date(y.timestamp || 0).getTime();
    return ty - tx;
  });
  return all.slice(0, 1000);
}

function dedupe(arr) {
  return Array.from(new Set(arr));
}
/* ============ Source Filters ============ */

export function getSourceFilters() {
  const data = load();
  return data.source_filters || {};
}

export function isSourceEnabled(sourceId) {
  const filters = getSourceFilters();
  return filters[sourceId] !== false;
}

export function setSourceEnabled(sourceId, enabled) {
  const data = load();
  if (!data.source_filters) data.source_filters = {};

  if (enabled) delete data.source_filters[sourceId];
  else data.source_filters[sourceId] = false;

  save(data);
  return data.source_filters;
}

export function setAllSourcesEnabled(sourceIds, enabled) {
  const data = load();
  if (!data.source_filters) data.source_filters = {};

  sourceIds.forEach((id) => {
    if (enabled) delete data.source_filters[id];
    else data.source_filters[id] = false;
  });

  save(data);
  return data.source_filters;
}