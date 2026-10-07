import { getAll } from '../core/registry.js';
import {
  getUserData,
  getSourceFilters,
  setSourceEnabled,
  setAllSourcesEnabled
} from '../../core/user-data.js';

const DROPDOWN_ID = 'webby-source-dropdown';
let delegateAttached = false;
let currentBtn = null;

export function initSourceFilter(container) {
  const btn = container.querySelector('.web-source-filter-btn');
  if (!btn) return;

  // ضمان وجود dropdown في body
  if (!document.getElementById(DROPDOWN_ID)) {
    const dropdown = document.createElement('div');
    dropdown.id = DROPDOWN_ID;
    dropdown.className = 'web-source-dropdown';
    dropdown.hidden = true;
    document.body.appendChild(dropdown);
  }

  if (!delegateAttached) {
    delegateAttached = true;
    attachDelegates();
  }
}

function attachDelegates() {
  document.addEventListener('click', (e) => {
    const toggleBtn =
      e.target.closest && e.target.closest('.web-source-filter-btn');

    if (toggleBtn) {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(toggleBtn);
      return;
    }

    const dropdown = document.getElementById(DROPDOWN_ID);
    if (!dropdown || dropdown.hidden) return;
    if (dropdown.contains(e.target)) return;
    closeDropdown();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  window.addEventListener('resize', () => {
    if (currentBtn) positionDropdown(currentBtn);
  });

  window.addEventListener(
    'scroll',
    () => {
      if (currentBtn) positionDropdown(currentBtn);
    },
    true
  );
}

function toggleDropdown(btn) {
  const dropdown = document.getElementById(DROPDOWN_ID);
  if (!dropdown) return;

  if (currentBtn === btn && !dropdown.hidden) {
    closeDropdown();
    return;
  }

  document
    .querySelectorAll('.web-source-filter-btn.active')
    .forEach((b) => b.classList.remove('active'));

  currentBtn = btn;
  btn.classList.add('active');

  buildContent(dropdown);
  dropdown.hidden = false;
  positionDropdown(btn);
}

function positionDropdown(btn) {
  const dropdown = document.getElementById(DROPDOWN_ID);
  if (!dropdown) return;

  const rect = btn.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // قياس الـ dropdown بعد أن ظهر
  const ddRect = dropdown.getBoundingClientRect();

  // top
  let top = rect.bottom + 6;
  if (top + ddRect.height > vh - 10) {
    top = rect.top - ddRect.height - 6;
  }
  if (top < 10) top = 10;

  // right (بمحاذاة يمين الزر)
  let right = vw - rect.right;
  if (right + ddRect.width > vw - 10) {
    right = vw - ddRect.width - 10;
  }
  if (right < 10) right = 10;

  dropdown.style.position = 'fixed';
  dropdown.style.top = top + 'px';
  dropdown.style.right = right + 'px';
  dropdown.style.left = 'auto';
  dropdown.style.bottom = 'auto';
  dropdown.style.zIndex = '2000';
}

export function closeDropdown() {
  const dropdown = document.getElementById(DROPDOWN_ID);
  if (!dropdown) return;
  dropdown.hidden = true;
  document
    .querySelectorAll('.web-source-filter-btn.active')
    .forEach((b) => b.classList.remove('active'));
  currentBtn = null;
}

function buildContent(dropdown) {
  const all = getAll();
  const filters = getSourceFilters();
  const data = getUserData();
  const apiKeys = data.api_keys || {};

  const readySources = all.filter((c) => {
    if (!c.keyRequired) return true;
    const key = apiKeys[`${c.id}_key`];
    return Boolean(key && String(key).trim());
  });

  const enabledCount = readySources.filter(
    (c) => filters[c.id] !== false
  ).length;
  const allEnabled = enabledCount === readySources.length;
  const someEnabled = enabledCount > 0 && enabledCount < readySources.length;

  dropdown.innerHTML = '';

  /* All row */
  const allRow = document.createElement('label');
  allRow.className = 'wsd-all-row';

  const allCb = document.createElement('input');
  allCb.type = 'checkbox';
  allCb.checked = allEnabled;
  allCb.indeterminate = someEnabled;
  allCb.addEventListener('change', (e) => {
    e.stopPropagation();
    const ids = readySources.map((c) => c.id);
    setAllSourcesEnabled(ids, allCb.checked);
    dispatchChange();
    buildContent(dropdown);
  });

  const allText = document.createElement('span');
  allText.textContent = `الكل (${enabledCount}/${readySources.length})`;

  allRow.appendChild(allCb);
  allRow.appendChild(allText);
  dropdown.appendChild(allRow);

  const sep = document.createElement('div');
  sep.className = 'wsd-sep';
  dropdown.appendChild(sep);

  /* Source rows */
  all.forEach((c) => {
    const row = document.createElement('label');
    row.className = 'wsd-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.disabled = !readySources.includes(c);
    cb.checked = filters[c.id] !== false;
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      setSourceEnabled(c.id, cb.checked);
      dispatchChange();
      buildContent(dropdown);
    });

    const nameSpan = document.createElement('span');
    nameSpan.className = 'wsd-name';
    nameSpan.textContent = c.name;

    const statusSpan = document.createElement('span');
    statusSpan.className = 'wsd-status';

    if (!readySources.includes(c)) {
      statusSpan.textContent = c.keyRequired ? 'يحتاج مفتاح' : '—';
      statusSpan.classList.add('missing');
    } else if (filters[c.id] === false) {
      statusSpan.textContent = 'معطّل';
      statusSpan.classList.add('off');
    } else {
      statusSpan.textContent = 'مفعّل';
      statusSpan.classList.add('on');
    }

    row.appendChild(cb);
    row.appendChild(nameSpan);
    row.appendChild(statusSpan);
    dropdown.appendChild(row);
  });
}

function dispatchChange() {
  window.dispatchEvent(new CustomEvent('webby:sources-changed'));
}