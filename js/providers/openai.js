import { PROVIDERS } from '../config.js';
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

export async function* streamMessage({ apiKey, model, system, history, images, signal, meta = {} }) {
  const body = {
    model,
    messages: buildMessages(system, history, images),
    stream: true,
  };
  // Newer models reject `max_tokens`; the current name is `max_completion_tokens`.
  // Omitted by default so the model uses its full output capacity.
  if (PROVIDERS.openai.maxOutputTokens) body.max_completion_tokens = PROVIDERS.openai.maxOutputTokens;

  const res = await fetch(PROVIDERS.openai.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  await ensureOk(res, 'OpenAI');

  for await (const { data } of sseEvents(res, meta)) {
    if (data === '[DONE]') break;
    let json;
    try {
      json = JSON.parse(data);
    } catch {
      continue;
    }
    const choice = json.choices?.[0];
    if (choice?.delta?.content) yield choice.delta.content;
    if (choice?.finish_reason) meta.finishReason = choice.finish_reason;
  }
}
