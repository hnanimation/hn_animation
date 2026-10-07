import { defineConnector } from '../core/connector.js';
import { createContentItem } from '../core/content-item.js';

async function fetchImages(query, page, perPage, signal, key) {
  const url =
    'https://api.pexels.com/v1/search' +
    `?query=${encodeURIComponent(query)}` +
    `&page=${page}` +
    `&per_page=${perPage}`;

  const res = await fetch(url, {
    signal,
    headers: { Authorization: key, Accept: 'application/json' }
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('BAD_KEY');
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`Pexels Image ${res.status}`);
  }

  const data = await res.json();

  return (data.photos || []).map((photo) =>
    createContentItem({
      id: `pexels-img-${photo.id}`,
      connectorId: 'pexels',
      type: 'image',
      title: photo.alt || '',
      creator: {
        name: photo.photographer || 'Unknown',
        url: photo.photographer_url || ''
      },
      source: {
        platform: 'Pexels',
        name: 'Pexels',
        url: 'https://www.pexels.com'
      },
      originalUrl: photo.url,
      thumbnail: { url: photo.src?.medium || photo.src?.small || '', source: 'external' },
      mediaUrl: photo.src?.original || '',
      license: 'Pexels License',
      raw: photo
    })
  );
}

async function fetchVideos(query, page, perPage, signal, key) {
  const url =
    'https://api.pexels.com/videos/search' +
    `?query=${encodeURIComponent(query)}` +
    `&page=${page}` +
    `&per_page=${perPage}`;

  const res = await fetch(url, {
    signal,
    headers: { Authorization: key, Accept: 'application/json' }
  });

  if (!res.ok) {
    if (res.status === 401) throw new Error('BAD_KEY');
    if (res.status === 429) throw new Error('RATE_LIMIT');
    throw new Error(`Pexels Video ${res.status}`);
  }

  const data = await res.json();

  return (data.videos || [])
    .map((video) => {
      const file =
        video.video_files?.find((f) => f.quality === 'hd') ||
        video.video_files?.[0];
      if (!file) return null;

      return createContentItem({
        id: `pexels-vid-${video.id}`,
        connectorId: 'pexels',
        type: 'video',
        title: video.user?.name || 'Pexels Video',
        description: '',
        creator: {
          name: video.user?.name || 'Unknown',
          url: video.user?.url || ''
        },
        source: {
          platform: 'Pexels',
          name: 'Pexels',
          url: 'https://www.pexels.com'
        },
        originalUrl: video.url,
        thumbnail: { url: video.image || '', source: 'external' },
        mediaUrl: file.link,
        videoMode: 'direct',
        duration: video.duration || null,
        license: 'Pexels License',
        raw: video
      });
    })
    .filter(Boolean);
}

export default defineConnector({
  id: 'pexels',
  name: 'Pexels',
  mediaTypes: ['image', 'video'],
  keyRequired: true,
  getKeyUrl: 'https://www.pexels.com/api/key/',
  capabilities: {
    search: true,
    metadata: true,
    thumbnail: true,
    open_original: true
  },
  async search(query, { page = 1, perPage = 20, signal, apiKeys = {}, filter = 'all' } = {}) {
    const key = apiKeys['pexels_key'];
    if (!key) return [];

    if (filter === 'image') return await fetchImages(query, page, perPage, signal, key);
    if (filter === 'video') return await fetchVideos(query, page, perPage, signal, key);

    // filter === 'all' → لا يحدث عمليًا (view يمرر 'image' أو 'video')
    return await fetchImages(query, page, perPage, signal, key);
  }
});