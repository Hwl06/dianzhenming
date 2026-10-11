// 小型本机向量存储：JSON 持久化 + 余弦相似度，适合当前演示知识库。
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { embed, getEmbeddingMode, getModelId } from './embed.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
export const indexPath = resolve(root, 'data/vectors/index.json');
const tempPath = indexPath + '.tmp';

function validVector(vector) {
  return Array.isArray(vector) && vector.length > 0 && vector.every(Number.isFinite);
}

export async function buildIndex(chunks) {
  const records = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    process.stdout.write(`\r向量化 ${i + 1}/${chunks.length} …`);
    records.push({
      id: chunk.id,
      vector: await embed(chunk.text),
      metadata: { ...chunk.meta, text: chunk.text }
    });
  }
  if (chunks.length) console.log();
  await mkdir(dirname(indexPath), { recursive: true });
  const contents = JSON.stringify({
    format: 1,
    embeddingMode: getEmbeddingMode(),
    model: getModelId(),
    createdAt: new Date().toISOString(),
    records
  });
  await writeFile(tempPath, contents, 'utf8');
  await rename(tempPath, indexPath);
  console.log(`已写入向量库：${records.length} 条`);
}

export async function search(query, topK = 5) {
  let index;
  try { index = JSON.parse(await readFile(indexPath, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  if (index?.format !== 1 || !Array.isArray(index.records) || !index.records.length) return [];

  const queryVector = await embed(query, { forceFallback: index.embeddingMode === 'ngram-fallback' });
  const results = [];
  for (const record of index.records) {
    if (!validVector(record.vector) || record.vector.length !== queryVector.length) continue;
    let score = 0;
    for (let i = 0; i < queryVector.length; i++) score += queryVector[i] * record.vector[i];
    if (Number.isFinite(score)) results.push({ id: record.id, score, metadata: record.metadata || {} });
  }
  return results.sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(20, topK)));
}

export async function clearIndex() {
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(tempPath, JSON.stringify({ format: 1, records: [] }), 'utf8');
  await rename(tempPath, indexPath);
}



