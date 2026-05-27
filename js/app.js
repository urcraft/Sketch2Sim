import * as storage from './storage.js';
import * as sessions from './sessions.js';
import { Settings } from './settings.js';
import { SketchPad } from './sketch.js';
import { SimulationView } from './simulation.js';
import { Chat } from './chat.js';
import { buildRequest } from './context.js';
import { getProvider } from './providers/index.js';
import { SYSTEM_PROMPT } from './systemPrompt.js';
import { extractHtml } from './html-extract.js';
import { PROVIDERS, DEFAULT_PROVIDER } from './config.js';

function init() {
  storage.initSchema();
  if (!storage.getSettings()) {
    storage.setSettings({
      provider: DEFAULT_PROVIDER,
      model: PROVIDERS[DEFAULT_PROVIDER].defaultModel,
    });
  }
  sessions.init();

  const sketch = new SketchPad(document.getElementById('sketch-panel'));
  const sim = new SimulationView(document.getElementById('sim-panel'));
  const settings = new Settings(document.getElementById('settings-modal'));

  const chat = new Chat(document.getElementById('chat-panel'), {
    onSend: () => handleSend(),
    onNewSession: () => {
      sessions.create();
      sim.reset();
      refresh();
      loadSketch();
    },
    onSelectSession: (id) => {
      sessions.setActive(id);
      refresh();
      loadLatestHtml();
      loadSketch();
    },
    onDeleteSession: () => {
      const active = sessions.getActive();
      const name = active?.title || 'this conversation';
      if (!confirm(`Delete “${name}”? This can't be undone.`)) return;
      sessions.remove(sessions.getActiveId());
      sim.reset();
      refresh();
      loadLatestHtml();
      loadSketch();
    },
    onOpenSettings: () => settings.open(),
    onAttachChange: (on) => chat.updateThumb(on ? sketch.export() : null),
    onLoadHtml: (html) => sim.setHtml(html),
  });

  // Persist the working sketch to the active session, and keep the attach
  // thumbnail live as the user draws.
  sketch.onChange = () => {
    const dataURL = sketch.export();
    sessions.setSketch(dataURL);
    if (chat.isAttachOn()) chat.updateThumb(dataURL);
  };

  // Runtime error in a generated page -> prefill a fix request in the composer.
  sim.onFixRequest = (msg) => {
    chat.setInput(`The simulation threw this error — please fix it:\n${msg}`);
  };

  wireFullscreen();
  wireSketchCollapse();

  let pending = false;

  function refresh() {
    chat.renderSessions(sessions.list(), sessions.getActiveId());
    chat.render(sessions.getActive());
  }

  function loadLatestHtml() {
    const html = sessions.latestHtml();
    if (html) sim.setHtml(html);
    else sim.reset();
  }

  function loadSketch() {
    sketch.load(sessions.getSketch(), () => {
      if (chat.isAttachOn()) chat.updateThumb(sketch.export());
    });
  }

  async function handleSend() {
    if (pending) return;
    chat.clearError();

    const text = chat.getInput().trim();
    const attach = chat.isAttachOn();
    if (!text && !attach) {
      chat.showError('Type a description or toggle “Attach sketch”.');
      return;
    }

    const cfg = storage.getSettings();
    const apiKey = storage.getKey(cfg.provider);
    if (!apiKey) {
      chat.showError(`No API key for ${PROVIDERS[cfg.provider].label}. Add one in Settings.`);
      settings.open(true);
      return;
    }

    const userMsg = { role: 'user', text };
    if (attach) userMsg.sketchDataURL = sketch.export();
    sessions.addMessage(userMsg);
    chat.clearInput();
    chat.updateThumb(null);
    chat.attachCheck.checked = false;
    refresh();

    pending = true;
    chat.setSending(true);
    sim.showLoading('Generating simulation…');

    const req = buildRequest(sessions.getActive(), SYSTEM_PROMPT);
    const adapter = getProvider(cfg.provider);
    const controller = new AbortController();
    let meta = {};
    let full = '';

    try {
      // Gemini (and others) intermittently return an empty 200 stream when
      // briefly overloaded, or finish thinking and emit zero text parts. Retry
      // a few times with a short backoff before giving up. We don't retry once
      // any text arrived or the prompt was content-blocked (retrying won't help).
      const MAX_ATTEMPTS = 4;
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        meta = {};
        full = '';
        for await (const delta of adapter.streamMessage({
          apiKey,
          model: cfg.model,
          signal: controller.signal,
          meta,
          ...req,
        })) {
          full += delta;
          chat.setStreaming(full.length);
          sim.showStreaming(full.length);
        }
        if (full.length > 0 || meta.blockReason || attempt === MAX_ATTEMPTS) break;
        sim.showLoading(`Empty response — retrying (${attempt + 1}/${MAX_ATTEMPTS})…`);
        chat.setStreaming(0);
        await new Promise((r) => setTimeout(r, 400 * attempt));
      }

      const html = extractHtml(full);
      const debug = {
        provider: cfg.provider,
        model: cfg.model,
        finishReason: meta.finishReason || null,
        blockReason: meta.blockReason || null,
        chars: full.length,
        bytes: meta.sseBytes ?? null,
        events: meta.sseEvents ?? null,
        attachedSketch: req.images.length > 0,
        usage: meta.usage || null,
      };
      logDebug(debug, full);

      if (html) {
        sessions.addMessage({ role: 'assistant', text: '', html, raw: full, debug });
        sim.setHtml(html);
      } else {
        let reason = describeEmpty(meta);
        if (!reason && full.length === 0) {
          reason = ' — empty response (the provider may be rate-limiting or overloaded; wait a moment and try again)';
        }
        sessions.addMessage({
          role: 'assistant',
          text: full || '(no text returned)',
          raw: full,
          debug,
        });
        sim.showError(`No HTML document returned${reason}. Open “Debug” on the reply to inspect the raw response.`);
      }
    } catch (err) {
      const msg = err?.message || String(err);
      logDebug({ provider: cfg.provider, model: cfg.model, error: msg, ...meta }, full);
      sessions.addMessage({
        role: 'assistant',
        text: `Error: ${msg}`,
        raw: full,
        debug: { provider: cfg.provider, model: cfg.model, error: msg, chars: full.length, ...meta },
      });
      chat.showError(msg);
      sim.showError(msg);
    } finally {
      pending = false;
      chat.setSending(false);
      chat.clearStreaming();
      refresh();
    }
  }

  refresh();
  loadLatestHtml();
  loadSketch();
  if (!storage.getKey(storage.getSettings().provider)) settings.open(true);
}

