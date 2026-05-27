import { PROVIDERS } from '../config.js';
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

export async function* streamMessage({ apiKey, model, system, history, images, signal, meta = {} }) {
  const url = `${PROVIDERS.gemini.endpoint}/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: buildContents(history, images),
  };
  // Omitted by default so the model uses its full output capacity.
  if (PROVIDERS.gemini.maxOutputTokens) {
    body.generationConfig = { maxOutputTokens: PROVIDERS.gemini.maxOutputTokens };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
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
    if (json.promptFeedback?.blockReason) meta.blockReason = json.promptFeedback.blockReason;
    const cand = json.candidates?.[0];
    if (cand?.finishReason) meta.finishReason = cand.finishReason;
    if (json.usageMetadata) meta.usage = json.usageMetadata;
    const parts = cand?.content?.parts;
    if (Array.isArray(parts)) {
      // Skip "thought" parts — they are internal reasoning, not the answer.
      for (const p of parts) if (p.text && !p.thought) yield p.text;
    }
  }
}
