// 可观测性的"决策"部分：把外部采集到的数据和库里的记录对上，算出该改什么。纯函数。
import type { InterfaceBriefRow, TransceiverDiagnosis } from './huaweiParser';

export interface WorkstationRef {
  id: string;
  name: string;
  code: string | null;
  ip: string | null;
  mac: string | null;
}

export interface PowerRow {
  name: string;
  ip: string;
  mac: string;
  online: boolean;
}

const normMac = (mac: string | null | undefined) => (mac ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');

function matcher(workstations: WorkstationRef[]) {
  const byKey = new Map<string, WorkstationRef>();
  for (const w of workstations) {
    if (w.mac) byKey.set(`mac:${normMac(w.mac)}`, w);
    if (w.ip) byKey.set(`ip:${w.ip}`, w);
    byKey.set(`name:${w.name}`, w);
    if (w.code) byKey.set(`name:${w.code}`, w); // code wins over name
  }
  return (name: string, ip?: string, mac?: string) =>
    byKey.get(`name:${name}`) ?? (ip ? byKey.get(`ip:${ip}`) : undefined) ?? (mac ? byKey.get(`mac:${normMac(mac)}`) : undefined);
}

/**
 * Power probe -> per workstation: online or not. Every matched row refreshes lastCheckedAt,
 * online rows also lastSeenAt. The manual adminState is never touched.
 */
export function planPowerSync(rows: PowerRow[], workstations: WorkstationRef[]) {
  const find = matcher(workstations);
  const plan = { updates: [] as { id: string; online: boolean }[], unmatched: [] as string[] };
  for (const r of rows) {
    const w = find(r.name, r.ip, r.mac);
    if (!w) plan.unmatched.push(r.name);
    else plan.updates.push({ id: w.id, online: r.online });
  }
  return plan;
}

/** ports.json: { seat: [switch sysname, interface, source?] } -> seats matched to workstations. */
export function planPortSync(ports: Record<string, string[]>, workstations: WorkstationRef[]) {
  const find = matcher(workstations);
  const plan = {
    matches: [] as { id: string; seat: string; sysname: string; ifName: string; source: string | null }[],
    unmatched: [] as string[],
  };
  for (const [seat, [sysname, ifName, source]] of Object.entries(ports)) {
    const w = find(seat);
    if (!w) plan.unmatched.push(seat);
    else plan.matches.push({ id: w.id, seat, sysname, ifName, source: source ?? null });
  }
  return plan;
}

export interface ObservationRow {
  ifName: string;
  phy: string | null;
  inUtilPercent: number | null;
  outUtilPercent: number | null;
  inErrors: number | null;
  outErrors: number | null;
  rxPowerDbm: number | null;
  txPowerDbm: number | null;
  rxLowAlarmDbm: number | null;
  rxLowWarnDbm: number | null;
}

export function mergeObservations(brief: InterfaceBriefRow[], transceivers: TransceiverDiagnosis[]): ObservationRow[] {
  const rows = new Map<string, ObservationRow>();
  const get = (iface: string) => {
    let r = rows.get(iface);
    if (!r) {
      r = {
        ifName: iface, phy: null, inUtilPercent: null, outUtilPercent: null, inErrors: null, outErrors: null,
        rxPowerDbm: null, txPowerDbm: null, rxLowAlarmDbm: null, rxLowWarnDbm: null,
      };
      rows.set(iface, r);
    }
    return r;
  };
  for (const b of brief) {
    Object.assign(get(b.interface), {
      phy: b.phy, inUtilPercent: b.inUtilPercent, outUtilPercent: b.outUtilPercent, inErrors: b.inErrors, outErrors: b.outErrors,
    });
  }
  for (const t of transceivers) {
    const r = get(t.interface);
    const rx = t.items.RxPower;
    r.rxPowerDbm = rx?.value ?? null;
    r.rxLowAlarmDbm = rx?.lowAlarm ?? null;
    r.rxLowWarnDbm = rx?.lowWarn ?? null;
    r.txPowerDbm = t.items.TxPower?.value ?? null;
  }
  return [...rows.values()];
}

export interface GrowthFinding {
  interface: string;
  kind: 'ERRORS_GROWING';
  severity: 'critical';
  value: number;
  since: Date;
  message: string;
}

export function errorGrowthFindings(
  current: { ifName: string; inErrors: number | null; outErrors: number | null }[],
  previous: Map<string, { inErrors: number | null; outErrors: number | null; collectedAt: Date }>,
): GrowthFinding[] {
  const findings: GrowthFinding[] = [];
  for (const c of current) {
    const p = previous.get(c.ifName);
    if (!p) continue;
    const grow = (now: number | null, before: number | null) => (now !== null && before !== null && now > before ? now - before : 0);
    const delta = grow(c.inErrors, p.inErrors) + grow(c.outErrors, p.outErrors);
    if (delta > 0) {
      findings.push({
        interface: c.ifName, kind: 'ERRORS_GROWING', severity: 'critical', value: delta, since: p.collectedAt,
        message: `上次采集以来错包又涨了 ${delta}，问题还在`,
      });
    }
  }
  return findings;
}

export interface Endpoint {
  name: string;
  kind: 'workstation' | 'device' | 'ip';
  location?: string;
}

export function buildEndpointIndex(
  workstations: { name: string; ip: string | null; location: string | null }[],
  ipRecords: { address: string; hostname: string | null; device: { name: string } | null }[],
): Map<string, Endpoint> {
  const index = new Map<string, Endpoint>();
  for (const r of ipRecords) {
    const name = r.device?.name ?? r.hostname;
    if (name) index.set(r.address, { name, kind: r.device ? 'device' : 'ip' });
  }
  for (const w of workstations) {
    if (!w.ip) continue;
    index.set(w.ip, w.location ? { name: w.name, kind: 'workstation', location: w.location } : { name: w.name, kind: 'workstation' });
  }
  return index;
}
