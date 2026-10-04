import { defineConnector } from '../core/connector.js';
import { createContentItem } from '../core/content-item.js';

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').trim();
}

function isVideoFile(title, mime) {
  const t = String(title || '').toLowerCase();
  const m = String(mime || '').toLowerCase();
  if (m.startsWith('video/')) return true;
  if (/\.(webm|ogv|ogg|mp4|mov)$/i.test(t)) return true;
  return false;
}

function pickVideoUrl(info) {
  if (Array.isArray(info.derivatives)) {
    const webm = info.derivatives.find(
      (d) => d.type === 'video/webm' && d.src
    );
    if (webm) return { url: webm.src, playable: true };

    const mp4 = info.derivatives.find(
      (d) => d.type === 'video/mp4' && d.src
    );
    if (mp4) return { url: mp4.src, playable: true };
  }

  // لا derivatives: نُعيد الرابط الأصلي مع علامة "غير مدعوم"
  if (info.url) return { url: info.url, playable: false };

  return null;
}

export default defineConnector({
  id: 'wikimedia',
  name: 'Wikimedia Commons',
  mediaTypes: ['image', 'video'],
  keyRequired: false,
  capabilities: {
    search: true,
    metadata: true,
    thumbnail: true,
    open_original: true
  },
  async search(query, { page = 1, perPage = 20, signal, filter = 'all' } = {}) {
    const searchTerm = filter === 'video'
      ? `${query} filetype:video`
      : query;

    const offset = (page - 1) * perPage;
    const url =
      'https://commons.wikimedia.org/w/api.php' +
      '?action=query' +
      '&generator=search' +
      `&gsrsearch=${encodeURIComponent(searchTerm)}` +
      '&gsrnamespace=6' +
      `&gsroffset=${offset}` +
      `&gsrlimit=${perPage}` +
      '&prop=imageinfo' +
      '&iiprop=url|mime|extmetadata|derivatives' +
      '&iiurlwidth=400' +
      '&format=json' +
      '&origin=*';

    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Wikimedia ${res.status}`);

    const data = await res.json();
    const pages = data.query && data.query.pages;
    if (!pages) return [];

    return Object.values(pages)
      .map((item) => {
        const info = item.imageinfo && item.imageinfo[0];
        if (!info) return null;

        const meta = info.extmetadata || {};
        const license = meta.LicenseShortName ? meta.LicenseShortName.value : null;
        const artist = meta.Artist ? stripHtml(meta.Artist.value) : 'Unknown';
        const isVid = isVideoFile(item.title, info.mime);

        // فلترة أساسية
        if (filter === 'image' && isVid) return null;

        let mediaUrl = '';
        let type = 'image';
        let playable = true;

        if (isVid) {
          const picked = pickVideoUrl(info);
          if (!picked) return null;
          mediaUrl = picked.url;
          playable = picked.playable;
          type = 'video';
        }

        const thumbnailUrl = info.thumburl || info.url || '';
        if (!thumbnailUrl) return null;

        return createContentItem({
          id: `wikimedia-${item.pageid}`,
          connectorId: 'wikimedia',
          type,
          title: item.title || '',
          creator: { name: artist || 'Unknown', url: '' },
          source: {
            platform: 'Wikimedia Commons',
            name: 'Wikimedia',
            url: 'https://commons.wikimedia.org'
          },
          originalUrl: `https://commons.wikimedia.org/?curid=${item.pageid}`,
          thumbnail: { url: thumbnailUrl, source: 'external' },
          mediaUrl,
          videoMode: playable ? 'direct' : 'external',
          duration: null,
          license: license || null,
          raw: { ...item, _playable: playable }
        });
      })
      .filter(Boolean);
  }
});