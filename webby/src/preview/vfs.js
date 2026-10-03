import {
  renderIndexPage,
  renderSectionPage,
  renderNetworkPage,
  renderSiteCss,
  getVisibleSections,
  getPageFilename
} from '../renderer/page-renderer.js';
import { SITE_SCRIPT } from '../renderer/site-script.js';
import { getMedia, getAssetPath } from '../core/media.js';
import { collectUsedMediaIds } from '../renderer/site-renderer.js';

function textFile(content, mime) {
  return { type: 'text', content, mime };
}

function blobFile(blob, mime) {
  return { type: 'blob', content: blob, mime };
}

export function buildVFSFiles(project) {
  const files = {};
  const visible = getVisibleSections(project);
  const resolveMedia = (id) => getAssetPath(id);

  const opts = {
    inlineCss: false,
    resolveMedia,
    author: project.meta?.username || project.meta?.name || '',
    admins: project.meta?.admins || [],
    siteLogo: project.meta?.logo || '',
    cssPath: 'style.css'
  };

  files['index.html'] = textFile(renderIndexPage(project, opts), 'text/html');
  visible.forEach((section) => {
    const fname = getPageFilename(section, project.sections);
    files[fname] = textFile(renderSectionPage(project, section, opts), 'text/html');
  });
  if (project.meta?.network?.enabled) {
    files['network.html'] = textFile(renderNetworkPage(project, opts), 'text/html');
  }

  files['style.css'] = textFile(renderSiteCss(project), 'text/css');
  files['script.js'] = textFile(SITE_SCRIPT, 'application/javascript');

  const usedIds = collectUsedMediaIds(project);
  usedIds.forEach((id) => {
    const m = getMedia(id);
    if (!m) return;
    const ext = m.ext || 'bin';
    files[`assets/asset_${m.id}.${ext}`] = blobFile(m.blob, m.type);
  });

  return files;
}

export async function sendVFSToSW(files) {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Webby] Service Worker not supported');
    return false;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    const sw = reg.active;
    if (!sw) {
      console.warn('[Webby] SW not active');
      return false;
    }

    await new Promise((resolve) => {
      let done = false;
      const handler = (e) => {
        if (e.data && e.data.type === 'vfs-ready') {
          done = true;
          navigator.serviceWorker.removeEventListener('message', handler);
          resolve();
        }
      };
      navigator.serviceWorker.addEventListener('message', handler);

      sw.postMessage({ type: 'vfs-update', files });

      setTimeout(() => {
        if (!done) {
          navigator.serviceWorker.removeEventListener('message', handler);
          resolve();
        }
      }, 800);
    });

    return true;
  } catch (err) {
    console.warn('[Webby] VFS send failed:', err);
    return false;
  }
}

/**
 * يُعيد HTML كامل للمعاينة عبر srcdoc (للوضع embedded).
 */
export function renderPreviewHTML(project, options = {}) {
  const page = options.page || 'index.html';
  const visible = getVisibleSections(project);

  const resolveMedia = (id) => {
    const m = getMedia(id);
    return m ? m.url : '';
  };

  const opts = {
    inlineCss: true,
    resolveMedia,
    author: project.meta?.username || project.meta?.name || '',
    admins: project.meta?.admins || [],
    siteLogo: project.meta?.logo || ''
  };

  let html;
  if (page === 'network.html' && project.meta?.network?.enabled) {
    html = renderNetworkPage(project, opts);
  } else if (page === 'index.html') {
    html = renderIndexPage(project, opts);
  } else {
    const section = visible.find(
      (s) => getPageFilename(s, project.sections) === page
    );
    html = section ? renderSectionPage(project, section, opts) : renderIndexPage(project, opts);
  }

  return injectLinkInterceptor(html);
}

export function isEmbeddedMode() {
  return location.pathname.includes('/webby/');
}
const PREVIEW_LINK_INTERCEPTOR = `<script>
(function(){
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a');
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href) return;
    if (href.charAt(0) === '#') return;
    if (href.indexOf('http') === 0) return;
    if (href.indexOf('mailto:') === 0) return;
    if (href.indexOf('tel:') === 0) return;
    if (!/\\.html$/i.test(href)) return;
    e.preventDefault();
    try {
      parent.postMessage({ source: 'webby-preview', kind: 'navigate', value: href }, '*');
    } catch(err){}
  });
})();
<\/script>`;

function injectLinkInterceptor(html) {
  return html.replace('</body>', PREVIEW_LINK_INTERCEPTOR + '</body>');
}