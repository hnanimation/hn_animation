const cooldowns = new Map();

const COOLDOWN_MS = 30 * 1000;

export function markConnectorFailed(id) {
  const now = Date.now();
  const entry = cooldowns.get(id) || { failures: 0, until: 0 };
  entry.failures += 1;

  if (entry.failures >= 2) {
    entry.until = now + COOLDOWN_MS;
    console.warn(`[Webby] connector "${id}" cooling down for 30s`);
  }

  cooldowns.set(id, entry);
}

export function markConnectorSuccess(id) {
  cooldowns.delete(id);
}

export function isConnectorCoolingDown(id) {
  const entry = cooldowns.get(id);
  if (!entry) return false;
  if (Date.now() >= entry.until) {
    cooldowns.delete(id);
    return false;
  }
  return true;
}