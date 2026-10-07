import { defineConnector } from '../core/connector.js';
import { createContentItem } from '../core/content-item.js';

const DEFAULT_INSTANCE = 'https://tilvids.com';

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = String(s % 60).padStart(2, '0');
  return `${m}:${sec}`;
}

export default defineConnector({
  id: 'peertube',
  name: 'PeerTube',
  mediaTypes: ['video'],
  keyRequired: false,
  capabilities: {
    search: true,
    metadata: true,
    thumbnail: true,
    open_original: true
  },
  async search(query, { page = 1, perPage = 20, signal, apiKeys = {}, filter = 'all' } = {}) {
    // PeerTube فيديو فقط
    if (filter === 'image') return [];

    const instance = (apiKeys['peertube_instance'] || DEFAULT_INSTANCE).replace(/\/$/, '');
    const start = (page - 1) * perPage;

    const url =
      `${instance}/api/v1/search/videos` +
      `?search=${encodeURIComponent(query)}` +
      `&count=${Math.min(perPage, 20)}` +
      `&start=${start}` +
      `&sort=-match`;

    // timeout إضافي داخل connector (4s)
const internalCtrl = new AbortController();
const internalTimeout = setTimeout(() => internalCtrl.abort(), 4000);

// ربط الإشارتين
signal?.addEventListener('abort', () => internalCtrl.abort());

let res;
try {
  res = await fetch(url, { signal: internalCtrl.signal });
} finally {
  clearTimeout(internalTimeout);
}

if (!res.ok) {
  if (res.status === 429) throw new Error('RATE_LIMIT');
  throw new Error(`PeerTube ${res.status}`);
}

    const data = await res.json();

    return (data.data || [])
      .map((video) => {
        const uuid = video.uuid;
        if (!uuid) return null;

        const host = video.account?.host || '';
        const thumb = video.thumbnailPath
          ? `${instance}${video.thumbnailPath}`
          : video.previewPath
            ? `${instance}${video.previewPath}`
            : '';

        const embed = video.embedUrl || `${instance}/videos/embed/${uuid}`;
        const watch = video.url || `${instance}/w/${uuid}`;

        return createContentItem({
          id: `peertube-${uuid}`,
          connectorId: 'peertube',
          type: 'video',
          title: video.name || 'PeerTube Video',
          description: video.description || '',
          creator: {
            name: video.account?.displayName || video.channel?.displayName || 'Unknown',
            url: video.account?.url || video.channel?.url || ''
          },
          source: {
            platform: 'PeerTube',
            name: host ? `PeerTube · ${host}` : 'PeerTube',
            url: instance
          },
          originalUrl: watch,
          thumbnail: { url: thumb, source: 'external' },
          mediaUrl: embed,
          videoMode: 'embed',
          duration: video.duration || null,
          license: video.licence?.label || null,
          raw: video
        });
      })
      .filter(Boolean);
  }
});