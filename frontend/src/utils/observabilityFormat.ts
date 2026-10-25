const UNITS = ['', 'K', 'M', 'G', 'T'];

function scale(value: number, base: number): [number, string] {
  let v = value;
  let i = 0;
  while (Math.abs(v) >= base && i < UNITS.length - 1) {
    v /= base;
    i += 1;
  }
  return [v, UNITS[i]];
}

export function formatBytes(bytes: number): string {
  const [v, u] = scale(bytes, 1024);
  return `${v.toFixed(v >= 100 || u === '' ? 0 : 1)} ${u}B`;
}

export function formatBps(bps: number): string {
  const [v, u] = scale(bps, 1000);
  return `${v.toFixed(v >= 100 || u === '' ? 0 : 1)} ${u}bps`;
}

// 座位卡片边框粗细：按流量对数分档，0 流量 1px，约 100Mbps 以上 4px
export function trafficBorderWidth(bps: number): number {
  if (bps <= 0) return 1;
  return Math.min(4, 1 + Math.floor(Math.log10(bps) / 2.7));
}
