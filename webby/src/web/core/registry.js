/**
 * Connector registry.
 */

const registry = new Map();

export function register(connector) {
  if (!connector?.id) throw new Error('Cannot register connector without id');
  registry.set(connector.id, connector);
}

export function getAll() {
  return Array.from(registry.values());
}

export function get(id) {
  return registry.get(id) || null;
}

export function getEnabled(apiKeys = {}) {
  return getAll().filter((c) => {
    if (!c.keyRequired) return true;
    const key = apiKeys[`${c.id}_key`];
    return Boolean(key && String(key).trim());
  });
}