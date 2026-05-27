// Controls the simulation iframe: injects generated HTML via srcdoc in a tight
// sandbox, shows loading/streaming state, and surfaces runtime errors the page
// reports back via postMessage.

const ERROR_BOOTSTRAP = `<script>(function(){function send(m){try{parent.postMessage({type:'sim-error',message:String(m)},'*');}catch(e){}}window.addEventListener('error',function(e){send((e.message||'Error')+(e.filename?(' @ '+e.filename+':'+(e.lineno||0)):''));});window.addEventListener('unhandledrejection',function(e){var r=e.reason;send('Unhandled rejection: '+((r&&r.message)||r));});})();</script>`;

function injectBootstrap(html) {
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch) {
    const idx = headMatch.index + headMatch[0].length;
    return html.slice(0, idx) + ERROR_BOOTSTRAP + html.slice(idx);
  }
  return ERROR_BOOTSTRAP + html;
}

export class SimulationView {
  constructor(root) {
    this.root = root;
    this.iframe = root.querySelector('#sim-frame');
    this.status = root.querySelector('#sim-status');
    this.placeholder = root.querySelector('#sim-placeholder');
    this.errorBox = root.querySelector('#sim-error');
    this.errorMsg = root.querySelector('#sim-error-msg');
    this.lastError = '';
    this.onFixRequest = null;

    const fixBtn = root.querySelector('#sim-fix-btn');
    if (fixBtn) {
      fixBtn.addEventListener('click', () => {
        if (typeof this.onFixRequest === 'function') this.onFixRequest(this.lastError);
      });
    }
    const closeBtn = root.querySelector('#sim-error-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.clearError());

    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'sim-error') this.showError(e.data.message || 'Unknown error');
    });
  }

  showLoading(text) {
    this.status.textContent = text || 'Generating…';
    this.status.hidden = false;
  }

  showStreaming(chars) {
    this.status.textContent = `Generating… ${chars.toLocaleString()} characters`;
    this.status.hidden = false;
  }

  setHtml(html) {
    this.clearError();
    this.status.hidden = true;
    this.placeholder.hidden = true;
    this.iframe.hidden = false;
    this.iframe.srcdoc = injectBootstrap(html);
  }

  reset() {
    this.iframe.srcdoc = '';
    this.iframe.hidden = true;
    this.status.hidden = true;
    this.placeholder.hidden = false;
    this.clearError();
  }

  showError(msg) {
    this.lastError = msg;
    this.status.hidden = true;
    this.errorMsg.textContent = msg;
    this.errorBox.hidden = false;
  }

  clearError() {
    this.errorBox.hidden = true;
    this.errorMsg.textContent = '';
  }
}
