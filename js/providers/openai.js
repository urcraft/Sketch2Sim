import { PROVIDERS, MAX_OUTPUT_TOKENS } from '../config.js';
import { sseEvents, ensureOk, splitHistory } from './base.js';

function buildMessages(system, history, images) {
  const turns = splitHistory(history);
  const lastUserIdx = findLastUserIndex(turns);
  const messages = [{ role: 'system', content: system }];

  turns.forEach((turn, i) => {
    if (turn.role === 'user' && i === lastUserIdx && images.length) {
      const content = [{ type: 'text', text: turn.text }];
      for (const img of images) {
        content.push({
          type: 'image_url',
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        });
      }
      messages.push({ role: 'user', content });
    } else {
      messages.push({ role: turn.role, content: turn.text });
    }
  });

  return messages;
}

function findLastUserIndex(turns) {
  for (let i = turns.length - 1; i >= 0; i--) if (turns[i].role === 'user') return i;
  return -1;
}

export async function* streamMessage({ apiKey, model, system, history, images, signal }) {
  const res = await fetch(PROVIDERS.openai.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(system, history, images),
      max_tokens: MAX_OUTPUT_TOKENS,
      stream: true,
    }),
    signal,
  });

  await ensureOk(res, 'OpenAI');

  for await (const { data } of sseEvents(res)) {
    if (data === '[DONE]') break;
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    const delta = json.choices?.[0]?.delta?.content;
    if (delta) yield delta;
  }
}
