import { GetAudios } from '../../graphql/GetAudios';

export type Audio = GetAudios['audios'][0];

interface FileFsData {
  localFilename: string;
  localPath: string;
  cloudFilename: string;
  cloudPath: string;
}

export interface AudioFsData {
  relPath: string;
  abspath: string;
  derivedPath: string;
  cachedDataPath: string;
  basename: string;
  hash: string;
  hashedBasename: string;
  m4bs: {
    HQ: FileFsData;
    LQ: FileFsData;
  };
  mp3Zips: {
    HQ: FileFsData;
    LQ: FileFsData;
  };
  parts: Array<{
    hashedBasename: string;
    basename: string;
    srcCloudPath: string;
    srcLocalPath: string;
    srcLocalFileExists: boolean;
    srcHash: string;
    cachedDataPath: string;
    mp3s: {
      HQ: FileFsData;
      LQ: FileFsData;
    };
  }>;
}

interface SoundCloudSharedAttrs {
  sharing: `public`;
  embeddable_by: `all`;
  genre: `Audiobooks`;
  downloadable: true;
  label_name: `Friends Library Publishing` | `Biblioteca de los Amigos`;
  permalink: string;
  title: string;
  description: string;
  tags: string[];
  /* we use this unimportant (to us) field to store artwork/mp3 file hashes */
  release?: null | string;
}

export type SoundCloudTrackAttrs = SoundCloudSharedAttrs & {
  track_type: `spoken`;
  commentable: false;
};

export type SoundCloudPlaylistAttrs = SoundCloudSharedAttrs & {
  trackIds: number[];
};
