// Minimal MS-Paint-like canvas: pen, straight line, text, eraser, color,
// stroke width, undo, clear. Exports the drawing as a PNG data URL.

export class SketchPad {
  constructor(root) {
    this.root = root;
    this.canvas = root.querySelector('#sketch-canvas');
    this.wrap = root.querySelector('#sketch-canvas-wrap');
    this.ctx = this.canvas.getContext('2d');

    this.tool = 'pen';
    this.color = '#1f2937';
    this.width = 3;
    this.dirty = false;
    this.onChange = null; // called after any committed change

    this.drawing = false;
    this.startPt = null;
    this.previewBase = null; // ImageData snapshot for line preview
    this.undoStack = [];
    this.maxUndo = 25;

    this._sizeToContainer(true);
    this._bindTools();
    this._bindDrawing();
    this._bindResize();
  }

  // --- sizing ---------------------------------------------------------------
  _sizeToContainer(initial = false) {
    const rect = this.wrap.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (!initial && this.canvas.width === w && this.canvas.height === h) return;

    // Preserve existing drawing across resizes.
    const prev = initial ? null : this.canvas.toDataURL();
    const pw = this.canvas.width;
    const ph = this.canvas.height;
    this.canvas.width = w;
    this.canvas.height = h;
    this._fillWhite();
    if (prev && pw && ph) {
      const img = new Image();
      img.onload = () => this.ctx.drawImage(img, 0, 0); // anchor top-left, no distortion
      img.src = prev;
    }
  }

  _fillWhite() {
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  _bindResize() {
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._sizeToContainer(false));
      this._ro.observe(this.wrap);
    } else {
      window.addEventListener('resize', () => this._sizeToContainer(false));
    }
  }

  // --- tools ----------------------------------------------------------------
  _bindTools() {
    this.root.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => this._setTool(btn.getAttribute('data-tool')));
    });

    const colorInput = this.root.querySelector('#sketch-color');
    if (colorInput) {
      this.color = colorInput.value || this.color;
      colorInput.addEventListener('input', () => {
        this.color = colorInput.value;
        if (this.tool === 'eraser') this._setTool('pen');
      });
    }

    this.root.querySelectorAll('.swatch').forEach((sw) => {
      sw.addEventListener('click', () => {
        this.color = sw.getAttribute('data-color');
        if (colorInput) colorInput.value = this.color;
        if (this.tool === 'eraser') this._setTool('pen');
      });
    });

    const widthInput = this.root.querySelector('#sketch-width');
    if (widthInput) {
      this.width = Number(widthInput.value) || this.width;
      widthInput.addEventListener('input', () => {
        this.width = Number(widthInput.value);
      });
    }

    const undoBtn = this.root.querySelector('#sketch-undo');
    if (undoBtn) undoBtn.addEventListener('click', () => this.undo());
    const clearBtn = this.root.querySelector('#sketch-clear');
    if (clearBtn) clearBtn.addEventListener('click', () => this.clear());

    this._setTool('pen');
  }

  _setTool(tool) {
    this.tool = tool;
    this.root.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });
    this.canvas.style.cursor = tool === 'text' ? 'text' : 'crosshair';
  }

  // --- undo -----------------------------------------------------------------
  _pushUndo() {
    try {
      this.undoStack.push(this.canvas.toDataURL());
      if (this.undoStack.length > this.maxUndo) this.undoStack.shift();
    } catch {
      /* tainted canvas should not happen here */
    }
  }

  undo() {
    const url = this.undoStack.pop();
    if (!url) {
      this._fillWhite();
      this.dirty = false;
      this._changed();
      return;
    }
    const img = new Image();
    img.onload = () => {
      this._fillWhite();
      this.ctx.drawImage(img, 0, 0);
      this._changed();
    };
    img.src = url;
  }

  clear() {
    this._pushUndo();
    this._fillWhite();
    this.dirty = false;
    this._changed();
  }

  // --- drawing --------------------------------------------------------------
  _bindDrawing() {
    this.canvas.addEventListener('pointerdown', (e) => this._onDown(e));
    this.canvas.addEventListener('pointermove', (e) => this._onMove(e));
    window.addEventListener('pointerup', (e) => this._onUp(e));
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (this.canvas.width / r.width),
      y: (e.clientY - r.top) * (this.canvas.height / r.height),
    };
  }

  _strokeStyle() {
    const eraser = this.tool === 'eraser';
    this.ctx.strokeStyle = eraser ? '#ffffff' : this.color;
    this.ctx.lineWidth = eraser ? Math.max(this.width * 4, 14) : this.width;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  _onDown(e) {
    const pt = this._pos(e);

    if (this.tool === 'text') {
      this._startTextInput(pt, e);
      return;
    }

    this._pushUndo();
    this.drawing = true;
    this.startPt = pt;
    this.canvas.setPointerCapture?.(e.pointerId);

    if (this.tool === 'line') {
      this.previewBase = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    } else {
      this._strokeStyle();
      this.ctx.beginPath();
      this.ctx.moveTo(pt.x, pt.y);
      // dot for a single click
      this.ctx.lineTo(pt.x + 0.01, pt.y + 0.01);
      this.ctx.stroke();
    }
  }

  _onMove(e) {
    if (!this.drawing) return;
    const pt = this._pos(e);

    if (this.tool === 'line') {
      this.ctx.putImageData(this.previewBase, 0, 0);
      this._strokeStyle();
      this.ctx.beginPath();
      this.ctx.moveTo(this.startPt.x, this.startPt.y);
      this.ctx.lineTo(pt.x, pt.y);
      this.ctx.stroke();
    } else {
      this._strokeStyle();
      this.ctx.lineTo(pt.x, pt.y);
      this.ctx.stroke();
    }
  }

  _onUp() {
    if (!this.drawing) return;
    this.drawing = false;
    this.previewBase = null;
    this.dirty = true;
    this._changed();
  }

  _startTextInput(pt, e) {
    const existing = this.root.querySelector('.sketch-text-input');
    if (existing) existing.remove();

    const wrapRect = this.wrap.getBoundingClientRect();
    const input = document.createElement('input');
    input.className = 'sketch-text-input';
    input.type = 'text';
    const fontSize = Math.max(14, this.width * 5);
    Object.assign(input.style, {
      position: 'absolute',
      left: `${e.clientX - wrapRect.left}px`,
      top: `${e.clientY - wrapRect.top}px`,
      fontSize: `${fontSize}px`,
      fontFamily: 'sans-serif',
      color: this.color,
      caretColor: this.color,
    });
    this.wrap.appendChild(input);

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const value = input.value;
      input.remove();
      if (!value) return;
      this._pushUndo();
      this.ctx.fillStyle = this.color;
      this.ctx.textBaseline = 'top';
      this.ctx.font = `${fontSize}px sans-serif`;
      this.ctx.fillText(value, pt.x, pt.y);
      this.dirty = true;
      this._changed();
    };

    input.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commit();
      } else if (ev.key === 'Escape') {
        done = true;
        input.remove();
      }
    });

    // Focus AFTER the current pointer sequence settles, then start listening for
    // blur. Focusing synchronously inside pointerdown gets stolen by the pointer
    // event, which would blur+remove the input before the user can type.
    setTimeout(() => {
      input.focus();
      input.addEventListener('blur', commit);
    }, 0);
  }

  _changed() {
    if (typeof this.onChange === 'function') this.onChange();
  }

  // --- public ---------------------------------------------------------------
  hasContent() {
    return this.dirty;
  }

  export() {
    return this.canvas.toDataURL('image/png');
  }
}
