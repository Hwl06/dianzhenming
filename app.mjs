import { diagnose as ruleDiagnose, VERSION } from '/rules.mjs';

const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const examples = {
  motor: {
    device: '三相异步电动机', symptom: '启动后嗡嗡响，转速上不去，外壳温度偏高', alarm: '',
    measure: { currentA: '8.2', currentB: '8.0', currentC: '12.5', ambient: '31' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  },
  cabinet: {
    device: '低压配电柜', symptom: '柜内出现间歇性嗡嗡声，接线端子附近有发热迹象', alarm: '',
    measure: { temperature: '78', load: '85' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  },
  drive: {
    device: '变频器', symptom: '加速过程中突然停机，面板显示过流', alarm: 'E-OC',
    measure: { extra: '加速时间 3 秒，电机带泵负载' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: false }
  },
  hazard: {
    device: '低压配电柜', symptom: '柜内闻到焦糊味，接线端子附近有轻微冒烟', alarm: '',
    measure: { temperature: '95' },
    safety: { poweredOff: true, verified: true, locked: true, hazard: true }
  }
};

let lastInput = null;
let lastResult = null;

function current() {
  return {
    device: $('device').value,
    symptom: $('symptom').value.trim(),
    alarm: $('alarm').value.trim(),
    measure: {
      currentA: $('currentA').value.trim(), currentB: $('currentB').value.trim(), currentC: $('currentC').value.trim(),
      voltageA: $('voltageA').value.trim(), voltageB: $('voltageB').value.trim(), voltageC: $('voltageC').value.trim(),
      temperature: $('temperature').value.trim(), ambient: $('ambient').value.trim(), load: $('load').value.trim(),
      extra: $('extra').value.trim()
    },
    safety: {
      poweredOff: $('sPoweredOff').checked,
      verified: $('sVerified').checked,
      locked: $('sLocked').checked,
      hazard: $('sHazard').checked
    }
  };
}

function applyExample(x) {
  $('device').value = x.device;
  $('symptom').value = x.symptom;
  $('alarm').value = x.alarm;
  const m = x.measure || {};
  for (const k of ['currentA','currentB','currentC','voltageA','voltageB','voltageC','temperature','ambient','load','extra']) {
    $(k).value = m[k] || '';
  }
  $('sPoweredOff').checked = x.safety.poweredOff;
  $('sVerified').checked = x.safety.verified;
  $('sLocked').checked = x.safety.locked;
  $('sHazard').checked = x.safety.hazard;
}

function riskLabel(level) {
  return level === 'high' ? '高风险' : level === 'medium' ? '需谨慎' : '建议复核';
}

function render(r) {
  lastResult = r;
  const srcLabel = r.source === 'ai' ? '联网 AI' : '本地规则';
  const srcClass = r.source === 'ai' ? 'ai' : 'rule';
  const riskClass = r.riskLevel === 'high' ? 'high' : r.riskLevel === 'medium' ? 'medium' : '';
  const confidence = typeof r.confidence === 'number' ? `置信度 ${(r.confidence * 100).toFixed(0)}%` : '';
  const missing = (r.missingInfo || []).length
    ? `<div class="section warn"><h3>信息缺口</h3><ul>${r.missingInfo.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>`
    : '';
  const fallback = r.fallbackReason ? `<p class="fallback">${esc(r.fallbackReason)}</p>` : '';
  const refs = (r.references || []).length
      ? '<div class="section references"><h3>参考依据</h3><ul>' + r.references.map(ref => '<li><strong>' + esc(ref.title) + '</strong><div class="src">' + esc(ref.doc_id) + ' · 相似度 ' + esc(ref.score) + '<br>' + esc(ref.snippet) + '</div></li>').join('') + '</ul></div>'
      : '';

  $('result').innerHTML = `
    <div class="topline">
      <div>
        <div class="eyebrow">诊断结果
          <span class="source-tag ${srcClass}">${srcLabel}</span>
          <span class="muted">v${VERSION}</span>
        </div>
        <div class="summary">${esc(r.summary)}</div>
      </div>
      <span class="severity ${riskClass}">${riskLabel(r.riskLevel)}</span>
    </div>
    ${fallback}
    <div class="sections">
      <div class="section">
        <h3>可能原因</h3>
        <ul>${r.causes.map(c => `<li>${esc(c.text)}${c.evidence?.length ? `<div class="evidence">依据：${c.evidence.map(esc).join('；')}</div>` : ''}</li>`).join('')}</ul>
      </div>
      <div class="section">
        <h3>排查顺序</h3>
        <ol>${r.steps.map((s, i) => `<li><label class="step"><input type="checkbox" data-step="${i}"><span>${esc(s.text)}${s.safety ? `<em>（${esc(s.safety)}）</em>` : ''}</span></label></li>`).join('')}</ol>
      </div>
      ${missing}
      ${refs}
      <div class="section safety"><h3>安全提醒</h3><p>${esc(r.safety)}</p></div>
      <div class="section stop"><h3>升级 / 停机条件</h3><p>${esc(r.escalation)}</p></div>
    </div>
    <div class="toolbar">
      <button class="btn secondary" id="copyReport">复制检修记录</button>
      <button class="btn secondary" id="downloadReport">下载文本报告</button>
      <button class="btn secondary" id="printReport">打印</button>
    </div>
    <div id="copyFallback" hidden><textarea readonly id="copyArea"></textarea></div>
    <p class="meta">生成时间：${esc(new Date(r.timestamp).toLocaleString())} · ${confidence}</p>
  `;
  attachActions();
}

function reportText() {
  const x = lastInput, r = lastResult, m = x.measure;
  const measures = [];
  if (m.currentA || m.currentB || m.currentC) measures.push(`三相电流 ${m.currentA || '-'}/${m.currentB || '-'}/${m.currentC || '-'} A`);
  if (m.voltageA || m.voltageB || m.voltageC) measures.push(`三相电压 ${m.voltageA || '-'}/${m.voltageB || '-'}/${m.voltageC || '-'} V`);
  if (m.temperature) measures.push(`设备温度 ${m.temperature}℃`);
  if (m.ambient) measures.push(`环境温度 ${m.ambient}℃`);
  if (m.load) measures.push(`负载率 ${m.load}%`);
  if (m.extra) measures.push(`补充 ${m.extra}`);
  const safety = `断电=${x.safety.poweredOff ? '是' : '否'} 验电=${x.safety.verified ? '是' : '否'} 挂牌=${x.safety.locked ? '是' : '否'} 高危迹象=${x.safety.hazard ? '有' : '无'}`;
  return [
    '电诊明检修记录',
    `时间：${new Date(r.timestamp).toLocaleString()}`,
    `来源：${r.source === 'ai' ? '联网 AI' : '本地规则'} v${VERSION}`,
    `风险等级：${riskLabel(r.riskLevel)}`,
    '',
    `设备：${x.device}`,
    `现象：${x.symptom}`,
    `报警：${x.alarm || '无'}`,
    `测量：${measures.join('；') || '未填写'}`,
    `安全确认：${safety}`,
    '',
    `判断：${r.summary}`,
    '',
    '可能原因：',
    ...r.causes.map((c, i) => `  ${i + 1}. ${c.text}${c.evidence?.length ? `（依据：${c.evidence.join('；')}）` : ''}`),
    '',
    '排查顺序：',
    ...r.steps.map((s, i) => `  ${i + 1}. ${s.text}${s.safety ? `（${s.safety}）` : ''}`),
    '',
    `安全提醒：${r.safety}`,
    `升级条件：${r.escalation}`,
    '',
    '本记录由电诊明生成，仅作辅助，不替代持证电工现场判断。'
  ].join('\n');
}

function attachActions() {
  $('copyReport').onclick = async () => {
    const btn = $('copyReport');
    try {
      if (!navigator.clipboard) throw Error('no clipboard');
      await navigator.clipboard.writeText(reportText());
      btn.textContent = '已复制';
    } catch {
      $('copyFallback').hidden = false;
      $('copyArea').value = reportText();
      $('copyArea').select();
      btn.textContent = '请手动复制';
    }
    setTimeout(() => { btn.textContent = '复制检修记录'; }, 2000);
  };
  $('downloadReport').onclick = () => {
    const blob = new Blob([reportText()], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '电诊明-检修记录.txt';
    a.click();
    URL.revokeObjectURL(a.href);
  };
  $('printReport').onclick = () => window.print();
}

async function run() {
  const x = current();
  if (!x.symptom) {
    $('symptom').focus();
    $('result').innerHTML = '<div class="empty"><div><strong>请先描述现场现象</strong>至少填写症状，系统才能给出谨慎的排查路径。</div></div>';
    return;
  }
  lastInput = x;
  $('run').disabled = true;
  $('run').textContent = '分析中…';
  try {
    const res = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(x)
    });
    if (res.ok) {
      render(await res.json());
      loadHistory();
    } else {
      const err = await res.json().catch(() => ({}));
      render({ ...ruleDiagnose(x, 'rule'), fallbackReason: err.error || `服务返回 ${res.status}，已回退本地规则` });
    }
  } catch {
    render({ ...ruleDiagnose(x, 'rule'), fallbackReason: '网络异常，已回退本地规则' });
  } finally {
    $('run').disabled = false;
    $('run').textContent = '生成诊断';
  }
}

$('run').onclick = run;
$('clear').onclick = () => {
  ['symptom','alarm','currentA','currentB','currentC','voltageA','voltageB','voltageC','temperature','ambient','load','extra']
    .forEach(id => { $(id).value = ''; });
  $('sHazard').checked = false;
  $('result').innerHTML = '<div class="empty"><div><strong>准备开始诊断</strong>先完成安全确认，再填入现象或点击案例。</div></div>';
};
document.querySelectorAll('.example').forEach(b => {
  b.onclick = () => {
    const x = examples[b.dataset.id];
    if (!x) return;
    applyExample(x);
    run();
  };
});
async function loadHistory(){
  if(location.protocol==='file:') return;
  try{
    const res=await fetch('/api/history?limit=10');
    if(!res.ok) return;
    const data=await res.json();
    const items=Array.isArray(data.items)?data.items:[];
    const box=document.getElementById('historyList');
    if(!box) return;
    if(!items.length){box.innerHTML='<p class="foot">暂无记录</p>';return;}
    box.innerHTML=items.map(it=>`<div class="history-item"><div><div><strong>${esc(it.device)}</strong> · ${esc(it.symptom)}</div><div class="src">${esc(new Date(it.ts).toLocaleString())} · ${it.source==='ai'?'联网 AI':'本地规则'}</div></div><span class="risk ${esc(it.riskLevel)}">${it.riskLevel==='high'?'高风险':it.riskLevel==='medium'?'需谨慎':'建议复核'}</span></div>`).join('');
  }catch{}
}
loadHistory();
setInterval(loadHistory,30000);



