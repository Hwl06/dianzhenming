import { search } from './rag/store.mjs';

const args = process.argv.slice(2);
if (args[0] === '--') args.shift();
const query = args.join(' ') || '电机嗡嗡响转速上不去';
console.log(`查询：${query}\n`);
const results = await search(query, 3);
if (!results.length) {
  console.log('索引为空。先运行 npm run build-rag。');
  process.exitCode = 1;
} else {
  for (const result of results) {
    console.log(`--- 相关度 ${result.score.toFixed(3)} ---`);
    console.log(`来源：${result.metadata.title}`);
    console.log(result.metadata.text.slice(0, 240));
    console.log();
  }
}

