export const SECTION_TYPES = {
  home: {
    label: 'Home',
    icon: 'house',
    single: true,
    defaultContent: { title: 'Welcome', body: 'مرحبًا بك في موقعي.' }
  },
  about: {
    label: 'About',
    icon: 'info',
    single: true,
    defaultContent: { title: 'About', body: 'اكتب نبذة عنك هنا.' }
  },
  contact: {
    label: 'Contact',
    icon: 'mail',
    single: true,
    defaultContent: { title: 'Contact', email: 'you@example.com' }
  },
  portfolio: {
    label: 'Portfolio',
    icon: 'palette',
    single: false,
    defaultContent: { title: 'Portfolio', items: [] }
  },
  projects: {
    label: 'Projects',
    icon: 'briefcase-business',
    single: false,
    defaultContent: { title: 'Projects', items: [] }
  },
  articles: {
    label: 'Articles',
    icon: 'newspaper',
    single: false,
    defaultContent: { title: 'Articles', items: [] }
  },
  posts: {
    label: 'Posts',
    icon: 'message-circle',
    single: false,
    defaultContent: { title: 'Posts', items: [] }
  },
  tutorials: {
    label: 'Tutorials',
    icon: 'graduation-cap',
    single: false,
    defaultContent: { title: 'Tutorials', items: [] }
  },
  comics: {
    label: 'Comics',
    icon: 'clapperboard',
    single: false,
    defaultContent: { title: 'Comics', items: [] }
  },
  videos: {
    label: 'Videos',
    icon: 'film',
    single: false,
    defaultContent: { title: 'Videos', items: [] }
  },
  downloads: {
    label: 'Downloads',
    icon: 'download',
    single: false,
    defaultContent: { title: 'Downloads', items: [] }
  },
  custom: {
    label: 'Custom (قسم مخصص)',
    icon: 'blocks',
    single: false,
    defaultContent: { title: 'Custom', items: [] }
  }
};

export function isCollection(type) {
  const def = SECTION_TYPES[type];
  return def ? def.single === false : false;
}

export function getSectionIcon(type) {
  const def = SECTION_TYPES[type];
  return def?.icon || 'blocks';
}

export function createSection(type, order = 0) {
  const def = SECTION_TYPES[type];
  if (!def) throw new Error(`Unknown section type: ${type}`);
  return {
    id: `${type}-${order}`,
    type,
    title: def.defaultContent.title,
    visible: true,
    order,
    content: JSON.parse(JSON.stringify(def.defaultContent))
  };
}