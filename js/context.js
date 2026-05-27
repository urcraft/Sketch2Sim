// Assemble a provider-neutral request from a session.
//
// Strategy (per design): send the full TEXT history (user + assistant) plus the
// MOST RECENT sketch image plus the MOST RECENT generated HTML. Older bulky
// payloads are collapsed so token use stays bounded.

import { MAX_TEXT_TURNS } from './config.js';

export function buildRequest(session, systemPrompt) {
  const messages = session?.messages || [];

  // Most recent attached sketch anywhere in history.
  let latestImage = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sketchDataURL) {
      latestImage = parseDataUrl(messages[i].sketchDataURL);
      break;
    }
  }

  // Most recent generated HTML, used so the model can "modify, don't replace".
  let latestHtml = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant' && messages[i].html) {
      latestHtml = messages[i].html;
      break;
    }
  }

  // Neutral text history; assistant HTML collapsed to a short marker.
  let history = messages.map((m) => {
    if (m.role === 'assistant') {
      return { role: 'assistant', text: '[Previously generated a simulation.]' };
    }
    let text = (m.text || '').trim();
    if (!text) {
      text = m.sketchDataURL
        ? 'Build a simulation based on the attached sketch.'
        : '(no message)';
    }
    return { role: 'user', text };
  });

  if (history.length > MAX_TEXT_TURNS) {
    history = history.slice(history.length - MAX_TEXT_TURNS);
  }

  // Attach the latest HTML to the final user turn.
  if (latestHtml) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') {
        history[i] = {
          role: 'user',
          text:
            `${history[i].text}\n\n---\nHere is the current simulation HTML. Modify it to satisfy the request above rather than rewriting from scratch:\n\n${latestHtml}`,
        };
        break;
      }
    }
  }

  return {
    system: systemPrompt,
    history,
    images: latestImage ? [latestImage] : [],
  };
}

function parseDataUrl(dataUrl) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl || '');
  return m ? { mimeType: m[1], base64: m[2] } : null;
}
