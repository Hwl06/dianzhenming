export const VERSION = '1.0.6';
export const RISK = Object.freeze({ LOW: 'low', MEDIUM: 'medium', HIGH: 'high' });

const HAZARD = /烟|焦糊|火花|烧|异味|冒火|着火/;

const HIGH_RISK_PLAN = [
  {
    priority: 1,
    action: '停止设备运行并启动现场应急处置',
    safety: '不得靠近冒烟、起火或裸露带电部位；只有经授权且可从安全位置操作的人员，才按现场应急预案执行停机/隔离。',
    tools: ['现场通信/报警设备（在安全区域使用）'],
    key_points: ['先确保人员撤离危险区域并设置警戒', '禁止开柜、拆检、复位或反复送电试验', '不得对疑似带电设备用水处置'],
    acceptance: '人员已处于安全区域，危险区域已隔离，现场负责人已接管；设备保持停运。',
    escalation: '有明火、烟雾扩大、无法确认电源隔离或存在触电风险时立即撤离，按单位预案联系应急/消防和电气负责人。'
  }
];

const ISOLATION_PLAN = [
  {
    priority: 1,
    action: '按工作许可和现场程序完成设备停机与安全隔离',
    safety: '由具备相应资质并获授权的人员执行；未确认所有电源、反送电及储能风险前，不得拆检或测量。',
    tools: ['适用的工作票/作业许可', '设备隔离清单', '符合现场制度的锁具与标识', '适用于设备电压等级的验电器'],
    key_points: ['逐项核对电源、控制电源、备用/反送电和储能来源', '按现场程序隔离、上锁挂牌并验电；验电器按规程确认有效', '记录隔离点和作业负责人；不确定时停止作业'],
    acceptance: '隔离点、验电结果、工作许可和负责人复核记录齐全，并满足现场适用规程。',
    escalation: '无法确认所有电源或无法完成可靠隔离时，停止作业并升级至电气负责人/持证电工。'
  }
];

const REPAIR_TEMPLATES = {
  motor_overheat: [
    ...ISOLATION_PLAN,
    {
      priority: 2,
      action: '清理电机外部冷却通道并检查风扇状态',
      safety: '完成隔离并确认设备完全停止后进行；遵守粉尘、旋转部件和防护罩要求。',
      tools: ['软毛刷或适用吸尘设备', '照明工具'],
      key_points: ['记录清理前堵塞/积尘情况', '按厂家要求清理进出风口和散热表面，不损伤风扇、护罩及绝缘件', '检查风扇是否松动、破损或受阻；不得在拆罩状态试运行'],
      acceptance: '风道无可见堵塞，风扇和护罩完整且无机械卡阻；检查结果已记录。',
      escalation: '风扇损坏、绕组有变色/异味或清理后温升仍异常时，停止运行并交由电机检修人员。'
    },
    {
      priority: 3,
      action: '由授权电工按厂家方法核对三相绕组电阻',
      safety: '设备隔离、验电并按厂家规定处理变频器/电容等储能后进行；测试仪器和测试电压须适配设备。',
      tools: ['适用量程的绕组电阻测试仪', '设备铭牌及厂家维修手册'],
      key_points: ['记录环境/绕组温度、仪器、接线方式和各相原始读数', '按厂家规定的测量方法、温度换算及允许偏差判读，不套用通用百分比', '测试后按设备规程恢复接线、放电并复核'],
      acceptance: '各相读数及偏差符合该型号厂家文件/现场检修规程的限值，且记录可追溯。',
      escalation: '读数超出设备专属限值、变化不稳定或无可用限值文件时，不送电，升级至电机检修负责人。'
    }
  ],
  variable_frequency_overcurrent: [
    ...ISOLATION_PLAN,
    {
      priority: 2,
      action: '核对变频器报警记录、参数与电机铭牌',
      safety: '只允许授权人员操作；涉及打开柜门、接触回路或修改参数时，先按厂家规定停电、等待放电并验电。',
      tools: ['变频器厂家手册', '电机铭牌记录', '故障记录/参数备份'],
      key_points: ['保存故障代码、发生时刻、负载工况和原参数', '逐项对照电机额定电压、电流、频率及设备专属加速/保护参数', '不因单次报警盲目提高限流值、屏蔽保护或反复复位'],
      acceptance: '铭牌数据与参数核对完成，任何变更均有依据、审批和回退记录。',
      escalation: '参数不匹配、保护重复触发或原因无法确认时，保持停机并联系厂家/变频器检修人员。'
    }
  ]
};

function repairPlan(kind) {
  const source = kind === 'high' ? HIGH_RISK_PLAN : kind === 'isolation' ? ISOLATION_PLAN : REPAIR_TEMPLATES[kind] || [];
  return source.map(item => ({ ...item, tools: [...item.tools], key_points: [...item.key_points] }));
}

