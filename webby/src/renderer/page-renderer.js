import { renderSection, escapeHtml } from './section-renderer.js';
import { getTemplate } from '../core/templates.js';
import { slugify } from '../utils/slug.js';
import { SITE_SCRIPT } from './site-script.js';

export function getVisibleSections(project) {
  return project.sections
    .filter((s) => s.visible)
    .sort((a, b) => a.order - b.order);
}

export function getPageFilename(section, allSections) {
  const baseName =
    section.type === 'custom'
      ? slugify(section.title || 'section', 'section')
      : section.type;

  const sameBase = allSections.filter((s) => {
    const sBase =
      s.type === 'custom'
        ? slugify(s.title || 'section', 'section')
        : s.type;
    return sBase === baseName;
  });

  if (sameBase.length <= 1) return `${baseName}.html`;
  const idx = sameBase.findIndex((s) => s.id === section.id) + 1;
  return `${baseName}-${idx}.html`;
}

function buildNav(project, currentFilename) {
  const visible = getVisibleSections(project);
  const items = visible.map((s, i) => {
    const fname = getPageFilename(s, project.sections);
    const isActive =
      fname === currentFilename ||
      (currentFilename === 'index.html' && i === 0);
    return `<a href="${fname}"${isActive ? ' class="active"' : ''}>${escapeHtml(
      s.title
    )}</a>`;
  });

  if (project.meta?.network?.enabled) {
    const isActive = currentFilename === 'network.html';
    items.push(
      `<a href="network.html"${isActive ? ' class="active"' : ''}>الشبكة</a>`
    );
  }

  return items.join('');
}

/* ============ SEO ============ */

