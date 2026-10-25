import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from './helpers/test';
import { createHierarchy, createWorkstation } from './helpers/api';

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../backend/src/services/observability/fixtures');

test('port health check flags the bad 445A fiber without saving', async ({ page }) => {
  await page.goto('/observability');
  await page.getByRole('tab', { name: '端口体检' }).click();
  await page.getByTestId('observability-switch-name').fill('E2E-445A-U6');
  await page.getByTestId('observability-brief').fill(readFileSync(path.join(fixtures, 'f13-interface-brief.txt'), 'utf8'));
  await page.getByTestId('observability-transceiver').fill(readFileSync(path.join(fixtures, '445a-u6-transceiver.txt'), 'utf8'));
  await page.getByLabel('保存为快照').uncheck();
  await page.getByTestId('observability-analyze').click();

  const findings = page.getByTestId('observability-findings');
  await expect(findings).toBeVisible();
  await expect(findings.locator('tr', { hasText: '收光' })).toContainText('XGE0/0/1');
  await expect(findings.locator('tr', { hasText: '入错包' }).first()).toContainText('2731');
});

test('seat map shows the workstations of a room', async ({ page, request }) => {
  const h = await createHierarchy(request, { room: { widthM: 6, depthM: 4 } });
  await createWorkstation(request, h.room.id, 'C445A-01', { fpX: 1, fpY: 1 });
  await createWorkstation(request, h.room.id, 'C445A-02', { fpX: 2, fpY: 1 });

  await page.goto('/observability');
  const seats = page.getByTestId('observability-seats');
  await expect(seats).toBeVisible();
  await expect(seats.getByTestId('seat-C445A-01')).toBeVisible();
  await expect(seats.getByTestId('seat-C445A-02')).toBeVisible();
});

test('traffic tab loads', async ({ page }) => {
  await page.goto('/observability');
  await page.getByRole('tab', { name: '流量' }).click();
  await expect(page.getByTestId('observability-flows')).toBeVisible();
});