function normalizeMeasure(m) {
  if (!m || typeof m !== 'object') return { extra: String(m || '') };
  const s = k => String(m[k] || '').trim();
  return {
    currentA: s('currentA'), currentB: s('currentB'), currentC: s('currentC'),
    voltageA: s('voltageA'), voltageB: s('voltageB'), voltageC: s('voltageC'),
    temperature: s('temperature'), ambient: s('ambient'), load: s('load'),
    extra: s('extra')
  };
}

function build(o) {
  const r = {
    source: o.source,
    riskLevel: o.riskLevel,
    summary: o.summary,
    confidence: typeof o.confidence === 'number' ? o.confidence : 0.6,
    missingInfo: o.missingInfo || [],
    causes: o.causes || [],
    steps: o.steps || [],
    repair_plan: o.repair_plan || [],
    safety: o.safety,
    escalation: o.escalation,
    references: o.references || [],
    timestamp: new Date().toISOString()
  };
  if (o.fallbackReason) r.fallbackReason = o.fallbackReason;
  return r;
}

function currentImbalance(m) {
  const a = parseFloat(m.currentA), b = parseFloat(m.currentB), c = parseFloat(m.currentC);
  if (![a, b, c].every(Number.isFinite)) return null;
  const max = Math.max(a, b, c), min = Math.min(a, b, c);
  if (max <= 0) return null;
  return ((max - min) / max) * 100;
}

