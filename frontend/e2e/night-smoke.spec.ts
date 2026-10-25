// Night smoke: read-only walk through the live stack (real data on 5173/3000).
// Nothing is created or saved; the template generator preview is closed without saving.
// Console errors/warnings, page errors and failed /api calls are collected into
// test-results/night-screenshots/issues.json instead of failing the run, so every page gets visited.
// Run: npx playwright test -c playwright.night.config.ts
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test as base, type Page } from '@playwright/test';

const SHOTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../test-results/night-screenshots');
fs.mkdirSync(SHOTS, { recursive: true });

interface Issue {
  test: string;
  url: string;
  kind: 'console.error' | 'console.warning' | 'pageerror' | 'api' | 'ui';
  text: string;
}
const issues: Issue[] = [];

const test = base.extend<{ collect: void }>({
  collect: [
    async ({ page }, use, info) => {
      const add = (kind: Issue['kind'], text: string) => issues.push({ test: info.title, url: page.url(), kind, text });
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') add(`console.${m.type()}` as Issue['kind'], m.text());
      });
      page.on('pageerror', (e) => add('pageerror', `${e.message}\n${(e.stack ?? '').split('\n').slice(0, 4).join('\n')}`));
      page.on('response', (r) => {
        if (r.url().includes('/api/') && r.status() >= 400) add('api', `${r.status()} ${r.request().method()} ${r.url()} ${r.request().postData() ?? ''}`);
      });
      page.on('requestfailed', (r) => {
        if (r.url().includes('/api/')) add('api', `failed ${r.url()} ${r.failure()?.errorText ?? ''}`);
      });
      await use();
    },
    { auto: true },
  ],
});

test.afterAll(() => {
  fs.writeFileSync(path.join(SHOTS, 'issues.json'), JSON.stringify(issues, null, 2));
});

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });

/** Visible error surfaces antd renders: error results, error messages/notifications, form alerts. */
async function uiErrors(page: Page): Promise<string[]> {
  return page
    .locator('.ant-result-error, .ant-message-error, .ant-notification-notice-error, .ant-alert-error')
    .evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.trim().slice(0, 300)));
}

/** i18n keys rendered as text (e.g. "templates.fields.name"): a missing translation. */
async function leakedKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const re = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_]+){1,4}$/;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const s = (n.textContent ?? '').trim();
      if (re.test(s) && !/^\d/.test(s) && !/\.(com|cn|net|org|local|json|ts|tsx|png)$/.test(s)) out.add(s);
    }
    return [...out];
  });
}

async function settle(page: Page, ms = 1500) {
  await page.waitForLoadState('load');
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => undefined);
  await page.waitForTimeout(ms);
}

async function checkPage(page: Page, testTitle: string) {
  for (const e of await uiErrors(page)) issues.push({ test: testTitle, url: page.url(), kind: 'ui', text: `visible error: ${e}` });
  for (const k of await leakedKeys(page)) issues.push({ test: testTitle, url: page.url(), kind: 'ui', text: `untranslated key on page: ${k}` });
}

interface Cabinet {
  id: string;
  name: string;
  roomId: string;
  fpX: number | null;
  deviceCount: number;
}
async function realCabinet(page: Page): Promise<Cabinet> {
  const res = await page.request.post('/api/v1/cabinets/list', { data: {} });
  expect(res.ok(), `cabinets/list ${res.status()}`).toBeTruthy();
  const list = (await res.json()) as Cabinet[];
  expect(list.length).toBeGreaterThan(0);
  return list.find((c) => c.fpX !== null && c.deviceCount > 0) ?? list[0];
}

test('dashboard, light and dark theme', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await settle(page);
  const html = page.locator('html');
  const start = await html.getAttribute('data-theme');
  await shot(page, `01-dashboard-${start ?? 'default'}`);
  await checkPage(page, info.title);

  await page.getByTestId('theme-toggle').click();
  const other = start === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', other);
  await page.waitForTimeout(800);
  await shot(page, `02-dashboard-${other}`);

  await page.getByTestId('theme-toggle').click();
  await expect(html).toHaveAttribute('data-theme', start ?? /.*/);
});

