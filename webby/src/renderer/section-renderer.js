import { isCollection } from '../core/sections.js';

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return iso;
  }
}

function resolveAuthor(item, options) {
  const admins = Array.isArray(options.admins) ? options.admins : [];
  const legacy = options.author || '';
  const siteLogo = options.siteLogo || '';
  const adminResolver =
    typeof options.adminResolver === 'function' ? options.adminResolver : null;

  if (item.authorId && admins.length > 0) {
    const admin = admins.find((a) => a.id === item.authorId);
    if (admin) {
      let imageUrl = admin.image || '';
      if (imageUrl && adminResolver) {
        imageUrl = adminResolver(admin.image);
      }
      return { name: admin.name || '', image: imageUrl, rawImage: admin.image || '' };
    }
  }
  if (legacy) return { name: legacy, image: siteLogo, rawImage: '' };
  return { name: '', image: '', rawImage: '' };
}

function renderItems(items, resolveMedia, options = {}) {
  if (!items || items.length === 0) {
    return '<p class="empty">لا يوجد محتوى بعد.</p>';
  }
  const resolveThumb = options.resolveThumb || resolveMedia;

  return `
    <div class="grid">
      ${items
        .map((item) => {
          const fullSrc = item.image && resolveMedia ? resolveMedia(item.image) : '';
          const thumbSrc =
            item.image && resolveThumb ? resolveThumb(item.image) : fullSrc;

          const imgHtml = thumbSrc
            ? `<img class="card-image" src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(
                item.title || ''
              )}" loading="lazy" width="640" height="360" draggable="false" data-thumb-for="${escapeHtml(
                item.image || ''
              )}" />`
            : '<div class="card-media-empty"></div>';

          const tags = Array.isArray(item.tags) ? item.tags.filter(Boolean) : [];
          const tagsHtml =
            tags.length > 0
              ? `<div class="card-tags">${tags
                  .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
                  .join('')}</div>`
              : '';

          const dateStr = formatDate(item.date);
          const dateHtml = dateStr
            ? `<span class="card-date">${escapeHtml(dateStr)}</span>`
            : '';

          const author = resolveAuthor(item, options);
          let authorImageSrc = '';
          if (author.image && resolveMedia) {
            authorImageSrc = resolveMedia(author.image);
          }

          let avatarHtml = '';
          if (author.name) {
            if (authorImageSrc) {
              avatarHtml = `<img class="card-author-avatar" src="${escapeHtml(
                authorImageSrc
              )}" alt="" draggable="false" width="22" height="22" />`;
            } else {
              avatarHtml = `<span class="card-author-avatar card-author-avatar-placeholder">${escapeHtml(
                author.name.charAt(0)
              )}</span>`;
            }
          }

          const authorHtml = author.name
            ? `<span class="card-author">${avatarHtml}<span class="author-name">${escapeHtml(
                author.name
              )}</span></span>`
            : '';

          return `
        <article class="card"
          data-webby-card
          data-title="${escapeHtml(item.title || '')}"
          data-description="${escapeHtml(item.description || '')}"
          data-image="${escapeHtml(fullSrc)}"
          data-tags="${escapeHtml(tags.join(','))}"
          data-date="${escapeHtml(dateStr)}"
          data-author="${escapeHtml(author.name)}"
          data-author-image="${escapeHtml(authorImageSrc)}">
          <div class="card-media">${imgHtml}</div>
          <div class="card-body">
            <h3 class="card-title">${escapeHtml(item.title || '')}</h3>
            <p class="card-desc">${escapeHtml(item.description || '')}</p>
            ${tagsHtml}
            <div class="card-meta">
              ${authorHtml}
              ${dateHtml}
            </div>
          </div>
        </article>
      `;
        })
        .join('')}
    </div>
  `;
}

export function renderSection(section, options = {}) {
  const { resolveMedia } = options;
  const { type, content = {} } = section;
  const title = escapeHtml(content.title || section.title || '');

  if (type === 'home') {
    return `
      <section id="${section.id}" class="section section-home">
        <h1>${title}</h1>
        <p class="lead">${escapeHtml(content.body || '')}</p>
      </section>`;
  }

  if (type === 'about') {
    return `
      <section id="${section.id}" class="section section-about">
        <h2>${title}</h2>
        <p>${escapeHtml(content.body || '')}</p>
      </section>`;
  }

  if (type === 'contact') {
    return `
      <section id="${section.id}" class="section section-contact">
        <h2>${title}</h2>
        ${
          content.email
            ? `<p>Email: <a href="mailto:${escapeHtml(content.email)}">${escapeHtml(
                content.email
              )}</a></p>`
            : ''
        }
      </section>`;
  }

  if (isCollection(type)) {
    return `
      <section id="${section.id}" class="section section-${escapeHtml(type)}">
        <h2>${title}</h2>
        ${renderItems(content.items, resolveMedia, options)}
      </section>`;
  }

  return `
    <section id="${section.id}" class="section">
      <h2>${title}</h2>
    </section>`;
}

export { escapeHtml };