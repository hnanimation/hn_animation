import { isCollection } from './sections.js';
import { getPageFilename } from '../renderer/page-renderer.js';

export function buildFeed(project) {
  const meta = project.meta || {};
  const items = [];

  project.sections.forEach((s) => {
    if (!isCollection(s.type)) return;
    const list = s.content?.items || [];
    const page = getPageFilename(s, project.sections);
    list.forEach((item, index) => {
      items.push({
        type: s.type,
        sectionTitle: s.title || '',
        id: `${s.id}-${index}`,
        title: item.title || '',
        description: item.description || '',
        tags: Array.isArray(item.tags) ? item.tags : [],
        image: item.image || '',
        page
      });
    });
  });

  return {
    version: 1,
    generator: 'Webby',
    site: {
      name: meta.name || '',
      description: meta.description || '',
      language: meta.language || 'ar',
      direction: meta.direction || 'rtl'
    },
    items
  };
}