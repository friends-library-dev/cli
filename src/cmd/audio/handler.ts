import fs from 'fs-extra';
import { dirname } from 'path';
import { sync as glob } from 'glob';
import exec from 'x-exec';
import md5File from 'md5-file';
import * as cloud from '@friends-library/cloud';
import { c, log } from 'x-chalk';
import { Audio } from '@friends-library/friends';
import * as docMeta from '@friends-library/document-meta';
import { AudioQuality, AUDIO_QUALITIES, Lang } from '@friends-library/types';
import { AudioFsData } from './types';
import { logDebug, logAction, logError } from '../../sub-log';
import { getAudios } from '../../audio';
import * as yml from '../../yml-writer';
import * as ffmpeg from '../../ffmpeg';
import * as cache from './cache';
import * as m4bTool from './m4b';
import * as soundcloud from './soundcloud';
import getSrcFsData from './audio-fs-data';

interface Argv {
  lang: Lang | 'both';
  limit: number;
  dryRun: boolean;
  skipLargeUploads: boolean;
  cleanDerivedDir: boolean;
  pattern?: string;
}

let argv: Argv = {
  lang: `both`,
  limit: 999999,
  dryRun: false,
  skipLargeUploads: false,
  cleanDerivedDir: false,
};

export default async function handler(passedArgv: Argv): Promise<void> {
  argv = passedArgv;
  ffmpeg.ensureExists();
  m4bTool.ensureExists();
  for (const audio of getAudios(argv.lang, argv.limit, argv.pattern)) {
    await handleAudio(audio);
  }
  log(``);
}

async function handleAudio(audio: Audio): Promise<void> {
  const { edition } = audio;
  log(c`\nHandling audio: {magenta ${edition.path}}`);
  const fsData = await getSrcFsData(audio);

  await ensureAudioImage(audio, fsData);
  await deriveUncachedMp3s(audio, fsData);
  await syncMp3s(audio, fsData);
  await syncMp3Zips(audio, fsData);
  await syncM4bs(audio, fsData);
  await syncSoundCloudTracks(audio, fsData);
  await syncSoundCloudPlaylists(audio, fsData);
  await storeFilesizeMeta(audio, fsData);
  await cleanCacheFiles(fsData);

  if (argv.cleanDerivedDir && fsData.derivedPath) {
    exec.exit(`rm -rf ${fsData.derivedPath}`);
  }
}

async function ensureAudioImage(audio: Audio, fsData: AudioFsData): Promise<void> {
  const cloudPath = `${fsData.relPath}/${fsData.basename}--${audio.edition.type}--audio.png`;
  const localPath = `${fsData.derivedPath}/cover.png`;
  if (fs.existsSync(localPath)) {
    const localHash = await md5File(localPath);
    const remoteHash = await cloud.md5File(cloudPath);
    if (localHash === remoteHash) {
      logDebug(`audio cover image already in place in derived dir`);
      return;
    }
  }
  logAction(`downloading audio cover image`);
  if (argv.dryRun) return;
  const buffer = await cloud.downloadFile(cloudPath);
  fs.writeFileSync(localPath, buffer);
}

async function deriveUncachedMp3s(audio: Audio, fsData: AudioFsData): Promise<void> {
  for (let idx = 0; idx < audio.parts.length; idx++) {
    const cached = cache.getPart(fsData, idx);
    for (const quality of AUDIO_QUALITIES) {
      const mp3Path = fsData.parts[idx].mp3s[quality].localPath;
      const partDesc = `pt${idx + 1} (${quality})`;
      if (fs.existsSync(mp3Path) && !cached[quality]) {
        logAction(`storing cache data mp3 for ${c`{cyan ${partDesc}}`}`);
        !argv.dryRun && (await cache.setPartQuality(fsData, idx, quality));
      } else if (!cached[quality]) {
        !argv.dryRun && (await ensureLocalMp3(audio, fsData, idx, quality));
        !argv.dryRun && (await cache.setPartQuality(fsData, idx, quality));
      } else {
        logDebug(`found valid cached fs data for mp3 ${partDesc}`);
      }
    }
  }
}

