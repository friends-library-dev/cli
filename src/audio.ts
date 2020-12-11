import { isDefined } from 'x-ts-utils';
import { Edition, Audio } from '@friends-library/friends';
import { allPublishedAudiobooks } from '@friends-library/friends/query';
import { Lang } from '@friends-library/types';

export function getAudios(lang: Lang | 'both', limit: number, pattern?: string): Audio[] {
  let audios: Edition[] = [];
  if (lang === `both` || lang === `en`) {
    audios = audios.concat(allPublishedAudiobooks(`en`));
  }
  if (lang === `both` || lang === `es`) {
    audios = audios.concat(allPublishedAudiobooks(`es`));
  }

  return audios
    .filter((edition) => !pattern || edition.path.includes(pattern))
    .map((edition) => edition.audio)
    .filter(isDefined)
    .slice(0, limit);
}
