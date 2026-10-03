import {
  renderIndexPage,
  renderSectionPage,
  renderNetworkPage,
  renderSiteCss,
  getVisibleSections,
  getPageFilename
} from './page-renderer.js';
import {
  getMedia,
  getAssetPath,
  getThumbPath,
  getLogoExportPath,
  getBannerExportPath,
  getAdminExportPath
} from '../core/media.js';
import { SITE_SCRIPT } from './site-script.js';

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function buildSitemap(project) {
  const base = normalizeBase(project.meta?.link);
  if (!base) return null;
  const urls = [`${base}/`];
  const visible = getVisibleSections(project);
  visible.forEach((s) => {
    urls.push(`${base}/${getPageFilename(s, project.sections)}`);
  });
  if (project.meta?.network?.enabled) {
    urls.push(`${base}/network.html`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join('\n')}
</urlset>`;
}

function buildRobots(project) {
  const base = normalizeBase(project.meta?.link);
  const lines = ['User-agent: *', 'Allow: /'];
  if (base) {
    lines.push('');
    lines.push(`Sitemap: ${base}/sitemap.xml`);
  }
  return lines.join('\n');
}

export function renderSite(project, options = {}) {
  const files = {};
  const visible = getVisibleSections(project);

  // مسارات التصدير المخصصة (اختيارية، تُستخدم في ZIP)
  const exportAssets = options.exportAssets || false;

  const logoUrl = exportAssets && project.meta?.logo
    ? getLogoExportPath()
    : '';
  const bannerUrl = exportAssets && project.meta?.banner
    ? getBannerExportPath()
    : '';
  const adminResolver = exportAssets
    ? (id) => getAdminExportPath(id)
    : null;

  const opts = {
    inlineCss: false,
    resolveMedia: (id) => getAssetPath(id),
    resolveThumb: options.resolveThumb || ((id) => getThumbPath(id)),
    author: project.meta?.username || project.meta?.name || '',
    admins: project.meta?.admins || [],
    siteLogo: project.meta?.logo || '',
    logoUrl,
    bannerUrl,
    adminResolver
  };

  files['index.html'] = renderIndexPage(project, opts);
  visible.forEach((section) => {
    const fname = getPageFilename(section, project.sections);
    files[fname] = renderSectionPage(project, section, opts);
  });

  if (project.meta?.network?.enabled) {
    files['network.html'] = renderNetworkPage(project, opts);
  }

  files['style.css'] = renderSiteCss(project);
  files['script.js'] = SITE_SCRIPT;

  const sitemap = buildSitemap(project);
  if (sitemap) files['sitemap.xml'] = sitemap;
  files['robots.txt'] = buildRobots(project);

  return files;
}

export function collectUsedMediaIds(project) {
  const ids = new Set();

  if (project.meta?.logo && getMedia(project.meta.logo)) {
    ids.add(project.meta.logo);
  }
  if (project.meta?.banner && getMedia(project.meta.banner)) {
    ids.add(project.meta.banner);
  }
  if (Array.isArray(project.meta?.admins)) {
    project.meta.admins.forEach((admin) => {
      if (admin.image && getMedia(admin.image)) {
        ids.add(admin.image);
      }
    });
  }
  project.sections.forEach((s) => {
    const items = s.content?.items;
    if (Array.isArray(items)) {
      items.forEach((item) => {
        if (item.image && getMedia(item.image)) ids.add(item.image);
      });
    }
  });

  return Array.from(ids);
}