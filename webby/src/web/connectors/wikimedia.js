import { defineConnector } from '../core/connector.js';
import { createContentItem } from '../core/content-item.js';

function stripHtml(html) {
  return String(html || '').replace(/<[^>]*>/g, '').trim();
}

export default defineConnector({
  id: 'wikimedia',
  name: 'Wikimedia Commons',
  mediaTypes: ['image'],
  keyRequired: false,
  capabilities: {
    search: true,
    metadata: true,
    thumbnail: true,
    open_original: true
  },
  async search(query, { page = 1, perPage = 20, signal } = {}) {
    const offset = (page - 1) * perPage;
        const url =
      'https://commons.wikimedia.org/w/api.php' +
      '?action=query' +
      '&generator=search' +
      `&gsrsearch=${encodeURIComponent(query)}` +
      '&gsrnamespace=6' +
      `&gsroffset=${offset}` +
      `&gsrlimit=${perPage}` +
      '&prop=imageinfo' +
      '&iiprop=url|extmetadata' +
      '&iiurlwidth=400' +          // ← thumbnail بعرض 400px
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

        return createContentItem({
          id: `wikimedia-${item.pageid}`,
          connectorId: 'wikimedia',
          type: 'image',
          title: item.title || '',
          creator: {
            name: artist || 'Unknown',
            url: ''
          },
          source: {
            platform: 'Wikimedia Commons',
            name: 'Wikimedia',
            url: 'https://commons.wikimedia.org'
          },
          originalUrl: `https://commons.wikimedia.org/?curid=${item.pageid}`,
          thumbnail: {
            url: info.thumburl || info.url || '',
            source: 'external'
          },
          mediaUrl: info.url || '',
          license: license || null,
          raw: item
        });
      })
      .filter((x) => x && x.thumbnail.url);
  }
});