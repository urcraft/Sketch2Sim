// Lightweight, idempotent post-processing of generated HTML (paper §A.6).
// Strictly additive: we never modify tags the model produced. We only fill in
// universal safety nets (charset + viewport meta) and strip stray fence
// markers the extractor may have missed. If anything goes wrong we return
// the original HTML untouched.

export function postProcess(html) {
  if (!html) return html;
  try {
    let out = html;

    // 1. Strip a stray trailing ``` (the extractor handles fenced blocks but
    //    some replies tack on an extra closing fence after </html>).
    out = out.replace(/\s*```\s*$/g, '');

    // 2. Ensure a UTF-8 charset meta exists.
    if (!/<meta[^>]+charset/i.test(out)) {
      out = insertInHead(out, '<meta charset="UTF-8">');
    }

    // 3. Ensure a viewport meta exists so the sim scales sensibly on tablets
    //    and projectors.
    if (!/<meta[^>]+name=["']viewport["']/i.test(out)) {
      out = insertInHead(out, '<meta name="viewport" content="width=device-width, initial-scale=1.0">');
    }

    return out;
  } catch {
    return html;
  }
}

function insertInHead(html, tag) {
  const m = /<head[^>]*>/i.exec(html);
  if (m) {
    const idx = m.index + m[0].length;
    return html.slice(0, idx) + '\n  ' + tag + html.slice(idx);
  }
  // No <head>: nothing safe to do here — leave the doc alone.
  return html;
}
