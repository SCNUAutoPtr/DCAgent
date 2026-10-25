import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { after, test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { withDb } from '../scripts/lib/assertDb';
import { env } from '../src/config/env';
import { prisma } from './helpers';

after(() => prisma.$disconnect());

async function legacyAvailable(): Promise<boolean> {
  const legacy = new PrismaClient({ datasourceUrl: withDb(env.DATABASE_URL, 'dcagent_legacy') });
  try {
    await legacy.$queryRaw`SELECT 1 FROM "ShortIdPool" LIMIT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await legacy.$disconnect();
  }
}

function run(): string {
  return execFileSync('npx', ['tsx', 'scripts/migrate-from-legacy.ts', '--target=test', '--apply'], {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

test('13. migrate-from-legacy is green and repeatable on dcagent_test', async (t) => {
  if (!(await legacyAvailable())) {
    t.skip('dcagent_legacy missing: run npm run db:legacy:restore');
    return;
  }
  const first = run();
  const second = run();
  const digest = (s: string) => /digest (\w+)/.exec(s)?.[1];
  assert.match(first, /\[ok\] committed/);
  assert.match(second, /\[ok\] committed/);
  assert.ok(!/\[FAIL\]/.test(first + second));
  assert.equal(digest(first), digest(second));
  assert.equal(await prisma.label.count(), 192);
  assert.equal(await prisma.ipAddress.count(), 296);
});
