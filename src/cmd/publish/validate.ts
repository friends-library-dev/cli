import { execSync } from 'child_process';
import fetch from 'node-fetch';
import env from '@friends-library/env';
import { FsDocPrecursor } from '@friends-library/dpc-fs';
import lintPath from '../../lint/lint-path';
import * as git from './git';

export default async function validate(dpc: FsDocPrecursor): Promise<void> {
  lint(dpc);
  gitBranch(dpc);
  gitStatus(dpc);
  await gitCommit(dpc);
}

function lint(dpc: FsDocPrecursor): void {
  const lints = lintPath(dpc.fullPath);
  if (lints.count() > 0) {
    throw new Error(
      `\n\nERROR: ${lints.count()} lint errors in ${dpc.path} must be fixed. 😬\n\n`,
    );
  }
}

function gitBranch(dpc: FsDocPrecursor): void {
  const isMaster =
    execSync(`git symbolic-ref HEAD --short`, { cwd: git.dpcRootDir(dpc) })
      .toString()
      .trim() === `master`;
  if (!isMaster) {
    throw new Error(`\n\nERROR: git branch for ${dpc.path} is not <master>.`);
  }
}

function gitStatus(dpc: FsDocPrecursor): void {
  const statusClean =
    execSync(`git status --porcelain`, { cwd: git.dpcRootDir(dpc) })
      .toString()
      .trim() === ``;
  if (!statusClean) {
    throw new Error(`\n\nERROR: git status for ${dpc.path} is not clean.`);
  }
}

async function gitCommit(dpc: FsDocPrecursor): Promise<void> {
  const { CLI_GITHUB_TOKEN } = env.require(`CLI_GITHUB_TOKEN`);
  const localSha = execSync(`git rev-parse --verify HEAD`, { cwd: git.dpcRootDir(dpc) })
    .toString()
    .trim();

  const org = dpc.lang === `en` ? `friends-library` : `biblioteca-de-los-amigos`;
  const path = `repos/${org}/${dpc.friendSlug}/git/refs/heads/master`;
  const res = await fetch(`https://api.github.com/${path}`, {
    headers: {
      Authorization: `token ${CLI_GITHUB_TOKEN}`,
    },
  });
  const json = await res.json();

  if (json.object.sha !== localSha) {
    throw new Error(
      `\n\nERROR: git repo for ${dpc.path} is not up to date with origin/master.`,
    );
  }
}
