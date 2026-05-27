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
    },
    onSelectSession: (id) => {
      sessions.setActive(id);
      refresh();
      loadLatestHtml();
    },
    onOpenSettings: () => settings.open(),
    onAttachChange: (on) => chat.updateThumb(on ? sketch.export() : null),
    onLoadHtml: (html) => sim.setHtml(html),
  });

  // Keep the attach thumbnail live as the user draws.
  sketch.onChange = () => {
    if (chat.isAttachOn()) chat.updateThumb(sketch.export());
  };

  // Runtime error in a generated page -> prefill a fix request in the composer.
  sim.onFixRequest = (msg) => {
    chat.setInput(`The simulation threw this error — please fix it:\n${msg}`);
  };

  wireFullscreen();

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
    const meta = {};
    let full = '';

    try {
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

      const html = extractHtml(full);
      const debug = {
        provider: cfg.provider,
        model: cfg.model,
        finishReason: meta.finishReason || null,
        blockReason: meta.blockReason || null,
        chars: full.length,
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
