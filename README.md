# Sketch2Sim

Sketch an idea — or describe it in chat — and an LLM builds a complete, interactive
**2D simulation** (physics, math, chemistry, etc.) for school students, rendered live in
the page. A static site: no backend, no build step. Your API key stays in your browser and
is sent directly to the provider you choose.

The approach is inspired by Google Research's **"Generative UI: LLMs are Effective UI
Generators"** (the model emits a full, self-contained interactive HTML page) and Simon
Willison's browser-tools pattern (call the model API directly from the browser, key in
`localStorage`, render the result in a sandboxed iframe).

## Layout

- **Left** — Chat: multi-turn history per session, a session switcher, and a clearly-labeled
  **Attach sketch** toggle (with a thumbnail of what will be sent).
- **Top right** — Sketch: a minimal MS-Paint-style canvas (pen, straight line, text, eraser,
  colors, stroke width, undo, clear). Fullscreen button.
- **Bottom right** — Simulation: the model's generated page, sandboxed. Fullscreen button.
  Runtime errors are caught and you can ask the AI to fix them.

## Use it

1. Open the page. On first run you'll be asked to choose a **provider + model** and paste an
   **API key** (Settings ⚙ anytime).
   - **Anthropic (Claude)** — officially supports direct browser calls. Recommended.
   - **Google Gemini** — works directly from the browser.
   - **OpenAI** — works in many cases, but OpenAI doesn't officially support browser calls; a
     CORS error means you'd need a proxy.
2. Sketch your idea and/or type a description. Toggle **Attach sketch** to send the drawing.
3. Press **Send** (or ⌘/Ctrl+Enter). The simulation appears bottom-right.
4. Iterate: "make gravity stronger", "add a velocity slider" — the model modifies the
   existing simulation rather than starting over.

Each turn sends the full text conversation, the most recent sketch, and the most recent
generated HTML so follow-up edits work. Keys, settings, and session history live in your
browser's `localStorage` only.

## Run locally

ES modules require an `http://` origin (not `file://`):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy (GitHub Pages)

`.github/workflows/pages.yml` deploys the repo root to Pages on every push to `main`.
One-time setup: **Settings → Pages → Build and deployment → Source = "GitHub Actions"**.

## Files

```
index.html            app shell (CSS-grid layout, settings modal)
css/styles.css        styling
js/app.js             orchestrator
js/config.js          provider + model registry, endpoints, constants
js/storage.js         localStorage layer
js/sessions.js        session/message state
js/context.js         builds the per-turn request (history + latest sketch + latest HTML)
js/systemPrompt.js    the system prompt
js/html-extract.js    pulls the HTML document out of the model reply
js/sketch.js          canvas controller
js/simulation.js      sandboxed iframe + error capture
js/settings.js        settings modal
js/chat.js            chat UI
js/providers/         anthropic.js, openai.js, gemini.js + base.js (SSE) + index.js
```
