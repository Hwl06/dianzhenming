从头到尾详细步骤：给电诊明接 RAG
先回答你的关键问题
同一个项目文件夹，不是新建项目。

在你现有的 电诊明 文件夹里，新增几个子文件夹（rag/、ingest/、knowledge/、data/vectors/），修改 3 个已有文件（server.mjs、app.mjs、index.html）。

不要另起炉灶新建项目，否则你的规则、安全逻辑、前端都要重写。

最终文件夹长这样
text
电诊明/                          ← 你现在这个文件夹
├── knowledge/                   ← 【新增】放资料
│   └── seed.md                  ← 先用你自己写的测试资料
├── rag/                         ← 【新增】RAG 核心代码
│   ├── embed.mjs                ← 文字转向量
│   └── store.mjs                ← 向量库操作
├── ingest/                      ← 【新增】建库脚本
│   ├── chunk.mjs                ← 切片逻辑
│   └── index-docs.mjs           ← 一键建库
├── scripts/                     ← 【新增】辅助脚本
│   └── rules-to-docs.mjs        ← 把 rules.mjs 导出成资料
├── data/                        ← 【已有或新增】
│   ├── vectors/                 ← 【新增】向量数据（自动生成）
│   ├── history.jsonl            ← 已有
│   └── server.log               ← 已有
├── package.json                 ← 【新增】npm 配置
├── test-rag.mjs                 ← 【新增】测试检索
├── rules.mjs                    ← 不动
├── server.mjs                   ← 【修改】集成 RAG
├── app.mjs                      ← 【修改】展示引用
├── index.html                   ← 【修改】加引用样式
└── smoke-test.mjs               ← 不动
第 1 步：检查环境
打开 PowerShell，进入你的项目目录：

powershell
cd "你的电诊明文件夹路径"
确认 Node.js 版本：

powershell
node -v
必须 ≥ 18。如果是 16 或更低，先去 nodejs.org 装新版。

确认目录里有这些文件：

powershell
dir
应该能看到 server.mjs、rules.mjs、app.mjs、index.html。

第 2 步：新建文件夹
powershell
mkdir knowledge, rag, ingest, scripts, data\vectors
注意：data 可能已经存在（因为你之前的方案会生成），那就只建 data\vectors。

如果 PowerShell 报“已存在”，忽略即可。

第 3 步：初始化 npm 并安装依赖
3.1 创建 package.json
powershell
npm init -y
这会生成一个 package.json。

3.2 修改 package.json
用记事本或 VS Code 打开 package.json，把 "type" 加上（如果没有的话）：

json
{
  "name": "dianzhenming",
  "version": "1.0.6",
  "type": "module",
  "private": true,
  "scripts": {
    "start": "node server.mjs",
    "build-rag": "node ingest/index-docs.mjs",
    "test-rag": "node test-rag.mjs",
    "smoke": "node smoke-test.mjs"
  }
}
"type": "module" 很重要，没有它 .mjs 文件里的 import 会报错。

3.3 安装 3 个依赖
powershell
npm install @xenova/transformers mini-vector-db
说明：

@xenova/transformers：本地跑 BGE 中文向量模型

mini-vector-db：嵌入式向量数据库

不装 pdf-parse，因为你现在没 PDF，先用 Markdown，等有 PDF 再装

第一次安装可能慢，等 1-3 分钟。

装完后 node_modules/ 会出现在项目里，package.json 里会多出 dependencies。

第 4 步：先造一份测试资料
你手边没资料，就先自己写一份。 打开记事本，新建文件 knowledge/seed.md，粘贴以下内容：

md
# 电诊明测试知识库

## 电机嗡嗡响转速上不去

现象：三相异步电动机启动后发出嗡嗡声，转速上不去，外壳温度偏高。

可能原因：
- 负载卡滞或泵/风机阻力过大
- 三相电流不平衡，可能存在接线或绕组问题
- 散热通道堵塞导致温升异常

排查步骤：
1. 断电后手动确认联轴器/负载无卡滞
2. 核对三相端子紧固状态
3. 空载与带载分别测量三相电流并比较
4. 检查风道、风扇和热继电器整定值

安全提醒：测量前必须验电；旋转部件未完全停止前不得靠近或拆护罩。

升级条件：三相电流差异明显、绝缘测试异常或温升持续上升时停机报修。

## 电机三相电流不平衡

现象：三相异步电动机三相电流偏差超过 15%，某一相明显偏高。

