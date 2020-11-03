import fs from 'fs';
import { CommandBuilder } from 'yargs';
import { execSync } from 'child_process';
import { green, magenta } from 'x-chalk';
import env from '@friends-library/env';
import { paperbackCoverFromProps } from '@friends-library/doc-manifests';
import * as artifacts from '@friends-library/doc-artifacts';

export const command = `cover:watch`;

export const describe = `watch for cover jobs`;

export async function handler({ exec }: { exec: boolean }): Promise<void> {
  const { DEV_APPS_PATH } = env.require(`DEV_APPS_PATH`);
  const path = `${DEV_APPS_PATH}/cover-web-app/listen/cover.json`;

  if (exec) {
    const props = JSON.parse(fs.readFileSync(path, `utf8`));
    fs.unlinkSync(path);
    artifacts.deleteNamespaceDir(`fl-cover-watch`);
    const [coverManifest] = paperbackCoverFromProps(props);
    const filePath = await artifacts.pdf(coverManifest, `cover--${Date.now()}`, {
      namespace: `fl-cover-watch`,
    });
    execSync(`open ${filePath}`);
    return;
  }

  green(`watching for jobs at ${path}`);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (fs.existsSync(path)) {
      magenta(`Received job, initiating...`);
      execSync(`node ${__dirname}/../../app.js cover:watch --exec`);
    }
    await new Promise((res) => setTimeout(res, 750));
  }
}

export const builder: CommandBuilder = function (yargs) {
  return yargs.option(`exec`, {
    type: `boolean`,
    default: false,
  });
};
