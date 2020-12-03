import fs from 'fs-extra';
import { c } from 'x-chalk';
import md5File from 'md5-file';
import * as t from 'io-ts';
import { isRight } from 'fp-ts/Either';
import { AudioQuality } from '@friends-library/types';
import { logAction } from '../../sub-log';
import { AudioFsData } from './types';

export function get(fsData: AudioFsData): AudioCachedData {
  const emptyData: AudioCachedData = {};

  const cachedDataPath = fsData.cachedDataPath;
  if (!fs.existsSync(cachedDataPath)) {
    return emptyData;
  }

  const json: unknown = JSON.parse(fs.readFileSync(cachedDataPath, `utf-8`));
  const result = AudioCachedData.decode(json);
  if (isRight(result)) {
    return result.right;
  }

  logAction(`deleting invalid stored combined cache`);
  fs.unlink(cachedDataPath);
  return emptyData;
}

export function getPart(fsData: AudioFsData, partIdx: number): AudioPartCachedData {
  const emptyPartData: AudioPartCachedData = {};
  const cachedDataPath = fsData.parts[partIdx].cachedDataPath;
  if (!fs.existsSync(cachedDataPath)) {
    return emptyPartData;
  }

  const json: unknown = JSON.parse(fs.readFileSync(cachedDataPath, `utf-8`));
  const result = AudioPartCachedData.decode(json);
  if (isRight(result)) {
    return result.right;
  }

  const part = `${fsData.relPath} pt. ${partIdx + 1}`;
  logAction(`deleting invalid stored cache for ${c`{cyan ${part}}`}`);
  fs.unlink(cachedDataPath);

  return emptyPartData;
}

export async function setM4bQuality(
  fsData: AudioFsData,
  quality: AudioQuality,
): Promise<void> {
  const data = get(fsData);
  const m4bPath = fsData.m4bs[quality].localPath;
  const m4bHash = await md5File(m4bPath);
  const m4bSize = fs.statSync(m4bPath).size;
  data[quality] = { ...data[quality], m4bHash, m4bSize };
  save(fsData, data);
}

export async function setMp3ZipQuality(
  fsData: AudioFsData,
  quality: AudioQuality,
): Promise<void> {
  const data = get(fsData);
  const mp3ZipPath = fsData.mp3Zips[quality].localPath;
  const mp3ZipHash = await md5File(mp3ZipPath);
  const mp3ZipSize = fs.statSync(mp3ZipPath).size;
  data[quality] = { ...data[quality], mp3ZipHash, mp3ZipSize };
  save(fsData, data);
}

export async function setPartQuality(
  fsData: AudioFsData,
  partIdx: number,
  quality: AudioQuality,
): Promise<void> {
  const mp3Path = fsData.parts[partIdx].mp3s[quality].localPath;
  const mp3Hash = await md5File(mp3Path);
  const mp3Size = fs.statSync(mp3Path).size;
  const partData = getPart(fsData, partIdx);
  partData[quality] = { mp3Hash, mp3Size };
  savePart(fsData, partIdx, partData);
}

function save(fsData: AudioFsData, data: AudioCachedData): void {
  const cachedDataPath = fsData.cachedDataPath;
  fs.writeFileSync(cachedDataPath, JSON.stringify(data, null, 2));
}

function savePart(
  fsData: AudioFsData,
  partIdx: number,
  partData: AudioPartCachedData,
): void {
  const cachedDataPath = fsData.parts[partIdx].cachedDataPath;
  fs.writeFileSync(cachedDataPath, JSON.stringify(partData, null, 2));
}

const AudioPartQualityCachedData = t.union([
  t.undefined,
  t.type({
    mp3Hash: t.string,
    mp3Size: t.number,
  }),
]);

const AudioPartCachedData = t.partial({
  HQ: AudioPartQualityCachedData,
  LQ: AudioPartQualityCachedData,
});

type AudioPartCachedData = t.TypeOf<typeof AudioPartCachedData>;

const AudioQualityCachedData = t.union([
  t.undefined,
  t.partial({
    mp3ZipHash: t.string,
    mp3ZipSize: t.number,
    m4bHash: t.string,
    m4bSize: t.number,
  }),
]);

const AudioCachedData = t.partial({
  HQ: AudioQualityCachedData,
  LQ: AudioQualityCachedData,
});

type AudioCachedData = t.TypeOf<typeof AudioCachedData>;