test('command palette finds a real cabinet by name', async ({ page }) => {
  const cab = await realCabinet(page);
  await page.goto('/');
  await expect(page.getByTestId('dashboard')).toBeVisible();
  await page.keyboard.press('Control+k');
  const input = page.getByTestId('command-palette-input');
  await expect(input).toBeFocused();
  await input.fill(cab.name);
  await page.waitForTimeout(1200);
  await shot(page, '03-command-palette-search');
  await input.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/cabinets/${cab.id}$`));
  await settle(page);
  await shot(page, '04-command-palette-cabinet-detail');
});

test('3D datacenter renders and a cabinet can be clicked', async ({ page }) => {
  const cab = await realCabinet(page);
  await page.goto(`/datacenter-3d/${cab.roomId}`);
  const canvas = page.locator('.dc3d-stage canvas').first();
  await expect(canvas).toBeVisible({ timeout: 20_000 });
  await settle(page, 3000);
  await shot(page, '05-datacenter-3d');

  const box = (await canvas.boundingBox())!;
  let hit = false;
  // sweep a grid over the canvas until a click selects a cabinet (URL gains a cabinet id)
  outer: for (let fy = 0.3; fy <= 0.8; fy += 0.1) {
    for (let fx = 0.15; fx <= 0.85; fx += 0.05) {
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
      await page.waitForTimeout(150);
      if (new RegExp(`/datacenter-3d/${cab.roomId}/[0-9a-f-]{36}$`).test(page.url())) {
        hit = true;
        break outer;
      }
    }
  }
  expect(hit, 'clicking somewhere on the 3D canvas should select a cabinet').toBeTruthy();
  await settle(page, 2000);
  await shot(page, '06-datacenter-3d-cabinet-selected');
});

test('panel template generator preview (not saved)', async ({ page }, info) => {
  await page.goto('/panel-templates');
  await settle(page);
  await shot(page, '07-panel-templates');
  await page.getByRole('button', { name: /新\s*建\s*模\s*板/ }).first().click();
  const drawer = page.locator('.ant-drawer-open .ant-drawer-content').last();
  await expect(drawer).toBeVisible();
  await drawer.getByTestId('template-name-input').fill('NIGHT-SMOKE-preview');
  const preset = drawer.locator('.ant-select').filter({ hasText: /预设|preset/i }).first();
  await preset.click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(drawer.getByTestId('generator-canvas')).toBeVisible();
  await page.waitForTimeout(800);
  await shot(page, '08-panel-template-generator-preview');
  await checkPage(page, info.title);
  await drawer.locator('.ant-drawer-close').click();
  await expect(drawer).toBeHidden();
  // nothing saved
  const res = await page.request.post('/api/v1/panel-templates/list', { data: {} });
  if (res.ok()) {
    const body = (await res.json()) as unknown;
    const rows = Array.isArray(body) ? body : ((body as { items?: unknown[] }).items ?? []);
    expect(JSON.stringify(rows)).not.toContain('NIGHT-SMOKE-');
  }
});

for (const [lang, n] of [
  ['en-US', '09'],
  ['ja-JP', '10'],
] as const) {
  test(`language ${lang}`, async ({ page }, info) => {
    await page.addInitScript((l) => localStorage.setItem('i18nextLng', l), lang);
    for (const [p, name] of [
      ['/', 'dashboard'],
      ['/cabinets', 'cabinets'],
      ['/panel-templates', 'panel-templates'],
    ] as const) {
      await page.goto(p);
      await settle(page);
      await expect(page.locator('html')).toHaveAttribute('lang', /.*/);
      await shot(page, `${n}-${lang}-${name}`);
      await checkPage(page, info.title);
    }
  });
}

const OLD_PAGES: [string, string][] = [
  ['/cabinets', 'cabinets'],
  ['/devices', 'devices'],
  ['/topology', 'topology'],
  ['/observability', 'observability'],
  ['/ip-management', 'ip-management'],
];
for (const [p, name] of OLD_PAGES) {
  test(`old page ${p}`, async ({ page }, info) => {
    await page.goto(p);
    await expect(page.locator('.ant-layout-content').first()).toBeVisible();
    await settle(page, 2000);
    await shot(page, `11-${name}`);
    await checkPage(page, info.title);
  });
}
