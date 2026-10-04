import { attachSearchHistory } from '../web/ui/search-history.js';
import { addSearchHistory } from '../core/user-data.js';
import { initWebView, showWebView, runSearch as runSearchFromWebView, clearWebFeed, removeFeedPool } from '../web/ui/view.js';import { newProject, getCurrentProject, replaceProject } from '../core/project.js';
import { createSection, SECTION_TYPES, getSectionIcon } from '../core/sections.js';
import { updatePreview, resetPreviewPage, navigatePreviewTo } from '../preview/preview.js';
import { exportAsSingleHtml } from '../exporter/html-exporter.js';
import { exportAsZip } from '../exporter/zip-exporter.js';
import { renderSectionEditor } from '../editor/content-editor.js';
import { renderMediaManager } from '../editor/media-manager.js';
import { renderSettingsEditor } from '../editor/settings-editor.js';
import { renderNetworkEditor } from '../editor/network-editor.js';
import { showConfirm, showPrompt, showSelect } from './dialogs.js';
import { showProgress } from './progress.js';
import { fillIcons, getIcon } from './icons.js';
import {
  saveProjectAsBundle,
  saveProjectAsJson,
  openProjectFromFile,
  saveProjectToFolder,
  openProjectFromFolder
} from '../fs/project-io.js';
import { pickFolder, isFsAccessSupported } from '../fs/file-system-access.js';
import { saveHandle, loadHandle, ensurePermission } from '../fs/handle-store.js';
import { initSearchView, resetSearchView, showSearchView, runSearch as runSearchFromSearchView } from '../web/ui/search-view.js';
let selectedSectionId = null;
let currentTab = 'content';
let linkedFolderHandle = null;
let currentView = 'thisweb';
let thiswebOfflineMode = false;

function isEmbeddedMode() {
  return location.pathname.includes('/webby/');
}

function safe(label, fn) {
  try {
    return fn();
  } catch (err) {
    console.error(`[Webby] Error in ${label}:`, err);
    return null;
  }
}

