import { defineConnector } from '../core/connector.js';
import { createContentItem } from '../core/content-item.js';

const PROXY = 'https://api.allorigins.win/raw?url=';

export default defineConnector({
  id: 'internet-archive',
  name: 'Internet Archive',
  mediaTypes: ['video'],
  keyRequired: false,
  capabilities: {
    search: true,
    metadata: true,
    thumbnail: true,
    open_original: true
  },
  async search(query, { page = 1, perPage = 20, signal } = {}) {
    const q = `${query} AND mediatype:(movies)`;

    const target =
      'https://archive.org/advancedsearch.php' +
      `?q=${encodeURIComponent(q)}` +
      `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=year&fl[]=description` +
      `&rows=${perPage}` +
      `&page=${page}` +
      `&output=json`;

    const url = PROXY + encodeURIComponent(target);

    const res = await fetch(url, { signal });
    if (!res.ok) {
      if (res.status === 429) throw new Error('RATE_LIMIT');
      throw new Error(`Internet Archive ${res.status}`);
    }

    const data = await res.json();
    const docs = data?.response?.docs || [];

    return docs
      .filter((doc) => doc.identifier)
      .map((doc) => {
        const id = doc.identifier;
        const creator = Array.isArray(doc.creator)
          ? doc.creator[0]
          : doc.creator || 'Internet Archive';

        return createContentItem({
          id: `ia-${id}`,
          connectorId: 'internet-archive',
          type: 'video',
          title: doc.title || id,
          description: doc.description || '',
          creator: {
            name: String(creator),
            url: `https://archive.org/details/${id}`
          },
          source: {
            platform: 'Internet Archive',
            name: 'Internet Archive',
            url: 'https://archive.org'
          },
          originalUrl: `https://archive.org/details/${id}`,
          thumbnail: {
            url: `https://archive.org/services/img/${id}`,
            source: 'external'
          },
          mediaUrl: `https://archive.org/embed/${id}`,
          videoMode: 'embed',
          duration: null,
          license: null,
          raw: doc
        });
      });
  }
});