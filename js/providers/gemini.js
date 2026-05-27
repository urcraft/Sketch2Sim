import { PROVIDERS, MAX_OUTPUT_TOKENS } from '../config.js';
import { sseEvents, ensureOk, splitHistory } from './base.js';

function buildContents(history, images) {
  const turns = splitHistory(history);
  const lastUserIdx = findLastUserIndex(turns);

  return turns.map((turn, i) => {
    const role = turn.role === 'assistant' ? 'model' : 'user';
    const parts = [{ text: turn.text }];
    if (turn.role === 'user' && i === lastUserIdx && images.length) {
      for (const img of images) {
        parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
      }
    }
    return { role, parts };
  });
}

function findLastUserIndex(turns) {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'user') return i;
  return -1;
}

export async function* streamMessage({ apiKey, model, system, history, images, signal }) {
  const url = `${PROVIDERS.gemini.endpoint}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: buildContents(history, images),
      generationConfig: { maxOutputTokens: MAX_OUTPUT_TOKENS },
    }),
    signal,
  });

  await ensureOk(res, 'Gemini');

  for await (const { data } of sseEvents(res)) {
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    const parts = json.candidates?.[0]?.content?.parts;
    if (Array.isArray(parts)) {
      for (const p of parts) if (p.text) yield p.text;
    }
  }
}
