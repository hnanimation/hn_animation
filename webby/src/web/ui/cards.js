const MAX_RETRIES = 2;

export function createCard(item, onClick) {
  const card = document.createElement('article');
  card.className = 'web-card';
  card.setAttribute('data-id', item.id);
  card.setAttribute('data-connector', item.connector_id);
  card.setAttribute('data-type', item.type || 'image');

  const thumbWrap = document.createElement('div');
  thumbWrap.className = 'web-card-thumb';

  if (item.thumbnail?.url) {
    const img = document.createElement('img');
    img.alt = item.title || '';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';

    let retries = 0;

    img.addEventListener('error', () => {
      if (retries < MAX_RETRIES) {
        retries++;
        const sep = item.thumbnail.url.includes('?') ? '&' : '?';
        img.src = `${item.thumbnail.url}${sep}_r=${retries}&_t=${Date.now()}`;
      } else {
        if (img.parentElement) {
          img.remove();
          const empty = document.createElement('div');
          empty.className = 'web-card-thumb-empty';
          thumbWrap.appendChild(empty);
        }
      }
    });

    img.src = item.thumbnail.url;
    thumbWrap.appendChild(img);
  } else {
    const empty = document.createElement('div');
    empty.className = 'web-card-thumb-empty';
    thumbWrap.appendChild(empty);
  }

  // شارة المصدر
  const badge = document.createElement('span');
  badge.className = 'web-card-badge';
  badge.textContent = item.source?.name || item.connector_id;
  thumbWrap.appendChild(badge);

  // شارة المدة (فيديو)
  if (item.type === 'video' && item.duration) {
    const dur = document.createElement('span');
    dur.className = 'web-card-duration';
    dur.textContent = formatDuration(item.duration);
    thumbWrap.appendChild(dur);
  }

    // شارة "غير مدعوم" للفيديوهات OGV/external
  if (item.type === 'video' && item.video_mode === 'external') {
    const warn = document.createElement('span');
    warn.className = 'web-card-warn';
    warn.textContent = '↗ المصدر';
    warn.title = 'صيغة غير مدعومة — يفتح في المصدر';
    thumbWrap.appendChild(warn);
  }
  
  // أيقونة التشغيل (فيديو)
  if (item.type === 'video') {
    const play = document.createElement('span');
    play.className = 'web-card-play';
    play.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">' +
      '<circle cx="28" cy="28" r="24" fill="rgba(0,0,0,0.55)"/>' +
      '<path d="M22 16v24l20-12z" fill="#ffffff"/>' +
      '</svg>';
    thumbWrap.appendChild(play);
  }

  card.appendChild(thumbWrap);

  // Body
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

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  const h = Math.floor(m / 60);
  const min = String(m % 60).padStart(2, '0');
  if (h > 0) return `${h}:${min}:${sec}`;
  return `${m}:${sec}`;
}