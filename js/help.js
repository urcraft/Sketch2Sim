// Help / onboarding modal. Shown once on first run and reopenable via the "?"
// icon. Renders the provider key links from config, and a set of example
// prompts whose buttons open a fresh chat with the text pre-filled (never sent
// automatically — the user edits or attaches a sketch first).

import { PROVIDERS } from './config.js';

const EXAMPLES = [
  {
    group: 'Physics',
    items: [
      { label: 'Projectile launcher', text: 'A projectile launched from a cannon — sliders for launch angle and speed, show the trajectory arc, range, and max height. Add a Reset button.' },
      { label: '1D collisions', text: 'Two balls colliding in 1D with adjustable masses and a coefficient-of-restitution slider; display momentum and kinetic energy before and after.' },
      { label: 'Pendulum', text: 'A simple pendulum with adjustable length and gravity, showing the period and a live energy bar (kinetic vs potential).' },
      { label: 'Mass on a spring', text: 'A mass on a spring (simple harmonic motion) with mass and stiffness sliders, plus a real-time position-vs-time graph.' },
    ],
  },
  {
    group: 'Math',
    items: [
      { label: 'Unit circle', text: 'An interactive unit circle: drag the angle and show sin, cos, and tan as the point moves, with the values updating live.' },
      { label: 'Sine wave explorer', text: 'Plot y = a·sin(bx + c) with sliders for a, b, and c so students can see how each parameter changes the wave.' },
      { label: 'Riemann sums', text: 'Visualize the area under a curve with Riemann sums — a slider for the number of rectangles converging to the true integral.' },
    ],
  },
  {
    group: 'Chemistry & Biology',
    items: [
      { label: 'Ideal gas', text: 'An ideal gas in a box: sliders for temperature and volume showing particle speed and pressure (kinetic theory).' },
      { label: 'Predator & prey', text: 'Predator–prey population dynamics (foxes and rabbits) with adjustable birth/death rates and a live population graph.' },
      { label: 'pH scale', text: 'A pH scale visualizer: a slider from 0–14 that colors a solution and labels common substances along the way.' },
    ],
  },
];

export class Help {
  constructor(root, { onTryExample, onOpenSettings } = {}) {
    this.root = root;
    this.onTryExample = onTryExample;
    this.onOpenSettings = onOpenSettings;

    this._renderKeyLinks();
    this._renderExamples();

    root.querySelector('#help-x').addEventListener('click', () => this.close());
    root.querySelector('#help-got-it').addEventListener('click', () => this.close());
    root.querySelector('#help-open-settings').addEventListener('click', () => {
      this.close();
      this.onOpenSettings?.();
    });
    root.addEventListener('click', (e) => {
      if (e.target === root) this.close(); // backdrop click
    });
  }

  open() {
    this.root.hidden = false;
  }
  close() {
    this.root.hidden = true;
  }

  _renderKeyLinks() {
    const ul = this.root.querySelector('#help-key-links');
    ul.innerHTML = '';
    for (const p of Object.values(PROVIDERS)) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = p.keyUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = `${p.label} — get a key →`;
      li.appendChild(a);
      ul.appendChild(li);
    }
  }

  _renderExamples() {
    const wrap = this.root.querySelector('#help-examples');
    wrap.innerHTML = '';
    for (const { group, items } of EXAMPLES) {
      const g = document.createElement('div');
      g.className = 'help-eg-group';
      const title = document.createElement('div');
      title.className = 'help-eg-title';
      title.textContent = group;
      g.appendChild(title);

      const row = document.createElement('div');
      row.className = 'help-eg-buttons';
      for (const ex of items) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-small example-btn';
        btn.textContent = ex.label;
        btn.title = ex.text;
        btn.addEventListener('click', () => {
          this.close();
          this.onTryExample?.(ex.text);
        });
        row.appendChild(btn);
      }
      g.appendChild(row);
      wrap.appendChild(g);
    }
  }
}