// --- debugging --------------------------------------------------------------
function describeEmpty(meta) {
  const bits = [];
  if (meta.blockReason) bits.push(`blocked: ${meta.blockReason}`);
  if (meta.finishReason) bits.push(`finishReason: ${meta.finishReason}`);
  return bits.length ? ` (${bits.join(', ')})` : '';
}

function logDebug(debug, raw) {
  try {
    console.groupCollapsed('%cSketch2Sim response', 'color:#818cf8;font-weight:bold');
    console.log('meta:', debug);
    console.log('raw response:', raw);
    console.groupEnd();
  } catch {
    /* ignore */
  }
}

// --- sketch collapse --------------------------------------------------------
function wireSketchCollapse() {
  const rightCol = document.querySelector('.right-col');
  const btn = document.getElementById('sketch-collapse');
  if (!rightCol || !btn) return;
  btn.addEventListener('click', () => {
    const collapsed = rightCol.classList.toggle('sketch-collapsed');
    btn.textContent = collapsed ? '▸' : '▾';
    btn.title = collapsed ? 'Expand sketch' : 'Collapse sketch';
  });
}

// --- fullscreen -------------------------------------------------------------
function wireFullscreen() {
  document.querySelectorAll('[data-fs]').forEach((btn) => {
    const target = document.getElementById(btn.getAttribute('data-fs'));
    if (target) btn.addEventListener('click', () => toggleFullscreen(target));
  });
}

function toggleFullscreen(el) {
  const isFs = document.fullscreenElement === el || el.classList.contains('maximized');
  if (isFs) {
    if (document.fullscreenElement === el && document.exitFullscreen) document.exitFullscreen();
    el.classList.remove('maximized');
    return;
  }
  if (el.requestFullscreen) {
    el.requestFullscreen().catch(() => el.classList.add('maximized'));
  } else {
    el.classList.add('maximized');
  }
}

document.addEventListener('DOMContentLoaded', init);
