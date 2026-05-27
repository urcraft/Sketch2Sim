import { PROVIDERS, MAX_OUTPUT_TOKENS } from '../config.js';
import { sseEvents, ensureOk, splitHistory } from './base.js';

function buildMessages(history, images) {
  const turns = splitHistory(history);
  const lastUserIdx = findLastUserIndex(turns);

  return turns.map((turn, i) => {
    if (turn.role === 'user' && i === lastUserIdx && images.length) {
      const content = [{ type: 'text', text: turn.text }];
      for (const img of images) {
        content.push({
          type: 'image',
          source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
        });
      }
      return { role: 'user', content };
    }
    return { role: turn.role, content: turn.text };
  });
}

function findLastUserIndex(turns) {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'user') return i;
  return -1;
}

export async function* streamMessage({ apiKey, model, system, history, images, signal }) {
  const res = await fetch(PROVIDERS.anthropic.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': PROVIDERS.anthropic.anthropicVersion,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: buildMessages(history, images),
      stream: true,
    }),
    signal,
  });

  await ensureOk(res, 'Anthropic');

  for await (const { data } of sseEvents(res)) {
    if (data === '[DONE]') break;
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
      yield json.delta.text;
    } else if (json.type === 'error') {
      throw new Error(json.error?.message || 'Anthropic stream error');
    }
  }
}
