import fs from 'fs';
import exec from 'x-exec';
import { Lang } from '@friends-library/types';
import env from '@friends-library/env';
import { safeLoad, safeDump } from 'js-yaml';

export function load(friendSlug: string, lang: Lang): Record<string, any> {
  const path = ensurePath(friendSlug, lang);
  return safeLoad(fs.readFileSync(path, `utf-8`)) as Record<string, any>;
}

export function write(data: unknown, friendSlug: string, lang: Lang): void {
  const { DEV_LIBS_PATH } = env.require(`DEV_LIBS_PATH`);
  const path = ensurePath(friendSlug, lang);
  const yml = safeDump(data);
  fs.writeFileSync(path, yml);
  exec.exit(`cd ${DEV_LIBS_PATH}/friends && npm run format`);
}

function ensurePath(friendSlug: string, lang: Lang): string {
  const { DEV_LIBS_PATH } = env.require(`DEV_LIBS_PATH`);
  const path = `${DEV_LIBS_PATH}/friends/yml/${lang}/${friendSlug}.yml`;
  if (!fs.existsSync(path)) {
    throw new Error(`No yml file to load at path: ${lang}/${friendSlug}.yml`);
  }
  return path;
}
