// 先按 Markdown 二级标题分章，再按段落切成小块，超长段落采用重叠窗口。
const MAX_CHARS = 700;
const MIN_CHARS = 20;

export function chunkMarkdown(text, docId, docTitle) {
  const normalized = String(text ?? '').replace(/\r\n?/g, '\n').trim();
  if (!normalized) return [];
  const sections = normalized.split(/\n(?=##\s)/);
  const chunks = [];
  for (const section of sections) {
    const body = section.trim();
    if (body.length < MIN_CHARS) continue;
    const paragraphs = body.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    let buffer = '';
    for (const paragraph of paragraphs) {
      if (paragraph.length > MAX_CHARS) {
        if (buffer) { chunks.push(makeChunk(buffer, docId, docTitle, chunks.length)); buffer = ''; }
        for (let start = 0; start < paragraph.length; start += MAX_CHARS - 80) {
          const slice = paragraph.slice(start, start + MAX_CHARS).trim();
          if (slice.length >= MIN_CHARS) chunks.push(makeChunk(slice, docId, docTitle, chunks.length));
        }
        continue;
      }
      const candidate = buffer ? buffer + '\n\n' + paragraph : paragraph;
      if (candidate.length > MAX_CHARS && buffer) {
        chunks.push(makeChunk(buffer, docId, docTitle, chunks.length));
        buffer = paragraph;
      } else buffer = candidate;
    }
    if (buffer.length >= MIN_CHARS) chunks.push(makeChunk(buffer, docId, docTitle, chunks.length));
  }
  return chunks;
}

function makeChunk(text, docId, docTitle, index) {
  return { id: `${docId}-${index}`, text: text.trim(), meta: { doc_id: docId, title: docTitle, chunk_index: index } };
}

