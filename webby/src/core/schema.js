export const SCHEMA_VERSION = 1;

export function createEmptyProject(name = 'My Artist Website') {
  return {
    schemaVersion: SCHEMA_VERSION,
    webbyVersion: '0.1.0',
    meta: {
      name,
      username: name,
      description: '',
      link: '',
      logo: '',
      banner: '',
      admins: [],
      gitlab: {
        username: '',
        project: ''
      },
      language: 'ar',
      direction: 'rtl',
      network: { enabled: false }
    },
    template: 'minimal',
    sections: [],
    media: []
  };
}