function normalizeBase(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getPageUrl(meta, relativePath) {
  const base = normalizeBase(meta.link);
  if (!base) return '';
  if (relativePath === 'index.html') return `${base}/`;
  return `${base}/${relativePath}`;
}

function getAbsoluteAsset(meta, assetPath) {
  if (!assetPath) return '';
  if (assetPath.startsWith('blob:')) return '';
  if (assetPath.startsWith('http')) return assetPath;
  const base = normalizeBase(meta.link);
  if (!base) return '';
  return `${base}/${assetPath.replace(/^\/+/, '')}`;
}

function buildMetaTags(project, { title, sectionDescription, relativePath, resolveMedia }) {
  const meta = project.meta || {};
  const siteName = meta.name || '';
  const fullTitle = title ? `${title} — ${siteName}` : siteName;

  const desc = String(sectionDescription || meta.description || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  // الصورة: العنصر → اللوكو → البانر
  let imagePath = '';
  if (meta.logo && resolveMedia) imagePath = resolveMedia(meta.logo);
  if (!imagePath && meta.banner && resolveMedia) imagePath = resolveMedia(meta.banner);
  const absoluteImage = getAbsoluteAsset(meta, imagePath);

  const absoluteUrl = getPageUrl(meta, relativePath);
  const t = getTemplate(project.template).tokens;

  const lines = [];
  if (desc) {
    lines.push(`<meta name="description" content="${escapeHtml(desc)}" />`);
  }

  // Open Graph
  lines.push(`<meta property="og:type" content="website" />`);
  if (fullTitle) {
    lines.push(`<meta property="og:title" content="${escapeHtml(fullTitle)}" />`);
  }
  if (desc) {
    lines.push(`<meta property="og:description" content="${escapeHtml(desc)}" />`);
  }
  if (siteName) {
    lines.push(`<meta property="og:site_name" content="${escapeHtml(siteName)}" />`);
  }
  if (absoluteUrl) {
    lines.push(`<meta property="og:url" content="${escapeHtml(absoluteUrl)}" />`);
  }
  if (absoluteImage) {
    lines.push(`<meta property="og:image" content="${escapeHtml(absoluteImage)}" />`);
  }

  // Twitter
  lines.push(
    `<meta name="twitter:card" content="${
      absoluteImage ? 'summary_large_image' : 'summary'
    }" />`
  );
  if (fullTitle) {
    lines.push(`<meta name="twitter:title" content="${escapeHtml(fullTitle)}" />`);
  }
  if (desc) {
    lines.push(`<meta name="twitter:description" content="${escapeHtml(desc)}" />`);
  }
  if (absoluteImage) {
    lines.push(`<meta name="twitter:image" content="${escapeHtml(absoluteImage)}" />`);
  }

  // Canonical
  if (absoluteUrl) {
    lines.push(`<link rel="canonical" href="${escapeHtml(absoluteUrl)}" />`);
  }

  // Theme color
  lines.push(`<meta name="theme-color" content="${escapeHtml(t.accent)}" />`);

  // Favicon (اللوكو)
  if (meta.logo && resolveMedia) {
    const fav = resolveMedia(meta.logo);
    if (fav) {
      lines.push(`<link rel="icon" href="${escapeHtml(fav)}" />`);
    }
  }

  return lines.join('\n');
}

/* ============ Header ============ */

function buildSiteHeader(project, resolveMedia, options = {}) {
  const meta = project.meta || {};
  const name = escapeHtml(meta.name || '');
  const description = String(meta.description || '');
  const link = meta.link || '';

  // نستخدم المسار المخصص عند التصدير، أو blob عند المعاينة
  const bannerSrc = options.bannerUrl
    ? options.bannerUrl
    : meta.banner && resolveMedia
      ? resolveMedia(meta.banner)
      : '';
  const bannerHtml = bannerSrc
    ? `<div class="site-banner"><img src="${escapeHtml(bannerSrc)}" alt="${name}" draggable="false" /></div>`
    : '<div class="site-banner site-banner-empty"></div>';

  const logoSrc = options.logoUrl
    ? options.logoUrl
    : meta.logo && resolveMedia
      ? resolveMedia(meta.logo)
      : '';
  const logoHtml = logoSrc
    ? `<img class="site-logo" src="${escapeHtml(logoSrc)}" alt="${name}" draggable="false" />`
    : `<div class="site-logo site-logo-placeholder">${escapeHtml(
        (meta.name || '?').charAt(0)
      )}</div>`;

  const MAX = 150;
  let descHtml = '';
  if (description) {
    if (description.length > MAX) {
      const short = escapeHtml(description.slice(0, MAX));
      const full = escapeHtml(description);
      descHtml = `
        <p class="site-description">
          <span class="desc-text">${short}…</span>
          <button class="desc-more" type="button"
            data-full-desc="${full}">المزيد</button>
        </p>`;
    } else {
      descHtml = `<p class="site-description">${escapeHtml(description)}</p>`;
    }
  }

  const linkHtml = link
    ? `<a class="site-link" href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(
        link
      )}</a>`
    : '';

  return `
    ${bannerHtml}
    <div class="site-brand">
      <div class="site-brand-row">
        ${logoHtml}
        <h1 class="site-name">${name}</h1>
      </div>
      ${descHtml}
      ${linkHtml}
    </div>
  `;
}

/* ============ Modal ============ */

const MODAL_HTML = `
<dialog id="webby-card-modal" class="wcm" aria-label="Card details">
  <button class="wcm-close" type="button" aria-label="Close">✕</button>
  <div class="wcm-scroll">
    <img class="wcm-image" alt="" draggable="false" />
    <h2 class="wcm-title"></h2>
    <div class="wcm-meta"></div>
    <p class="wcm-desc"></p>
    <div class="wcm-tags"></div>
  </div>
</dialog>
<dialog id="webby-desc-modal" class="wcm" aria-label="Site description">
  <button class="wdm-close" type="button" aria-label="Close">✕</button>
  <div class="wcm-scroll">
    <h2 class="wcm-title">الوصف</h2>
    <p class="wdm-body"></p>
  </div>
</dialog>`;

/* ============ Shell ============ */

function buildShell(
  project,
  {
    title,
    currentFilename,
    mainContent,
    inlineCss,
    cssPath,
    resolveMedia,
    sectionDescription,
    logoUrl,
    bannerUrl
  }
) {
  const { meta } = project;
  const lang = meta.language || 'ar';
  const dir = meta.direction || 'rtl';
  const css = renderSiteCss(project);
  const cssTag = inlineCss
    ? `<style>\n${css}\n</style>`
    : `<link rel="stylesheet" href="${cssPath || 'style.css'}" />`;
  const scriptTag = inlineCss
    ? `<script>\n${SITE_SCRIPT}\n</script>`
    : `<script src="script.js"></script>`;

  const pageTitle = title
    ? `${escapeHtml(title)} — ${escapeHtml(meta.name || '')}`
    : escapeHtml(meta.name || 'Website');

  const metaTags = buildMetaTags(project, {
    title,
    sectionDescription,
    relativePath: currentFilename,
    resolveMedia
  });

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${pageTitle}</title>
${metaTags}
${cssTag}
</head>
<body>
<header class="site-header">
  ${buildSiteHeader(project, resolveMedia, { logoUrl, bannerUrl })}
</header>
<nav class="site-nav">
  ${buildNav(project, currentFilename)}
</nav>
<main>
${mainContent}
</main>
<footer class="site-footer">
  <p>© ${escapeHtml(meta.name || '')}</p>
</footer>


${MODAL_HTML}
${scriptTag}
</body>
</html>`;
}

export function renderSectionPage(project, section, options = {}) {
  const fname = getPageFilename(section, project.sections);
  const desc = section.content?.description || section.content?.body || '';
  return buildShell(project, {
    title: section.title,
    currentFilename: fname,
    mainContent: renderSection(section, options),
    inlineCss: options.inlineCss,
    cssPath: options.cssPath,
    resolveMedia: options.resolveMedia,
    sectionDescription: desc,
    logoUrl: options.logoUrl,
    bannerUrl: options.bannerUrl
  });
}

export function renderIndexPage(project, options = {}) {
  const visible = getVisibleSections(project);
  const first = visible[0];

  if (!first) {
    return buildShell(project, {
      title: project.meta.name || '',
      currentFilename: 'index.html',
      mainContent:
        '<section class="section"><h2>مرحبًا</h2><p>لم تُضف أي أقسام بعد.</p></section>',
      inlineCss: options.inlineCss,
      cssPath: options.cssPath,
      resolveMedia: options.resolveMedia
    });
  }

  return buildShell(project, {
    title: first.title,
    currentFilename: 'index.html',
    mainContent: renderSection(first, options),
    inlineCss: options.inlineCss,
    cssPath: options.cssPath,
    resolveMedia: options.resolveMedia
  });
}

export function renderNetworkPage(project, options = {}) {
  const body = `
    <section class="section section-network">
      <h2>الشبكة</h2>
      <p class="lead">قريبًا...</p>
      <p class="network-desc">سيعرض هذا القسم محتوى من المواقع المرتبطة بك عبر بروتوكولات مفتوحة.</p>
    </section>`;

  return buildShell(project, {
    title: 'الشبكة',
    currentFilename: 'network.html',
    mainContent: body,
    inlineCss: options.inlineCss,
    cssPath: options.cssPath,
    resolveMedia: options.resolveMedia
  });
}

/* ============ CSS ============ */

export function renderSiteCss(project) {
  const t = getTemplate(project.template).tokens;
  return `
:root {
  --bg: ${t.background};
  --text: ${t.text};
  --accent: ${t.accent};
  --font: ${t.font};
  --muted: rgba(127, 127, 127, 0.15);
  --muted-border: rgba(127, 127, 127, 0.3);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  line-height: 1.6;
}
.site-header { width: 100%; }
.site-banner {
  width: 100%;
  aspect-ratio: 6 / 1;
  max-height: 240px;
  min-height: 90px;
  overflow: hidden;
  background: var(--muted);
}
.site-banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.site-banner-empty {
  background: linear-gradient(135deg, rgba(127,127,127,0.3), rgba(127,127,127,0.08));
}
.site-brand {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 24px 4px;
}
.site-brand-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.site-logo {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid var(--muted-border);
  flex-shrink: 0;
  background: var(--muted);
}
.site-logo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
  color: var(--text);
  background: var(--muted);
}
.site-name {
  margin: 0;
  font-size: 1.8em;
  line-height: 1.2;
}
.site-description {
  margin: 12px 0 4px;
  font-size: 1em;
  opacity: 0.85;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px;
  max-width: 100%;
}
.site-description .desc-text { word-break: break-word; }
.desc-more {
  background: transparent;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.9em;
  padding: 0;
  text-decoration: underline;
}
.desc-more:hover { opacity: 0.8; }
.site-link {
  display: inline-block;
  margin-top: 2px;
  color: var(--accent);
  text-decoration: none;
  font-size: 0.9em;
}
.site-link:hover { text-decoration: underline; }

.site-nav {
  border-top: 1px solid var(--muted-border);
  border-bottom: 1px solid var(--muted-border);
  padding: 0 24px;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  max-width: 1100px;
  margin: 0 auto;
}
.site-nav a {
  color: inherit;
  text-decoration: none;
  padding: 12px 2px;
  border-bottom: 2px solid transparent;
  font-size: 0.95em;
  opacity: 0.75;
  transition: opacity 0.15s, border-color 0.15s;
}
.site-nav a:hover { opacity: 1; }
.site-nav a.active {
  opacity: 1;
  border-bottom-color: var(--text);
  font-weight: 600;
}

main {
  padding: 32px 24px;
  max-width: 1100px;
  margin: 0 auto;
}
.section { margin-bottom: 48px; }
.section h1 { font-size: 2em; margin: 0 0 16px; }
.section h2 { margin-bottom: 16px; font-size: 1.4em; }
.lead { font-size: 1.1em; opacity: 0.9; }
.network-desc { opacity: 0.75; margin-top: 8px; }

.section-home .lead,
.section-about p,
.section-contact p,
.site-description .desc-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 24px 16px;
}

.card {
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: transform 0.15s ease;
  border: none;
  background: transparent;
  padding: 0;
  min-width: 0;
  width: 100%;
  overflow: hidden;
}
.card:hover { transform: translateY(-2px); }
.card-media {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 12px;
  background: var(--muted);
  position: relative;
}
.card-media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.card-media-empty {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(127,127,127,0.15), rgba(127,127,127,0.05));
}
.card-body {
  padding: 10px 4px 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
  width: 100%;
}
.card-title {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
}
.card-desc {
  margin: 0 0 8px;
  font-size: 13px;
  opacity: 0.7;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  max-width: 100%;
}
.card-tags {
  display: flex;
  flex-wrap: nowrap;
  overflow: hidden;
  gap: 5px;
  margin-bottom: 8px;
  max-width: 100%;
}
.tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 10px;
  background: var(--muted);
  color: inherit;
  border: 1px solid var(--muted-border);
  white-space: nowrap;
  flex-shrink: 0;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  flex-wrap: wrap;
  min-width: 0;
}
.card-author {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #6cb6ff;
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 11.5px;
  letter-spacing: 0.2px;
  max-width: 100%;
  min-width: 0;
}
.card-author .author-name {
  color: #6cb6ff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}
.card-author-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
  background: var(--muted);
  border: 1px solid var(--muted-border);
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text);
  text-transform: uppercase;
}
.card-date {
  opacity: 0.55;
  font-size: 11.5px;
  flex-shrink: 0;
}

