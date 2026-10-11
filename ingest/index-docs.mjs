import { readFile, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkMarkdown } from './chunk.mjs';
import { buildIndex, clearIndex } from '../rag/store.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const docsDir = join(root, 'knowledge');

async function main() {
  const files = (await readdir(docsDir, { withFileTypes: true }).catch(() => []))
    .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
    .map(entry => entry.name).sort();
  if (!files.length) { await clearIndex(); console.log('knowledge/ 里没有 .md 文件，已清空旧索引'); return; }

  console.log(`找到 ${files.length} 份文档`);
  const allChunks = [];
  for (const file of files) {
    const text = await readFile(join(docsDir, file), 'utf8');
    const docId = basename(file, '.md');
    const chunks = chunkMarkdown(text, docId, docId);
    allChunks.push(...chunks);
    console.log(`  ${file}: ${chunks.length} 片段`);
  }
  console.log(`共 ${allChunks.length} 个片段`);
  if (!allChunks.length) { await clearIndex(); console.log('文档无可索引内容，已清空旧索引。'); return; }
  await buildIndex(allChunks);
  console.log('建库完成');
}

main().catch(error => { console.error('建库失败：', error.message); process.exitCode = 1; });


