import puppeteer from 'puppeteer-core';
import { exec, execSync } from 'child_process';
import env from '@friends-library/env';
import { green } from 'x-chalk';

export async function start(): Promise<number> {
  const port = 71717;
  const { DEV_APPS_PATH } = env.require(`DEV_APPS_PATH`);
  green(`Building poster app...`);
  execSync(`cd ${DEV_APPS_PATH}/poster && npm run build`);
  green(`Serving poster app`);
  stop(port);
  exec(`serve -l ${port} ${DEV_APPS_PATH}/poster/dist`);
  await new Promise((res) => setTimeout(res, 1000));
  return port;
}

export function stop(port: number): void {
  execSync(`lsof -t -i tcp:${port} | xargs kill`);
}

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