.site-footer {
  padding: 20px 24px;
  border-top: 1px solid var(--muted-border);
  text-align: center;
  font-size: 13px;
  opacity: 0.7;
}

dialog.wcm {
  border: none;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  max-width: 92vw;
  width: 640px;
  border-radius: 12px;
  border: 1px solid var(--muted-border);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  font-family: var(--font);
  overflow: hidden;
}
dialog.wcm::backdrop {
  background: rgba(0, 0, 0, 0.75);
}

.wcm-close, .wdm-close {
  position: absolute;
  top: 12px;
  inset-inline-end: 12px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--muted-border);
  background: var(--bg);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.wcm-close:hover, .wdm-close:hover { background: var(--muted); }

.wcm-scroll {
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
  padding-top: 56px;
  max-height: 85vh;
  max-height: 85dvh;
  -webkit-overflow-scrolling: touch;
}
.wcm-scroll::-webkit-scrollbar { width: 8px; }
.wcm-scroll::-webkit-scrollbar-track { background: transparent; }
.wcm-scroll::-webkit-scrollbar-thumb {
  background: var(--muted-border);
  border-radius: 4px;
}

.wcm-image {
  width: 100%;
  height: auto;
  max-height: 70vh;
  object-fit: contain;
  border-radius: 8px;
  margin-bottom: 16px;
  display: block;
  background: var(--muted);
}
.wcm-title {
  margin: 0 0 8px;
  font-size: 1.4em;
  color: var(--text);
}
.wcm-meta {
  font-size: 12px;
  margin-bottom: 12px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.wcm-desc {
  white-space: pre-wrap;
  margin: 0 0 16px;
  line-height: 1.7;
  color: var(--text);
}
.wcm-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.wdm-body {
  white-space: pre-wrap;
  line-height: 1.7;
  color: var(--text);
  margin: 0;
}

body.webby-modal-open {
  overflow: hidden;
  position: fixed;
  width: 100%;
}

img {
  -webkit-user-drag: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;      /* iOS: يمنع long-press menu */
  pointer-events: none;              /* يمنع النقر/السحب مباشرة على الصورة */
}

/* اسمح بالنقر داخل البطاقة (لأن الصورة نفسها لا تستقبل pointer) */
.card {
  pointer-events: auto;
}

@media (max-width: 1100px) {
  .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 800px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 520px) {
  .site-banner { aspect-ratio: 4 / 1; min-height: 70px; }
  .site-logo { width: 64px; height: 64px; }
  .site-name { font-size: 1.4em; }
  .site-brand, main, .site-nav { padding-inline: 16px; }
  .grid { grid-template-columns: 1fr; gap: 20px; }
}
  
`.trim();
}