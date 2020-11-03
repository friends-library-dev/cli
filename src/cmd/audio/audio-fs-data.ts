import path from 'path';
import fs from 'fs-extra';
import md5File from 'md5-file';
import env from '@friends-library/env';
import { Audio } from '@friends-library/friends';
import { AudioFsData } from './types';
import { logError, md5String } from './utils';

export default async function getSrcFsData(audio: Audio): Promise<AudioFsData> {
  const { AUDIOS_PATH } = env.require(`AUDIOS_PATH`);
  const DERIVED_DIR = path.resolve(`${__dirname}/../../../src/cmd/audio/derived`);
  const basename = audio.edition.document.filenameBase;
  const errors: string[] = [];
  const cachedDataDir = `${AUDIOS_PATH}/${audio.edition.path}/_cached_audio_data`;
  const data: Omit<AudioFsData, 'm4bs' | 'mp3Zips'> = {
    relPath: audio.edition.path,
    abspath: `${AUDIOS_PATH}/${audio.edition.path}`,
    derivedPath: `${DERIVED_DIR}/${audio.edition.path}`,
    cachedDataPath: ``,
    hash: ``,
    hashedBasename: ``,
    basename,
    parts: [],
  };

  fs.ensureDirSync(cachedDataDir);
  fs.ensureDirSync(data.derivedPath);

  for (let idx = 0; idx < audio.parts.length; idx++) {
    let partBasename = basename;
    if (audio.parts.length > 1) {
      partBasename += `--pt${idx + 1}`;
    }
    const srcPath = `${data.abspath}/${partBasename}.wav`;
    if (!fs.existsSync(srcPath)) {
      errors.push(`source path not found: ${partBasename}.wav`);
    } else {
      const part = `pt--` + String(idx + 1).padStart(2, `0`);
      const srcHash = await md5File(srcPath);
      const hashedBasename = `${srcHash}--${partBasename}`;
      data.parts.push({
        basename: partBasename,
        hashedBasename,
        cachedDataPath: `${cachedDataDir}/${part}--${srcHash}.json`,
        srcPath,
        srcHash,
        mp3s: {
          HQ: {
            localFilename: `${hashedBasename}.mp3`,
            localPath: `${data.derivedPath}/${hashedBasename}.mp3`,
            cloudFilename: `${partBasename}.mp3`,
            cloudPath: `${data.relPath}/${partBasename}.mp3`,
          },
          LQ: {
            localFilename: `${hashedBasename}--lq.mp3`,
            localPath: `${data.derivedPath}/${hashedBasename}--lq.mp3`,
            cloudFilename: `${partBasename}--lq.mp3`,
            cloudPath: `${data.relPath}/${partBasename}--lq.mp3`,
          },
        },
      });
    }
  }

  if (errors.length) {
    errors.forEach(logError);
    console.log(``);
    process.exit(1);
  }

  data.hash = md5String(data.parts.map((p) => p.srcHash).join(``));
  data.hashedBasename = `${data.hash}--${data.basename}`;
  data.cachedDataPath = `${cachedDataDir}/combined--${data.hash}.json`;

  return {
    ...data,
    m4bs: {
      HQ: {
        localFilename: `${data.hashedBasename}.m4b`,
        localPath: `${data.derivedPath}/${data.hashedBasename}.m4b`,
        cloudFilename: `${data.basename}.m4b`,
        cloudPath: `${data.relPath}/${data.basename}.m4b`,
      },
      LQ: {
        localFilename: `${data.hashedBasename}--lq.m4b`,
        localPath: `${data.derivedPath}/${data.hashedBasename}--lq.m4b`,
        cloudFilename: `${data.basename}--lq.m4b`,
        cloudPath: `${data.relPath}/${data.basename}--lq.m4b`,
      },
    },
    mp3Zips: {
      HQ: {
        localFilename: `${data.hashedBasename}--mp3s.zip`,
        localPath: `${data.derivedPath}/${data.hashedBasename}--mp3s.zip`,
        cloudFilename: `${data.basename}--mp3s.zip`,
        cloudPath: `${data.relPath}/${data.basename}--mp3s.zip`,
      },
      LQ: {
        localFilename: `${data.hashedBasename}--mp3s--lq.zip`,
        localPath: `${data.derivedPath}/${data.hashedBasename}--mp3s--lq.zip`,
        cloudFilename: `${data.basename}--mp3s--lq.zip`,
        cloudPath: `${data.relPath}/${data.basename}--mp3s--lq.zip`,
      },
    },
  };
}
