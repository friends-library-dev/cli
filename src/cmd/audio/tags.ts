import { Audio } from '@friends-library/friends';
import { utf8ShortTitle } from '@friends-library/adoc-utils';

export function getPartTags(audio: Audio, partIndex: number): Record<string, string> {
  const edition = audio.edition;
  const document = edition.document;
  const friend = document.friend;
  const lang = friend.lang;
  const docShortTitle = utf8ShortTitle(document.title);
  const publisher = lang === `en` ? `Friends Library` : `Biblioteca de los Amigos`;
  const partTitle = getPartTitle(audio, partIndex);

  const tags = {
    title: partTitle,
    track: `${partIndex + 1}/${audio.parts.length}`,
    genre: lang === `en` ? `Audiobook` : `Audiolibro`,
    language: lang === `en` ? `eng` : `spa`,
    publisher,
  };

  if (friend.isCompilationsQuasiFriend) {
    return withSortTags({
      ...tags,
      artist: docShortTitle,
      album_artist: docShortTitle,
      album: publisher,
      compilation: `1`,
    });
  }

  return withSortTags({
    ...tags,
    artist: friend.name,
    'artist-sort': friend.alphabeticalName,
    album_artist: friend.name,
    album: docShortTitle,
  });
}

export function getPartTitle(audio: Audio, partIndex: number): string {
  const partTitle = audio.parts[partIndex].title;
  const docShortTitle = utf8ShortTitle(audio.edition.document.title);

  if (audio.parts.length > 1) {
    return partTitle.replace(
      /^(Parte?|Chapter|Capítulo|Sección|Section) (\d+)$/,
      (_, type: string, num: string) => `${docShortTitle} — ${ABBREV_MAP[type]}. ${num}`,
    );
  } else if (audio.parts.length === 1) {
    return docShortTitle;
  }

  return partTitle;
}

const ABBREV_MAP: Record<string, string> = {
  Part: `pt`,
  Parte: `pt`,
  Chapter: `ch`,
  Section: `sect`,
  Sección: `pt`,
  Capítulo: `cp`,
};

function withSortTags(tags: Record<string, string>): Record<string, string> {
  if (tags[`artist-sort`] === undefined) {
    tags[`artist-sort`] = suffixThe(tags.artist);
  }
  tags[`album-sort`] = suffixThe(tags.album);
  tags[`title-sort`] = suffixThe(tags.title);
  return tags;
}

export function suffixThe(str: string): string {
  return str.replace(/^The (.*)/, `$1, The`);
}
