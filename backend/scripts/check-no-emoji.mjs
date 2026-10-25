// Fails when an emoji appears in backend sources, scripts or migrations.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dirs = ['src', 'scripts', 'test', 'prisma'];
const re = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/u;
const bad = [];
function walk(p) {
  for (const f of readdirSync(p)) {
    const full = path.join(p, f);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|mjs|js|sql|prisma|sh)$/.test(f)) {
      readFileSync(full, 'utf8').split('\n').forEach((line, i) => {
        if (re.test(line)) bad.push(`${path.relative(root, full)}:${i + 1}`);
      });
    }
  }
}
for (const d of dirs) walk(path.join(root, d));
if (bad.length) {
  console.error(`[error] emoji found:\n${bad.join('\n')}`);
  process.exit(1);
}
console.log('[ok] no emoji');
