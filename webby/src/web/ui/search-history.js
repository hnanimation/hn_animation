import {
  getSearchHistory,
  addSearchHistory,
  removeSearchHistory,
  clearSearchHistory
} from '../../core/user-data.js';

/**
 * يربط حقل بحث بقائمة منسدلة للسجل.
 *
 * @param {HTMLInputElement} inputEl
 * @param {HTMLElement} wrapperEl - العنصر الأب (position: relative)
 * @param {Object} options - { scope, onSelect }
 */
export function attachSearchHistory(inputEl, wrapperEl, options = {}) {
  const scope = options.scope || 'default';
  const onSelect = options.onSelect || (() => {});
  // لا شيء — onClearAll يُستدعى من الزر

  // قائمة منسدلة
  const dropdown = document.createElement('div');
  dropdown.className = 'search-history-dropdown';
  dropdown.style.display = 'none';
  wrapperEl.appendChild(dropdown);

  function renderDropdown(filter = '') {
    const history = getSearchHistory(scope);
    dropdown.innerHTML = '';

    const f = String(filter || '').toLowerCase().trim();

    // عناصر السجل (مع تصفية)
    const matches = f
      ? history.filter((item) => item.toLowerCase().includes(f))
      : history;

    if (matches.length === 0) {
      if (history.length === 0) {
        dropdown.style.display = 'none';
        return;
      }
      const empty = document.createElement('div');
      empty.className = 'sh-empty';
      empty.textContent = 'لا توجد نتائج مطابقة';
      dropdown.appendChild(empty);
      dropdown.style.display = 'block';
      return;
    }

    matches.forEach((item) => {
      const row = document.createElement('div');
      row.className = 'sh-item';

      const label = document.createElement('span');
      label.className = 'sh-label';
      label.textContent = item;
      label.addEventListener('click', () => {
        inputEl.value = item;
        closeDropdown();
        onSelect(item);
      });
      row.appendChild(label);

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'sh-delete';
      del.setAttribute('aria-label', 'حذف');
      del.textContent = '✕';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        removeSearchHistory(item, scope);
        if (options.onDelete) options.onDelete(item);
        renderDropdown(inputEl.value);
      });
      row.appendChild(del);

      dropdown.appendChild(row);
    });

    // زر "مسح الكل"
    if (history.length > 0) {
      const clearRow = document.createElement('div');
      clearRow.className = 'sh-clear-all';
      clearRow.textContent = 'مسح الكل';
      clearRow.addEventListener('click', () => {
        clearSearchHistory(scope);
        if (options.onClearAll) options.onClearAll();
        closeDropdown();
      });
      dropdown.appendChild(clearRow);
    }

    dropdown.style.display = 'block';
  }

  function openDropdown() {
    renderDropdown(inputEl.value);
  }

  function closeDropdown() {
    dropdown.style.display = 'none';
  }

  // زر ▼ في نهاية الحقل
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'search-history-toggle';
  toggleBtn.setAttribute('aria-label', 'سجل البحث');
  toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dropdown.style.display === 'block') {
      closeDropdown();
    } else {
      openDropdown();
      inputEl.focus();
    }
  });
  wrapperEl.appendChild(toggleBtn);

  // أحداث الحقل
  inputEl.addEventListener('focus', () => {
    if (inputEl.value.length === 0) openDropdown();
  });

  inputEl.addEventListener('input', () => {
    if (dropdown.style.display === 'block') {
      renderDropdown(inputEl.value);
    }
  });

  // إغلاق عند النقر خارج
  document.addEventListener('click', (e) => {
    if (!wrapperEl.contains(e.target)) {
      closeDropdown();
    }
  });

  // Escape
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDropdown();
  });

  return {
    open: openDropdown,
    close: closeDropdown,
    add: (query) => {
      addSearchHistory(query, scope);
    },
    render: () => renderDropdown(inputEl.value)
  };
}