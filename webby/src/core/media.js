const mediaStore = new Map();
const THUMB_CACHE = new Map();

/* ============ ضغط الصور ============ */

const COMPRESS = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.82,
  format: 'image/webp',
  skipBelowBytes: 200 * 1024,
  skipBelowDimension: 800
};

const SKIP_TYPES = [
  'image/gif',
  'image/svg+xml',
  'image/avif',
  'image/webp'
];

function shouldSkipCompression(file) {
  if (!file.type.startsWith('image/')) return true;
  if (SKIP_TYPES.includes(file.type)) return true;
  if (file.size < COMPRESS.skipBelowBytes) return true;
  return false;
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch (err) {
      console.warn('[Webby] toBlob error:', err);
      resolve(null);
    }
  });
}

async function compressImage(file) {
  if (shouldSkipCompression(file)) return file;

  try {
    console.log('[Webby] compressing:', file.name, file.size, 'bytes');

    const img = await loadImageElement(file);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    console.log('[Webby] original size:', width, 'x', height);

    if (
      width <= COMPRESS.skipBelowDimension &&
      height <= COMPRESS.skipBelowDimension
    ) {
      console.log('[Webby] skip: both dimensions small');
      return file;
    }

    if (width > COMPRESS.maxWidth || height > COMPRESS.maxHeight) {
      const ratio = Math.min(
        COMPRESS.maxWidth / width,
        COMPRESS.maxHeight / height
      );
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    console.log('[Webby] new size:', width, 'x', height);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    let blob = await canvasToBlob(canvas, 'image/webp', COMPRESS.quality);
    let outType = 'image/webp';
    let outExt = 'webp';

    if (!blob) {
      blob = await canvasToBlob(canvas, 'image/jpeg', COMPRESS.quality);
      outType = 'image/jpeg';
      outExt = 'jpg';
    }

    if (!blob) return file;

    console.log('[Webby] compressed size:', blob.size, 'bytes');

    if (blob.size >= file.size) {
      console.log('[Webby] compressed is bigger, keep original');
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const newName = `${baseName}.${outExt}`;
    const newFile = new File([blob], newName, {
      type: outType,
      lastModified: Date.now()
    });

    console.log('[Webby] compressed OK:', newFile.name, newFile.size);
    return newFile;
  } catch (err) {
    console.warn('[Webby] compression failed:', err);
    return file;
  }
}

/* ============ Media API ============ */

export async function addMedia(file) {
  const processed = await compressImage(file);
  const wasCompressed = processed !== file;

  const id = 'media_' + Math.random().toString(36).slice(2, 10);
  const url = URL.createObjectURL(processed);
  const ext = (processed.name.split('.').pop() || 'bin').toLowerCase();

  const safe = {
    id,
    name: processed.name,
    type: processed.type || 'application/octet-stream',
    ext,
    blob: processed,
    url,
    size: processed.size,
    originalSize: file.size,
    originalName: file.name,
    wasCompressed
  };

  mediaStore.set(id, safe);
  return id;
}

/**
 * إضافة وسائط بـ id معروف (للتحميل من ZIP / مجلد).
 * يحاول الضغط إذا لم تكن الصورة مضغوطة أصلًا.
 */
export async function addMediaWithId(id, blob, meta = {}) {
  const name = meta.name || blob.name || `media_${id}`;

  // حوّل الـ Blob إلى File ليتمكن compressImage من العمل
  let file;
  if (blob instanceof File) {
    file = blob;
  } else {
    try {
      file = new File([blob], name, {
        type: blob.type || meta.type || 'application/octet-stream'
      });
    } catch {
      // متصفحات قديمة قد لا تدعم File constructor
      file = blob;
      file.name = name;
    }
  }

  let processed = file;
  if (file.type && file.type.startsWith('image/')) {
    processed = await compressImage(file);
  }

  const url = URL.createObjectURL(processed);
  const ext = (
    processed.name?.split('.').pop() ||
    meta.ext ||
    'bin'
  ).toLowerCase();

  const safe = {
    id,
    name: processed.name || name,
    type: processed.type || blob.type || 'application/octet-stream',
    ext,
    blob: processed,
    url,
    size: processed.size,
    originalSize: file.size || blob.size,
    wasCompressed: processed !== file
  };

  mediaStore.set(id, safe);
  return id;
}

export function getMedia(id) {
  return mediaStore.get(id);
}

export function getAllMedia() {
  return Array.from(mediaStore.values());
}

export function removeMedia(id) {
  const m = mediaStore.get(id);
  if (!m) return;
  URL.revokeObjectURL(m.url);
  mediaStore.delete(id);

  // امسح thumbnails المرتبطة بهذه الوسائط
  for (const [key, url] of Array.from(THUMB_CACHE.entries())) {
    if (key.startsWith(id + '_')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        /* ignore */
      }
      THUMB_CACHE.delete(key);
    }
  }
}

export function getAssetFilename(id) {
  const m = getMedia(id);
  if (!m) return null;
  return `asset_${m.id}.${m.ext}`;
}

export function getAssetPath(id) {
  const f = getAssetFilename(id);
  return f ? `assets/${f}` : '';
}

export function clearAllMedia() {
  mediaStore.forEach((m) => URL.revokeObjectURL(m.url));
  mediaStore.clear();

  THUMB_CACHE.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  });
  THUMB_CACHE.clear();
}