export function diagnose(input, source = 'rule') {
  const device = String(input?.device || '未知设备').trim();
  const symptom = String(input?.symptom || '').trim();
  const alarm = String(input?.alarm || '').trim();
  const m = normalizeMeasure(input?.measure);
  const s = input?.safety || {};
  const text = `${symptom} ${alarm} ${m.extra}`.toLowerCase();

  const missingInfo = [];
  if (!symptom) missingInfo.push('现场现象');
  if (!m.currentA && !m.currentB && !m.currentC) missingInfo.push('三相电流');
  if (!m.temperature) missingInfo.push('设备温度');
  const vagueSymptom = /^(?:设备)?(?:坏了|异常|有问题|不正常|故障)$/u.test(symptom);
  if (vagueSymptom || device === '未知设备') {
    if (!missingInfo.includes('设备铭牌型号与额定参数')) missingInfo.push('设备铭牌型号与额定参数');
    if (!missingInfo.includes('报警代码及故障发生条件')) missingInfo.push('报警代码及故障发生条件');
    if (!missingInfo.includes('三相电压、电流及温度实测值')) missingInfo.push('三相电压、电流及温度实测值');
  }

  // 1) 高危迹象优先
  if (s.hazard || HAZARD.test(text)) {
    return build({
      source, riskLevel: RISK.HIGH, confidence: 0.9, missingInfo,
      repair_plan: repairPlan('high'),
      summary: '现场存在冒烟/焦糊/火花/异味等高危迹象，立即停机隔离，禁止继续运行或复位。',
      causes: [
        { text: '绝缘击穿或局部短路', evidence: ['出现高危迹象'] },
        { text: '接点严重发热，接触电阻升高', evidence: [] },
        { text: '负载异常引起持续过流', evidence: [] }
      ],
      steps: [
        { text: '立即停机并切断上级电源', safety: '禁止带电操作' },
        { text: '执行验电、挂牌上锁', safety: '验电确认无电压后方可作业' },
        { text: '隔离故障回路，禁止重复送电试验', safety: '禁止强制复位' },
        { text: '由持证电工完成绝缘与回路检查', safety: '需专业人员' }
      ],
      safety: '高风险：先断电、验电、挂牌；不得开盖、拆检或复位。',
      escalation: '立即升级现场负责人/持证电工，未排除隐患前不得送电。'
    });
  }

  // 2) 安全前提未满足：只给安全指引
  if (s.poweredOff === false || s.verified === false || s.locked === false) {
    return build({
      source, riskLevel: RISK.MEDIUM, confidence: 0.5, missingInfo,
      repair_plan: repairPlan('isolation'),
      summary: '尚未完成断电、验电、挂牌上锁，请先完成安全隔离再进入排查。',
      causes: [{ text: '安全前提未满足，暂不判断故障原因', evidence: [] }],
      steps: [
        { text: '切断设备上级电源', safety: '确认断电范围' },
        { text: '使用合格验电器验电', safety: '验电前后自检' },
        { text: '挂牌上锁，防止误送电', safety: '专人保管钥匙' },
        { text: '完成上述步骤后重新生成诊断', safety: '' }
      ],
      safety: '未完成安全隔离前，不得进行拆检或测量。',
      escalation: '无法安全隔离或电源不确定时，请联系持证电工。'
    });
  }

  const ev = [];
  if (m.temperature) ev.push(`设备温度 ${m.temperature}℃`);
  if (m.ambient) ev.push(`环境温度 ${m.ambient}℃`);
  if (m.load) ev.push(`负载率 ${m.load}%`);

  // 3) 电机
  if (/(过流|e-oc|嗡嗡|电流|过热|温度)/.test(text) && /电(?:动)?机/u.test(device)) {
    const dev = currentImbalance(m);
    const evLocal = [...ev];
    if (dev !== null) evLocal.push(`三相电流偏差约 ${dev.toFixed(1)}%`);
    return build({
      source, riskLevel: dev !== null && dev > 15 ? RISK.HIGH : RISK.MEDIUM,
      confidence: 0.7, missingInfo, repair_plan: repairPlan(dev !== null && dev > 15 ? 'high' : 'motor_overheat'),
      summary: '疑似负载不平衡或机械卡滞，建议优先核对三相电流与转动阻力。',
      causes: [
        { text: '负载卡滞或泵/风机阻力过大', evidence: evLocal.slice(0, 1) },
        { text: '三相电流不平衡，可能存在接线或绕组问题', evidence: evLocal },
        { text: '散热通道堵塞导致温升异常', evidence: [] }
      ],
      steps: [
        { text: '断电后手动确认联轴器/负载无卡滞', safety: '确认已断电挂牌' },
        { text: '核对三相端子紧固状态', safety: '使用力矩扳手' },
        { text: '空载与带载分别测量三相电流并比较', safety: '测量需持证人员' },
        { text: '检查风道、风扇和热继电器整定值', safety: '' }
      ],
      safety: '测量前必须验电；旋转部件未完全停止前不得靠近或拆护罩。',
      escalation: '三相电流差异明显、绝缘测试异常或温升持续上升时停机报修。'
    });
  }

  // 4) 变频器
  if (/(过流|e-oc)/.test(text) && device.includes('变频器')) {
    return build({
      source, riskLevel: RISK.HIGH, confidence: 0.7, missingInfo,
      repair_plan: repairPlan('high'),
      summary: '疑似加速段电流冲击或负载侧异常，优先延长加速时间并核对参数。',
      causes: [
        { text: '加速时间过短或转矩提升过高', evidence: [] },
        { text: '电机/负载机械阻力突增', evidence: [] },
        { text: '电机参数与变频器设置不匹配', evidence: [] }
      ],
      steps: [
        { text: '确认停机后检查负载是否卡滞', safety: '确认已断电挂牌' },
        { text: '核对电机铭牌参数与变频器自学习设置', safety: '' },
        { text: '将加速时间逐步延长并观察电流趋势', safety: '禁止反复强制复位' },
        { text: '检查输出电缆绝缘和接地', safety: '等待母线放电后验电' }
      ],
      safety: '变频器断电后仍可能残留直流母线电压，等待规定放电时间并验电。',
      escalation: '若空载仍过流或保护重复触发，停止试机并交专业人员处理。'
    });
  }

  // 5) 配电柜
  if (/(嗡嗡|发热|温度)/.test(text) && device.includes('配电柜')) {
    return build({
      source, riskLevel: RISK.HIGH, confidence: 0.75, missingInfo,
      repair_plan: repairPlan('high'),
      summary: '疑似接点接触不良引起局部发热，需优先处理端子与母排连接。',
      causes: [
        { text: '端子螺栓松动或压接不良', evidence: ev },
        { text: '负载偏大或三相不平衡', evidence: [] },
        { text: '柜内散热不良', evidence: [] }
      ],
      steps: [
        { text: '停电、验电后检查端子压接和变色痕迹', safety: '执行挂牌上锁' },
        { text: '按规定力矩复紧连接点', safety: '使用力矩扳手' },
        { text: '记录各相电流并检查负载分配', safety: '' },
        { text: '复电后用红外测温复核温升', safety: '复电需负责人确认' }
      ],
      safety: '柜内作业必须执行停电验电和挂牌上锁；不得仅凭声音判断可继续运行。',
      escalation: '端子温度持续升高、出现变色/焦味或保护动作时立即停机。'
    });
  }

  // 6) 兜底
  return build({
    source, riskLevel: RISK.LOW, confidence: 0.4, missingInfo,
    repair_plan: vagueSymptom || device === '未知设备' ? [] : repairPlan('isolation'),
    summary: '信息不足，建议先补充设备铭牌、故障发生时刻和三相测量值。',
    causes: [
      { text: '现象暂不足以支持单一判断', evidence: [] },
      { text: '可能与接线、负载、供电或环境有关', evidence: ev }
    ],
    steps: [
      { text: '确认设备已安全停机并挂牌', safety: '验电确认无电压' },
      { text: '核对铭牌参数、接线和保护设置', safety: '' },
      { text: '记录空载/带载状态下的电压与电流', safety: '测量需持证人员' },
      { text: '补充信息后再次诊断', safety: '' }
    ],
    safety: '仅由具备资质人员进行验电、测量和拆检；禁止带电触碰裸露导体。',
    escalation: '出现冒烟、焦糊味、火花或保护装置反复动作时，立即停机、隔离电源并联系专业人员。'
  });
}

