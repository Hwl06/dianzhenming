(()=>{
const { diagnose: ruleDiagnose, VERSION } = window.DianzhenRules;
const $ = id => document.getElementById(id);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

(async () => {
  const status = $('service-status');
  const dot = $('service-dot');
  if (!status || !dot) return;
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (!response.ok) throw new Error('service unavailable');
    const config = await response.json();
    status.textContent = config.aiEnabled ? '联网 AI 配置已载入' : '未配置 API Key';
    dot.classList.toggle('is-offline', !config.aiEnabled);
  } catch {
    status.textContent = '联网服务未连接';
    dot.classList.add('is-offline');
  }
})();

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
let attachments = [];
let attachmentId = 0;
// Keep the diagnosis result panel aligned with the full height of the input panel.
const formCard = document.querySelector('.grid > .card:not(.result)');
const resultCard = $('result');
const syncResultHeight = () => {
  if (formCard && resultCard) {
    resultCard.style.height = `${Math.ceil(formCard.getBoundingClientRect().height)}px`;
  }
};
if (formCard && resultCard) {
  syncResultHeight();
  if ('ResizeObserver' in window) {
    new ResizeObserver(syncResultHeight).observe(formCard);
  } else {
    window.addEventListener('resize', syncResultHeight);
    document.querySelector('.grid details')?.addEventListener('toggle', syncResultHeight);
  }
}

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
    },
    images: attachments.filter(file => file.kind === 'image').map(file => file.data),
    files: attachments.filter(file => file.kind === 'text' || file.kind === 'pdf').map(file => file.text)
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
  const references = Array.isArray(r.references) ? r.references : [];
  const refs = references.length
      ? '<div class="section references"><h3>参考依据（RAG 检索）</h3><ul>' + references.map(ref => '<li><strong>' + esc(ref.title) + '</strong><div class="src">' + esc(ref.doc_id) + ' · 相似度 ' + esc(ref.score) + '<br>' + esc(ref.snippet) + '</div></li>').join('') + '</ul></div>'
      : '';
  const repairPlan = Array.isArray(r.repair_plan) ? r.repair_plan.slice(0, 3) : [];
  const repairHTML = repairPlan.length ? `
    <div class="section repair">
      <h3>维修作业指导</h3>
      <div class="repair-grid">
        ${repairPlan.map(item => `
          <article class="repair-task">
            <div class="repair-head"><span class="repair-priority">P${esc(item.priority)}</span><strong>${esc(item.action)}</strong></div>
            <p class="repair-safety">安全前提：${esc(item.safety)}</p>
            <details><summary>执行、验收与升级细节</summary>
              <p>工具材料：${(item.tools || []).map(esc).join('、') || '按厂家文件与现场作业票准备'}</p>
              <p>执行要点：${(item.key_points || []).map(esc).join('；') || '按现场规程执行'}</p>
              <p>验收标准：${esc(item.acceptance)}</p>
              <p>升级路径：${esc(item.escalation)}</p>
            </details>
          </article>
        `).join('')}
      </div>
    </div>
  ` : `
    <div class="section repair">
      <h3>维修作业指导</h3>
      <p class="muted">当前信息不足，暂不生成具体检修动作。请补充设备铭牌型号、报警代码、故障发生条件和测量值。</p>
    </div>
  `;  $('result').innerHTML = `
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
      ${repairHTML}
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
    '维修作业指导（草案；执行前须经授权人员按现场规程复核）：',
    ...(r.repair_plan || []).slice(0, 2).flatMap(item => [
      `P${item.priority} ${item.action}`,
      `  安全前提：${item.safety}`,
      `  工具材料：${(item.tools || []).join('、')}`,
      ...((item.key_points || []).map(point => `  执行要点：${point}`)),
      `  验收标准：${item.acceptance}`,
      `  升级路径：${item.escalation}`
    ]),
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
  window.setRobotState('working');
  $('run').textContent = '分析中…';
  try {
    if (location.protocol === 'file:') {
      const attachmentNote = x.images.length || x.files.length ? '附件已在页面中选择，但直接打开 index.html 时不会上传或解析附件。' : '';
      render({ ...ruleDiagnose(x, 'rule'), fallbackReason: [attachmentNote, '本地文件模式：当前使用本地规则；联网 AI 需要通过服务启动。'].filter(Boolean).join(' ') });
      return;
    }
    const res = await fetch('/api/diagnose', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(x)
    });
    if (res.ok) {
      const result = await res.json();
      render(result);
      saveHistory({
        device: x.device,
        symptom: x.symptom,
        riskLevel: result.riskLevel,
        source: result.source,
        ts: new Date().toISOString()
      });
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
    window.setRobotState('happy');
  }
}

$('run').onclick = run;
$('clear').onclick = () => {
  ['symptom','alarm','currentA','currentB','currentC','voltageA','voltageB','voltageC','temperature','ambient','load','extra']
    .forEach(id => { $(id).value = ''; });
  clearAttachments();
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

const MAX_UPLOAD_FILES = 3;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_DATA_LENGTH = 4_000_000;
const MAX_TEXT_LENGTH = 100_000;
const fileUpload = $('fileUpload');
const filePreview = $('filePreview');
const fileStatus = $('fileStatus');

function clearAttachments() {
  attachments = [];
  if (fileUpload) fileUpload.value = '';
  renderAttachments();
}

function renderAttachments() {
  if (!filePreview) return;
  filePreview.replaceChildren();
  for (const file of attachments) {
    const box = document.createElement('div');
    box.className = 'file-preview-item';
    box.title = file.name;
    if (file.kind === 'image') {
      const img = document.createElement('img');
      img.src = file.data;
      img.alt = `现场照片：${file.name}`;
      box.appendChild(img);
    } else {
      const label = document.createElement('div');
      label.className = 'file-preview-name';
      label.textContent = file.name;
      box.appendChild(label);
    }
    const remove = document.createElement('button');
    remove.className = 'file-preview-remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `移除附件 ${file.name}`);
    remove.addEventListener('click', () => {
      attachments = attachments.filter(item => item.id !== file.id);
      renderAttachments();
    });
    box.appendChild(remove);
    filePreview.appendChild(box);
  }
  if (fileStatus) {
    const imageCount = attachments.filter(file => file.kind === 'image').length;
    const docCount = attachments.filter(file => file.kind !== 'image').length;
    fileStatus.textContent = attachments.length
      ? `已选 ${attachments.length}/${MAX_UPLOAD_FILES} 个附件（照片 ${imageCount}，文本/ PDF ${docCount}）。PDF 正文暂不提取。`
      : '无附件。启动服务并配置 API Key 后，照片会提交至千帆视觉模型；否则不做外部分析。PDF 正文暂不提取。';
  }
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('照片读取失败'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('照片格式无法解码'));
      image.onload = () => {
        try {
          let width = image.naturalWidth;
          let height = image.naturalHeight;
          const maxEdge = 800;
          if (Math.max(width, height) > maxEdge) {
            const scale = maxEdge / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const context = canvas.getContext('2d');
          if (!context) throw new Error('浏览器不支持图片压缩');
          context.drawImage(image, 0, 0, width, height);
          let data = canvas.toDataURL('image/jpeg', 0.7);
          if (data.length > MAX_IMAGE_DATA_LENGTH) data = canvas.toDataURL('image/jpeg', 0.45);
          if (data.length > MAX_IMAGE_DATA_LENGTH) throw new Error('压缩后照片仍过大，请缩小照片后重试');
          resolve(data);
        } catch (error) { reject(error); }
      };
      image.src = String(reader.result || '');
    };
    reader.readAsDataURL(file);
  });
}

if (fileUpload) {
  fileUpload.addEventListener('change', async event => {
    const selected = Array.from(event.target.files || []);
    attachments = [];
    renderAttachments();
    const files = selected.slice(0, MAX_UPLOAD_FILES);
    if (selected.length > MAX_UPLOAD_FILES) alert(`最多上传 ${MAX_UPLOAD_FILES} 个文件，超出的文件已忽略。`);
    const skipped = [];
    for (const file of files) {
      if (file.size > MAX_UPLOAD_BYTES) {
        alert(`文件 ${file.name} 超过 5MB，已跳过`);
        skipped.push(file.name);
        continue;
      }
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || (!file.type && ['jpg', 'jpeg', 'png', 'webp'].includes(ext));
      const isText = file.type === 'text/plain' || (!file.type && ext === 'txt');
      const isPdf = file.type === 'application/pdf' || (!file.type && ext === 'pdf');
      try {
        if (isImage) {
          const data = await compressImage(file);
          attachments.push({ id: ++attachmentId, kind: 'image', name: file.name, data });
        } else if (isText) {
          const text = await file.text();
          if (text.includes('\0')) throw new Error('不是可读取的纯文本文件');
          const truncated = text.length > MAX_TEXT_LENGTH;
          attachments.push({ id: ++attachmentId, kind: 'text', name: file.name, text: `[文件:${file.name}] ${text.slice(0, MAX_TEXT_LENGTH)}` });
          if (truncated) skipped.push(`${file.name}（文本已截断至100KB）`);
        } else if (isPdf) {
          attachments.push({ id: ++attachmentId, kind: 'pdf', name: file.name, text: `[PDF文件:${file.name}] PDF 正文未提取；请勿据此推断手册内容。需要分析时请另存为 TXT 后上传。` });
          skipped.push(`${file.name}（仅传递文件名，未解析 PDF 正文）`);
        } else {
          skipped.push(`${file.name}（格式不支持）`);
        }
      } catch (error) {
        skipped.push(`${file.name}（${error?.message || '读取失败'}）`);
      }
    }
    renderAttachments();
    if (fileStatus && skipped.length) fileStatus.textContent += ` 已跳过/受限：${skipped.join('；')}`;
  });
}
renderAttachments();



function loadHistory() {
  const box = $('historyList');
  if (!box) return;
  try {
    const stored = JSON.parse(localStorage.getItem('dianzhen_history') || '[]');
    const items = Array.isArray(stored) ? stored : [];
    if (!items.length) {
      box.innerHTML = '<p class="foot">暂无记录（您的历史记录仅保存在本机浏览器中）</p>';
      return;
    }
    box.innerHTML = items.slice(0, 10).map(item => {
      const timestamp = item.ts && Number.isFinite(Date.parse(item.ts)) ? new Date(item.ts).toLocaleString() : '时间未知';
      const risk = ['high', 'medium', 'low'].includes(item.riskLevel) ? item.riskLevel : 'low';
      const riskText = risk === 'high' ? '高风险' : risk === 'medium' ? '需谨慎' : '建议复核';
      return `<article class="history-item"><div class="history-main"><strong>${esc(item.device || '未知设备')}</strong><span>${esc(item.symptom || '未填写现象')}</span><small>${esc(timestamp)} · ${item.source === 'ai' ? '联网 AI' : '本地规则'}</small></div><span class="risk ${risk}">${riskText}</span></article>`;
    }).join('');
  } catch (e) {
    console.error('读取历史记录失败', e);
    box.innerHTML = '<p class="loading-line error-line">读取本机历史记录失败。</p>';
  }
}
function saveHistory(item) {
  try {
    const stored = JSON.parse(localStorage.getItem('dianzhen_history') || '[]');
    const items = Array.isArray(stored) ? stored : [];
    items.unshift(item);
    if (items.length > 20) items.length = 20;
    localStorage.setItem('dianzhen_history', JSON.stringify(items));
  } catch (e) {
    console.error('保存历史记录失败', e);
  }
}
function activateView(name) {
  const valid = ['diagnosis', 'history', 'knowledge', 'about'];
  if (!valid.includes(name)) name = 'diagnosis';
  document.querySelectorAll('[data-view-panel]').forEach(panel => {
    panel.hidden = panel.dataset.viewPanel !== name;
  });
  document.querySelectorAll('[data-view-target]').forEach(button => {
    const active = button.dataset.viewTarget === name;
    button.classList.toggle('is-active', active);
    if (button.matches('.nav-link')) {
      button.setAttribute('aria-selected', String(active));
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
  });
  if (name === 'history') loadHistory();
  if (name === 'diagnosis') requestAnimationFrame(syncResultHeight);
}
document.querySelectorAll('[data-view-target]').forEach(button => {
  button.addEventListener('click', event => {
    event.preventDefault();
    activateView(button.dataset.viewTarget);
  });
});
$('historyRefresh')?.addEventListener('click', loadHistory);
const requestedView = location.hash.slice(1);
activateView(['diagnosis', 'history', 'knowledge', 'about'].includes(requestedView) ? requestedView : 'diagnosis');
if (requestedView !== 'history') loadHistory();

})();
// 欢迎封面进入逻辑
(() => {
  const cover = document.getElementById('cover');
  const enterBtn = document.getElementById('enterBtn');
  if (!cover || !enterBtn) return;

  let isEntering = false;
  const enter = () => {
    if (isEntering) return;
    isEntering = true;
    cover.classList.add('is-hidden');
    setTimeout(() => cover.remove(), 700);
  };

  enterBtn.addEventListener('click', enter);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('cover')) enter();
  });
})();

// Floating electrical assistant chat
(() => {
  const box = document.getElementById('assistant-chat-box');
  const avatar = document.getElementById('assistant-avatar');
  const close = document.getElementById('assistant-close');
  const form = document.getElementById('assistant-chat-form');
  const input = document.getElementById('assistant-input');
  const history = document.getElementById('assistant-chat-history');
  const send = document.getElementById('assistant-send');
  if (!box || !avatar || !form || !input || !history || !send) return;

  let avatarMotionTimer = null;
  const setOpen = (open, focus = true) => {
    const wasOpen = !box.classList.contains('assistant-hidden');
    if (wasOpen !== open) {
      const motionClass = open ? 'dialog-opening' : 'dialog-closing';
      avatar.classList.remove('dialog-opening', 'dialog-closing');
      void avatar.offsetWidth;
      avatar.classList.add(motionClass);
      clearTimeout(avatarMotionTimer);
      avatarMotionTimer = setTimeout(() => avatar.classList.remove(motionClass), 500);
    }
    box.classList.toggle('assistant-hidden', !open);
    box.setAttribute('aria-hidden', String(!open));
    avatar.setAttribute('aria-expanded', String(open));
    avatar.setAttribute('aria-label', open ? '关闭电诊明助手' : '打开电诊明助手');
    if (open && focus) input.focus();
  };
  let autoPromptEnabled = true;
  let autoPromptInterval = null;
  let autoPromptTimeout = null;
  const stopAutoPrompt = () => {
    autoPromptEnabled = false;
    clearInterval(autoPromptInterval);
    clearTimeout(autoPromptTimeout);
  };
  const startAutoPrompt = () => {
    if (!autoPromptEnabled || !box.classList.contains('assistant-hidden')) return;
    setOpen(true, false);
    autoPromptTimeout = setTimeout(() => {
      if (!autoPromptEnabled) return;
      setOpen(false, false);
      autoPromptInterval = setInterval(() => {
        if (!autoPromptEnabled || !box.classList.contains('assistant-hidden')) return;
        setOpen(true, false);
        autoPromptTimeout = setTimeout(() => {
          if (autoPromptEnabled) setOpen(false, false);
        }, 2000);
      }, 10000);
    }, 2000);
  };
  const cover = document.getElementById('cover');
  if (!cover) {
    startAutoPrompt();
  } else {
    const coverObserver = new MutationObserver(() => {
      if (!document.getElementById('cover')) {
        coverObserver.disconnect();
        startAutoPrompt();
      }
    });
    coverObserver.observe(document.body, { childList: true });
  }
  const assistant = document.getElementById('ai-assistant');
  const positionKey = 'dianzhen-assistant-position-v1';
  const clamp = (value, min, max) => Math.min(Math.max(value, min), Math.max(min, max));
  const placeAssistant = (right, bottom) => {
    const rect = avatar.getBoundingClientRect();
    const safeRight = clamp(right, 8, window.innerWidth - rect.width - 8);
    const safeBottom = clamp(bottom, 8, window.innerHeight - rect.height - 8);
    assistant.style.left = 'auto';
    assistant.style.top = 'auto';
    assistant.style.right = `${safeRight}px`;
    assistant.style.bottom = `${safeBottom}px`;
    return { right: safeRight, bottom: safeBottom };
  };
  try {
    const saved = JSON.parse(localStorage.getItem(positionKey) || 'null');
    if (Number.isFinite(saved?.right) && Number.isFinite(saved?.bottom)) placeAssistant(saved.right, saved.bottom);
  } catch {}
  window.addEventListener('resize', () => {
    const right = Number.parseFloat(assistant.style.right || getComputedStyle(assistant).right) || 24;
    const bottom = Number.parseFloat(assistant.style.bottom || getComputedStyle(assistant).bottom) || 24;
    const position = placeAssistant(right, bottom);
    try { localStorage.setItem(positionKey, JSON.stringify(position)); } catch {}
  });

  let pointer = null;
  let dragged = false;
  avatar.addEventListener('pointerdown', event => {
    if (!event.isPrimary || (event.button !== 0 && event.pointerType !== 'touch')) return;
    const rect = avatar.getBoundingClientRect();
    pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, rect, moved: false };
    avatar.setPointerCapture(event.pointerId);
  });
  avatar.addEventListener('pointermove', event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    const dx = event.clientX - pointer.startX;
    const dy = event.clientY - pointer.startY;
    if (!pointer.moved && Math.hypot(dx, dy) < 6) return;
    pointer.moved = true;
    dragged = true;
    avatar.classList.add('is-dragging');
    placeAssistant(window.innerWidth - (pointer.rect.right + dx), window.innerHeight - (pointer.rect.bottom + dy));
  });
  const finishDrag = event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    if (pointer.moved) {
      dragged = event.type === 'pointerup';
      const position = { right: Number.parseFloat(assistant.style.right), bottom: Number.parseFloat(assistant.style.bottom) };
      try { localStorage.setItem(positionKey, JSON.stringify(position)); } catch {}
      avatar.classList.remove('is-dragging');
    }
    pointer = null;
  };
  avatar.addEventListener('pointerup', finishDrag);
  avatar.addEventListener('pointercancel', finishDrag);
  avatar.addEventListener('lostpointercapture', finishDrag);
  avatar.addEventListener('click', event => {
    if (dragged) { dragged = false; event.preventDefault(); return; }
    stopAutoPrompt();
    setOpen(box.classList.contains('assistant-hidden'));
  });
  close?.addEventListener('click', () => { stopAutoPrompt(); setOpen(false); });
  box.addEventListener('pointerdown', stopAutoPrompt);
  input.addEventListener('focus', stopAutoPrompt);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !box.classList.contains('assistant-hidden')) { stopAutoPrompt(); setOpen(false); }
  });

  const addMessage = (kind, text) => {
    const message = document.createElement('div');
    message.className = `assistant-message assistant-${kind}`;
    message.textContent = text;
    history.append(message);
    history.scrollTop = history.scrollHeight;
    return message;
  };
  let sending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question || sending) return;
    sending = true;
    send.disabled = true;
    window.setRobotState('working');
    addMessage('user', question);
    input.value = '';
    const pending = addMessage('ai', '正在查阅知识库并整理回答…');
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question }),
        signal: AbortSignal.timeout(20_000)
      });
      const data = await response.json().catch(() => null);
      pending.textContent = data?.answer || '暂时无法获得回答，请稍后重试。';
    } catch {
      pending.textContent = '暂时连接不上服务，请确认后端已启动并检查网络配置。';
    } finally {
      sending = false;
      send.disabled = false;
      input.focus();
      history.scrollTop = history.scrollHeight;
      window.setRobotState('happy');
    }
  });
})();

// Robot state motion for diagnosis and chat requests.
let robotStateTimer;
window.setRobotState = function(state) {
  const avatar = document.getElementById('assistant-avatar');
  if (!avatar) return;
  clearTimeout(robotStateTimer);
  avatar.classList.remove('working', 'happy');
  if (state === 'working') {
    avatar.classList.add('working');
  } else if (state === 'happy') {
    avatar.classList.add('happy');
    robotStateTimer = setTimeout(() => avatar.classList.remove('happy'), 1500);
  }
};

// Read project knowledge files without leaving the current view.
(() => {
  const modal = document.getElementById('reader-modal');
  const content = document.getElementById('reader-content');
  const titleEl = document.getElementById('reader-title');
  const closeButton = modal?.querySelector('.reader-close');
  if (!modal || !content || !titleEl || !closeButton) return;

  let activeRequest = null;
  let previousFocus = null;
  const closeReader = () => {
    activeRequest?.abort();
    activeRequest = null;
    modal.hidden = true;
    document.body.classList.remove('reader-open');
    if (previousFocus?.isConnected) previousFocus.focus();
  };

  window.openReader = async (filePath, title) => {
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    previousFocus = document.activeElement;
    titleEl.textContent = title || '手册详情';
    content.replaceChildren();
    const loading = document.createElement('p');
    loading.className = 'muted';
    loading.textContent = '正在读取参考文件…';
    content.append(loading);
    modal.hidden = false;
    document.body.classList.add('reader-open');
    closeButton.focus();

    try {
      const response = await fetch(`/api/file?path=${encodeURIComponent(filePath)}`, {
        cache: 'no-store', signal: request.signal
      });
      if (!response.ok) throw new Error('读取失败');
      const markdown = await response.text();
      if (activeRequest !== request) return;
      if (window.marked && window.DOMPurify) {
        content.innerHTML = window.DOMPurify.sanitize(window.marked.parse(markdown), {
          USE_PROFILES: { html: true }
        });
        content.querySelectorAll('a[href]').forEach(link => {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        });
      } else {
        const plainText = document.createElement('pre');
        plainText.textContent = markdown;
        content.replaceChildren(plainText);
      }
      content.scrollTop = 0;
    } catch (error) {
      if (request.signal.aborted || activeRequest !== request) return;
      content.replaceChildren();
      const message = document.createElement('p');
      message.className = 'reader-error';
      message.textContent = '读取文件失败，请确认本机服务已启动且文件存在。';
      content.append(message);
    } finally {
      if (activeRequest === request) activeRequest = null;
    }
  };
  window.closeReader = closeReader;

  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('[data-reader-file]') : null;
    if (!link) return;
    event.preventDefault();
    const title = link.closest('.knowledge-card')?.querySelector('h2')?.textContent;
    window.openReader(link.dataset.readerFile, title);
  });
  modal.addEventListener('click', event => {
    if (event.target instanceof Element && event.target.closest('[data-reader-close]')) closeReader();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !modal.hidden) {
      event.stopImmediatePropagation();
      closeReader();
    }
  }, true);
})();
