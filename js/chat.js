// Chat panel: session switcher, message history, composer with the
// sketch-attach toggle, and streaming indicator.

export class Chat {
  constructor(root, handlers = {}) {
    this.root = root;
    this.h = handlers;

    this.messagesEl = root.querySelector('#messages');
    this.inputEl = root.querySelector('#chat-input');
    this.sendBtn = root.querySelector('#send-btn');
    this.attachCheck = root.querySelector('#attach-sketch');
    this.attachThumb = root.querySelector('#attach-thumb');
    this.sessionSel = root.querySelector('#session-select');
    this.errorEl = root.querySelector('#chat-error');

    this.streamEl = null;

    this.sendBtn.addEventListener('click', () => this.h.onSend?.());
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.h.onSend?.();
      }
    });
    this.attachCheck.addEventListener('change', () => this.h.onAttachChange?.(this.attachCheck.checked));
    this.sessionSel.addEventListener('change', () => this.h.onSelectSession?.(this.sessionSel.value));
    root.querySelector('#new-session').addEventListener('click', () => this.h.onNewSession?.());
    root.querySelector('#delete-session').addEventListener('click', () => this.h.onDeleteSession?.());
    root.querySelector('#open-help').addEventListener('click', () => this.h.onOpenHelp?.());
    root.querySelector('#open-settings').addEventListener('click', () => this.h.onOpenSettings?.());
  }

  // --- composer -------------------------------------------------------------
  getInput() {
    return this.inputEl.value;
  }
  setInput(text) {
    this.inputEl.value = text;
    this.inputEl.focus();
  }
  clearInput() {
    this.inputEl.value = '';
  }
  isAttachOn() {
    return this.attachCheck.checked;
  }
  updateThumb(dataURL) {
    if (dataURL) {
      this.attachThumb.src = dataURL;
      this.attachThumb.hidden = false;
    } else {
      this.attachThumb.hidden = true;
      this.attachThumb.removeAttribute('src');
    }
  }
  setSending(on) {
    this.sendBtn.disabled = on;
    this.sendBtn.textContent = on ? 'Generating…' : 'Send';
  }

  showError(msg) {
    this.errorEl.textContent = msg;
    this.errorEl.hidden = false;
  }
  clearError() {
    this.errorEl.hidden = true;
    this.errorEl.textContent = '';
  }

  // --- sessions -------------------------------------------------------------
  renderSessions(sessions, activeId) {
    this.sessionSel.innerHTML = '';
    for (const s of sessions) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.title || 'Untitled';
      if (s.id === activeId) opt.selected = true;
      this.sessionSel.appendChild(opt);
    }
  }

  // --- messages -------------------------------------------------------------
  render(session) {
    this.messagesEl.innerHTML = '';
    this.streamEl = null;
    if (!session) return;

    for (const m of session.messages) {
      if (m.role === 'user') this.messagesEl.appendChild(this._userBubble(m));
      else this.messagesEl.appendChild(this._assistantBubble(m));
    }
    this._scrollToBottom();
  }

  _userBubble(m) {
    const el = document.createElement('div');
    el.className = 'msg msg-user';
    if (m.text) {
      const p = document.createElement('div');
      p.className = 'msg-text';
      p.textContent = m.text;
      el.appendChild(p);
    }
    if (m.sketchDataURL) {
      const img = document.createElement('img');
      img.className = 'msg-sketch';
      img.src = m.sketchDataURL;
      img.alt = 'attached sketch';
      el.appendChild(img);
    }
    return el;
  }

  _assistantBubble(m) {
    const el = document.createElement('div');
    el.className = 'msg msg-ai';
    if (m.html) {
      const card = document.createElement('div');
      card.className = 'sim-card';
      card.innerHTML = '<span>Simulation generated</span>';
      const view = document.createElement('button');
      view.className = 'btn btn-small';
      view.textContent = 'View';
      view.addEventListener('click', () => this.h.onLoadHtml?.(m.html));
      card.appendChild(view);
      el.appendChild(card);
    } else {
      const p = document.createElement('div');
      p.className = 'msg-text';
      p.textContent = m.text || '(empty response)';
      el.appendChild(p);
    }
    if (m.debug || m.raw != null) el.appendChild(this._debugPanel(m));
    return el;
  }

  _debugPanel(m) {
    const d = document.createElement('details');
    d.className = 'debug';
    const sum = document.createElement('summary');
    sum.textContent = 'Debug';
    d.appendChild(sum);

    if (m.debug) {
      const meta = document.createElement('div');
      meta.className = 'debug-meta';
      const dbg = m.debug;
      const parts = [
        `${dbg.provider || '?'} · ${dbg.model || '?'}`,
        `chars: ${(dbg.chars ?? (m.raw ? m.raw.length : 0)).toLocaleString()}`,
        dbg.bytes != null ? `bytes: ${dbg.bytes.toLocaleString()}` : null,
        dbg.events != null ? `events: ${dbg.events}` : null,
        dbg.finishReason ? `finish: ${dbg.finishReason}` : null,
        dbg.blockReason ? `blocked: ${dbg.blockReason}` : null,
        dbg.attachedSketch ? 'sketch attached' : null,
        dbg.error ? `error: ${dbg.error}` : null,
      ].filter(Boolean);
      meta.textContent = parts.join('  ·  ');
      d.appendChild(meta);
    }

    const pre = document.createElement('pre');
    pre.className = 'debug-raw';
    pre.textContent = m.raw && m.raw.length ? m.raw : '(model returned no text)';
    d.appendChild(pre);

    const copy = document.createElement('button');
    copy.className = 'btn btn-small';
    copy.textContent = 'Copy raw';
    copy.addEventListener('click', () => navigator.clipboard?.writeText(m.raw || ''));
    d.appendChild(copy);
    return d;
  }

  // --- streaming bubble -----------------------------------------------------
  setStreaming(chars) {
    if (!this.streamEl) {
      this.streamEl = document.createElement('div');
      this.streamEl.className = 'msg msg-ai msg-streaming';
      this.messagesEl.appendChild(this.streamEl);
    }
    this.streamEl.innerHTML = `<span class="spinner"></span> Building simulation… <span class="muted">${chars.toLocaleString()} chars</span>`;
    this._scrollToBottom();
  }
  clearStreaming() {
    if (this.streamEl) {
      this.streamEl.remove();
      this.streamEl = null;
    }
  }

  _scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
