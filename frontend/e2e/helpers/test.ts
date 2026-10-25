// Every spec runs with a console watcher: any console error/warning or uncaught page error fails the test.
// A test that provokes an API error on purpose lists the expected messages in `allowedConsole`.
import { expect, test as base } from '@playwright/test';

export const test = base.extend<{ allowedConsole: RegExp[]; consoleGuard: void }>({
  allowedConsole: [[], { option: true }],
  consoleGuard: [
    async ({ page, allowedConsole }, use) => {
      const problems: string[] = [];
      const record = (text: string) => {
        if (!allowedConsole.some((re) => re.test(text))) problems.push(text);
      };
      page.on('console', (m) => {
        if (m.type() === 'error' || m.type() === 'warning') record(`console.${m.type()}: ${m.text()}`);
      });
      page.on('pageerror', (e) => record(`pageerror: ${e.message}`));
      await use();
      expect(problems, 'browser console must stay clean').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
