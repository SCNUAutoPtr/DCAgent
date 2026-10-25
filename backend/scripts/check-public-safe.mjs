// Fails when a tracked file leaks real network details into this public repo.
// Rules: docs/PUBLIC_SAFETY.md. Real private prefixes live in the untracked
// repo-root file .public-safe.local (one prefix per line), never in git.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const IGNORE_MARK = 'public-safe-ignore';
const DOC_RANGES = ['192.0.2.', '198.51.100.', '203.0.113.'];
const WELL_KNOWN = new Set(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
const EXAMPLE_MACS = new Set(['000000000000', 'ffffffffffff', '001122334455']);

const IP_RE = /(?<![\d.\\])(\d{1,3})\\?\.(\d{1,3})\\?\.(\d{1,3})\\?\.(\d{1,3})(?![\d.]*\d)/g;
const MAC_RE =
  /(?<![0-9a-f:-])(?:[0-9a-f]{2}([:-])[0-9a-f]{2}(?:\1[0-9a-f]{2}){4}|[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4})(?![0-9a-f:-])/gi;
const HOME_RE = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//g;

function ipKind(o, deny) {
  if (o.some((n) => n > 255)) return null; // version numbers like 5.14.0.687
  const ip = o.join('.');
  if (deny.some((p) => ip.startsWith(p))) return 'deny';
  const [a, b] = o;
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat-ip';
  const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  const isSpecial = a === 0 || a === 127 || a >= 224 || (a === 169 && b === 254);
  if (isPrivate || isSpecial || WELL_KNOWN.has(ip) || DOC_RANGES.some((p) => ip.startsWith(p))) return null;
  return 'public-ip';
}

function macOk(raw) {
  const hex = raw.replace(/[:-]/g, '').toLowerCase();
  return EXAMPLE_MACS.has(hex) || (parseInt(hex.slice(0, 2), 16) & 0x02) !== 0;
}

/** Findings for one text; deny = real private prefixes like "10.77.". */
export function scanText(text, deny = []) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (line.includes(IGNORE_MARK)) return;
    for (const m of line.matchAll(IP_RE)) {
      const kind = ipKind(m.slice(1, 5).map(Number), deny);
      if (kind) out.push({ line: i + 1, kind, match: m[0] });
    }
    for (const m of line.matchAll(MAC_RE)) if (!macOk(m[0])) out.push({ line: i + 1, kind: 'mac', match: m[0] });
    for (const m of line.matchAll(HOME_RE)) out.push({ line: i + 1, kind: 'home-path', match: m[0] });
  });
  return out;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const localFile = path.join(root, '.public-safe.local');
  const deny = existsSync(localFile)
    ? readFileSync(localFile, 'utf8').split('\n').map((s) => s.trim()).filter((s) => s && !s.startsWith('#'))
    : [];
  const files = execFileSync('git', ['-c', 'core.quotepath=off', 'ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter((f) => f && !/(package-lock\.json|\.(png|jpe?g|gif|ico|svg|woff2?|ttf|glb|gltf|dump))$/i.test(f));
  const bad = [];
  for (const f of files) {
    const full = path.join(root, f);
    if (!existsSync(full)) continue;
    for (const x of scanText(readFileSync(full, 'utf8'), deny)) bad.push(`${f}:${x.line} ${x.kind} ${x.match}`);
  }
  if (bad.length) {
    console.error(`[error] public-safety check failed (see docs/PUBLIC_SAFETY.md):\n${bad.join('\n')}`);
    process.exit(1);
  }
  console.log(`[ok] public-safe (${files.length} files, ${deny.length} local deny prefixes)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
