import {
  buildVFSFiles,
  sendVFSToSW,
  renderPreviewHTML,
  isEmbeddedMode
} from './vfs.js';

let currentIframe = null;
let currentProject = null;
let currentPreviewPage = 'index.html';
let onActionCallback = null;
let listenerAttached = false;

const VFS_BASE = '/__webby-preview__/';

function attachListener() {
  if (listenerAttached) return;
  listenerAttached = true;

  window.addEventListener('message', (e) => {
    if (!e.data || e.data.source !== 'webby-preview') return;

    if (e.data.kind === 'action' && e.data.value) {
      if (typeof onActionCallback === 'function') {
        onActionCallback(e.data.value);
      }
      return;
    }

    if (e.data.kind === 'navigate' && e.data.value) {
      const href = e.data.value;
      if (/\.html$/i.test(href)) {
        loadPreview(href);
      }
      return;
    }
  });
}

async function loadPreview(page) {
  if (!currentIframe || !currentProject) return;
  currentPreviewPage = page || currentPreviewPage || 'index.html';

  // Embedded (dans /webby/) → srcdoc
  if (isEmbeddedMode()) {
    currentIframe.removeAttribute('src');
    currentIframe.srcdoc = renderPreviewHTML(currentProject, {
      page: currentPreviewPage
    });
    return;
  }

  // Root → VFS
  const files = buildVFSFiles(currentProject);
  const ok = await sendVFSToSW(files);

  if (!ok) {
    console.warn('[Webby] VFS failed, using srcdoc');
    currentIframe.removeAttribute('src');
    currentIframe.srcdoc = renderPreviewHTML(currentProject, {
      page: currentPreviewPage
    });
    return;
  }

  // Cache-buster لإجبار المتصفح على إعادة التحميل
  const url = VFS_BASE + currentPreviewPage + '?_t=' + Date.now();

  try {
    currentIframe.contentWindow.location.replace(url);
  } catch {
    currentIframe.setAttribute('src', url);
  }
}

export async function updatePreview(iframe, project, options = {}) {
  if (!iframe || !project) return;

  currentIframe = iframe;
  currentProject = project;
  if (options.onAction) onActionCallback = options.onAction;
  if (options.page) currentPreviewPage = options.page;

  attachListener();
  await loadPreview(currentPreviewPage);
}

export function navigatePreviewTo(page) {
  loadPreview(page);
}

export function resetPreviewPage() {
  currentPreviewPage = 'index.html';
  loadPreview('index.html');
}