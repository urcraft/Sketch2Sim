// In-memory session state, synced to localStorage.
// A session = { id, title, createdAt, updatedAt, messages: [...] }
// A message = { role:'user'|'assistant', text, sketchDataURL?, html? }

import * as storage from './storage.js';

let sessions = [];
let activeId = null;

function genId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeSession() {
  return {
    id: genId(),
    title: 'New simulation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
}

export function init() {
  sessions = storage.getSessions();
  activeId = storage.getActiveSessionId();
  if (!sessions.length) {
    const s = makeSession();
    sessions.push(s);
    activeId = s.id;
    persist();
  } else if (!activeId || !sessions.some((s) => s.id === activeId)) {
    activeId = sessions[0].id;
  }
}

export function list() {
  return sessions;
}
export function getActive() {
  return sessions.find((s) => s.id === activeId) || null;
}
export function getActiveId() {
  return activeId;
}

export function setActive(id) {
  if (sessions.some((s) => s.id === id)) {
    activeId = id;
    storage.setActiveSessionId(id);
  }
}

export function create() {
  const s = makeSession();
  sessions.unshift(s);
  activeId = s.id;
  storage.setActiveSessionId(s.id);
  persist();
  return s;
}

export function remove(id) {
  sessions = sessions.filter((s) => s.id !== id);
  if (!sessions.length) sessions.push(makeSession());
  if (!sessions.some((s) => s.id === activeId)) activeId = sessions[0].id;
  storage.setActiveSessionId(activeId);
  persist();
}

export function addMessage(msg) {
  const s = getActive();
  if (!s) return null;
  s.messages.push(msg);
  s.updatedAt = Date.now();
  if (s.title === 'New simulation' && msg.role === 'user' && msg.text) {
    s.title = msg.text.slice(0, 48);
  }
  persist();
  return msg;
}

export function latestHtml(session = getActive()) {
  if (!session) return null;
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const m = session.messages[i];
    if (m.role === 'assistant' && m.html) return m.html;
  }
  return null;
}

// Persist, trimming large payloads on older messages to respect the ~5MB budget.
export function persist() {
  const KEEP = 4; // keep full sketch/html only on the most recent N messages
  const snapshot = sessions.map((s) => ({
    ...s,
    messages: s.messages.map((m, i, arr) => {
      if (arr.length - i <= KEEP) return m;
      const { sketchDataURL, html, raw, ...rest } = m;
      return rest;
    }),
  }));

  if (!storage.setSessions(snapshot)) {
    // Quota exceeded — keep only the last couple of messages per session.
    const minimal = sessions.map((s) => ({ ...s, messages: s.messages.slice(-2) }));
    storage.setSessions(minimal);
  }
}
