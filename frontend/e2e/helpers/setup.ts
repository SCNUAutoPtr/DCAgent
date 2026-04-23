import { Page } from '@playwright/test';
import { resetSeedData } from './reset';

export async function preparePage(page: Page) {
  await resetSeedData();
  await page.addInitScript(() => {
    window.localStorage.setItem('i18nextLng', 'zh-CN');
  });
}
