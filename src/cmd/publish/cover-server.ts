import puppeteer from 'puppeteer-core';
import { exec, execSync } from 'child_process';
import env from '@friends-library/env';
import { green } from 'x-chalk';

export async function start(): Promise<number> {
  const port = 51515;
  const { DEV_APPS_PATH } = env.require(`DEV_APPS_PATH`);
  green(`Building cover app...`);
  execSync(`cd ${DEV_APPS_PATH}/cover-web-app && npm run build`);
  green(`Serving cover app`);
  stop(port);
  exec(`serve -l ${port} ${DEV_APPS_PATH}/cover-web-app/dist`);
  await new Promise((res) => setTimeout(res, 1000));
  return port;
}

export function stop(port: number): void {
  execSync(`lsof -t -i tcp:${port} | xargs kill`);
}

export interface ScreenshotTaker {
  (id: string, type: 'ebook' | 'audio'): Promise<Buffer>;
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
  await page.setViewport({ width: 1600, height: 2400 });

  return [
    async (id: string, type: 'ebook' | 'audio'): Promise<Buffer> => {
      const clip = type === `ebook` ? false : getAudioImageClip();
      await page.goto(`http://localhost:${port}?capture=${type}&id=${id}`);
      return page.screenshot({ encoding: `binary`, ...(clip ? { clip } : {}) });
    },
    async () => await browser.close(),
  ];
}

function getAudioImageClip(): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  // height (in px) of top white bar, which we clip out
  const TOP_WHITE_BAR_HEIGHT = 451;

  // quasi-arbitrary value that tightens in on the main title square
  const ZOOM = 200;

  // a little extra room beyond the height of the top white bar, to center better
  const Y_PADDING = ZOOM / 10;

  // actual width (in px) of full ebook screenshot cover element
  const FULL_WIDTH = 1600;

  return {
    x: 0 + ZOOM / 2,
    y: TOP_WHITE_BAR_HEIGHT + Y_PADDING + ZOOM / 2,
    width: FULL_WIDTH - ZOOM,
    height: FULL_WIDTH - ZOOM,
  };
}
