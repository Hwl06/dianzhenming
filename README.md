# 电诊明 v1.0.6 · 本机 RAG 增强版

在 v1.0.6 交付版上增加 Markdown 知识库、中文向量检索和诊断引用展示。原规则诊断、安全拦截、诊断历史、严格 CSP，以及双击 `index.html` 的本地模式均保留。

## 环境

需要 Node.js 18+ 和 npm，首次 BGE 建库需要联网下载依赖与模型。也可以使用 pnpm。

## 安装、建库和检索

在 PowerShell 进入本目录：

```powershell
npm install
npm run export-rules
npm run build-rag
npm run test-rag -- "电机三相电流不平衡"
```

`knowledge/seed.md` 是演示资料。把已审核的 Markdown 维修资料放入 `knowledge/`，再运行 `npm run build-rag` 重建索引。默认使用 `Xenova/bge-small-zh-v1.5`；首次运行从 Hugging Face 下载并缓存模型。Node 运行环境无法访问模型源时，建库自动退回本地字符 n-gram 向量，仍可进行本机检索并显示引用。可设置 `EMBEDDING_MODE=ngram` 强制使用此离线模式。

向量索引保存在 `data/vectors/index.json`，不会提交到 Git。当前 JSON 余弦检索适合小型本机资料集；资料量大时再迁移到专用向量数据库。可通过 `EMBEDDING_MODEL` 环境变量更换兼容的 Transformers.js 模型。

## 启动

```powershell
npm start
```

也可双击 `启动电诊明.bat`，自动启动本文件夹的服务并打开设备诊断工作台。本目录使用 `.env` 中的 `PORT`（当前为 8888）；前端由本机服务提供，历史记录写入本目录的 `data/`，已有历史和知识库已随副本一并迁入。

如需使用联网 AI、历史记录与服务端知识库，请双击 `启动电诊明.bat`；直接双击 `index.html` 会进入浏览器 `file://` 模式，只运行本地规则。

## 知识库阅读器

通过本机服务打开网页后，在“手册 / 知识库”点击“打开参考文件”，可在当前页面阅读排版后的 Markdown。阅读器使用随项目附带的 Marked 与 DOMPurify，无需访问 CDN。`GET /api/file?path=seed.md` 只读取 `knowledge/` 内的 Markdown 文件；直接双击 HTML 的本地模式无法读取该接口。

## 照片与文件附件

在“现场现象”下可选择最多 3 个 JPG/PNG/WebP/TXT/PDF 文件，单个原始文件最多 5 MB。照片会在浏览器缩放到最长边 800px 并转为 JPEG 后预览和提交；TXT 最多读取前 100 KB。PDF 目前只传递文件名提示，不会读取 PDF 正文，请将需要参考的文字另存为 TXT 再上传。

附件通过本机服务提交。只有设置 `.env` 中的 `QIANFAN_API_KEY` 且安全确认完整、规则判断非高危时，照片才会并发提交到千帆视觉模型；默认模型为 `ernie-4.5-turbo-vl-32k`，可用 `QIANFAN_VISION_MODEL` 覆盖。视觉模型只提供可见特征作为待核实证据，诊断仍由规则、RAG 与文本模型完成。缺少 API Key、视觉接口失败或安全条件不满足时，系统继续规则降级；直接双击 HTML 时附件不会上传或分析。

## 结构化维修作业指导

诊断结果增加按优先级排序的 `repair_plan`，每项包括动作、安全前提、工具材料、执行要点、验收标准和升级路径。电机过热等已知场景在本地规则模式也有预置模板；现场高危时只给停机/撤离/隔离/升级提示，不生成开柜维修或复电步骤；信息不足时维修计划留空并列出需补充的设备型号、报警和测量值。结构化作业指导会随诊断摘要写入 `data/history.jsonl`，并包含在复制/下载的检修记录中。

联网诊断将摘要限制为30字，原因和步骤最多各3条；页面最多展示P1/P2两项动作，安全前提始终显示，执行与验收细节可展开查看。RAG 每次最多取回一个知识片段。AI 风险不能降低本地规则风险；AI 判为高危时只显示安全应急步骤。

作业指导是供有资质且获授权人员审核的草案，不是工作票或设备维修手册。扭矩、绕组偏差、温度和试验限值必须使用对应型号厂家文件和现场规程中的值；程序不采用通用推测阈值。执行前须按适用安全规程、工作许可和现场风险评估复核。

## 行为与安全

- 本地规则先运行。规则命中高危，或未完成断电、验电、挂牌确认时，跳过 RAG 和外部 AI。
- 照片/文本附件不写入诊断历史或日志；模型提示会将上传文本和图片观察视为不可信参考内容。
- 其它诊断最多检索 1 个相关片段；低相似度结果不附加，匹配引用展示在“参考依据”。
- 模型只接收有限长度的参考片段；知识库作为不可信资料，不执行其中可能出现的指令。
- 无索引、模型下载失败或检索异常时，主诊断继续运行并写入警告日志。
- 新增/修改资料后重建索引；服务查询直接读取最新索引，无需重启。
- 引用仅供辅助参考，现场规程、设备说明书和安全要求优先。

## 接口和检查

原有接口不变：`GET /health`、`GET /api/config`、`GET /api/history?limit=10`、`POST /api/diagnose`。新增 `GET /api/file?path=...`，仅用于读取本机知识库 Markdown。悬浮电诊明助手使用 `POST /api/chat`，从 RAG 知识库检索参考片段并调用已配置的联网模型；需要在服务端 `.env` 配置 API Key。

```powershell
npm run export-rules
npm run build-rag
npm run test-rag -- "变频器 E-OC"
npm run smoke
.\verify.ps1
.\backup.ps1
```

备份包括源码、知识资料、向量索引和历史数据，不包含 `.env` 与 `node_modules`。

## 目录

- `knowledge/`：审核过的 Markdown 知识资料
- `rag/embed.mjs`：BGE 与离线 n-gram 向量
- `rag/store.mjs`：文件持久化向量存储与余弦检索
- `ingest/`：Markdown 切片与索引构建
- `scripts/rules-to-docs.mjs`：导出本地规则知识
- `test-rag.mjs`：检索检查
- `data/vectors/index.json`：自动生成的本机向量索引

## 其他文档

实施方案、产品方案书、联网启动说明和演示脚本已按类别整理到 `docs/`，目录说明见 `docs/README.md`。当前仅保留根目录的工作台前端。

