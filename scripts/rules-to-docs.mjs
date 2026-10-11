import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnose } from '../rules.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const normal = { poweredOff: true, verified: true, locked: true, hazard: false };
const cases = [
  { device:'三相异步电动机', symptom:'启动后嗡嗡响，转速上不去，外壳温度偏高', alarm:'', measure:{currentA:'8.2',currentB:'8.0',currentC:'12.5',ambient:'31'}, safety:normal },
  { device:'三相异步电动机', symptom:'三相电流不平衡，C 相明显偏高', alarm:'', measure:{currentA:'8.2',currentB:'8.0',currentC:'12.5'}, safety:normal },
  { device:'变频器', symptom:'加速过程中突然停机，面板显示过流', alarm:'E-OC', measure:{extra:'加速时间 3 秒，电机带泵负载'}, safety:normal },
  { device:'低压配电柜', symptom:'柜内出现间歇性嗡嗡声，接线端子附近有发热迹象', alarm:'', measure:{temperature:'78',load:'85'}, safety:normal },
  { device:'低压配电柜', symptom:'闻到焦糊味，端子冒烟', alarm:'', measure:{temperature:'95'}, safety:{...normal,hazard:true} },
  { device:'三相异步电动机', symptom:'嗡嗡响', alarm:'', measure:{}, safety:{poweredOff:false,verified:false,locked:false,hazard:false} },
  { device:'未知设备', symptom:'设备有点异常', alarm:'', measure:{}, safety:normal }
];
const lines = ['# 电诊明规则导出','','本文件由 rules.mjs 自动生成，仅作为检索资料；现场安全规程始终优先。'];
for (const input of cases) {
  const result = diagnose(input, 'rule');
  lines.push('', '## ' + input.device + '：' + input.symptom, '',
    '现象：' + input.symptom, '风险等级：' + result.riskLevel, '判断：' + result.summary,
    '', '可能原因：', ...result.causes.map(c => '- ' + c.text),
    '', '排查步骤：', ...result.steps.map((s,i) => (i+1) + '. ' + s.text + (s.safety ? '（' + s.safety + '）' : '')),
    '', '安全提醒：' + result.safety, '升级条件：' + result.escalation);
}
await writeFile(join(root, 'knowledge', 'rules-export.md'), lines.join('\n') + '\n', 'utf8');
console.log('已导出 ' + cases.length + ' 条规则到 knowledge/rules-export.md');

