/**
 * Connector interface + validation.
 */

export function defineConnector(def = {}) {
  if (!def.id) throw new Error('Connector must have an id');
  if (!def.name) throw new Error('Connector must have a name');
  if (typeof def.search !== 'function') {
    throw new Error(`Connector ${def.id} must implement search()`);
  }

  return {
    id: String(def.id),
    name: String(def.name),
    mediaTypes: Array.isArray(def.mediaTypes) ? def.mediaTypes : ['image'],
    capabilities: def.capabilities || {
      search: true,
      metadata: true,
      thumbnail: true,
      open_original: true
    },
    keyRequired: Boolean(def.keyRequired),
    getKeyUrl: def.getKeyUrl || null,
    search: def.search
  };
}