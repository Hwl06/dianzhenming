import http from 'node:http';
const port = Number(process.env.PORT || 8788);

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body != null ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const r = http.request({
      host: '127.0.0.1', port, path, method,
      headers: data ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data), connection: 'close' } : { connection: 'close' }
    }, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => buf += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: buf }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ok  ${name}`); }
  else { fail++; console.error(`FAIL  ${name}`); }
}

const baseSafety = { poweredOff: true, verified: true, locked: true, hazard: false };
const baseMeasure = { currentA: '', currentB: '', currentC: '', voltageA: '', voltageB: '', voltageC: '', temperature: '', ambient: '', load: '', extra: '' };

// 1. 首页与安全头
const root = await req('GET', '/');
check('首页 200', root.status === 200);
check('首页含标题', root.body.includes('电诊明'));
check('首页使用本地兼容脚本', root.body.includes('src="./app.js"') && root.body.includes('src="./rules.js"') && !root.body.includes('type="module"'));
check('CSP 头', String(root.headers['content-security-policy']).includes("default-src 'self'"));
check('nosniff 头', root.headers['x-content-type-options'] === 'nosniff');
check('X-Frame-Options', root.headers['x-frame-options'] === 'DENY');
check('Referrer-Policy', root.headers['referrer-policy'] === 'no-referrer');

// 2. health / config
const health = await req('GET', '/health');
const h = JSON.parse(health.body);
check('health 200', health.status === 200);
check('health ok', h.ok === true);
check('health 有版本', typeof h.version === 'string');
check('health 有 mode', ['local','online'].includes(h.mode));

const cfg = await req('GET', '/api/config');
check('config 200', cfg.status === 200);
check('config 有 aiEnabled', typeof JSON.parse(cfg.body).aiEnabled === 'boolean');

// 3. 静态资源
for (const p of ['/app.js', '/rules.js', '/app.mjs', '/rules.mjs']) {
  const r = await req('GET', p);
  check(`静态 ${p} 200`, r.status === 200);
}

// 4. 输入校验
const empty = await req('POST', '/api/diagnose', { device: '三相异步电动机', symptom: '', alarm: '', measure: baseMeasure, safety: baseSafety });
check('空症状 400', empty.status === 400);

const badJson = await req('POST', '/api/diagnose', '{not json');
check('非法 JSON 400', badJson.status === 400);

const huge = await req('POST', '/api/diagnose', 'x'.repeat(16 * 1024 * 1024));
check('超大 body 413', huge.status === 413);

const badShape = await req('POST', '/api/diagnose', { device: '三相异步电动机', symptom: '嗡嗡响', measure: 'abc', safety: baseSafety });
check('measure 非对象 400', badShape.status === 400);

const withAttachments = await req('POST', '/api/diagnose', {
  device: '低压配电柜', symptom: '端子附近有发热迹象', alarm: '', measure: baseMeasure, safety: baseSafety,
  images: ['data:image/jpeg;base64,AAAA'], files: ['[文件:现场说明.txt] 端子温度偏高']
});
check('压缩图片与TXT附件请求 200', withAttachments.status === 200);
check('无API Key附件安全降级提示', JSON.parse(withAttachments.body).fallbackReason?.includes('未配置 API Key'));

const badImage = await req('POST', '/api/diagnose', {
  device: '低压配电柜', symptom: '端子发热', alarm: '', measure: baseMeasure, safety: baseSafety,
  images: ['data:image/svg+xml;base64,AAAA']
});
check('拒绝不支持的图片类型', badImage.status === 400);

const tooManyImages = await req('POST', '/api/diagnose', {
  device: '低压配电柜', symptom: '端子发热', alarm: '', measure: baseMeasure, safety: baseSafety,
  images: ['data:image/jpeg;base64,AAAA','data:image/jpeg;base64,AAAA','data:image/jpeg;base64,AAAA','data:image/jpeg;base64,AAAA']
});
check('拒绝超过3张图片', tooManyImages.status === 400);

const pdfNotice = await req('POST', '/api/diagnose', {
  device: '低压配电柜', symptom: '端子发热', alarm: '', measure: baseMeasure, safety: baseSafety,
  files: ['[PDF文件:设备手册.pdf] PDF 正文未提取；请勿据此推断手册内容。']
});
check('PDF明确提示正文未解析', JSON.parse(pdfNotice.body).fallbackReason?.includes('PDF 正文未提取'));

// 5. 正常诊断
const ok = await req('POST', '/api/diagnose', {
  device: '三相异步电动机',
  symptom: '启动后嗡嗡响，转速上不去',
  alarm: '',
  measure: { ...baseMeasure, currentA: '8.2', currentB: '8.0', currentC: '8.1' },
  safety: baseSafety
});
check('正常诊断 200', ok.status === 200);
const o = JSON.parse(ok.body);
check('结果有 source', o.source === 'rule' || o.source === 'ai');
check('结果 riskLevel 合法', ['low', 'medium', 'high'].includes(o.riskLevel));
check('结果 causes 数组', Array.isArray(o.causes));
check('结果 steps 数组', Array.isArray(o.steps));
check('结果含 timestamp', typeof o.timestamp === 'string');
check('正常安全诊断附带 RAG 引用', Array.isArray(o.references) && o.references.length > 0);

const motorWorkOrder = await req('POST', '/api/diagnose', {
  device: '三相异步电动机', symptom: '电机过热，外壳温度偏高', alarm: '', measure: baseMeasure, safety: baseSafety
});
const mw = JSON.parse(motorWorkOrder.body);
check('电机过热最多返回2条结构化作业指导', motorWorkOrder.status === 200 && mw.repair_plan?.length >= 2 && mw.repair_plan.length <= 2);
check('作业指导具备六项字段', (mw.repair_plan || []).every(item => item.priority && item.action && item.safety && item.tools?.length && item.key_points?.length && item.acceptance && item.escalation));
check('作业指导不写通用扭矩阈值', !(mw.repair_plan || []).some(item => item.key_points.join(' ').match(/\b\d+(?:\.\d+)?\s*N[·.]?m\b/i)));

const vague = await req('POST', '/api/diagnose', {
  device: '三相异步电动机', symptom: '设备坏了', alarm: '', measure: {}, safety: baseSafety
});
const vagueResult = JSON.parse(vague.body);
check('信息不足时不生成维修动作', vague.status === 200 && Array.isArray(vagueResult.repair_plan) && vagueResult.repair_plan.length === 0);
check('信息不足提示补充型号和报警', vagueResult.missingInfo?.includes('设备铭牌型号与额定参数') && vagueResult.missingInfo?.includes('报警代码及故障发生条件'));

// 6. 高风险场景
const haz = await req('POST', '/api/diagnose', {
  device: '低压配电柜',
  symptom: '闻到焦糊味，端子冒烟',
  alarm: '',
  measure: baseMeasure,
  safety: { ...baseSafety, hazard: true }
});
check('高危迹象 -> high', JSON.parse(haz.body).riskLevel === 'high');
check('高危维修指导先给安全应急动作', JSON.parse(haz.body).repair_plan?.[0]?.action?.includes('启动现场应急处置'));
check('高危指导不包含开柜/送电检修动作', !JSON.parse(haz.body).repair_plan?.some(item => /开柜|复位|送电试验/u.test(item.action)));
check('高危场景跳过 RAG', !JSON.parse(haz.body).references?.length);

// 7. 安全前提未满足
const unsafe = await req('POST', '/api/diagnose', {
  device: '三相异步电动机',
  symptom: '嗡嗡响',
  alarm: '',
  measure: baseMeasure,
  safety: { poweredOff: false, verified: false, locked: false, hazard: false }
});
check('未安全隔离 -> medium', JSON.parse(unsafe.body).riskLevel === 'medium');

// 8. 空 measure 兜底
const bare = await req('POST', '/api/diagnose', {
  device: '未知设备', symptom: '设备有点异常', alarm: '', measure: {}, safety: baseSafety
});
check('空 measure 不崩溃', bare.status === 200);
check('空 measure 有 missingInfo', Array.isArray(JSON.parse(bare.body).missingInfo));
const hist = await req('GET', '/api/history?limit=5');
check('history 200', hist.status === 200);
check('history 有 items', Array.isArray(JSON.parse(hist.body).items));
check('历史记录保存维修指导字段', Array.isArray(JSON.parse(hist.body).items[0]?.repair_plan));
const after = await req('GET', '/api/history?limit=1');
check('诊断后历史非空', JSON.parse(after.body).items.length > 0);

console.log(`\n${pass}/${pass + fail} 通过`);
if (fail > 0) process.exit(1);
console.log(`PASS electrical-diagnosis ${h.version}`);


