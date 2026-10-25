// Locale and text hygiene, run with `node --test scripts/`:
// - every namespace exists in all languages with exactly the same keys (zh-CN is the reference);
// - the CJK allowlist only names files that exist and still contain CJK text (so fixed files must leave it);
// - no emoji anywhere in sources, tests or locales.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const locales = path.join(root, 'src', 'locales');
const LANGS = ['zh-CN', 'en-US', 'ja-JP'];
const CJK = /[぀-ヿ㐀-䶿一-鿿＀-￯]/;
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]|\u{FE0F}/u;

function keys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

const namespaces = (lang) =>
  readdirSync(path.join(locales, lang))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();

test('every language has the same namespaces', () => {
  for (const lang of LANGS.slice(1)) assert.deepEqual(namespaces(lang), namespaces('zh-CN'), lang);
});

for (const ns of namespaces('zh-CN')) {
  test(`namespace ${ns} has the same keys in every language`, () => {
    const load = (lang) => JSON.parse(readFileSync(path.join(locales, lang, `${ns}.json`), 'utf8'));
    const ref = new Set(keys(load('zh-CN')));
    for (const lang of LANGS.slice(1)) {
      const other = new Set(keys(load(lang)));
      const missing = [...ref].filter((k) => !other.has(k));
      const extra = [...other].filter((k) => !ref.has(k));
      assert.deepEqual({ missing, extra }, { missing: [], extra: [] }, `${lang}/${ns}.json`);
    }
  });
}

test('the CJK allowlist only names files that still need it', () => {
  const { files } = JSON.parse(readFileSync(path.join(root, 'eslint-cjk-allowlist.json'), 'utf8'));
  for (const f of files) {
    const full = path.join(root, f);
    assert.ok(existsSync(full), `${f} does not exist: remove it from eslint-cjk-allowlist.json`);
    const code = readFileSync(full, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    assert.ok(CJK.test(code), `${f} has no CJK literals left: remove it from eslint-cjk-allowlist.json`);
  }
});

test('no emoji in sources, tests or locales', () => {
  const bad = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const full = path.join(dir, f);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx|mjs|json|css|html)$/.test(f)) {
        readFileSync(full, 'utf8')
          .split('\n')
          .forEach((line, i) => EMOJI.test(line) && bad.push(`${path.relative(root, full)}:${i + 1}`));
      }
    }
  };
  for (const d of ['src', 'e2e', 'scripts']) walk(path.join(root, d));
  assert.deepEqual(bad, []);
});

test('the errors namespace covers every backend error code', () => {
  const enums = readFileSync(path.join(root, '..', 'backend', 'src', 'contracts', 'enums.ts'), 'utf8');
  const block = /ERROR_CODES = \[([\s\S]*?)\] as const/.exec(enums);
  assert.ok(block, 'ERROR_CODES not found in contracts/enums.ts');
  const codes = [...block[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  const errors = JSON.parse(readFileSync(path.join(locales, 'zh-CN', 'errors.json'), 'utf8'));
  assert.deepEqual(codes.filter((c) => typeof errors[c] !== 'string'), []);
});
