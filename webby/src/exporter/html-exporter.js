import { renderIndexPage } from '../renderer/page-renderer.js';
import { getMedia } from '../core/media.js';

export function exportAsSingleHtml(project) {
  const resolveMedia = (id) => {
    const m = getMedia(id);
    return m ? m.url : '';
  };
  const html = renderIndexPage(project, { inlineCss: true, resolveMedia });
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), 'index.html');
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}