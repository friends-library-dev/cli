import { dirname } from 'path';
import omit from 'lodash.omit';
import env from '@friends-library/env';
import { Audio } from '@friends-library/friends';
import { AudioQuality, Lang } from '@friends-library/types';
import { translate, setLocale } from '@friends-library/locale';
import { utf8ShortTitle } from '@friends-library/adoc-convert';
import { logDebug } from '../../sub-log';
import Client from './SoundCloudClient';
import { getPartTitle } from './tags';
import { SoundCloudTrackAttrs, SoundCloudPlaylistAttrs } from './types';

export function getTrack(trackId: number): Promise<null | Record<string, any>> {
  return getClient().getTrack(trackId);
}

export function getPlaylist(playlistId: number): Promise<null | Record<string, any>> {
  return getClient().getPlaylist(playlistId);
}

export function replaceTrack(trackId: number, localPath: string): Promise<boolean> {
  return getClient().replaceTrack(trackId, localPath);
}

export function updatePlaylistAttrs(
  playlistId: number,
  attrs: SoundCloudPlaylistAttrs,
): Promise<boolean> {
  return getClient().setPlaylistAttrs(playlistId, attrs);
}

export function updateTrackAttrs(
  trackId: number,
  attrs: SoundCloudTrackAttrs,
): Promise<Record<string, any>> {
  return getClient().updateTrackAttrs(trackId, {
    ...omit(attrs, `tags`),
    tag_list: attrs.tags.join(` `),
  });
}

export function createPlaylist(audio: Audio, quality: AudioQuality): Promise<number> {
  return getClient().createPlaylist(playlistAttrs(audio, quality));
}

export function setPlaylistArtwork(
  playlistId: number,
  localArtworkPath: string,
): Promise<boolean> {
  return getClient().setPlaylistArtwork(playlistId, localArtworkPath);
}

export function setTrackArtwork(
  trackId: number,
  localArtworkPath: string,
): Promise<boolean> {
  return getClient().setTrackArtwork(trackId, localArtworkPath);
}

export function playlistAttrs(
  audio: Audio,
  quality: AudioQuality,
): SoundCloudPlaylistAttrs {
  const edition = audio.edition;
  const document = edition.document;
  const friend = document.friend;
  const lang = friend.lang;
  const trackIdProp = quality === `HQ` ? `externalIdHq` : `externalIdLq`;
  return {
    ...COMMON_ATTRS,
    permalink: permalink(audio, quality),
    label_name: lang === `en` ? `Friends Library Publishing` : `Biblioteca de los Amigos`,
    trackIds: audio.parts.map((part) => part[trackIdProp]),
    title: utf8ShortTitle(document.title),
    description: document.description,
    tags: soundcloudTags(document.tags, quality, lang),
  };
}

function permalink(audio: Audio, quality: AudioQuality, suffix?: string): string {
  const edition = audio.edition;
  const document = edition.document;
  const editionSuffix = edition.type !== `updated` ? `-${edition.type}` : ``;
  const friend = document.friend;
  let permalink = `${friend.slug}-${document.slug}${editionSuffix}${suffix ?? ``}`;
  if (quality === `LQ`) {
    permalink += `-lq`;
  }
  return permalink;
}

export function trackAttrs(
  audio: Audio,
  partIndex: number,
  quality: AudioQuality,
): SoundCloudTrackAttrs {
  const edition = audio.edition;
  const document = edition.document;
  const friend = document.friend;
  const lang = friend.lang;
  const numParts = audio.parts.length;
  let permalinkSuffix = ``;
  if (numParts > 1) {
    const partStr = String(partIndex + 1);
    permalinkSuffix = `-pt-${partStr.padStart(numParts > 9 ? 2 : 1, `0`)}`;
  }
  return {
    ...COMMON_ATTRS,
    permalink: permalink(audio, quality, permalinkSuffix),
    track_type: `spoken`,
    commentable: false,
    label_name: lang === `en` ? `Friends Library Publishing` : `Biblioteca de los Amigos`,
    title: getPartTitle(audio, partIndex),
    description: edition.description || document.description,
    tags: soundcloudTags(document.tags, quality, lang),
  };
}

export function attrsMatch(
  proposed: SoundCloudPlaylistAttrs | SoundCloudTrackAttrs,
  fromApi: Record<string, any>,
): boolean {
  return !Object.entries(proposed).reduce((foundNonMatch, [key, value]) => {
    if (foundNonMatch) {
      return true;
    }

    if (key === `trackIds`) {
      const apiTrackIds = fromApi.tracks.map((t: { id: number }) => t.id);
      const trackIdsMatch = JSON.stringify(apiTrackIds) !== JSON.stringify(value);
      if (trackIdsMatch && process.argv.includes(`--verbose`)) {
        logDebug(`soundcloud attrs mismatch: track ids to not match`);
      }
      return trackIdsMatch;
    }

    if (key === `tags`) {
      key = `tag_list`;
      const apiTags = fromApi.tag_list.replace(/"/g, ``);
      return apiTags !== value.join(` `);
    }

    const attrMismatch = fromApi[key] !== value;
    if (attrMismatch && process.argv.includes(`--verbose`)) {
      logDebug(`soundcloud attrs mismatch: ${key} != ${value}, api=${fromApi[key]}`);
    }

    if (attrMismatch && key === `track_type`) {
      // soundcloud refuses to update this for some tracks... ¯\_(ツ)_/¯
      return foundNonMatch;
    }

    return attrMismatch;
  }, false);
}

function soundcloudTags(
  documentTags: string[],
  quality: AudioQuality,
  lang: Lang,
): string[] {
  setLocale(lang);
  return [
    ...documentTags.map(translate),
    lang === `en` ? `quakers` : `cuáqueros`,
    lang === `en` ? `early-quakers` : `primeros-cuáqueros`,
    lang === `en` ? `christianity` : `cristiandad`,
    lang === `en` ? `friends-library` : `biblioteca-de-los-amigos`,
    quality,
  ];
}

const COMMON_ATTRS = {
  genre: `Audiobooks`,
  sharing: `public`,
  embeddable_by: `all`,
  downloadable: true,
} as const;

export function uploadNewTrack(
  audio: Audio,
  audioPath: string,
  partIdx: number,
  quality: AudioQuality,
): Promise<number> {
  return getClient().uploadTrack(
    audioPath,
    `${dirname(audioPath)}/cover.png`,
    trackAttrs(audio, partIdx, quality),
  );
}

let client: Client | undefined;

export function getClient(): Client {
  if (client) {
    return client;
  }
  const {
    SOUNDCLOUD_USERNAME,
    SOUNDCLOUD_PASSWORD,
    SOUNDCLOUD_CLIENT_ID,
    SOUNDCLOUD_CLIENT_SECRET,
  } = env.require(
    `SOUNDCLOUD_USERNAME`,
    `SOUNDCLOUD_PASSWORD`,
    `SOUNDCLOUD_CLIENT_ID`,
    `SOUNDCLOUD_CLIENT_SECRET`,
  );

  client = new Client({
    username: SOUNDCLOUD_USERNAME,
    password: SOUNDCLOUD_PASSWORD,
    clientId: SOUNDCLOUD_CLIENT_ID,
    clientSecret: SOUNDCLOUD_CLIENT_SECRET,
  });

  return client;
}
