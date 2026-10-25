// Every page opens on an empty-ish test database, and its main dialogs open and close, with a clean console.
import { expect, test } from './helpers/test';
import { createHierarchy, rpc } from './helpers/api';
import type { SubnetDto } from '@contracts/ip';

test('every page renders and its main dialogs open', async ({ page, request }) => {
  const h = await createHierarchy(request, { ports: 4, room: { widthM: 8, depthM: 6 } });
  const subnet = await rpc<SubnetDto>(request, 'subnets/create', { name: 'E2E smoke', network: '10.250.0.0/24', gateway: '10.250.0.1' });
  const port = h.panel.ports[0];

  const pages: { path: string; open?: string; drawer?: boolean }[] = [
    { path: '/' },
    { path: '/datacenters', open: '新建数据中心' },
    { path: '/rooms', open: '新建机房' },
    { path: `/rooms/${h.room.id}` },
    { path: '/cabinets', open: '新建机柜' },
    { path: `/cabinets/${h.cabinet.id}`, open: '添加设备' },
    { path: '/devices', open: '新建设备' },
    { path: '/panels', open: '新建面板' },
    { path: '/topology', open: '创建连接' },
    { path: `/topology/panel/${h.panel.id}` },
    { path: `/ports/${port.id}` },
    { path: '/cable-manual-inventory' },
    { path: '/cable-scrap' },
    { path: '/optical-modules', open: '采购入库' },
    { path: '/labels', open: '生成号段' },
    { path: '/ip-management', open: '创建子网' },
    { path: `/ip-management/subnet/${subnet.id}`, open: '分配IP' },
    { path: '/observability' },
    { path: '/datacenter-3d' },
    { path: `/datacenter-3d/${h.room.id}/${h.cabinet.id}` },
    { path: '/bulk-deployment' },
    { path: '/panel-templates', open: '新建模板', drawer: true },
  ];

  for (const p of pages) {
    await test.step(p.path, async () => {
      await page.goto(p.path);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.ant-layout-content').first()).toBeVisible();
      if (p.open) {
        await page.getByRole('button', { name: new RegExp(p.open.split('').join('\\s*')) }).first().click();
        const dialog = p.drawer
          ? page.locator('.ant-drawer-open .ant-drawer-content').last()
          : page.locator('.ant-modal-wrap:not([style*="display: none"]) .ant-modal').last();
        await expect(dialog).toBeVisible();
        await dialog.locator(p.drawer ? '.ant-drawer-close' : '.ant-modal-close').click();
        await expect(dialog).toBeHidden();
      }
    });
  }
});