async function syncMp3s(audio: Audio, fsData: AudioFsData): Promise<void> {
  for (let idx = 0; idx < audio.parts.length; idx++) {
    const cached = cache.getPart(fsData, idx);
    for (const quality of AUDIO_QUALITIES) {
      const mp3Info = fsData.parts[idx].mp3s[quality];
      const localHash = ensureCache(cached[quality]).mp3Hash;
      const remoteHash = await cloud.md5File(mp3Info.cloudPath);
      const partDesc = `pt${idx + 1} (${quality})`;
      if (localHash !== remoteHash) {
        logAction(`uploading changed mp3 for ${c`{cyan ${partDesc}}`}`);
        if (!argv.dryRun) {
          await ensureLocalMp3(audio, fsData, idx, quality);
          await cloud.uploadFile(mp3Info.localPath, mp3Info.cloudPath);
        }
      } else {
        logDebug(`skipping mp3 upload for ${partDesc} - remote file identical`);
      }
    }
  }
}

async function syncMp3Zips(audio: Audio, fsData: AudioFsData): Promise<void> {
  const cached = cache.get(fsData);
  for (const quality of AUDIO_QUALITIES) {
    const localZipPath = fsData.mp3Zips[quality].localPath;
    const hasCache = !!cached[quality]?.mp3ZipHash;
    if (fs.existsSync(localZipPath) && !hasCache) {
      logAction(`storing cache data for mp3 zip ${c`{cyan (${quality})}`}`);
      !argv.dryRun && (await cache.setMp3ZipQuality(fsData, quality));
    } else if (!hasCache) {
      !argv.dryRun && (await ensureLocalMp3Zip(audio, fsData, quality));
      !argv.dryRun && (await cache.setMp3ZipQuality(fsData, quality));
    } else {
      logDebug(`found valid cached fs data for mp3 zip (${quality})`);
    }

    // now we know we have good cached data, reload it
    const { mp3ZipHash: localZipHash } = ensureCache(cache.get(fsData)[quality]);
    if (typeof localZipHash === `undefined`) {
      throw new Error(`Unexpected missing mp3 zip hash from cache, q: ${quality}`);
    }

    const cloudFilepath = fsData.mp3Zips[quality].cloudPath;
    const cloudZipHash = await cloud.md5File(cloudFilepath);
    if (localZipHash !== cloudZipHash) {
      logAction(`uploading new mp3 zip ${c`{cyan (${quality})}`} to cloud storage`);
      !argv.dryRun && (await ensureLocalMp3Zip(audio, fsData, quality));
      if (!argv.skipLargeUploads) {
        !argv.dryRun && (await cloud.uploadFile(localZipPath, cloudFilepath));
      } else {
        logDebug(`skipping mp3 zip (${quality}) upload due to --skip-large-uploads`);
      }
    } else {
      logDebug(`skipping upload of mp3 zip (${quality}) - remote file identical`);
    }
  }
}

async function syncM4bs(audio: Audio, fsData: AudioFsData): Promise<void> {
  const cached = cache.get(fsData);
  for (const quality of AUDIO_QUALITIES) {
    const localM4bPath = fsData.m4bs[quality].localPath;
    const hasCache = !!cached[quality]?.m4bHash;
    if (fs.existsSync(localM4bPath) && !hasCache) {
      logAction(`storing cache data for m4b ${c`{cyan (${quality})}`}`);
      !argv.dryRun && (await cache.setM4bQuality(fsData, quality));
    } else if (!hasCache) {
      !argv.dryRun && ensureLocalM4b(audio, fsData, quality);
      !argv.dryRun && (await cache.setM4bQuality(fsData, quality));
    } else {
      logDebug(`found valid cached fs data for m4b (${quality})`);
    }

    // now we know we have good cached data, reload it
    const { m4bHash: localM4bHash } = ensureCache(cache.get(fsData)[quality]);
    if (typeof localM4bHash === `undefined`) {
      throw new Error(`Unexpected missing m4b hash from cache, q: ${quality}`);
    }

    const cloudFilepath = fsData.m4bs[quality].cloudPath;
    const cloudM4bHash = await cloud.md5File(cloudFilepath);
    if (localM4bHash !== cloudM4bHash) {
      logAction(`uploading new m4b ${c`{cyan (${quality})}`} to cloud storage`);
      !argv.dryRun && ensureLocalM4b(audio, fsData, quality);
      if (!argv.skipLargeUploads) {
        !argv.dryRun && (await cloud.uploadFile(localM4bPath, cloudFilepath));
      } else {
        logDebug(`skipping m4b (${quality}) upload due to --skip-large-uploads`);
      }
    } else {
      logDebug(`skipping upload of m4b (${quality}) - remote file identical`);
    }
  }
}

