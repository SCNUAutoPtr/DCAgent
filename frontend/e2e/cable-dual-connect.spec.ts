import { test, expect } from '@playwright/test';
import { preparePage } from './helpers/setup';
import {
  apiCreatePanel,
  apiCreatePort,
  apiDeletePanel,
  apiGetCableEndpointsByShortId,
  apiGetDeviceByName,
} from './helpers/api';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('creates a dual-end cable connection from topology page', async ({ page, request }) => {
  const deviceA = await apiGetDeviceByName(request, 'WEB-Server-01');
  const deviceB = await apiGetDeviceByName(request, 'DB-Server-01');
  expect(deviceA).not.toBeNull();
  expect(deviceB).not.toBeNull();

  const panelA = await apiCreatePanel(request, {
    deviceId: deviceA!.id,
    name: 'E2E-Cable-A',
    type: 'NETWORK',
    shortId: 70012,
  });
  const panelB = await apiCreatePanel(request, {
    deviceId: deviceB!.id,
    name: 'E2E-Cable-B',
    type: 'NETWORK',
    shortId: 70013,
  });

  await apiCreatePort(request, {
    panelId: panelA.id,
    number: '1',
    label: 'Port-1',
    portType: 'RJ45',
    position: { x: 40, y: 12 },
    size: { width: 18, height: 12 },
  });
  await apiCreatePort(request, {
    panelId: panelB.id,
    number: '1',
    label: 'Port-1',
    portType: 'RJ45',
    position: { x: 40, y: 12 },
    size: { width: 18, height: 12 },
  });

  try {
    await page.goto('http://localhost:5173/topology');
    await page.locator('[data-testid="topology-create-cable-btn"]').click();
    await expect(page.locator('[data-testid="create-cable-modal"]')).toBeVisible();

    await page.locator('[data-testid="cable-tab-dual"]').click();
    await expect(page.locator('[data-testid="cable-dual-mode"]')).toBeVisible();

    await page.locator('[data-testid="cable-panel-a-select"]').click();
    await page.locator(`[data-testid="cable-panel-option-${panelA.id}"]`).first().click();
    await page.locator('[data-testid="cable-port-a-select"]').click();
    await page.locator('[data-testid^="cable-port-option-"]').filter({ hasText: /^1 \(Port-1\)$/ }).first().click();

    await page.locator('[data-testid="cable-panel-b-select"]').click();
    await page.locator(`[data-testid="cable-panel-option-${panelB.id}"]`).last().click();
    await page.locator('[data-testid="cable-port-b-select"]').click();
    await page.locator('[data-testid^="cable-port-option-"]').filter({ hasText: /^1 \(Port-1\)$/ }).last().click();

    await page.locator('[data-testid="cable-shortid-a-input"]').fill('70020');
    await page.locator('[data-testid="cable-shortid-b-input"]').fill('70021');
    await page.locator('[data-testid="cable-label-input"]').fill('E2E Dual Cable');

    await page.locator('[data-testid="cable-type-select"]').click();
    await page.locator('.ant-select-item-option-content').filter({ hasText: 'CAT6 网线' }).click();

    await page.locator('[data-testid="cable-submit-btn"]').click();

    await expect.poll(async () => {
      try {
        const endpoint = await apiGetCableEndpointsByShortId(request, 70020);
        return endpoint?.cable?.label ?? null;
      } catch {
        return null;
      }
    }).toBe('E2E Dual Cable');
  } finally {
    try {
      await apiDeletePanel(request, panelA.id);
    } catch {
    }
    try {
      await apiDeletePanel(request, panelB.id);
    } catch {
    }
  }
});