export function initApp(root) {
  root.innerHTML = `
        <header class="topbar">
      <h1 class="topbar-brand">Webby</h1>

      <div class="topbar-search" id="topbar-search">
        <input type="search" id="topbar-search-input" placeholder="ابحث..." autocomplete="off" />
        <button id="topbar-search-btn" type="button" title="بحث">
          <span data-icon="search" data-icon-size="18"></span>
        </button>
      </div>

      <div class="actions" id="topbar-actions">
        <button id="btn-new">New</button>
        <button id="btn-open">Open</button>
        <button id="btn-save">Save</button>
        <button id="btn-save-as" data-hide-mobile="true">Save As</button>
        <button id="btn-export-html" data-hide-mobile="true">Export HTML</button>
        <button id="btn-export-zip">Export ZIP</button>
      </div>

      <div class="folder-status" id="folder-status">لا يوجد مجلد مرتبط</div>
    </header>

    <main class="app-content">
      <div class="view" data-view="search" id="search-view-root"></div>

      <div class="view" data-view="web" id="web-view-root"></div>

      <div class="view active" data-view="thisweb">
        <div class="thisweb-container">
          <div id="thisweb-content"></div>
        </div>
      </div>

      <div class="view" data-view="publish">
        <aside class="sidebar">
          <h3>الأقسام</h3>
          <nav id="section-list"></nav>
          <button id="btn-add-section" class="add-section">+ قسم جديد</button>

          <h3 style="margin-top:20px;">أدوات</h3>
          <nav id="tool-list">
            <button id="tool-settings">الإعدادات</button>
            <button id="tool-media">الوسائط</button>
            <button id="tool-network">الشبكة</button>
          </nav>
        </aside>

        <section class="editor">
          <div id="editor-panel">
            <p>اختر قسمًا من القائمة.</p>
          </div>
        </section>

        <section class="preview">
          <div class="preview-header">
            <h2>Preview</h2>
            <div class="preview-sizes">
              <button data-size="desktop" class="size-btn active" title="Desktop">🖥️</button>
              <button data-size="tablet" class="size-btn" title="Tablet">📱</button>
              <button data-size="mobile" class="size-btn" title="Mobile">📱</button>
            </div>
            <div class="preview-label" id="preview-label">Desktop</div>
            <button id="btn-preview-fullscreen" class="fullscreen-btn" title="ملء الشاشة">⛶</button>
          </div>
          <div class="preview-stage" id="preview-stage">
            <iframe id="preview-frame" title="Preview"></iframe>
          </div>
        </section>
      </div>

      <div class="view" data-view="bookmarks">
        <div class="view-placeholder">
          <span class="view-placeholder-icon" data-icon="bookmark" data-icon-size="48"></span>
          <h2>مفضلة</h2>
          <p>المواقع التي وضعت عليها علامة + فيدزها.</p>
          <p class="placeholder-hint">سيُبنى في المرحلة 4.</p>
        </div>
      </div>
    </main>

    <nav class="bottom-bar">
      <button class="bottom-btn" data-view="search">
        <span class="bottom-icon" data-icon="search" data-icon-size="22"></span>
        <span class="bottom-label">بحث</span>
      </button>
      <button class="bottom-btn" data-view="web">
        <span class="bottom-icon" data-icon="earth" data-icon-size="22"></span>
        <span class="bottom-label">Web</span>
      </button>
      <button class="bottom-btn active" data-view="thisweb">
        <span class="bottom-icon" data-icon="house" data-icon-size="22"></span>
        <span class="bottom-label">thisweb</span>
      </button>
      <button class="bottom-btn" data-view="bookmarks">
        <span class="bottom-icon" data-icon="bookmark" data-icon-size="22"></span>
        <span class="bottom-label">مفضلة</span>
      </button>
      <button class="bottom-btn" data-view="publish">
        <span class="bottom-icon" data-icon="sticky-note-plus" data-icon-size="22"></span>
        <span class="bottom-label">نشر</span>
      </button>
    </nav>

    <input type="file" id="file-input" accept=".webby,.zip,.json" style="display:none" />
  `;

  fillIcons(root);

  const previewFrame = document.getElementById('preview-frame');
  const sidebarList = document.getElementById('section-list');
  const editorPanel = document.getElementById('editor-panel');
  const fileInput = document.getElementById('file-input');
  const folderStatus = document.getElementById('folder-status');
  const thiswebContent = document.getElementById('thisweb-content');

    function getLocalSiteUrl() {
    const host = location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (!isLocal) return '';

    let path = location.pathname;
    path = path.replace(/\/webby\/.*$/, '/');
    path = path.replace(/\/[^\/]*$/, '/');
    return location.origin + path + 'index.html';
  }

    /* ===== Offline Detection ===== */
  function showOfflineBanner() {
    if (document.getElementById('offline-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.textContent = '⚠️ لا يوجد اتصال بالإنترنت';
    document.body.appendChild(banner);
  }

  function hideOfflineBanner() {
    const b = document.getElementById('offline-banner');
    if (b) b.remove();
  }

  window.addEventListener('offline', showOfflineBanner);
  window.addEventListener('online', hideOfflineBanner);

  if (!navigator.onLine) showOfflineBanner();

    /* ===== Topbar Search ===== */
  const topbarSearchInput = document.getElementById('topbar-search-input');
  const topbarSearchBtn = document.getElementById('topbar-search-btn');

  const searchableViews = ['search', 'web', 'thisweb'];
  const viewSearchMemory = { search: '', web: '', thisweb: '' };

  function triggerTopbarSearch() {
    const q = topbarSearchInput.value.trim();
    if (!q) return;

    // سجّل البحث
    try {
      if (currentView === 'web') {
        addSearchHistory(q, 'web');
      } else {
        addSearchHistory(q, 'default');
      }
    } catch { /* ignore */ }

    if (currentView === 'search') {
      safe('search.runSearch', () => runSearchFromSearchView(q));
    } else if (currentView === 'web') {
      safe('web.runSearch', () => runSearchFromWebView(q));
    } else if (currentView === 'thisweb') {
      setView('search');
      setTimeout(() => {
        safe('search.runSearch', () => runSearchFromSearchView(q));
      }, 50);
    }

    // حدّث السجل بعد البحث
    if (searchHistoryUI) searchHistoryUI.close();
  }

  topbarSearchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerTopbarSearch();
    }
  });

  topbarSearchBtn.addEventListener('click', () => {
    triggerTopbarSearch();
  });

    /* ===== Search History Dropdown ===== */
  let searchHistoryUI = null;
  const topbarSearchWrapper = topbarSearchInput.parentElement;

  function getSearchScope() {
    if (currentView === 'search') return 'default';
    if (currentView === 'web') return 'web';
    return 'default';
  }

  function initSearchHistoryUI() {
    const scope = getSearchScope();
    if (searchHistoryUI && searchHistoryUI._scope === scope) return;

    // احذف القديم
    if (searchHistoryUI && searchHistoryUI._toggle) {
      searchHistoryUI._toggle.remove();
    }
    const oldDropdown = topbarSearchWrapper.querySelector('.search-history-dropdown');
    if (oldDropdown) oldDropdown.remove();

    searchHistoryUI = attachSearchHistory(topbarSearchInput, topbarSearchWrapper, {
      scope,
      onSelect: (query) => {
        triggerTopbarSearch();
      },
      onDelete: (query) => {
        if (scope === 'web') {
          safe('removeFeedPool', () => removeFeedPool(query));
        }
      },
      onClearAll: () => {
        if (scope === 'web') {
          safe('clearWebFeed', () => clearWebFeed());
        }
      }
    });
    searchHistoryUI._scope = scope;
    searchHistoryUI._toggle = topbarSearchWrapper.querySelector('.search-history-toggle');
  }

  function updateFolderStatus() {
    if (linkedFolderHandle) {
      folderStatus.textContent = `📁 ${linkedFolderHandle.name}`;
      folderStatus.classList.add('linked');
    } else {
      folderStatus.textContent = 'لا يوجد مجلد مرتبط';
      folderStatus.classList.remove('linked');
    }
  }

  async function restoreLinkedFolder() {
    try {
      const handle = await loadHandle();
      if (handle) {
        linkedFolderHandle = handle;
        updateFolderStatus();
      }
    } catch (err) {
      console.warn('[Webby] restoreLinkedFolder:', err);
    }
  }

    /* ===== هذا الموقع (thisweb) ===== */

  function normalizeUrl(input) {
    const s = String(input || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) return s;
    return 'https://' + s;
  }

  function exitOfflinePreview() {
    thiswebOfflineMode = false;
    renderThisWeb();
  }

  function renderThisWeb() {
    const project = getCurrentProject();
    if (!project) return;

    const meta = project.meta || {};
    const url = (meta.link || '').trim();
    const hasProject = !!project.sections?.length;

    thiswebContent.innerHTML = '';

    /* ===== embedded: العودة إلى الموقع الأصلي ===== */
    if (isEmbeddedMode()) {
      const wrap = document.createElement('div');
      wrap.className = 'thisweb-empty-wrap';

      const inner = document.createElement('div');
      inner.className = 'thisweb-empty-inner';
      inner.innerHTML = `
        <span class="thisweb-header-icon">${getIcon('house', 48)}</span>
        <h2>هذا الموقع</h2>
        <p class="thisweb-empty-title">أنت داخل Webby</p>
        <p class="thisweb-empty-hint">
          هذا موقع شخص آخر. للعودة إلى محتواه، اضغط الزر أدناه.
          لبناء موقعك الخاص، استخدم زر <strong>نشر</strong>.
        </p>
      `;

      const backBtn = document.createElement('a');
      backBtn.className = 'thisweb-btn primary';
      backBtn.href = '../index.html';
      backBtn.innerHTML = `<span>${getIcon('earth', 16)}</span> العودة إلى الموقع`;
      inner.appendChild(backBtn);

      const goBuilder = document.createElement('button');
      goBuilder.className = 'thisweb-btn';
      goBuilder.style.marginTop = '8px';
      goBuilder.innerHTML = `<span>${getIcon('blocks', 16)}</span> اذهب إلى البناء`;
      goBuilder.addEventListener('click', () => setView('publish'));
      inner.appendChild(goBuilder);

      wrap.appendChild(inner);
      thiswebContent.appendChild(wrap);
      return;
    }

    /* ===== الحالة 3: Offline Preview ===== */
    if (thiswebOfflineMode && hasProject) {
      const offlineBar = document.createElement('div');
      offlineBar.className = 'thisweb-offline-bar';

      const badge = document.createElement('span');
      badge.className = 'thisweb-offline-badge';
      badge.textContent = '● OFFLINE';
      offlineBar.appendChild(badge);

      const label = document.createElement('span');
      label.className = 'thisweb-offline-label';
      label.textContent = 'معاينة محلية — لم تُنشر';
      offlineBar.appendChild(label);

      const exitBtn = document.createElement('button');
      exitBtn.className = 'thisweb-offline-exit';
      exitBtn.textContent = '✕ خروج من المعاينة';
      exitBtn.addEventListener('click', exitOfflinePreview);
      offlineBar.appendChild(exitBtn);

      thiswebContent.appendChild(offlineBar);

      const iframe = document.createElement('iframe');
      iframe.className = 'thisweb-offline-frame';
      iframe.title = 'معاينة محلية';
      thiswebContent.appendChild(iframe);

      requestAnimationFrame(() => {
        updatePreview(iframe, project, {
          onAction: (action) => {
            if (action === 'thisweb') {
              thiswebOfflineMode = false;
              renderThisWeb();
              return;
            }
            if (['search', 'web', 'bookmarks', 'publish'].includes(action)) {
              setView(action);
            }
          }
        });
      });

      return;
    }

    /* ===== الحالتان 1 و 2: Empty أو Card ===== */

    const wrap = document.createElement('div');
    wrap.className = 'thisweb-empty-wrap';

    const inner = document.createElement('div');
    inner.className = 'thisweb-empty-inner';

    inner.innerHTML = `
      <span class="thisweb-header-icon">${getIcon('house', 48)}</span>
      <h2>هذا الموقع</h2>
    `;

    const localUrl = getLocalSiteUrl();

    if (url) {
      /* ===== الحالة 2: رابط موجود ===== */
      const urlBox = document.createElement('div');
      urlBox.className = 'thisweb-url-box';
      urlBox.innerHTML = `
        <span class="thisweb-url-icon">${getIcon('earth', 18)}</span>
        <a class="thisweb-url-link" href="${url}" target="_blank" rel="noopener"></a>
      `;
      urlBox.querySelector('.thisweb-url-link').textContent = url;
      inner.appendChild(urlBox);

      const actions = document.createElement('div');
      actions.className = 'thisweb-actions';

      const openBtn = document.createElement('a');
      openBtn.className = 'thisweb-btn primary';
      openBtn.href = url;
      openBtn.target = '_blank';
      openBtn.rel = 'noopener';
      openBtn.innerHTML = `<span>${getIcon('earth', 16)}</span> افتح أونلاين`;
      actions.appendChild(openBtn);

      if (hasProject) {
        const offlineBtn = document.createElement('button');
        offlineBtn.className = 'thisweb-btn';
        offlineBtn.innerHTML = `<span>${getIcon('sticky-note-plus', 16)}</span> معاينة offline`;
        offlineBtn.addEventListener('click', () => {
          thiswebOfflineMode = true;
          renderThisWeb();
        });
        actions.appendChild(offlineBtn);
      }

      const editBtn = document.createElement('button');
      editBtn.className = 'thisweb-btn';
      editBtn.textContent = 'تعديل الرابط';
      editBtn.addEventListener('click', async () => {
        const input = await showPrompt('رابط موقعك:', url);
        if (input === null) return;
        project.meta.link = normalizeUrl(input);
        refreshAll();
      });
      actions.appendChild(editBtn);

      inner.appendChild(actions);
    } else {
      /* ===== الحالة 1: لا رابط ===== */
      const emptyText = document.createElement('p');
      emptyText.className = 'thisweb-empty-title';
      emptyText.textContent = 'لم تنشر موقعك بعد.';
      inner.appendChild(emptyText);

      const hint = document.createElement('p');
      hint.className = 'thisweb-empty-hint';
      hint.textContent =
        'بعد أن تُصدّر موقعك وترفعه على أي استضافة (GitHub Pages، Netlify، Cloudflare Pages...)، الصق الرابط هنا ليعرفه Webby.';
      inner.appendChild(hint);

      if (localUrl && hasProject) {
        const localBox = document.createElement('div');
        localBox.className = 'thisweb-url-box thisweb-url-box-offline';
        localBox.innerHTML = `
          <span class="thisweb-url-icon">${getIcon('sticky-note-plus', 18)}</span>
          <a class="thisweb-url-link" href="${localUrl}" target="_blank" rel="noopener"></a>
        `;
        localBox.querySelector('.thisweb-url-link').textContent = localUrl;
        inner.appendChild(localBox);

        const label = document.createElement('p');
        label.className = 'thisweb-local-label';
        label.textContent = 'معاينة محلية (قبل النشر)';
        inner.appendChild(label);
      }

      const actions = document.createElement('div');
      actions.className = 'thisweb-actions';

      const addBtn = document.createElement('button');
      addBtn.className = 'thisweb-btn primary';
      addBtn.textContent = 'أضف رابط موقعك';
      addBtn.addEventListener('click', async () => {
        const input = await showPrompt('رابط موقعك:', 'https://');
        if (!input) return;
        project.meta.link = normalizeUrl(input);
        refreshAll();
      });
      actions.appendChild(addBtn);

      if (hasProject) {
        const offlineBtn = document.createElement('button');
        offlineBtn.className = 'thisweb-btn';
        offlineBtn.innerHTML = `<span>${getIcon('sticky-note-plus', 16)}</span> معاينة offline`;
        offlineBtn.addEventListener('click', () => {
          thiswebOfflineMode = true;
          renderThisWeb();
        });
        actions.appendChild(offlineBtn);
      }

      inner.appendChild(actions);

      const goBuilder = document.createElement('button');
      goBuilder.className = 'thisweb-btn';
      goBuilder.style.marginTop = '8px';
      goBuilder.innerHTML = `<span>${getIcon('blocks', 16)}</span> اذهب إلى البناء`;
      goBuilder.addEventListener('click', () => setView('publish'));
      inner.appendChild(goBuilder);
    }

    wrap.appendChild(inner);
    thiswebContent.appendChild(wrap);
  }

  /* ===== View Switching ===== */

    function setView(viewName) {
    if (!['search', 'web', 'thisweb', 'publish', 'bookmarks'].includes(viewName)) {
      viewName = 'thisweb';
    }

    // احفظ نص البحث للـ view الحالي قبل التبديل
    if (searchableViews.includes(currentView)) {
      viewSearchMemory[currentView] = topbarSearchInput.value;
    }

    currentView = viewName;
    root.dataset.currentView = viewName;

    root.querySelectorAll('.view').forEach((v) => {
      v.classList.toggle('active', v.dataset.view === viewName);
    });

    root.querySelectorAll('.bottom-btn[data-view]').forEach((b) => {
      b.classList.toggle('active', b.dataset.view === viewName);
    });

    const previewSection = root.querySelector('.preview');
    if (previewSection?.classList.contains('fullscreen')) {
      previewSection.classList.remove('fullscreen');
      document.body.classList.remove('preview-fullscreen-open');
    }

    if (viewName !== 'thisweb') {
      thiswebOfflineMode = false;
    }
    if (viewName === 'thisweb') {
      renderThisWeb();
    }

    if (viewName === 'web') {
      const webRoot = document.getElementById('web-view-root');
      if (webRoot) safe('initWebView', () => initWebView(webRoot));
      safe('showWebView', () => showWebView());
    }

    if (viewName === 'publish') {
      refreshPreview();
    }

    if (viewName === 'search') {
      const searchRoot = document.getElementById('search-view-root');
      if (searchRoot) safe('initSearchView', () => initSearchView(searchRoot));
      safe('showSearchView', () => showSearchView());
      safe('initSearchHistoryUI', () => initSearchHistoryUI());
    } else {
      safe('resetSearchView', () => resetSearchView());
    }

    if (viewName === 'web') {
      safe('initSearchHistoryUI', () => initSearchHistoryUI());
    }

    // استعد نص البحث للـ view الجديد
    if (searchableViews.includes(viewName)) {
      topbarSearchInput.value = viewSearchMemory[viewName] || '';
      if (viewName === 'search') {
        topbarSearchInput.placeholder = 'ابحث مؤقتًا...';
      } else if (viewName === 'web') {
        topbarSearchInput.placeholder = 'ابحث في الشبكة...';
      } else {
        topbarSearchInput.placeholder = 'ابحث...';
      }
    } else {
      topbarSearchInput.value = '';
    }

    try {
      localStorage.setItem('webby-current-view', viewName);
    } catch {
      /* ignore */
    }
  }

  function refreshPreview() {
    const project = getCurrentProject();
    if (!project) return;
    safe('refreshPreview', () =>
      updatePreview(previewFrame, project, {
        onAction: (action) => {
          if (action === 'thisweb') {
            navigatePreviewTo('index.html');
            return;
          }
          if (['search', 'web', 'bookmarks', 'publish'].includes(action)) {
            setView(action);
          }
        }
      })
    );
  }

  function deleteSection(sectionId) {
    const project = getCurrentProject();
    if (!project) return;
    const idx = project.sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    project.sections.splice(idx, 1);
    if (selectedSectionId === sectionId) selectedSectionId = null;
    refreshAll();
  }

  function renderSidebar() {
    const project = getCurrentProject();
    if (!project) return;

    sidebarList.innerHTML = '';
    const sorted = project.sections.slice().sort((a, b) => a.order - b.order);

    sorted.forEach((section, index) => {
      const row = document.createElement('div');
      row.className = 'section-row';

      const btn = document.createElement('button');
      btn.className = 'section-btn';
      if (currentTab === 'content' && section.id === selectedSectionId) {
        btn.classList.add('active');
      }

      const iconName = getSectionIcon(section.type);
      btn.innerHTML = `
        <span class="section-btn-icon">${getIcon(iconName, 18)}</span>
        <span class="section-btn-label"></span>
      `;
      btn.querySelector('.section-btn-label').textContent = section.title;

      btn.addEventListener('click', () => {
        currentTab = 'content';
        selectedSectionId = section.id;
        renderSidebar();
        renderEditor();
      });
      row.appendChild(btn);

      const del = document.createElement('button');
      del.textContent = '✕';
      del.className = 'delete-section-btn';
      del.title = 'حذف القسم';
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await showConfirm(`حذف قسم "${section.title}"؟`, 'حذف');
        if (ok) deleteSection(section.id);
      });
      row.appendChild(del);

      const up = document.createElement('button');
      up.textContent = '▲';
      up.className = 'move-btn';
      up.disabled = index === 0;
      up.addEventListener('click', () => {
        if (index === 0) return;
        const tmp = section.order;
        section.order = sorted[index - 1].order;
        sorted[index - 1].order = tmp;
        renderSidebar();
        refreshPreview();
      });
      row.appendChild(up);

      const down = document.createElement('button');
      down.textContent = '▼';
      down.className = 'move-btn';
      down.disabled = index === sorted.length - 1;
      down.addEventListener('click', () => {
        if (index === sorted.length - 1) return;
        const tmp = section.order;
        section.order = sorted[index + 1].order;
        sorted[index + 1].order = tmp;
        renderSidebar();
        refreshPreview();
      });
      row.appendChild(down);

      sidebarList.appendChild(row);
    });

    document.getElementById('tool-media').classList.toggle('active', currentTab === 'media');
    document.getElementById('tool-settings').classList.toggle('active', currentTab === 'settings');
    document.getElementById('tool-network').classList.toggle('active', currentTab === 'network');
  }

  function renderEditor() {
    const project = getCurrentProject();
    if (!project) return;

    if (currentTab === 'settings') {
      editorPanel.innerHTML = '<h2>إعدادات الموقع</h2>';
      const wrap = document.createElement('div');
      editorPanel.appendChild(wrap);
      safe('renderSettingsEditor', () =>
        renderSettingsEditor(wrap, project, () => refreshPreview())
      );
      return;
    }

    if (currentTab === 'media') {
      editorPanel.innerHTML = '<h2>الوسائط</h2>';
      const wrap = document.createElement('div');
      editorPanel.appendChild(wrap);
      safe('renderMediaManager', () =>
        renderMediaManager(wrap, refreshPreview)
      );
      return;
    }

    if (currentTab === 'network') {
      editorPanel.innerHTML = '<h2>الشبكة</h2>';
      const wrap = document.createElement('div');
      editorPanel.appendChild(wrap);
      safe('renderNetworkEditor', () =>
        renderNetworkEditor(wrap, project, () => refreshPreview())
      );
      return;
    }

    const section = project.sections.find((s) => s.id === selectedSectionId);
    if (!section) {
      editorPanel.innerHTML = '<p>اختر قسمًا من القائمة.</p>';
      return;
    }

    editorPanel.innerHTML = '';

    const toolbar = document.createElement('div');
    toolbar.className = 'editor-toolbar';

    const typeLabel = document.createElement('span');
    typeLabel.className = 'type-label';
    typeLabel.textContent = `النوع: ${SECTION_TYPES[section.type]?.label || section.type}`;
    toolbar.appendChild(typeLabel);

    const delBtn = document.createElement('button');
    delBtn.textContent = 'حذف القسم';
    delBtn.className = 'danger';
    delBtn.addEventListener('click', async () => {
      const ok = await showConfirm(`حذف قسم "${section.title}"؟`, 'حذف');
      if (ok) deleteSection(section.id);
    });
    toolbar.appendChild(delBtn);

    editorPanel.appendChild(toolbar);

    const formWrapper = document.createElement('div');
    editorPanel.appendChild(formWrapper);

    safe('renderSectionEditor', () =>
      renderSectionEditor(formWrapper, section, refreshPreview, project)
    );
  }

  function refreshAll() {
    const project = getCurrentProject();
    if (!project) return;
    if (!selectedSectionId || !project.sections.find((s) => s.id === selectedSectionId)) {
      selectedSectionId = project.sections[0]?.id || null;
    }
    refreshPreview();
    renderSidebar();
    renderEditor();
    renderThisWeb();
  }

  /* ===== New ===== */
  document.getElementById('btn-new').addEventListener('click', async () => {
    const name =
      (await showPrompt('اسم المشروع:', 'My Artist Website')) || 'My Artist Website';
    newProject(name);
    selectedSectionId = null;
    currentTab = 'content';
    resetPreviewPage();
    refreshAll();
  });

  /* ===== Open ===== */
  document.getElementById('btn-open').addEventListener('click', async () => {
    const options = [];
    if (isFsAccessSupported()) {
      options.push({ value: 'folder', label: '📁 مجلد مشروع (موصى به)' });
    }
    options.push({
      value: 'file',
      label: 'ملف مشروع أو حزمة (.webby / .zip / .json)'
    });

    const choice = await showSelect('فتح من:', options);
    if (!choice) return;

    if (choice === 'file') {
      fileInput.value = '';
      fileInput.click();
      return;
    }

    try {
      const dirHandle = await pickFolder();
      const ok = await ensurePermission(dirHandle, 'readwrite');
      if (!ok) {
        await showConfirm('لم يتم منح الإذن لقراءة المجلد.', 'حسنًا');
        return;
      }
      const project = await openProjectFromFolder(dirHandle);
      linkedFolderHandle = dirHandle;
      await saveHandle(dirHandle);
      updateFolderStatus();
      replaceProject(project);
      selectedSectionId = null;
      currentTab = 'content';
      resetPreviewPage();
      refreshAll();
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      await showConfirm('فشل فتح المجلد: ' + err.message, 'حسنًا');
    }
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const project = await openProjectFromFile(file);
      replaceProject(project);
      selectedSectionId = null;
      currentTab = 'content';
      resetPreviewPage();
      refreshAll();
    } catch (err) {
      console.error(err);
      await showConfirm('فشل فتح المشروع: ' + err.message, 'حسنًا');
    }
  });

  /* ===== Save ===== */
  document.getElementById('btn-save').addEventListener('click', async () => {
    const project = getCurrentProject();
    if (!project) return;

    if (linkedFolderHandle) {
      try {
        const ok = await ensurePermission(linkedFolderHandle, 'readwrite');
        if (!ok) {
          await showConfirm('لم يتم منح الإذن للحفظ.', 'حسنًا');
          return;
        }
        await saveProjectToFolder(project, linkedFolderHandle);
        await showConfirm('تم الحفظ في المجلد المرتبط.', 'حسنًا');
        return;
      } catch (err) {
        console.error(err);
        await showConfirm('فشل الحفظ في المجلد: ' + err.message, 'حسنًا');
        return;
      }
    }

    try {
      await saveProjectAsBundle(project);
    } catch (err) {
      console.error(err);
      await showConfirm('فشل الحفظ: ' + err.message, 'حسنًا');
    }
  });

  /* ===== Save As ===== */
  document.getElementById('btn-save-as').addEventListener('click', async () => {
    const project = getCurrentProject();
    if (!project) return;

    const options = [];
    if (isFsAccessSupported()) {
      options.push({ value: 'folder', label: '📁 مجلد على جهازك (Chrome/Edge)' });
    }
    options.push({ value: 'bundle', label: 'حزمة .webby (مع الوسائط)' });
    options.push({ value: 'json', label: 'ملف .json فقط (بدون وسائط)' });

    const choice = await showSelect('حفظ باسم:', options);
    if (!choice) return;

    try {
      if (choice === 'folder') {
        const dirHandle = await pickFolder();
        const ok = await ensurePermission(dirHandle, 'readwrite');
        if (!ok) {
          await showConfirm('لم يتم منح الإذن.', 'حسنًا');
          return;
        }
        await saveProjectToFolder(project, dirHandle);
        linkedFolderHandle = dirHandle;
        await saveHandle(dirHandle);
        updateFolderStatus();
        await showConfirm('تم الربط والحفظ في المجلد.', 'حسنًا');
      } else if (choice === 'bundle') {
        await saveProjectAsBundle(project);
      } else {
        saveProjectAsJson(project);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      await showConfirm('فشل الحفظ: ' + err.message, 'حسنًا');
    }
  });

  /* ===== Export ===== */
  document.getElementById('btn-export-html').addEventListener('click', () => {
    const project = getCurrentProject();
    if (!project) return;
    exportAsSingleHtml(project);
  });

  document.getElementById('btn-export-zip').addEventListener('click', async () => {
    const project = getCurrentProject();
    if (!project) return;

    const progress = showProgress('جاري تجهيز التصدير...');

    try {
      await exportAsZip(project, ({ phase, current, total }) => {
        progress.update(phase, current, total);
      });
      progress.close();
    } catch (err) {
      progress.close();
      console.error(err);
      await showConfirm('فشل التصدير: ' + err.message, 'حسنًا');
    }
  });

  /* ===== Add Section ===== */
  document.getElementById('btn-add-section').addEventListener('click', async () => {
    const project = getCurrentProject();
    if (!project) return;

    const options = Object.entries(SECTION_TYPES).map(([value, def]) => ({
      value,
      label: def.label || value
    }));

    const type = await showSelect('اختر نوع القسم:', options);
    if (!type) return;

    let customTitle = null;
    if (type === 'custom') {
      customTitle = await showPrompt('اسم القسم المخصص:', 'My Section');
      if (!customTitle) return;
    }

    const maxOrder = project.sections.reduce((m, s) => Math.max(m, s.order), 0);
    const newSec = createSection(type, maxOrder + 10);

    if (customTitle) {
      newSec.title = customTitle;
      newSec.content.title = customTitle;
    }

    let counter = 1;
    const baseId = newSec.id;
    while (project.sections.some((s) => s.id === newSec.id)) {
      newSec.id = `${baseId}-${counter++}`;
    }
    project.sections.push(newSec);
    selectedSectionId = newSec.id;
    currentTab = 'content';
    setView('publish');
    refreshAll();
  });

  /* ===== Tools ===== */
  document.getElementById('tool-media').addEventListener('click', () => {
    currentTab = 'media';
    renderSidebar();
    renderEditor();
  });

  document.getElementById('tool-settings').addEventListener('click', () => {
    currentTab = 'settings';
    renderSidebar();
    renderEditor();
  });

  document.getElementById('tool-network').addEventListener('click', () => {
    currentTab = 'network';
    renderSidebar();
    renderEditor();
  });

  /* ===== Bottom Bar ===== */
  root.querySelectorAll('.bottom-btn[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  /* ===== Preview size ===== */
  const previewSection = root.querySelector('.preview');
  const previewStage = document.getElementById('preview-stage');
  const previewLabel = document.getElementById('preview-label');
  const sizeButtons = root.querySelectorAll('.size-btn');
  const fsBtn = document.getElementById('btn-preview-fullscreen');

  const SIZES = {
    desktop: { width: '1280px', label: 'Desktop — 1280px' },
    tablet: { width: '768px', label: 'Tablet — 768px' },
    mobile: { width: '390px', label: 'Mobile — 390px' }
  };

  function setPreviewSize(size) {
    const cfg = SIZES[size] || SIZES.desktop;
    previewStage.style.setProperty('--preview-width', cfg.width);
    previewStage.dataset.size = size;
    previewLabel.textContent = cfg.label;
    sizeButtons.forEach((b) => {
      b.classList.toggle('active', b.dataset.size === size);
    });
    try {
      localStorage.setItem('webby-preview-size', size);
    } catch {
      /* ignore */
    }
  }

  sizeButtons.forEach((btn) => {
    btn.addEventListener('click', () => setPreviewSize(btn.dataset.size));
  });

  let savedSize = 'desktop';
  try {
    savedSize = localStorage.getItem('webby-preview-size') || 'desktop';
  } catch {
    /* ignore */
  }
  setPreviewSize(savedSize);

  /* ===== Fullscreen preview ===== */
  function setFullscreen(on) {
    if (on) {
      previewSection.classList.add('fullscreen');
      fsBtn.textContent = '✕';
      fsBtn.title = 'خروج من وضع ملء الشاشة';
      document.body.classList.add('preview-fullscreen-open');
    } else {
      previewSection.classList.remove('fullscreen');
      fsBtn.textContent = '⛶';
      fsBtn.title = 'ملء الشاشة';
      document.body.classList.remove('preview-fullscreen-open');
    }
  }

  fsBtn.addEventListener('click', () => {
    setFullscreen(!previewSection.classList.contains('fullscreen'));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewSection.classList.contains('fullscreen')) {
      setFullscreen(false);
    }
  });

    /* ===== Web view ===== */
  const webViewRoot = document.getElementById('web-view-root');
  if (webViewRoot) {
    safe('initWebView', () => initWebView(webViewRoot));
  }

  /* ===== تشغيل أولي ===== */
  newProject('My Artist Website');
  refreshAll();

  // استعد آخر view (مع تحويل "yourweb" القديم إلى "publish")
  let savedView = 'thisweb';
  try {
    savedView = localStorage.getItem('webby-current-view') || 'thisweb';
    if (savedView === 'yourweb') savedView = 'publish';
  } catch {
    /* ignore */
  }

  // ?view=... يأتي من الشريط السفلي في المواقع المُصدَّرة
  try {
    const urlParams = new URLSearchParams(location.search);
    const urlView = urlParams.get('view');
    if (urlView && ['search', 'web', 'thisweb', 'publish', 'bookmarks'].includes(urlView)) {
      savedView = urlView;
    }
  } catch {
    /* ignore */
  }

  setView(savedView);

  restoreLinkedFolder();
}