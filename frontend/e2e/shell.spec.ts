// App shell: command palette (pages, assets, label numbers), theme switch, dashboard entry points.
import { expect, test } from './helpers/test';
import { createHierarchy, display } from './helpers/api';

const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

test('command palette jumps to a page and to a cabinet by its label', async ({ page, request }) => {
  const h = await createHierarchy(request, { ports: 1 });
  await page.goto('/');
  await expect(page.getByTestId('stat-devices')).toBeVisible();

  await page.keyboard.press(`${mod}+k`);
  const input = page.getByTestId('command-palette-input');
  await expect(input).toBeFocused();
  await input.fill('/labels');
  await input.press('Enter');
  await expect(page).toHaveURL(/\/labels$/);

  // a label number typed at scanner speed: Enter before the answer arrives still lands on the cabinet
  await page.keyboard.press(`${mod}+k`);
  await page.keyboard.type(display(h.cabinet.label!.shortId));
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/cabinets/${h.cabinet.id}$`));
});

test('theme choice survives a reload; dashboard cards navigate', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  const before = await html.getAttribute('data-theme');
  await page.getByTestId('theme-toggle').click();
  const after = before === 'dark' ? 'light' : 'dark';
  await expect(html).toHaveAttribute('data-theme', after);
  await page.reload();
  await expect(html).toHaveAttribute('data-theme', after);

  await page.getByTestId('stat-cabinets').click();
  await expect(page).toHaveURL(/\/cabinets$/);
  await page.goBack();
  await page.getByTestId('dashboard-3d-entry').click();
  await expect(page).toHaveURL(/\/datacenter-3d$/);
});
