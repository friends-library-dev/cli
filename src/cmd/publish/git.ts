import path from 'path';
import { execSync } from 'child_process';
import { FsDocPrecursor } from '@friends-library/dpc-fs';

export function currentSha(repoRoot: string): string {
  const cmd = `git log --max-count=1 --pretty="%H" -- .`;
  return execSync(cmd, { cwd: repoRoot }).toString().trim();
}

export function cliStatusClean(): boolean {
  return execSync(`git status --porcelain`, { cwd: CLI_ROOT }).toString().trim() === ``;
}

export function dpcRootDir(dpc: FsDocPrecursor): string {
  return path.dirname(path.dirname(dpc.fullPath));
}

export function dpcDocumentCurrentSha(dpc: FsDocPrecursor): string {
  // go one up from `journal/original` to catch changes to custom html/css
  // which are in document root dir
  return currentSha(path.dirname(dpc.fullPath));
}

const CLI_ROOT = `${__dirname}/../../../`;
