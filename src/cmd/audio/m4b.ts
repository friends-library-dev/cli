import fs from 'fs-extra';
import os from 'os';
import exec from 'x-exec';
import { red } from 'x-chalk';
import { Audio } from '@friends-library/friends';
import { AudioQuality } from '@friends-library/types';
import { AudioFsData } from './types';
import { utf8ShortTitle } from '@friends-library/adoc-utils';
import * as ffmpeg from '../../ffmpeg';
import { suffixThe } from './tags';

export function create(audio: Audio, src: AudioFsData, quality: AudioQuality): void {
  const edition = audio.edition;
  const document = edition.document;
  const friend = document.friend;
  const shortTitle = utf8ShortTitle(document.title);
  const m4bDir = `${src.derivedPath}/m4b`;
  const relWorkDir = `Religion/${friend.name}/${shortTitle}`;
  const workDir = `${m4bDir}/${relWorkDir}`;
  const isMultipart = audio.parts.length > 1;

  fs.rmdirSync(m4bDir, { recursive: true });
  fs.ensureDirSync(workDir);
  exec.exit(`cp ${src.derivedPath}/cover.png "${workDir}"`);
  fs.writeFileSync(`${workDir}/description.txt`, document.description);

  let durationAccum = 0;
  const chapterFileLines: string[] = [];

  src.parts.forEach((part, idx) => {
    chapterFileLines.push(`${secsToStr(durationAccum)} ${audio.parts[idx].title}`);
    exec.exit(`cp ${part.srcLocalPath} "${workDir}"`);
    if (isMultipart && idx < src.parts.length - 1) {
      const [, duration] = ffmpeg.getDuration(part.srcLocalPath);
      durationAccum += duration;
    }
  });

  if (isMultipart) {
    const chaptersFilePath = `${workDir}/chapters.txt`;
    fs.writeFileSync(chaptersFilePath, chapterFileLines.join(`\n`));
  }

  const user = exec.exit(`echo "$(id -u):$(id -g)"`).trim();
  const dockerArgs = [
    `docker run`,
    `--rm`,
    `--user ${user}`,
    `--volume "${m4bDir}":/mnt`,
    IMAGE,
  ];

  const m4bToolArgs = [
    `merge`,
    `"${relWorkDir}"`,
    `--audio-channels=1`,
    `--audio-samplerate=48000`,
    `--audio-bitrate=${quality === `HQ` ? `128k` : `48k`}`,
    `--output-file="merged.m4b"`,
    `--name="${shortTitle}"`,
    `--sortname="${suffixThe(shortTitle)}"`,
    `--album="${shortTitle}"`,
    `--sortalbum="${suffixThe(shortTitle)}"`,
    `--genre=Religion`,
    `--jobs=${os.cpus().length - 1}`,
    `--artist="${friend.name}"`,
    `--sortartist="${friend.alphabeticalName}"`,
  ];

  exec.exit(`${dockerArgs.join(` `)} ${m4bToolArgs.join(` `)}`);
  const filename = `${src.hashedBasename}${quality === `LQ` ? `--lq` : ``}.m4b`;
  exec.exit(`mv ${m4bDir}/merged.m4b ${src.derivedPath}/${filename}`);
  fs.rmdirSync(m4bDir, { recursive: true });
}

export function ensureExists(): void {
  if (!exec.success(`docker --version`)) {
    red(`Docker required to run m4b-tool`);
    process.exit(1);
  }

  if (!exec.success(`docker image inspect ${IMAGE}`)) {
    red(`Missing docker image for 'm4b-tool'.`);
    red(`To install, clone https://github.com/sandreas/m4b-tool,`);
    red(`reset to commit 5d1fb52 (known working version),`);
    red(`then cd into the dir and run 'docker build . -t m4b-tool'.`);
    red(`Repo is forked into jaredh159 if needed.`);
    process.exit(1);
  }
}

const IMAGE = `m4b-tool`;

/**
 * Takes a duration in seconds (3114.05) and returns
 * a ffmpeg-like duration string "00:51:54.05"
 */
function secsToStr(duration: number): string {
  const hours = Math.floor(duration / (60 * 60));
  const minutesSeconds = duration - hours * 60 * 60;
  const minutes = Math.floor(minutesSeconds / 60);
  const seconds = minutesSeconds - minutes * 60;
  const hoursStr = String(hours).padStart(2, `0`);
  const minutesStr = String(minutes).padStart(2, `0`);
  const secondsStr = seconds.toFixed(2).padStart(5, `0`);
  return `${hoursStr}:${minutesStr}:${secondsStr}`;
}