可能原因：
- 接线端子松动，接触电阻升高
- 绕组匝间短路或对地绝缘下降
- 电源侧三相电压不平衡

排查步骤：
1. 断电验电后，检查三相端子紧固状态和变色痕迹
2. 用万用表测三相绕组直流电阻，比较是否平衡
3. 用兆欧表测绕组对地绝缘电阻
4. 检查电源侧三相电压是否平衡

安全提醒：测量绝缘必须断电验电，测量后必须放电。

升级条件：绕组电阻差异超过 5%、绝缘电阻低于 0.5MΩ 时停机检修。

## 变频器加速过流 E-OC

现象：变频器加速过程中突然停机，面板显示 E-OC。

可能原因：
- 加速时间过短或转矩提升过高
- 电机/负载机械阻力突增
- 电机参数与变频器设置不匹配

排查步骤：
1. 确认停机后检查负载是否卡滞
2. 核对电机铭牌参数与变频器自学习设置
3. 将加速时间逐步延长并观察电流趋势
4. 检查输出电缆绝缘和接地

安全提醒：变频器断电后仍可能残留直流母线电压，等待规定放电时间并验电。

升级条件：若空载仍过流或保护重复触发，停止试机并交专业人员处理。

## 配电柜端子发热

现象：低压配电柜接线端子附近温度偏高，柜内出现间歇性嗡嗡声。

可能原因：
- 端子螺栓松动或压接不良
- 负载偏大或三相不平衡
- 柜内散热不良

排查步骤：
1. 停电、验电后检查端子压接和变色痕迹
2. 按规定力矩复紧连接点
3. 记录各相电流并检查负载分配
4. 复电后用红外测温复核温升

安全提醒：柜内作业必须执行停电验电和挂牌上锁；不得仅凭声音判断可继续运行。

升级条件：端子温度持续升高、出现变色/焦味或保护动作时立即停机。

## 高危迹象处理

现象：现场出现冒烟、焦糊味、火花、异味或着火。

处理原则：立即停机隔离，禁止继续运行或复位。

排查步骤：
1. 立即停机并切断上级电源
2. 执行验电、挂牌上锁
3. 隔离故障回路，禁止重复送电试验
4. 由持证电工完成绝缘与回路检查

安全提醒：高风险：先断电、验电、挂牌；不得开盖、拆检或复位。

升级条件：立即升级现场负责人/持证电工，未排除隐患前不得送电。
保存时注意：编码选 UTF-8，不然中文会乱码。

第 5 步：写向量化模块
新建 rag/embed.mjs，粘贴：

js
// rag/embed.mjs
// 作用：把一段文字转成一串数字（向量），用于语义检索

import { pipeline } from '@xenova/transformers';

let embedder = null;

export async function getEmbedder() {
  if (!embedder) {
    console.log('首次加载向量模型（约 100MB，需要 1-2 分钟）…');
    embedder = await pipeline(
      'feature-extraction',
      'Xenova/bge-small-zh-v1.5',
      { quantized: true }
    );
    console.log('向量模型加载完成');
  }
  return embedder;
}

export async function embed(text) {
  const model = await getEmbedder();
  const out = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(out.data);
}
说明：第一次跑会下载模型，之后就用本地缓存，不再联网。

第 6 步：写向量库模块
新建 rag/store.mjs，粘贴：

js
// rag/store.mjs
// 作用：把向量存进本地库，以及从库里检索

import { MiniVectorDB } from 'mini-vector-db';
import { embed } from './embed.mjs';

const db = new MiniVectorDB({ path: './data/vectors' });

export async function buildIndex(chunks) {
  if (!chunks.length) {
    console.log('没有片段需要索引');
    return;
  }

  const vectors = [];
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    process.stdout.write(`\r向量化 ${i + 1}/${chunks.length} …`);
    const vec = await embed(c.text);
    vectors.push({
      id: c.id,
      vector: vec,
      metadata: {
        text: c.text,
        doc_id: c.meta.doc_id,
        title: c.meta.title,
        chunk_index: c.meta.chunk_index
      }
    });
  }
  console.log();

  await db.insert(vectors);
  console.log(`已写入向量库：${vectors.length} 条`);
}

export async function search(query, topK = 5) {
  const qvec = await embed(query);
  return db.search(qvec, { topK });
}

export async function clearIndex() {
  try {
    await db.clear();
  } catch {}
}
第 7 步：写切片模块
新建 ingest/chunk.mjs，粘贴：

