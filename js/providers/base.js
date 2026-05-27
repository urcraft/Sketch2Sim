// Shared helpers for provider adapters.
//
// Each adapter exports:
//   async function* streamMessage({ apiKey, model, system, history, images, signal })
//     -> yields incremental text strings (deltas).
//
// `history`: [{ role: 'user' | 'assistant', text }] in chronological order.
// `images`:  [{ mimeType, base64 }] to attach to the FINAL user turn (base64 has
//            no data-URL prefix). Usually 0 or 1 (the most recent sketch).

// Parse a fetch Response body as Server-Sent Events.
// Yields { event, data } objects (event may be null for data-only streams).
// If `meta` is passed, records `sseBytes` (raw bytes read) and `sseEvents`
// (events yielded) so an empty stream can be diagnosed after the fact: a 200
// with sseBytes>0 but no usable content is the provider returning nothing,
// not a parse failure.
export async function* sseEvents(response, meta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  // Event records are separated by a blank line. Gemini frames its stream with
  // CRLF (`\r\n\r\n`); OpenAI/Anthropic use LF (`\n\n`). Match all variants —
  // splitting only on `\n\n` silently drops every CRLF-framed event.
  const SEP = /\r\n\r\n|\n\n|\r\r/;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (meta && value) meta.sseBytes = (meta.sseBytes || 0) + value.byteLength;
    buffer += decoder.decode(value, { stream: true });

    let m;
    while ((m = SEP.exec(buffer))) {
      const block = buffer.slice(0, m.index);
      buffer = buffer.slice(m.index + m[0].length);
      const evt = parseEventBlock(block);
      if (evt) {
        if (meta) meta.sseEvents = (meta.sseEvents || 0) + 1;
        yield evt;
      }
    }
  }
  // Flush any final event that wasn't terminated by a trailing blank line.
  const last = parseEventBlock(buffer);
  if (last) {
    if (meta) meta.sseEvents = (meta.sseEvents || 0) + 1;
    yield last;
  }
}

function parseEventBlock(block) {
  let event = null;
  const dataLines = [];
  for (const line of block.split(/\r\n|\r|\n/)) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (!dataLines.length) return null;
  return { event, data: dataLines.join('\n') };
}

// Throw a readable error for a non-OK response (reads + parses the error body).
export async function ensureOk(response, providerLabel) {
  if (response.ok) return;
  let detail = '';
  try {
    const body = await response.text();
    try {
      const json = JSON.parse(body);
      detail = json.error?.message || json.message || JSON.stringify(json);
    } catch {
      detail = body;
    }
  } catch {
    /* ignore */
  }
  const hint =
    response.status === 401 || response.status === 403
      ? ' (check your API key in Settings)'
      : '';
  throw new Error(
    `${providerLabel} request failed: ${response.status} ${response.statusText}${hint}` +
      (detail ? ` — ${detail.slice(0, 500)}` : '')
  );
}

// Split history into the leading turns and the final user turn (the one images
// attach to). Drops any leading assistant turns so the list starts with a user.
export function splitHistory(history) {
  const trimmed = [...history];
  while (trimmed.length && trimmed[0].role !== 'user') trimmed.shift();
  return trimmed;
}
