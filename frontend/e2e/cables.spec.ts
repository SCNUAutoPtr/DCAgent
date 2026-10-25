import { expect, test } from './helpers/test';
import { createHierarchy, display, getCable, getPanel, nextLabel, resolveLabel } from './helpers/api';

test('creates a cable with both ends from the topology page', async ({ page, request }) => {
  const a = await createHierarchy(request, { ports: 2 });
  const b = await createHierarchy(request, { ports: 2 });
  const labelA = await nextLabel(request);
  const labelB = await nextLabel(request);

  await page.goto('/topology');
  await page.getByTestId('topology-create-cable-btn').click();
  await expect(page.getByTestId('create-cable-modal')).toBeVisible();
  await page.getByTestId('cable-tab-dual').click();
  await expect(page.getByTestId('cable-dual-mode')).toBeVisible();

  await page.getByTestId('cable-panel-a-select').click();
  await page.getByTestId(`cable-panel-option-${a.panel.id}`).filter({ visible: true }).click();
  await page.getByTestId('cable-port-a-select').click();
  await page.getByTestId(`cable-port-option-${a.panel.ports[0].id}`).filter({ visible: true }).click();
  await page.getByTestId('cable-panel-b-select').click();
  await page.getByTestId(`cable-panel-option-${b.panel.id}`).filter({ visible: true }).click();
  await page.getByTestId('cable-port-b-select').click();
  await page.getByTestId(`cable-port-option-${b.panel.ports[1].id}`).filter({ visible: true }).click();

  await page.getByTestId('cable-shortid-a-input').fill(display(labelA));
  await page.getByTestId('cable-shortid-b-input').fill(display(labelB));
  await page.getByTestId('cable-label-input').fill('E2E Dual Cable');
  await page.getByTestId('cable-type-select').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: 'CAT6 网线' }).click();
  await page.getByTestId('cable-submit-btn').click();
  await expect(page.locator('.ant-message-notice', { hasText: '线缆已创建' })).toBeVisible();

  const r = await resolveLabel(request, labelA);
  expect(r.bound?.kind).toBe('CABLE_ENDPOINT');
  const cableId = r.bound!.path.find((n) => n.kind === 'CABLE')!.id;
  const cable = await getCable(request, cableId);
  expect(cable).toMatchObject({ label: 'E2E Dual Cable', medium: 'CAT6', state: 'IN_USE' });
  expect(cable.endpoints.map((e) => e.portId).sort()).toEqual([a.panel.ports[0].id, b.panel.ports[1].id].sort());
});

test('quick mode: scan a panel, pick a port, scan a new plug', async ({ page, request }) => {
  const h = await createHierarchy(request, { ports: 2 });
  const plug = await nextLabel(request);

  await page.goto('/topology');
  await page.getByTestId('topology-create-cable-btn').click();
  await page.getByTestId('cable-tab-single').click();
  const mode = page.getByTestId('cable-single-mode');
  await expect(mode).toBeVisible();

  const panelInput = page.getByTestId('cable-single-panel-scan-input');
  await panelInput.fill(display(h.panel.label!.shortId));
  await panelInput.blur();
  await expect(mode.getByTestId('panel-view')).toBeVisible();
  await mode.getByTestId('panel-port-hitbox-1').click({ force: true });
  await expect(mode).toContainText('已选择: 1');

  const plugInput = page.getByTestId('cable-single-shortid-input');
  await plugInput.fill(display(plug));
  await plugInput.blur();
  await expect(mode).toContainText(`已录入：${display(plug)}`);
  await expect(page.getByTestId('cable-submit-btn')).toBeEnabled();
  await page.getByTestId('cable-submit-btn').click();
  await expect(page.locator('.ant-message-notice', { hasText: '线缆已创建' })).toBeVisible();

  const panel = await getPanel(request, h.panel.id);
  const port1 = panel.ports.find((p) => p.number === '1')!;
  expect(port1.connected).toBe(true);
  expect(port1.endpoint?.label?.shortId).toBe(plug);
});

test('scanning a plug in the header jumps to its cable', async ({ page, request }) => {
  const h = await createHierarchy(request, { ports: 1 });
  const plug = await nextLabel(request);
  await request.post('/api/v1/cables/create', {
    data: { medium: 'CAT6', label: 'E2E Scan', ends: { A: { portId: h.panel.ports[0].id, labelShortId: plug }, B: {} } },
  });

  await page.goto('/');
  const search = page.getByTestId('global-search');
  await search.fill(display(plug));
  await expect(page.locator('.ant-select-item-option')).toContainText(display(plug));
  await search.press('Enter');
  await expect(page).toHaveURL(/\/cables\/[0-9a-f-]{36}$/);
  await expect(page.getByText('E2E Scan')).toBeVisible();
});
