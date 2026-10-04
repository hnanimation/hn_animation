import { defineConnector } from '../core/connector.js';
import { createContentItem } from '../core/content-item.js';

export default defineConnector({
  id: 'openverse',
  name: 'Openverse',
  mediaTypes: ['image'],
  keyRequired: false,
  capabilities: {
    search: true,
    metadata: true,
    thumbnail: true,
    open_original: true
  },
  async search(query, { page = 1, perPage = 20, signal } = {}) {
    const url =
      'https://api.openverse.org/v1/images/' +
      `?q=${encodeURIComponent(query)}` +
      `&page=${page}` +
      `&page_size=${perPage}`;

    const res = await fetch(url, {
      signal,
      headers: { Accept: 'application/json' }
    });

    if (!res.ok) {
      if (res.status === 429) throw new Error('RATE_LIMIT');
      throw new Error(`Openverse ${res.status}`);
    }

    const data = await res.json();

    return (data.results || [])
      .filter((item) => {
        // تجاهل ما يأتي من Wikimedia — لدينا connector خاص به
        const src = (item.source || '').toLowerCase();
        const srcName = (item.source_name || '').toLowerCase();
        if (src === 'wikimedia' || src.includes('wikimedia')) return false;
        if (srcName.includes('wikimedia')) return false;
        return true;
      })
      .map((item) => {
        const sourceName = item.source_name || 'Openverse';

        return createContentItem({
          id: `openverse-${item.id}`,
          connectorId: 'openverse',
          type: 'image',
          title: item.title || '',
          description: item.description || '',
          creator: {
            name: item.creator || 'Unknown',
            url: item.creator_url || ''
          },
          source: {
            platform: sourceName,
            name: sourceName,
            url: 'https://openverse.org'
          },
          originalUrl: item.foreign_landing_url || item.url,
          thumbnail: {
            url: item.thumbnail || item.url,
            source: 'external'
          },
          mediaUrl: item.url,
          tags: (item.tags || []).map((t) => t.name || t).filter(Boolean),
          license: item.license || null,
          raw: item
        });
      });
  }
});