/* ============ Thumbnails ============ */

export async function getThumbnail(mediaId, maxSize = 400) {
  const m = getMedia(mediaId);
  if (!m) return null;

  if (
    m.blob.type === 'image/svg+xml' ||
    m.blob.type === 'image/gif'
  ) {
    return m.url;
  }

  const cacheKey = `${mediaId}_${maxSize}`;
  if (THUMB_CACHE.has(cacheKey)) {
    return THUMB_CACHE.get(cacheKey);
  }

  try {
    const img = await loadImageElement(m.blob);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width <= maxSize && height <= maxSize) {
      THUMB_CACHE.set(cacheKey, m.url);
      return m.url;
    }

    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, 'image/webp', 0.78);
    if (!blob) return m.url;

    const url = URL.createObjectURL(blob);
    THUMB_CACHE.set(cacheKey, url);
    return url;
  } catch (err) {
    console.warn('[Webby] thumbnail failed:', err);
    return m.url;
  }
}

/* للتشخيص */
if (typeof window !== 'undefined') {
  window.__webbyMediaStore = mediaStore;
  window.__webbyThumbCache = THUMB_CACHE;
  window.__webbyThumbInfo = () => {
    console.log('=== Thumbnails ===');
    console.log('عدد thumbnails:', THUMB_CACHE.size);
    THUMB_CACHE.forEach((url, key) => {
      console.log('  -', key, '->', url.slice(0, 60) + '...');
    });
  };
}

/* ============ Thumbnail for export ============ */

export function getThumbPath(id) {
  const m = getMedia(id);
  if (!m) return '';
  if (m.blob.type === 'image/svg+xml' || m.blob.type === 'image/gif') {
    return getAssetPath(id);
  }
  return `assets/thumbs/asset_${m.id}.webp`;
}

export async function getThumbnailBlob(id, maxSize = 480) {
  const m = getMedia(id);
  if (!m) return null;

  if (m.blob.type === 'image/svg+xml' || m.blob.type === 'image/gif') {
    return null; // لا نولّد، الأصلية تُستخدم
  }

  try {
    const img = await loadImageElement(m.blob);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width <= maxSize && height <= maxSize) {
      // الصورة صغيرة أصلًا → نسخة واحدة
      return null;
    }

    const ratio = Math.min(maxSize / width, maxSize / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, 'image/webp', 0.78);
    return blob || null;
  } catch (err) {
    console.warn('[Webby] thumb blob failed:', err);
    return null;
  }
}
/* ============ Export paths + resize ============ */

export function getLogoExportPath() {
  const m = getMedia(getCurrentLogoId());
  if (!m) return '';
  if (m.blob.type === 'image/svg+xml') return 'assets/logo.svg';
  return 'assets/logo.webp';
}

export function getBannerExportPath() {
  const m = getMedia(getCurrentBannerId());
  if (!m) return '';
  if (m.blob.type === 'image/svg+xml') return 'assets/banner.svg';
  return 'assets/banner.webp';
}

export function getAdminExportPath(id) {
  const m = getMedia(id);
  if (!m) return '';
  if (m.blob.type === 'image/svg+xml') {
    return `assets/admins/asset_${id}.svg`;
  }
  return `assets/admins/asset_${id}.webp`;
}

/**
 * يصغّر صورة إلى أبعاد قصوى محددة.
 * يعيد:
 *  - { blob, ext } للملف الجديد
 *  - أو { blob: original, ext: 'svg' } لملفات SVG
 *  - أو null إذا فشل
 */
export async function resizeImage(mediaId, maxW, maxH, quality = 0.85) {
  const m = getMedia(mediaId);
  if (!m) return null;

  // SVG: نعيد الأصل كما هو
  if (m.blob.type === 'image/svg+xml') {
    return { blob: m.blob, ext: 'svg' };
  }

  // GIF: نترك الأصل (متحرك)
  if (m.blob.type === 'image/gif') {
    return { blob: m.blob, ext: 'gif' };
  }

  try {
    const img = await loadImageElement(m.blob);
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    const alreadySmall = width <= maxW && height <= maxH;

    if (alreadySmall) {
      return { blob: m.blob, ext: m.ext };
    }

    const ratio = Math.min(maxW / width, maxH / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, 'image/webp', quality);
    if (!blob) return { blob: m.blob, ext: m.ext };

    // لا تكبّر الحجم: إذا النتيجة أكبر، أعد الأصل
    if (blob.size >= m.blob.size) {
      return { blob: m.blob, ext: m.ext };
    }

    return { blob, ext: 'webp' };
  } catch (err) {
    console.warn('[Webby] resize failed:', mediaId, err);
    return { blob: m.blob, ext: m.ext };
  }
}

/* مساعد داخلي: نحتاج meta للوصول إلى logo/banner id */
let _currentProjectRef = null;
export function _setCurrentProjectRef(project) {
  _currentProjectRef = project;
}
function getCurrentLogoId() {
  return _currentProjectRef?.meta?.logo || '';
}
function getCurrentBannerId() {
  return _currentProjectRef?.meta?.banner || '';
}