// Rebuilds dcagent_test from the migrations. Refuses any database whose name does not end with _test.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import dotenv from 'dotenv';
import { assertTestDb } from './lib/assertDb';

const root = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(root, '.env.test'), override: true });
const name = assertTestDb(process.env.DATABASE_URL);
execFileSync('npx', ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'], {
  cwd: root,
  stdio: ['ignore', 'ignore', 'inherit'],
  env: { ...process.env },
});
console.log(`[ok] ${name} reset to the latest migration`);
