// Thin, defensive localStorage layer with a versioned key namespace.

const NS = 'sketch2sim';
const KEYS = {
  schemaVersion: `${NS}.schemaVersion`,
  settings: `${NS}.settings`,
  keys: `${NS}.keys`,
  sessions: `${NS}.sessions`,
  activeSessionId: `${NS}.activeSessionId`,
};

const SCHEMA_VERSION = '1';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    // QuotaExceededError or private-mode failures land here.
    console.error('Storage write failed for', key, err);
    return false;
  }
}

export function initSchema() {
  if (localStorage.getItem(KEYS.schemaVersion) !== SCHEMA_VERSION) {
    localStorage.setItem(KEYS.schemaVersion, SCHEMA_VERSION);
  }
}

// --- settings: { provider, model } ---
export function getSettings() {
  return readJSON(KEYS.settings, null);
}
export function setSettings(settings) {
  return writeJSON(KEYS.settings, settings);
}

// --- api keys: { anthropic, openai, gemini } ---
export function getKeys() {
  return readJSON(KEYS.keys, {});
}
export function getKey(provider) {
  return getKeys()[provider] || '';
}
export function setKey(provider, value) {
  const keys = getKeys();
  if (value) keys[provider] = value;
  else delete keys[provider];
  return writeJSON(KEYS.keys, keys);
}

// --- sessions ---
export function getSessions() {
  const sessions = readJSON(KEYS.sessions, []);
  return Array.isArray(sessions) ? sessions : [];
}
export function setSessions(sessions) {
  return writeJSON(KEYS.sessions, sessions);
}

export function getActiveSessionId() {
  try {
    return localStorage.getItem(KEYS.activeSessionId) || null;
  } catch {
    return null;
  }
}
export function setActiveSessionId(id) {
  try {
    localStorage.setItem(KEYS.activeSessionId, id);
  } catch {
    /* ignore */
  }
}
