export const TEMPLATES = {
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    tokens: {
      background: '#ffffff',
      text: '#111111',
      accent: '#0066cc',
      font: 'system-ui, sans-serif'
    }
  },
  'dark-artist': {
    id: 'dark-artist',
    name: 'Dark Artist',
    tokens: {
      background: '#111111',
      text: '#eeeeee',
      accent: '#ff5577',
      font: 'system-ui, sans-serif'
    }
  }
};

export function getTemplate(id) {
  return TEMPLATES[id] || TEMPLATES.minimal;
}