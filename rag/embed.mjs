// 中文向量封装。优先使用 BGE；模型网络不可用时回退到确定性的本机字符 n-gram 向量。
const DEFAULT_MODEL_ID = 'Xenova/bge-small-zh-v1.5';
function getModelId() { return process.env.EMBEDDING_MODEL || DEFAULT_MODEL_ID; }
const FALLBACK_DIM = 384;
let extractorPromise;
let modelUnavailable = false;
let mode = 'bge';

function hashToken(token) {
  let hash = 2166136261;
  for (const char of token) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function ngramEmbedding(text) {
  const normalized = text.normalize('NFKC').toLowerCase();
  const features = [];
  const words = normalized.match(/[a-z0-9-]+|[\u3400-\u9fff]+/g) || [];
  for (const word of words) {
    if (/^[\u3400-\u9fff]+$/.test(word)) {
      for (const char of word) features.push('c:' + char);
      for (let i = 0; i < word.length - 1; i++) features.push('b:' + word.slice(i, i + 2));
      for (let i = 0; i < word.length - 2; i++) features.push('t:' + word.slice(i, i + 3));
    } else features.push('w:' + word);
  }
  const vector = new Array(FALLBACK_DIM).fill(0);
  for (const feature of features) {
    const hash = hashToken(feature);
    const slot = hash % FALLBACK_DIM;
    vector[slot] += (hash & 0x80000000) ? -1 : 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map(value => value / norm);
}

async function bgeEmbedding(text) {
  if (!extractorPromise) {
    console.log('正在加载中文向量模型 ' + getModelId() + '（首次运行需要下载）…');
    extractorPromise = import('@huggingface/transformers')
      .then(({ pipeline }) => pipeline('feature-extraction', getModelId(), { dtype: 'q8' }));
  }
  const model = await extractorPromise;
  const output = await model(text, { pooling: 'mean', normalize: true });
  const vector = Array.from(output.data, Number);
  if (!vector.length || vector.some(value => !Number.isFinite(value))) throw new Error('模型返回了无效向量');
  return vector;
}

export async function embed(text, options = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new TypeError('embed(text) 需要非空文本');
  const normalized = text.trim();
  if (options.forceFallback || process.env.EMBEDDING_MODE === 'ngram' || mode === 'ngram-fallback' || modelUnavailable) return ngramEmbedding(normalized);
  try {
    const vector = await bgeEmbedding(normalized);
    mode = 'bge';
    return vector;
  } catch (error) {
    modelUnavailable = true;
    mode = 'ngram-fallback';
    console.warn('BGE 模型当前不可用，改用本地 n-gram 检索向量：' + (error?.message || error));
    return ngramEmbedding(normalized);
  }
}

export function getEmbeddingMode() { return mode; }
export { getModelId };