async function syncSoundCloudTracks(audio: Audio, fsData: AudioFsData): Promise<void> {
  for (let idx = 0; idx < audio.parts.length; idx++) {
    const part = audio.parts[idx];
    const partCache = cache.getPart(fsData, idx);
    for (const quality of AUDIO_QUALITIES) {
      const localPath = fsData.parts[idx].mp3s[quality].localPath;
      const trackIdProp = quality === `HQ` ? `externalIdHq` : `externalIdLq`;
      let trackId = part[trackIdProp];
      const fileDesc = `pt${idx + 1} (${quality})`;

      // STEP 1: no track yet? upload it. (0 is my convention non-uploaded audios in .yml files)
      if (trackId === 0) {
        logAction(`uploading new soundcloud file for ${c`{cyan ${fileDesc}}`}`);
        if (!argv.dryRun) {
          await ensureLocalMp3(audio, fsData, idx, quality);
          trackId = await soundcloud.uploadNewTrack(audio, localPath, idx, quality);
          logAction(`soundcloud track added for ${fileDesc} ${c`{green ${trackId}}`}`);
          updateYml(audio, (data) => {
            data.parts[idx][`external_id_${quality.toLowerCase()}`] = trackId;
          });
          logAction(`awaiting soundcloud track API data for ${c`{cyan ${fileDesc}}`}`);
          await newSoundcloudTrackReady(trackId);
        } else {
          logError(`cannot continue in dry-run mode without trackId`);
          continue;
        }
      }

      // STEP 2: bail w/ error if funky id detected
      const track = await soundcloud.getTrack(trackId);
      if (!track || track.user.permalink !== `friendslibrary`) {
        logError(`bad soundcloud id for ${fileDesc}: ${trackId}\n`);
        process.exit(1);
      }

      // STEP 3: replace the remote file if it's not exactly the same size as local
      const remoteSize = track.original_content_size;
      const localSize = ensureCache(partCache[quality]).mp3Size;
      if (localSize !== remoteSize) {
        logAction(`replacing soundcloud file for ${c`{cyan ${fileDesc}}`}`);
        if (!argv.dryRun) {
          await ensureLocalMp3(audio, fsData, idx, quality);
          await soundcloud.replaceTrack(trackId, localPath);
        }
      } else {
        logDebug(`soundcloud track verified for ${fileDesc}: ${track.id}`);
      }

      // STEP 4: (before check attrs!) replace remote artwork if not same as local
      // hack: use the `release` attr to store artwork hash, since soundcloud
      // doesn't give us access to the originally uploaded artwork to verify identity
      const remoteArtworkHash = track.release;
      const localArtworkPath = `${fsData.derivedPath}/cover.png`;
      const localArtworkHash = await md5File(localArtworkPath);
      if (localArtworkHash !== remoteArtworkHash) {
        logAction(`replacing soundcloud artwork for ${c`{cyan ${fileDesc}}`}`);
        !argv.dryRun && (await soundcloud.setTrackArtwork(trackId, localArtworkPath));
      } else {
        logDebug(`verified correct soundcloud artwork for ${fileDesc}`);
      }

      // STEP 5: check all the track attributes, update if they don't match exactly
      const attrs = soundcloud.trackAttrs(audio, idx, quality);
      attrs.release = localArtworkHash; // hack, see above ^^^
      if (!soundcloud.attrsMatch(attrs, track)) {
        logAction(`updating soundcloud attrs for ${c`{cyan ${fileDesc}}`}`);
        !argv.dryRun && soundcloud.updateTrackAttrs(trackId, attrs);
      } else {
        logDebug(`soundcloud attrs verified for ${fileDesc}`);
      }
    }
  }
}

