import { addMedia, getAllMedia, removeMedia, getMedia } from '../core/media.js';
import { showConfirm } from '../ui/dialogs.js';

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export function renderMediaManager(container, onChange) {
  container.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'media-header';

  const label = document.createElement('label');
  label.className = 'upload-btn';
  label.textContent = '+ إضافة صورة';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = 'wb-media-upload';
  fileInput.name = 'wb-media-upload';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.style.display = 'none';

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';

    for (const file of files) {
      await addMedia(file);
    }

    renderMediaManager(container, onChange);
    if (onChange) onChange();
  });

  label.appendChild(fileInput);
  header.appendChild(label);

  const count = document.createElement('span');
  count.className = 'media-count';
  count.textContent = `${getAllMedia().length} ملف`;
  header.appendChild(count);

  container.appendChild(header);

  const hint = document.createElement('p');
  hint.className = 'media-hint';
  hint.textContent =
    'الصور الكبيرة تُضغط تلقائيًا إلى WebP (بحد أقصى 1920px) لتسريع الموقع.';
  container.appendChild(hint);

  const list = getAllMedia();
  if (list.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'media-empty';
    empty.textContent = 'لا توجد صور بعد. أضف صورًا لاستخدامها داخل الأقسام.';
    container.appendChild(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'media-grid';

  list.forEach((m) => {
    const card = document.createElement('div');
    card.className = 'media-card';

    const img = document.createElement('img');
    img.src = m.url;
    img.alt = m.name;
    img.width = 200;
    img.height = 160;
    card.appendChild(img);

    const name = document.createElement('div');
    name.className = 'media-name';
    name.textContent = m.name;
    name.title = m.name;
    card.appendChild(name);

    const size = document.createElement('div');
    size.className = 'media-size';
    if (m.wasCompressed && m.originalSize) {
      const saved = m.originalSize - m.size;
      const pct = Math.round((saved / m.originalSize) * 100);
      size.textContent = `${formatBytes(m.size)} · -${pct}%`;
      size.title = `الأصلي: ${formatBytes(m.originalSize)}`;
      size.classList.add('compressed');
    } else {
      size.textContent = formatBytes(m.size);
    }
    card.appendChild(size);

    const del = document.createElement('button');
    del.textContent = '✕';
    del.className = 'delete-section-btn';
    del.title = 'حذف الصورة';
    del.addEventListener('click', async () => {
      const ok = await showConfirm(`حذف الصورة "${m.name}"؟`, 'حذف');
      if (!ok) return;
      removeMedia(m.id);
      renderMediaManager(container, onChange);
      if (onChange) onChange();
    });
    card.appendChild(del);

    grid.appendChild(card);
  });

  container.appendChild(grid);
}

export { getMedia };