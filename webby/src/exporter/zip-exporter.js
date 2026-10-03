import { renderSite, collectUsedMediaIds } from '../renderer/site-renderer.js';
import {
  getMedia,
  getAssetFilename,
  getThumbnailBlob,
  resizeImage,
  _setCurrentProjectRef
} from '../core/media.js';
import { downloadBlob } from './html-exporter.js';
import { serializeProject } from '../core/project-serializer.js';
import { buildFeed } from '../core/feed.js';
import {
  buildSiteManifest,
  buildSiteServiceWorker,
  buildWebbyConfig,
  fetchWebbyFiles
} from './site-pwa.js';

export async function exportAsZip(project, onProgress) {
  if (!window.JSZip) {
    throw new Error('JSZip لم يتم تحميله.');
  }

  _setCurrentProjectRef(project);

  const notify = (phase, current, total) => {
    if (typeof onProgress === 'function') {
      try {
        onProgress({ phase, current, total });
      } catch {
        /* ignore */
      }
    }
  };

  const zip = new window.JSZip();

  const safeName =
    (project.meta?.name || 'website')
      .replace(/[^\p{L}\p{N}_-]+/gu, '_')
      .slice(0, 40) || 'website';

  const root = zip.folder(safeName);

  // ===== 1) thumbnails =====
  const usedIds = collectUsedMediaIds(project);
  const thumbs = new Map();
  const total = usedIds.length;

  notify('جاري تجهيز الصور...', 0, total);

  for (let i = 0; i < usedIds.length; i++) {
    const id = usedIds[i];
    try {
      const blob = await getThumbnailBlob(id, 480);
      if (blob) thumbs.set(id, blob);
    } catch (err) {
      console.warn('[Webby] thumb failed:', id, err);
    }
    notify('جاري تجهيز الصور...', i + 1, total);
  }

  // ===== 2) اللوكو + البانر + المديرين =====
  notify('جاري تجهيز اللوكو والبانر...', total, total);

  const assets = root.folder('assets');
  const adminFolder = assets.folder('admins');

  if (project.meta?.logo) {
    const res = await resizeImage(project.meta.logo, 184, 184, 0.92);
    if (res) assets.file(`logo.${res.ext}`, res.blob);
  }

  if (project.meta?.banner) {
    const res = await resizeImage(project.meta.banner, 1600, 300, 0.92);
    if (res) assets.file(`banner.${res.ext}`, res.blob);
  }

  if (Array.isArray(project.meta?.admins)) {
    const seen = new Set();
    for (const admin of project.meta.admins) {
      if (!admin.image || seen.has(admin.image)) continue;
      seen.add(admin.image);
      const res = await resizeImage(admin.image, 88, 88, 0.92);
      if (res) {
        adminFolder.file(`asset_${admin.image}.${res.ext}`, res.blob);
      }
    }
  }

  // ===== 3) بناء HTML/CSS/JS =====
  notify('جاري بناء الموقع...', total, total);
  const site = renderSite(project, { exportAssets: true });

  Object.entries(site).forEach(([name, content]) => {
    root.file(name, content);
  });

  // ===== 4) webby-project.json =====
  const data = serializeProject(project);
  root.file('webby-project.json', JSON.stringify(data, null, 2));

  // ===== 5) webby-feed.json =====
  try {
    root.file('webby-feed.json', JSON.stringify(buildFeed(project), null, 2));
  } catch (err) {
    console.warn('[Webby] feed generation failed:', err);
  }

  // ===== 6) الوسائط الكاملة =====
  usedIds.forEach((id) => {
    const m = getMedia(id);
    if (!m) return;
    const filename = getAssetFilename(id);
    if (!filename) return;
    assets.file(filename, m.blob);
  });

  // ===== 7) thumbnails =====
  if (thumbs.size > 0) {
    const thumbsFolder = assets.folder('thumbs');
    thumbs.forEach((blob, id) => {
      const m = getMedia(id);
      if (!m) return;
      thumbsFolder.file(`asset_${m.id}.webp`, blob);
    });
  }

  // ===== 8) Webby PWA files (manifest, sw, config) =====
  notify('جاري تجهيز ملفات PWA...', total, total);

  const pageFiles = Object.keys(site).filter((name) => name.endsWith('.html'));

  const manifestContent = buildSiteManifest(project, {
    safeName,
    siteUrl: project.meta?.link || ''
  });
  root.file('manifest.json', manifestContent);

  const swContent = buildSiteServiceWorker(pageFiles);
  root.file('service-worker.js', swContent);

  const configContent = buildWebbyConfig(project);
  root.file('webby-config.json', configContent);

  // ===== 9) نسخ Webby إلى /webby/ =====
  notify('جاري تجهيز Webby Lite...', 0, 32);

  const webbyFiles = await fetchWebbyFiles((current, count) => {
    notify('جاري تجهيز Webby Lite...', current, count);
  });

  if (webbyFiles.size > 0) {
    const webbyFolder = root.folder('webby');

    // manifest.json داخل /webby/ — بنسخة معدّلة
    const embeddedManifest = JSON.parse(manifestContent);
    embeddedManifest.icons = embeddedManifest.icons.map((icon) => ({
      ...icon,
      src: icon.src.replace(/^assets\//, 'public/icons/')
    }));
    webbyFolder.file('manifest.json', JSON.stringify(embeddedManifest, null, 2));

    // ملفات نصية + أيقونات

    webbyFiles.forEach((content, path) => {
      if (path.startsWith('__icon__')) {
        const iconName = path.replace('__icon__', '');
        // إلى assets/ للموقع الرئيسي
        assets.file(iconName, content);
        // إلى /webby/public/icons/ (يستخدمها manifest الابن)
        const webbyIcons = webbyFolder.folder('public').folder('icons');
        webbyIcons.file(iconName, content);
        return;
      }
      webbyFolder.file(path, content);
    });

    // Webby index.html — نسخة معدّلة لتعمل من /webby/
    // (نستخدم نفس الملف لأن كل المسارات نسبية)
    // لا شيء إضافي.
  }

  // ===== 10) توليد ZIP =====
  notify('جاري ضغط الملف...', total, total);
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadBlob(blob, `${safeName}.zip`);

  _setCurrentProjectRef(null);
  notify('تم!', total, total);
}