// Settings modal: pick provider + model, store per-provider API keys.

import { PROVIDERS } from './config.js';
import * as storage from './storage.js';

export class Settings {
  constructor(root, { onChange } = {}) {
    this.root = root;
    this.onChange = onChange;

    this.providerSel = root.querySelector('#set-provider');
    this.modelSel = root.querySelector('#set-model');
    this.modelCustom = root.querySelector('#set-model-custom');
    this.keyInput = root.querySelector('#set-key');
    this.keyProviderLabel = root.querySelector('#set-key-provider');
    this.keyLink = root.querySelector('#set-key-link');
    this.keyHint = root.querySelector('#set-key-hint');
    this.note = root.querySelector('#set-note');

    // Populate provider options once.
    this.providerSel.innerHTML = '';
    for (const [id, p] of Object.entries(PROVIDERS)) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = p.label;
      this.providerSel.appendChild(opt);
    }

    this.providerSel.addEventListener('change', () => this._onProviderChange());
    root.querySelector('#set-save').addEventListener('click', () => this._save());
    root.querySelector('#set-cancel').addEventListener('click', () => this.close());
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close(); // backdrop click
    });
  }

  open(focusKey = false) {
    const settings = storage.getSettings() || {};
    this.providerSel.value = PROVIDERS[settings.provider] ? settings.provider : Object.keys(PROVIDERS)[0];
    this._onProviderChange(settings.model);
    this.root.hidden = false;
    if (focusKey) setTimeout(() => this.keyInput.focus(), 0);
  }

  close() {
    this.root.hidden = true;
  }

  _onProviderChange(preferredModel) {
    const id = this.providerSel.value;
    const p = PROVIDERS[id];
    const settings = storage.getSettings() || {};
    const currentModel = preferredModel || (settings.provider === id ? settings.model : p.defaultModel);

    // Models dropdown.
    this.modelSel.innerHTML = '';
    let matched = false;
    for (const m of p.models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.label;
      if (m.id === currentModel) {
        opt.selected = true;
        matched = true;
      }
      this.modelSel.appendChild(opt);
    }
    // If the stored model isn't a listed option, surface it in the custom field.
    this.modelCustom.value = !matched && currentModel ? currentModel : '';

    // Key + help for this provider.
    this.keyProviderLabel.textContent = p.label;
    this.keyInput.value = storage.getKey(id);
    this.keyLink.href = p.keyUrl;
    this.keyHint.textContent = p.keyHint || '';
    this.note.textContent = p.note || '';
  }

  _save() {
    const provider = this.providerSel.value;
    const model = this.modelCustom.value.trim() || this.modelSel.value;
    storage.setSettings({ provider, model });
    storage.setKey(provider, this.keyInput.value.trim());
    this.close();
    if (typeof this.onChange === 'function') this.onChange({ provider, model });
  }
}
