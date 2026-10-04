const MAX_RETRIES = 2;

export function createCard(item, onClick) {
  const card = document.createElement('article');
  card.className = 'web-card';
  card.setAttribute('data-connector', item.connector_id);

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'web-card-thumb';

  if (item.thumbnail?.url) {
    const img = document.createElement('img');
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';

    let retries = 0;

    function tryLoad(src) {
      img.src = src;
    }

    img.addEventListener('error', () => {
      if (retries < MAX_RETRIES) {
        retries++;
        const sep = item.thumbnail.url.includes('?') ? '&' : '?';
        tryLoad(`${item.thumbnail.url}${sep}_r=${retries}&_t=${Date.now()}`);
      } else {
        // استبدل بـ placeholder
        if (img.parentElement) {
          img.remove();
          const empty = document.createElement('div');
          empty.className = 'web-card-thumb-empty';
          thumbWrap.appendChild(empty);
        }
      }
    });

    tryLoad(item.thumbnail.url);
    thumbWrap.appendChild(img);
  } else {
    const empty = document.createElement('div');
    empty.className = 'web-card-thumb-empty';
    thumbWrap.appendChild(empty);
  }

  const badge = document.createElement('span');
  badge.className = 'web-card-badge';
  badge.textContent = item.source?.name || item.connector_id;
  thumbWrap.appendChild(badge);

  card.appendChild(thumbWrap);

  const body = document.createElement('div');
  body.className = 'web-card-body';

  const title = document.createElement('h3');
  title.className = 'web-card-title';
  title.textContent = item.title || 'بدون عنوان';
  title.title = item.title || '';
  body.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'web-card-meta';

  const creatorSpan = document.createElement('span');
  creatorSpan.className = 'web-card-creator';
  creatorSpan.textContent = item.creator?.name || '—';
  creatorSpan.title = item.creator?.name || '';
  meta.appendChild(creatorSpan);

  if (item.license) {
    const lic = document.createElement('span');
    lic.className = 'web-card-license';
    lic.textContent = item.license;
    meta.appendChild(lic);
  }

  body.appendChild(meta);
  card.appendChild(body);

  card.addEventListener('click', () => {
    if (onClick) onClick(item);
  });

  return card;
}