import puppeteer from 'puppeteer-core';
import env from '@friends-library/env';

export interface ScreenshotTaker {
  (path: string): Promise<Buffer>;
}

interface BrowserCloser {
  (): Promise<void>;
}

export async function screenshot(
  port: number,
): Promise<[ScreenshotTaker, BrowserCloser]> {
  const { CHROMIUM_PATH } = env.require(`CHROMIUM_PATH`);
  const browser = await puppeteer.launch({ executablePath: CHROMIUM_PATH });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  return [
    async (path: string): Promise<Buffer> => {
      await page.goto(`http://localhost:${port}/${path}`);
      return page.screenshot({ encoding: `binary` });
    },
    async () => await browser.close(),
  ];
}
