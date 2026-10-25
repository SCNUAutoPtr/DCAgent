// goflow2 JSON 行（sFlow v5 / NetFlow v9）解析与内存滚动窗口汇总。

export interface FlowRecord {
  type: string;
  sampler: string;
  src: string;
  dst: string;
  proto: string;
  srcPort: number;
  dstPort: number;
  bytes: number; // 已乘采样率的估算值
  packets: number;
  timeMs: number;
}

export interface TopFlow {
  src: string;
  dst: string;
  proto: string;
  dstPort: number;
  bytes: number;
  packets: number;
  records: number;
  bitsPerSecond: number;
}

/**
 * 解析 goflow2 的一行 JSON。计数器样本等没有地址的记录返回 null。
 * 华为 NetStream v9 不在模板里带采样率（sampling_rate=0），用 defaultRates 按采样器补。
 */
export function parseFlowLine(line: string, defaultRates: Record<string, number> = {}): FlowRecord | null {
  let d: any;
  try {
    d = JSON.parse(line);
  } catch {
    return null;
  }
  if (!d || !d.src_addr || !d.dst_addr) return null;
  const sampler = String(d.sampler_address ?? '');
  const rate = Number(d.sampling_rate) || defaultRates[sampler] || 1;
  return {
    type: String(d.type ?? ''),
    sampler,
    src: d.src_addr,
    dst: d.dst_addr,
    proto: String(d.proto ?? ''),
    srcPort: Number(d.src_port) || 0,
    dstPort: Number(d.dst_port) || 0,
    bytes: (Number(d.bytes) || 0) * rate,
    packets: (Number(d.packets) || 0) * rate,
    timeMs: Math.floor(Number(d.time_received_ns ?? 0) / 1e6),
  };
}

export class FlowWindow {
  private records: FlowRecord[] = [];

  constructor(private capacity = 200000) {}

  add(flows: FlowRecord[]) {
    this.records.push(...flows);
    if (this.records.length > this.capacity) {
      this.records.splice(0, this.records.length - this.capacity);
    }
  }

  size() {
    return this.records.length;
  }

  samplers() {
    return [...new Set(this.records.map((r) => r.sampler))].sort();
  }

  top(opts: { now: number; windowMs: number; sampler?: string; limit?: number }): TopFlow[] {
    const acc = new Map<string, TopFlow>();
    for (const r of this.records) {
      if (opts.now - r.timeMs > opts.windowMs || r.timeMs > opts.now) continue;
      if (opts.sampler && r.sampler !== opts.sampler) continue;
      const key = `${r.src}|${r.dst}|${r.proto}|${r.dstPort}`;
      const row = acc.get(key) ?? {
        src: r.src, dst: r.dst, proto: r.proto, dstPort: r.dstPort, bytes: 0, packets: 0, records: 0, bitsPerSecond: 0,
      };
      row.bytes += r.bytes;
      row.packets += r.packets;
      row.records += 1;
      acc.set(key, row);
    }
    const seconds = opts.windowMs / 1000;
    return [...acc.values()]
      .map((r) => ({ ...r, bitsPerSecond: Math.round((r.bytes * 8) / seconds) }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, opts.limit ?? 20);
  }
}