async function syncSoundCloudPlaylists(audio: Audio, fsData: AudioFsData): Promise<void> {
  if (audio.parts.length === 1) {
    return;
  }

  for (const quality of AUDIO_QUALITIES) {
    const propKey = quality === `HQ` ? `externalPlaylistIdHq` : `externalPlaylistIdLq`;
    let playlistId = audio[propKey];

    // STEP 1: create the playlist if necessary
    if (!playlistId) {
      logAction(`creating soundcloud playlist for ${c`{cyan (${quality})}`}`);
      if (!argv.dryRun) {
        playlistId = await soundcloud.createPlaylist(audio, quality);
        updateYml(audio, (data) => {
          data[`external_playlist_id_${quality.toLowerCase()}`] = playlistId;
        });
      } else {
        logError(`cannot continue in dry-run mode without playlistId`);
        continue;
      }
    }

    // STEP 2: verify remote playlist artwork
    const playlist = await soundcloud.getPlaylist(playlistId);
    if (!playlist) {
      logError(`Unexpected missing playlist for id: ${playlistId}`);
      process.exit(1);
    }

    const remoteArtworkHash = playlist.tracks[0].release;
    const localArtworkPath = `${fsData.derivedPath}/cover.png`;
    const localArtworkHash = await md5File(localArtworkPath);
    if (localArtworkHash !== remoteArtworkHash) {
      logAction(`replacing soundcloud playlist artwork for ${c`{cyan (${quality})}`}`);
      !argv.dryRun && (await soundcloud.setPlaylistArtwork(playlistId, localArtworkPath));
    } else {
      logDebug(`verified correct soundcloud playlist artwork for (${quality})`);
    }

    // STEP 3: check all the track attributes, update if they don't match exactly
    const attrs = soundcloud.playlistAttrs(audio, quality);
    if (!soundcloud.attrsMatch(attrs, playlist)) {
      logAction(`updating soundcloud playlist attrs for ${c`{cyan (${quality})}`}`);
      !argv.dryRun && (await soundcloud.updatePlaylistAttrs(playlistId, attrs));
    } else {
      logDebug(`soundcloud playlist attrs verified for (${quality})`);
    }
  }
}

let meta: undefined | docMeta.DocumentMeta;

async function storeFilesizeMeta(audio: Audio, fsData: AudioFsData): Promise<void> {
  if (!meta) {
    meta = await docMeta.fetchSingleton();
  }

  const editionMeta = meta.get(audio.edition.path);
  if (!editionMeta) {
    logError(`Edition meta not found\n`);
    process.exit(1);
  }

  const cached = cache.get(fsData);
  const hqCache = ensureCache(cached.HQ);
  const lqCache = ensureCache(cached.LQ);
  const combined = Object.values(hqCache).concat(Object.values(lqCache));
  if (combined.length !== 8 || combined.includes(undefined)) {
    logError(`Unexpected missing cache for store filesizes\n`);
    process.exit(1);
  }

  const localAudioMeta = {
    durations: audio.parts.map(
      (p, idx) => ffmpeg.getDuration(fsData.parts[idx].srcPath)[1],
    ),
    LQ: {
      mp3ZipSize: lqCache.mp3ZipSize ?? -1,
      m4bSize: lqCache.m4bSize ?? -1,
      parts: audio.parts.map((p, idx) => {
        const partCache = cache.getPart(fsData, idx);
        return { mp3Size: partCache.LQ?.mp3Size ?? -1 };
      }),
    },
    HQ: {
      mp3ZipSize: hqCache.mp3ZipSize ?? -1,
      m4bSize: hqCache.m4bSize ?? -1,
      parts: audio.parts.map((p, idx) => {
        const partCache = cache.getPart(fsData, idx);
        return { mp3Size: partCache.HQ?.mp3Size ?? -1 };
      }),
    },
  };

  if (JSON.stringify(localAudioMeta) === JSON.stringify(editionMeta.audio)) {
    logDebug(`skiping store meta - up to date`);
    return;
  }

  logAction(`saving changed filesizes`);
  if (argv.dryRun) return;
  meta.set(audio.edition.path, {
    ...editionMeta,
    updated: new Date().toISOString(),
    audio: localAudioMeta,
  });
  await docMeta.save(meta);
}

function ensureLocalM4b(audio: Audio, fsData: AudioFsData, quality: AudioQuality): void {
  const localPath = fsData.m4bs[quality].localPath;
  if (fs.existsSync(localPath)) {
    return;
  }
  logAction(`creating m4b ${c`{cyan (${quality})}`}`);
  !argv.dryRun && m4bTool.create(audio, fsData, quality);
}

async function ensureLocalMp3Zip(
  audio: Audio,
  fsData: AudioFsData,
  quality: AudioQuality,
): Promise<void> {
  const localPath = fsData.mp3Zips[quality].localPath;
  if (fs.existsSync(localPath)) {
    return;
  }
  await createMp3Zip(audio, fsData, quality);
}

