// 解析华为交换机命令输出（display interface brief / display transceiver diagnosis），
// 并按现场排障经验给出端口健康结论。纯函数，不碰数据库。

export interface InterfaceBriefRow {
  interface: string;
  shortName: string;
  phy: string;
  protocol: string;
  inUtilPercent: number | null;
  outUtilPercent: number | null;
  inErrors: number;
  outErrors: number;
}

export interface TransceiverItem {
  unit: string;
  value: number;
  highAlarm: number | null;
  highWarn: number | null;
  lowAlarm: number | null;
  lowWarn: number | null;
  status: string;
}

export interface TransceiverDiagnosis {
  interface: string;
  items: Record<string, TransceiverItem>;
}

export type FindingSeverity = 'critical' | 'warning';
export type FindingKind = 'RX_POWER' | 'TX_POWER' | 'INPUT_ERRORS' | 'OUTPUT_ERRORS' | 'UTILIZATION';

export interface PortFinding {
  interface: string;
  shortName: string;
  kind: FindingKind;
  severity: FindingSeverity;
  value: number;
  marginDb?: number;
  message: string;
}

// 入方向错包超过这个数算严重（445A 那根坏光纤是几千到上千万）
const ERROR_CRITICAL = 1000;
const UTIL_WARNING = 80;

export function shortInterfaceName(name: string): string {
  return name.replace(/^XGigabitEthernet/, 'XGE').replace(/^GigabitEthernet/, 'GE');
}

const toNumber = (s: string): number | null => {
  const n = Number.parseFloat(s.replace('%', ''));
  return Number.isFinite(n) ? n : null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function parseInterfaceBrief(text: string): InterfaceBriefRow[] {
  const rows: InterfaceBriefRow[] = [];
  const re = /^(\S+)\s+([*^]?(?:up|down)\S*)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d+)\s*$/;
  for (const line of text.split(/\r?\n/)) {
    const m = re.exec(line.trim());
    if (!m || m[1] === 'Interface') continue;
    rows.push({
      interface: m[1],
      shortName: shortInterfaceName(m[1]),
      phy: m[2],
      protocol: m[3],
      inUtilPercent: toNumber(m[4]),
      outUtilPercent: toNumber(m[5]),
      inErrors: Number(m[6]),
      outErrors: Number(m[7]),
    });
  }
  return rows;
}

export function parseTransceiverDiagnosis(text: string): TransceiverDiagnosis[] {
  const result: TransceiverDiagnosis[] = [];
  let current: TransceiverDiagnosis | null = null;
  const item = /^(\w+)\(([^)]+)\)\s+(-?[\d.]+)\s+(-?[\d.]+|-)\s+(-?[\d.]+|-)\s+(-?[\d.]+|-)\s+(-?[\d.]+|-)\s+(\S+)\s*$/;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const port = /^Port (\S+) transceiver diagnostic information/.exec(line);
    if (port) {
      if (!result.some((r) => r.interface === port[1])) {
        current = { interface: port[1], items: {} };
        result.push(current);
      } else {
        current = result.find((r) => r.interface === port[1])!;
      }
      continue;
    }
    const m = current && item.exec(line);
    if (!current || !m) continue;
    current.items[m[1]] = {
      unit: m[2],
      value: Number(m[3]),
      highAlarm: toNumber(m[4]),
      highWarn: toNumber(m[5]),
      lowAlarm: toNumber(m[6]),
      lowWarn: toNumber(m[7]),
      status: m[8],
    };
  }
  return result;
}

function powerFinding(iface: string, kind: 'RX_POWER' | 'TX_POWER', it: TransceiverItem): PortFinding | null {
  const shortName = shortInterfaceName(iface);
  const margin = it.lowAlarm === null ? undefined : round1(it.value - it.lowAlarm);
  const label = kind === 'RX_POWER' ? '收光' : '发光';
  if ((it.lowAlarm !== null && it.value <= it.lowAlarm) || it.status !== 'Normal') {
    return {
      interface: iface, shortName, kind, severity: 'critical', value: it.value, marginDb: margin,
      message: `${label} ${it.value} dBm，已到告警线 ${it.lowAlarm} dBm 以下：查光纤、跳线、端面`,
    };
  }
  if (it.lowWarn !== null && it.value <= it.lowWarn) {
    return {
      interface: iface, shortName, kind, severity: 'warning', value: it.value, marginDb: margin,
      message: `${label} ${it.value} dBm，距告警线只剩 ${margin} dB`,
    };
  }
  return null;
}

export function assessPortHealth(input: {
  interfaces: InterfaceBriefRow[];
  transceivers: TransceiverDiagnosis[];
}): PortFinding[] {
  const findings: PortFinding[] = [];

  for (const t of input.transceivers) {
    for (const kind of ['RX_POWER', 'TX_POWER'] as const) {
      const it = t.items[kind === 'RX_POWER' ? 'RxPower' : 'TxPower'];
      const f = it && powerFinding(t.interface, kind, it);
      if (f) findings.push(f);
    }
  }

  for (const r of input.interfaces) {
    for (const [kind, value] of [['INPUT_ERRORS', r.inErrors], ['OUTPUT_ERRORS', r.outErrors]] as const) {
      if (value <= 0) continue;
      findings.push({
        interface: r.interface, shortName: r.shortName, kind,
        severity: value >= ERROR_CRITICAL ? 'critical' : 'warning', value,
        message: `${kind === 'INPUT_ERRORS' ? '入' : '出'}方向累计错包 ${value}（计数器自上次清零起累计，持续增长才说明问题仍在）`,
      });
    }
    const util = Math.max(r.inUtilPercent ?? 0, r.outUtilPercent ?? 0);
    if (util >= UTIL_WARNING) {
      findings.push({
        interface: r.interface, shortName: r.shortName, kind: 'UTILIZATION', severity: 'warning', value: util,
        message: `利用率 ${util}%`,
      });
    }
  }

  const rank = { critical: 0, warning: 1 };
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
