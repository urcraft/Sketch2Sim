// Pull a full HTML document out of a model response.
// The model is told to emit a single ```html fence, but we also tolerate raw
// HTML or extra prose around it.

export function extractHtml(text) {
  if (!text) return null;

  // 1. Prefer a fenced code block (```html ... ``` or bare ``` ... ```).
  const fence = text.match(/```(?:html)?\s*\n?([\s\S]*?)```/i);
  let candidate = fence ? fence[1] : text;

  // 2. Narrow to the actual document if a doctype/<html> is present.
  const sliced = sliceToDocument(candidate);
  if (sliced) return sliced;

  // 3. Fallback: maybe the doctype lives outside the fence we picked.
  const slicedFromAll = sliceToDocument(text);
  if (slicedFromAll) return slicedFromAll;

  // 4. Last resort: return the fenced content trimmed (could be a fragment).
  const trimmed = candidate.trim();
  return trimmed || null;
}

function sliceToDocument(str) {
  if (!str) return null;
  const lower = str.toLowerCase();
  let start = lower.indexOf('<!doctype');
  if (start === -1) start = lower.indexOf('<html');
  if (start === -1) return null;

  let end = lower.lastIndexOf('</html>');
  end = end === -1 ? str.length : end + '</html>'.length;
  return str.slice(start, end).trim();
}