async function createMp3Zip(
  audio: Audio,
  fsData: AudioFsData,
  quality: AudioQuality,
): Promise<void> {
  logAction(`creating mp3 zip ${c`{cyan (${quality})}`}`);
  const zipFilename = fsData.mp3Zips[quality].localFilename;
  const mp3Filenames: string[] = [];
  const unhashed: string[] = [];

  for (let idx = 0; idx < audio.parts.length; idx++) {
    await ensureLocalMp3(audio, fsData, idx, quality);
    const mp3Data = fsData.parts[idx].mp3s[quality];
    const hashedPath = mp3Data.localPath;
    const unhashedPath = hashedPath.replace(mp3Data.localFilename, mp3Data.cloudFilename);
    unhashed.push(unhashedPath);
    exec.exit(`cp ${hashedPath} ${unhashedPath}`);
    mp3Filenames.push(mp3Data.cloudFilename);
  }

  exec.exit(`zip ${zipFilename} ${mp3Filenames.join(` `)}`, fsData.derivedPath);
  unhashed.forEach((unhashedPath) => fs.unlinkSync(unhashedPath));
}

function updateYml(
  audio: Audio,
  updater: (audioData: Record<string, any>) => void,
): void {
  const edition = audio.edition;
  const document = edition.document;
  const friend = document.friend;
  const ymlData = yml.load(friend.slug, friend.lang);
  const docData = (ymlData.documents as any[]).find((doc) => doc.slug === document.slug);
  const edData = (docData.editions as any[]).find((ed) => ed.type === edition.type);
  updater(edData.audio);
  yml.write(ymlData, friend.slug, friend.lang);
}

async function newSoundcloudTrackReady(trackId: number): Promise<void> {
  const track = await soundcloud.getTrack(trackId);
  if (track) return;
  // poll every 15 seconds until API responds with track
  await new Promise((res) => setTimeout(res, 15000));
  return newSoundcloudTrackReady(trackId);
}

async function createMp3(
  audio: Audio,
  fsData: AudioFsData,
  partIndex: number,
  quality: AudioQuality,
  destPath: string,
): Promise<void> {
  const srcPath = fsData.parts[partIndex].srcPath;
  ffmpeg.createMp3(audio, partIndex, srcPath, destPath, quality);
}

async function ensureLocalMp3(
  audio: Audio,
  fsData: AudioFsData,
  partIndex: number,
  quality: AudioQuality,
): Promise<void> {
  const mp3Path = fsData.parts[partIndex].mp3s[quality].localPath;
  if (fs.existsSync(mp3Path)) {
    return;
  }

  // much faster to download an MP3 than re-create, so try that first
  const partDesc = `pt${partIndex + 1} (${quality})`;
  const cached = cache.getPart(fsData, partIndex);
  const mp3Info = fsData.parts[partIndex].mp3s[quality];
  const localHash = cached[quality]?.mp3Hash;
  const remoteHash = await cloud.md5File(mp3Info.cloudPath);
  if (localHash === remoteHash) {
    logAction(`downloading missing mp3 for ${c`{cyan ${partDesc}}`}`);
    const buff = await cloud.downloadFile(mp3Info.cloudPath);
    fs.writeFileSync(mp3Path, buff);
    return;
  }

  logAction(`creating missing mp3 for ${c`{cyan ${partDesc}}`}`);
  !argv.dryRun && createMp3(audio, fsData, partIndex, quality, mp3Path);
}

async function cleanCacheFiles(fsData: AudioFsData): Promise<void> {
  const keepList = [fsData.cachedDataPath, ...fsData.parts.map((p) => p.cachedDataPath)];
  const cacheFiles = glob(`${dirname(fsData.cachedDataPath)}/**/*.json`);
  cacheFiles.filter((f) => !keepList.includes(f)).forEach((f) => fs.unlinkSync(f));
}

function ensureCache<T>(cached: T): NonNullable<T> {
  assertCache(cached);
  return cached;
}

function assertCache<T>(cached: T): asserts cached is NonNullable<T> {
  if (cached === undefined) {
    logError(`Unexpected missing cache\n\n`);
    console.trace(`Unexpected Missing Cache`);
    process.exit(1);
  }
}