js
// ingest/chunk.mjs
// 作用：把一份 Markdown 文档切成一段一段

export function chunkMarkdown(text, docId, docTitle) {
  // 按二级标题 ## 切开
  const parts = text.split(/\n(?=##\s)/);
  const chunks = [];

  for (let i = 0; i < parts.length; i++) {
    const body = parts[i].trim();
    if (body.length < 20) continue;

    // 如果某一段太长（>800 字），再按空行切
    if (body.length > 800) {
      const paras = body.split(/\n\n+/);
      let buf = '';
      for (const p of paras) {
        if ((buf + '\n\n' + p).length > 600 && buf) {
          chunks.push(makeChunk(buf, docId, docTitle, chunks.length));
          buf = p;
        } else {
          buf = buf ? buf + '\n\n' + p : p;
        }
      }
      if (buf.trim()) {
        chunks.push(makeChunk(buf, docId, docTitle, chunks.length));
      }
    } else {
      chunks.push(makeChunk(body, docId, docTitle, chunks.length));
    }
  }

  return chunks;
}

function makeChunk(text, docId, docTitle, index) {
  return {
    id: `${docId}-${index}`,
    text: text.trim(),
    meta: {
      doc_id: docId,
      title: docTitle,
      chunk_index: index
    }
  };
}
第 8 步：写建库主脚本
新建 ingest/index-docs.mjs，粘贴：

js
// ingest/index-docs.mjs
// 作用：读取 knowledge/ 里的所有 Markdown，切片，向量化，存库

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chunkMarkdown } from './chunk.mjs';
import { buildIndex, clearIndex } from '../rag/store.mjs';

const DOCS_DIR = './knowledge';

async function main() {
  const files = await readdir(DOCS_DIR).catch(() => []);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  if (!mdFiles.length) {
    console.log('knowledge/ 里没有 .md 文件，请先放资料');
    return;
  }

  console.log(`找到 ${mdFiles.length} 份文档`);

  const allChunks = [];
  for (const file of mdFiles) {
    const text = await readFile(join(DOCS_DIR, file), 'utf8');
    const docId = file.replace('.md', '');
    const docTitle = docId;
    const chunks = chunkMarkdown(text, docId, docTitle);
    allChunks.push(...chunks);
    console.log(`  ${file}: ${chunks.length} 片段`);
  }

  console.log(`共 ${allChunks.length} 个片段`);

  // 清空旧索引（简单做法，后面可改增量）
  await clearIndex();

  // 建新索引
  await buildIndex(allChunks);

  console.log('建库完成');
}

main().catch(e => {
  console.error('建库失败：', e.message);
  process.exit(1);
});
第 9 步：跑第一次建库
powershell
node ingest/index-docs.mjs
第一次运行会发生什么：

下载 BGE 模型（约 100MB，1-2 分钟）

加载模型

把 seed.md 切成 5 个片段

逐个向量化

写入 data/vectors/

成功的标志：

text
找到 1 份文档
  seed.md: 5 片段
共 5 个片段
首次加载向量模型（约 100MB，需要 1-2 分钟）…
向量模型加载完成
向量化 5/5 …
已写入向量库：5 条
建库完成
如果报错，看下面的“常见问题”。

第 10 步：测试检索
新建 test-rag.mjs（在项目根目录），粘贴：

js
// test-rag.mjs
import { search } from './rag/store.mjs';

const query = process.argv[2] || '电机嗡嗡响转速上不去';
console.log(`查询：${query}\n`);

const results = await search(query, 3);

for (const r of results) {
  console.log(`--- 相关度 ${r.score.toFixed(3)} ---`);
  console.log(`来源：${r.metadata.title}`);
  console.log(r.metadata.text.slice(0, 200));
  console.log();
}
跑：

powershell
node test-rag.mjs
成功的标志：输出 3 段和“电机嗡嗡响”相关的片段，第一条相关度最高。

再试几个查询：

powershell
node test-rag.mjs "变频器 E-OC"
node test-rag.mjs "端子发热"
node test-rag.mjs "冒烟怎么办"
每个查询都应该找到对应的片段。

第 11 步：把 rules.mjs 导出成资料
新建 scripts/rules-to-docs.mjs，粘贴：

js
// scripts/rules-to-docs.mjs
// 作用：把你 rules.mjs 里已验证的规则导出成 Markdown 资料

import { writeFile } from 'node:fs/promises';
import { diagnose } from '../rules.mjs';

// 用一批典型输入，触发所有规则分支
const cases = [
  {
    device: '三相异步电动机',
    symptom: '启动后嗡嗡响，转速上不去，外壳温度偏高',
    alarm: '',
    measure: { currentA: '8.2', currentB: '8.0', currentC: '12.5', ambient: '31' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  },
  {
    device: '三相异步电动机',
    symptom: '三相电流不平衡，C 相明显偏高',
    alarm: '',
    measure: { currentA: '8.2', currentB: '8.0', currentC: '12.5' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  },
  {
    device: '变频器',
    symptom: '加速过程中突然停机，面板显示过流',
    alarm: 'E-OC',
    measure: { extra: '加速时间 3 秒，电机带泵负载' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  },
  {
    device: '低压配电柜',
    symptom: '柜内出现间歇性嗡嗡声，接线端子附近有发热迹象',
    alarm: '',
    measure: { temperature: '78', load: '85' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  },
  {
    device: '低压配电柜',
    symptom: '闻到焦糊味，端子冒烟',
    alarm: '',
    measure: { temperature: '95' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: true }
  },
  {
    device: '三相异步电动机',
    symptom: '嗡嗡响',
    alarm: '',
    measure: {},
    safety: { poweredOff: false, verified: false, locked: false, hazard: false }
  },
  {
    device: '未知设备',
    symptom: '设备有点异常',
    alarm: '',
    measure: {},
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  }
];

const docs = cases.map(tc => {
  const r = diagnose(tc, 'rule');
  return { input: tc, result: r };
});

const md = [
  '# 电诊明规则导出',
  '',
  '本文件由 scripts/rules-to-docs.mjs 从 rules.mjs 自动导出。',
  '内容为已验证的本地规则，可作为 RAG 知识库的种子资料。',
  ''
].join('\n') + docs.map(d => {
  const r = d.result;
  const m = d.input.measure || {};
  const measures = [];
  if (m.currentA || m.currentB || m.currentC) measures.push(`三相电流 ${m.currentA||'-'}/${m.currentB||'-'}/${m.currentC||'-'} A`);
  if (m.temperature) measures.push(`温度 ${m.temperature}℃`);
  if (m.load) measures.push(`负载 ${m.load}%`);
  if (m.extra) measures.push(m.extra);

  return `
## ${d.input.device}：${d.input.symptom}

现象：${d.input.symptom}${d.input.alarm ? `，报警 ${d.input.alarm}` : ''}${measures.length ? `，测量 ${measures.join('；')}` : ''}

风险等级：${r.riskLevel}
判断：${r.summary}

可能原因：
${r.causes.map(c => `- ${c.text}${c.evidence?.length ? `（依据：${c.evidence.join('；')}）` : ''}`).join('\n')}

排查步骤：
${r.steps.map((s, i) => `${i + 1}. ${s.text}${s.safety ? `（${s.safety}）` : ''}`).join('\n')}

安全提醒：${r.safety}

升级条件：${r.escalation}
`;
}).join('\n---\n');

await writeFile('./knowledge/rules-export.md', md);
console.log(`已导出 ${docs.length} 条规则到 knowledge/rules-export.md`);
跑：

powershell
node scripts/rules-to-docs.mjs
成功的标志：knowledge/ 里多了 rules-export.md，7 条规则。

重新建库：

powershell
node ingest/index-docs.mjs
现在有 seed.md 和 rules-export.md 两份文档，片段数增加到十几个。

再测检索：

powershell
node test-rag.mjs "电机三相不平衡"
node test-rag.mjs "变频器过流"
应该都能命中。

第 12 步：集成到 server.mjs
先备份：

powershell
Copy-Item server.mjs server.mjs.bak
打开 server.mjs，找到顶部的 import 区，加上：

js
import { search } from './rag/store.mjs';
然后找到 handleDiagnose 函数，在 const t0 = Date.now(); 之前插入 RAG 检索：

js
  // ---------- RAG 检索 ----------
  let ragContext = '';
  let references = [];
  try {
    const query = buildRagQuery(input);
    const hits = await search(query, 3);
    if (hits.length) {
      ragContext = hits.map((h, i) =>
        `[资料${i + 1}] 来源：${h.metadata.title}\n${h.metadata.text}`
      ).join('\n\n');
      references = hits.map(h => ({
        title: h.metadata.title,
        doc_id: h.metadata.doc_id,
        snippet: h.metadata.text.slice(0, 150)
      }));
      log('info', 'rag hits', { count: hits.length, topScore: hits[0].score });
    }
  } catch (e) {
    log('warn', 'rag failed', { err: e?.message });
    // RAG 失败不阻塞主流程
  }

  const t0 = Date.now();
然后找到调用 AI 的地方，把 prompt(input) 替换为带 RAG 的版本：

js
const userPrompt = ragContext
  ? `${prompt(input)}\n\n以下是相关技术资料，请优先基于这些资料回答，并在结论中标注引用来源：\n${ragContext}`
  : prompt(input);
同时把 { role: 'user', content: prompt(input) } 改成：

js
{ role: 'user', content: userPrompt }
最后，在 result 拿到后（无论走 AI 还是规则），把 references 塞进去：

js
  if (result && references.length) {
    result.references = references;
  }
在 handleDiagnose 函数外面（文件底部靠上位置），加一个辅助函数：

js
function buildRagQuery(input) {
  const parts = [];
  if (input.device) parts.push(input.device);
  if (input.alarm) parts.push(`故障代码 ${input.alarm}`);
  if (input.symptom) parts.push(input.symptom);
  const m = input.measure || {};
  if (m.temperature) parts.push(`温度 ${m.temperature}℃`);
  if (m.currentA && m.currentC) parts.push('三相电流不平衡');
  if (m.extra) parts.push(m.extra);
  return parts.join(' ');
}
注意：log 函数是你 v1.0.6 里加的，如果还没有，就用 console.log 替代。

保存。

第 13 步：修改 index.html
先备份：

powershell
Copy-Item index.html index.html.bak
在 <style> 标签内，追加：

css
.references{margin-top:12px}
.references li{margin:8px 0}
.references .src{color:var(--muted);font-size:12px}
保存。

第 14 步：修改 app.mjs
先备份：

powershell
Copy-Item app.mjs app.mjs.bak
打开 app.mjs，找到 render(r) 函数里的 sections 拼接部分。

在 </div>（sections 结束）之前，加上参考依据：

js
const refs = (r.references || []).length
  ? `<div class="section references"><h3>参考依据</h3><ul>${r.references.map(ref =>
      `<li><strong>${esc(ref.title)}</strong><div class="src">${esc(ref.snippet)}…</div></li>`
    ).join('')}</ul></div>`
  : '';
然后在 innerHTML 的模板字符串里，把这个 refs 插进去。找到：

js
      <div class="section safety"><h3>安全提醒</h3><p>${esc(r.safety)}</p></div>
      <div class="section stop"><h3>升级 / 停机条件</h3><p>${esc(r.escalation)}</p></div>
改成：

js
      ${refs}
      <div class="section safety"><h3>安全提醒</h3><p>${esc(r.safety)}</p></div>
      <div class="section stop"><h3>升级 / 停机条件</h3><p>${esc(r.escalation)}</p></div>
保存。

第 15 步：启动服务并测试
启动：

powershell
node server.mjs
打开浏览器：http://localhost:8787

测试：

点“电机三相不平衡”案例

等结果出来

检查结果区是否多了一个“参考依据”区块

点“变频器加速过流”案例，看引用是否变成变频器相关

如果看不到参考依据，检查：

server.mjs 的 references 是否塞进 result

app.mjs 的 refs 是否拼进 innerHTML

浏览器控制台有没有报错

第 16 步：验证 RAG 不影响主流程
测试 1：高危场景不走 RAG

点“配电柜焦糊冒烟（高危）”案例，结果应该是：

风险等级：高风险

排查步骤第一步：立即停机并切断上级电源

不应该有参考依据（因为规则在高危分支直接返回，没走到 RAG）

测试 2：RAG 挂掉不影响诊断

临时把 knowledge/seed.md 删掉（或改名），重启服务，再点案例。

诊断结果应该正常返回

只是没有“参考依据”

服务端日志里会看到 rag failed 或 rag hits: 0

测试 3：AI 关闭时也能用

如果你没配 QIANFAN_API_KEY，服务走本地规则。

点案例，结果来自 source: "rule"

参考依据仍然有（因为 RAG 检索在 AI 之前）

第 17 步：日常怎么用
添加新资料
把新的 .md 文件放进 knowledge/

跑 node ingest/index-docs.mjs

重启服务（或不用重启，如果 server 每次查询都读最新索引的话）

注意：当前 store.mjs 是每次查询时调用 db.search，db 是模块加载时创建的，所以加新资料后需要重启服务才能生效。

修改现有资料
改完 .md，重新跑 node ingest/index-docs.mjs，重启服务。

查看当前有哪些资料
powershell
dir knowledge
测试某个查询
powershell
node test-rag.mjs "你要查的内容"
第 18 步：以后有 PDF 了怎么办
先装 pdf-parse：

powershell
npm install pdf-parse
新建 ingest/parse-pdf.mjs：

js
import { readFile } from 'node:fs/promises';
import pdf from 'pdf-parse';

export async function parsePdf(filePath) {
  const buf = await readFile(filePath);
  const data = await pdf(buf);
  return data.text;
}
修改 ingest/index-docs.mjs，把 PDF 也纳入：

找到这一段：

js
  const mdFiles = files.filter(f => f.endsWith('.md'));
改成：

js
  const mdFiles = files.filter(f => f.endsWith('.md'));
  const pdfFiles = files.filter(f => f.endsWith('.pdf'));
然后在处理 mdFiles 之后，加上处理 pdfFiles：

js
  const { parsePdf } = await import('./parse-pdf.mjs');
  for (const file of pdfFiles) {
    const text = await parsePdf(join(DOCS_DIR, file));
    const docId = file.replace('.pdf', '');
    const chunks = chunkMarkdown(text, docId, docId);
    allChunks.push(...chunks);
    console.log(`  ${file}: ${chunks.length} 片段`);
  }
注意：chunkMarkdown 是按 ## 标题切的，PDF 里一般没有 Markdown 标题，效果可能不好。以后可以再写一个 chunkPlainText，按段落切。

常见问题
1. 报错 Cannot use import statement outside a module
原因：package.json 里没有 "type": "module"。

解决：在 package.json 里加上。

2. 报错 Cannot find package '@xenova/transformers'
原因：依赖没装好。

解决：

powershell
npm install
3. 第一次运行卡很久
原因：在下载 BGE 模型（约 100MB）。

解决：耐心等，网速慢可能要 5 分钟。下载完会缓存到本地，以后不重复下载。

4. 中文乱码
原因：seed.md 编码不是 UTF-8。

解决：用 VS Code 打开，右下角选编码，改成 UTF-8 保存。

5. 检索结果不相关
原因：资料太少，或查询和资料用词差异太大。

解决：

先加更多资料

测试时用和资料接近的词

以后可以加混合检索和重排序

6. mini-vector-db 报错找不到
原因：包名可能不对。如果你装的时候报错，换成 @omendb/omendb。

解决：

powershell
npm install @omendb/omendb
然后 rag/store.mjs 里把 MiniVectorDB 换成 OmenDB，用法类似。

7. 端口被占用
解决：

powershell
Get-NetTCPConnection -LocalPort 8787 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
再启动。

全部步骤的检查清单
按顺序勾：

□ 第 1 步：Node 版本 ≥ 18
□ 第 2 步：新建 4 个文件夹
□ 第 3 步：npm init -y + 改 package.json + npm install
□ 第 4 步：创建 knowledge/seed.md
□ 第 5 步：创建 rag/embed.mjs
□ 第 6 步：创建 rag/store.mjs
□ 第 7 步：创建 ingest/chunk.mjs
□ 第 8 步：创建 ingest/index-docs.mjs
□ 第 9 步：node ingest/index-docs.mjs 成功
□ 第 10 步：node test-rag.mjs 能检索到
□ 第 11 步：node scripts/rules-to-docs.mjs 成功
□ 第 11 步：重新建库
□ 第 12 步：修改 server.mjs
□ 第 13 步：修改 index.html
□ 第 14 步：修改 app.mjs
□ 第 15 步：启动服务，看到“参考依据”
□ 第 16 步：3 个验证测试通过
执行顺序总结
text
1. 建文件夹
2. 装依赖
3. 写 seed.md（先跑通）
4. 写 4 个 .mjs 模块
5. 建库 → 测试检索
6. 导出规则 → 重新建库
7. 改 server.mjs / app.mjs / index.html
8. 启动测试
9. 验证 RAG 不影响安全逻辑
全程 1-2 小时，第一次跑会慢在模型下载。

一句话总结
不是在别处新建项目，就在你现在这个项目里加 4 个文件夹、4 个新文件、改 3 个旧文件。

先跑通 seed.md → 建库 → 检索，再集成到 server，最后补资料。

每一步都能独立验证，跑不通就停下来检查，不要跳步。