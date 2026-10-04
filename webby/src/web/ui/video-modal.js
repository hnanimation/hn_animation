let modalEl, titleEl, videoEl, iframeEl, metaEl;

export function initVideoModal() {
  if (modalEl) return;

  modalEl = document.createElement('dialog');
  modalEl.className = 'web-video-modal';
  modalEl.innerHTML = `
    <div class="wvm-header">
      <h3 class="wvm-title"></h3>
      <button class="wvm-close" type="button" aria-label="إغلاق">✕</button>
    </div>
    <div class="wvm-body">
      <video class="wvm-video" controls playsinline style="display:none"></video>
      <iframe class="wvm-iframe" allowfullscreen referrerpolicy="no-referrer" style="display:none"></iframe>
    </div>
    <div class="wvm-meta">
      <span class="wvm-creator"></span>
      <a class="wvm-original" target="_blank" rel="noopener">فتح الأصلي ↗</a>
    </div>
  `;

  document.body.appendChild(modalEl);

  titleEl = modalEl.querySelector('.wvm-title');
  videoEl = modalEl.querySelector('.wvm-video');
  iframeEl = modalEl.querySelector('.wvm-iframe');
  metaEl = modalEl.querySelector('.wvm-creator');

  modalEl.querySelector('.wvm-close').addEventListener('click', closeVideoModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeVideoModal();
  });
  modalEl.addEventListener('close', stopPlayback);
}

export function openVideoModal(item) {
  if (!modalEl) initVideoModal();

  // فيديو غير مدعوم → افتح المصدر مباشرة
  if (item.video_mode === 'external') {
    const target = item.original_url || item.media_url;
    if (target) {
      window.open(target, '_blank', 'noopener,noreferrer');
    }
    return;
  }

  titleEl.textContent = item.title || 'فيديو';
  metaEl.textContent = item.creator?.name || item.source?.name || '';
  modalEl.querySelector('.wvm-original').href = item.original_url || item.media_url || '#';

  stopPlayback();

  if (item.video_mode === 'embed' || !item.media_url) {
    iframeEl.src = item.media_url || item.original_url || '';
    iframeEl.style.display = 'block';
    videoEl.style.display = 'none';
  } else {
    videoEl.src = item.media_url;
    videoEl.style.display = 'block';
    iframeEl.style.display = 'none';
    setTimeout(() => videoEl.play().catch(() => {}), 100);
  }

  if (typeof modalEl.showModal === 'function') modalEl.showModal();
  else modalEl.setAttribute('open', '');
}

export function closeVideoModal() {
  if (!modalEl) return;
  stopPlayback();
  if (typeof modalEl.close === 'function') modalEl.close();
  else modalEl.removeAttribute('open');
}

function stopPlayback() {
  if (videoEl) {
    try { videoEl.pause(); videoEl.removeAttribute('src'); videoEl.load(); } catch {}
  }
  if (iframeEl) iframeEl.src = 'about:blank';
}