/**
 * 可观测性采集器：把现场数据推给 DCAgent。三种模式：
 *
 *   flows     经 jumper 实时 tail goflow2 的 flows.json，分批推给 /observability/flows/ingest（常驻）
 *   switches  经 jumper SSH 到交换机，抓 interface brief + 万兆口光模块诊断，存端口快照
 *   power     跑 lab-power 导出（哦易平台），同步工作站开关机状态
 *
 *   JUMPER_PASS=... npx tsx scripts/collect-observability.ts flows
 *   JUMPER_PASS=... SWITCH_PASS=... npx tsx scripts/collect-observability.ts switches 445A-U6=192.0.2.31 445C-F13=192.0.2.11
 *   npx tsx scripts/collect-observability.ts power
 *
 * 环境变量：
 *   DCAGENT_API   默认 http://localhost:3000/api/v1
 *   JUMPER        必填（flows / switches），形如 user@host，不设默认值
 *   SWITCH_USER   默认 netadmin
 *   LABPOWER_DIR  默认 ~/code/lab-power
 *   密码只从 JUMPER_PASS / SWITCH_PASS 读，不写进任何文件。
 */
import { execFile, spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { parseInterfaceBrief } from '../src/services/observability/huaweiParser';

const execFileAsync = promisify(execFile);

const API = process.env.DCAGENT_API ?? 'http://localhost:3000/api/v1';
const JUMPER = process.env.JUMPER ?? '';
const SWITCH_USER = process.env.SWITCH_USER ?? 'netadmin';
const LABPOWER_DIR = process.env.LABPOWER_DIR ?? path.join(os.homedir(), 'code', 'lab-power');
const FLOW_BATCH = 5000;
const FLOW_FLUSH_MS = 2000;

async function post<T>(route: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${route} ${res.status}: ${JSON.stringify(json)}`);
  return json as T;
}

// ---------- flows ----------

export function takeBatches(buffer: string[], size: number): string[][] {
  const batches: string[][] = [];
  while (buffer.length > 0) batches.push(buffer.splice(0, size));
  return batches;
}

function runFlows() {
  const buffer: string[] = [];
  let partial = '';
  const start = () => {
    const child = spawn('sshpass', ['-e', 'ssh', '-o', 'ServerAliveInterval=15', JUMPER, 'tail -F -n 0 ~/goflow2/flows.json'], {
      env: { ...process.env, SSHPASS: process.env.JUMPER_PASS ?? '' },
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      const lines = (partial + chunk).split('\n');
      partial = lines.pop() ?? '';
      buffer.push(...lines.filter(Boolean));
    });
    child.on('exit', (code) => {
      console.error(`jumper tail 退出(${code})，5 秒后重连`);
      setTimeout(start, 5000);
    });
  };
  start();
  setInterval(async () => {
    for (const lines of takeBatches(buffer, FLOW_BATCH)) {
      try {
        const r = await post<{ accepted: number; buffered: number }>('/observability/flows/ingest', { lines });
        console.log(`${new Date().toISOString()} +${r.accepted} 条，缓冲 ${r.buffered}`);
      } catch (e) {
        console.error('推送失败:', (e as Error).message);
      }
    }
  }, FLOW_FLUSH_MS);
}

// ---------- switches ----------

/** 经 jumper 登交换机执行一串 display 命令，返回原始输出 */
export function switchRemoteCommand(ip: string, commands: string[], user = SWITCH_USER): string {
  const script = ['screen-length 0 temporary', ...commands, 'quit'].join('\\n');
  // 第一行 stdin 是交换机密码，read 进环境变量交给 sshpass -e，不出现在任何命令行里
  return `read -r SSHPASS; export SSHPASS; printf '${script}\\n' | timeout 120 sshpass -e ssh -tt -o ConnectTimeout=8 ${user}@${ip} 2>&1 | tr -d '\\r'`;
}

async function runOnSwitch(ip: string, commands: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('sshpass', ['-e', 'ssh', JUMPER, switchRemoteCommand(ip, commands)], {
      env: { ...process.env, SSHPASS: process.env.JUMPER_PASS ?? '' },
    });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('exit', () => resolve(out));
    child.on('error', reject);
    child.stdin.end(`${process.env.SWITCH_PASS ?? ''}\n`);
  });
}

/** 从 brief 里挑出起来的光口（XGE 及以上），只对它们查光模块 */
export function opticalPortsUp(briefText: string): string[] {
  return parseInterfaceBrief(briefText)
    .filter((r) => r.phy === 'up' && /^(XGigabitEthernet|\d+GE|MultiGE)/.test(r.interface))
    .map((r) => r.interface);
}

async function runSwitches(targets: string[]) {
  for (const t of targets) {
    const [switchName, ip] = t.split('=');
    if (!switchName || !ip) {
      console.error(`参数格式应为 名字=IP，跳过: ${t}`);
      continue;
    }
    try {
      const brief = await runOnSwitch(ip, ['display interface brief']);
      const optical = opticalPortsUp(brief);
      const transceiver = optical.length
        ? await runOnSwitch(ip, optical.map((p) => `display transceiver diagnosis interface ${p}`))
        : '';
      const r = await post<{ saved: number; unmatched: number; findings: { shortName: string; kind: string; value: number }[] }>(
        '/observability/switches/snapshot',
        { sysname: switchName, interfaceBrief: brief, transceiver, save: true },
      );
      const bad = r.findings.map((f) => `${f.shortName} ${f.kind} ${f.value}`).join('; ');
      const lost = r.unmatched ? `，${r.unmatched} 行没对上设备(sysname)，进了待匹配` : '';
      console.log(`${switchName}: 存 ${r.saved} 个口${lost}，发现 ${r.findings.length} 项${bad ? `：${bad}` : ''}`);
    } catch (e) {
      console.error(`${switchName} 采集失败:`, (e as Error).message);
    }
  }
}

// ---------- power ----------

export function labPowerCsvToRows(csv: string) {
  const [header, ...lines] = csv.trim().split(/\r?\n/);
  const cols = header.split(',');
  const idx = (k: string) => cols.indexOf(k);
  return lines.map((l) => {
    const c = l.split(',');
    return { name: c[idx('name')], ip: c[idx('ip')] ?? '', mac: c[idx('mac')] ?? '', online: c[idx('status')] === '4' };
  });
}

async function runPower() {
  const { stdout } = await execFileAsync('python3', ['-m', 'labpower.cli', 'export'], { cwd: LABPOWER_DIR, timeout: 90000 });
  const rows = labPowerCsvToRows(stdout);
  const r = await post<{ updated: number; online: number; unmatched: string[] }>('/observability/workstations/sync-power', { rows, dryRun: false });
  console.log(`开关机同步：探测 ${r.updated}，在线 ${r.online}，对不上 ${r.unmatched.length}`);
}

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if ((mode === 'flows' || mode === 'switches') && !JUMPER) {
    console.error('JUMPER 未设置（形如 user@host）');
    process.exit(1);
  }
  if (mode === 'flows') return runFlows();
  if (mode === 'switches') return runSwitches(args);
  if (mode === 'power') return runPower();
  console.error('用法: collect-observability.ts flows | switches 名字=IP ... | power');
  process.exit(1);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
