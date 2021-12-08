import { EditionMeta } from '@friends-library/document-meta';
import { Audio, AudioPart } from '@friends-library/friends';
import uuid from 'uuid/v4';
import { red } from 'x-chalk';
import { boolean, nullable, nullableInt } from './helpers';

export default function handleAudio(
  audio: Audio,
  editionId: string,
  meta: EditionMeta,
): string[] {
  const audioMeta = meta.audio;
  if (!audioMeta) {
    red(`missing audio meta for ${audio.edition.path}`);
    process.exit(1);
  }
  const audioId = uuid();
  const insertAudio = /* sql */ `
    INSERT INTO "edition_audios"
    (
      "id",
      "edition_id",
      "reader",
      "is_incomplete",
      "mp3_zip_size_hq",
      "mp3_zip_size_lq",
      "m4b_size_hq",
      "m4b_size_lq",
      "external_playlist_id_hq",
      "external_playlist_id_lq",
      "created_at",
      "updated_at"
    ) VALUES (
      '${audioId}',
      '${editionId}',
      '${audio.reader}',
      ${boolean(!audio.complete)},
      ${audioMeta.HQ.mp3ZipSize},
      ${audioMeta.LQ.mp3ZipSize},
      ${audioMeta.HQ.m4bSize},
      ${audioMeta.LQ.m4bSize},
      ${nullableInt(audio.externalPlaylistIdHq)},
      ${nullableInt(audio.externalPlaylistIdLq)},
      '${audio.added.toISOString()}',
      '${audio.added.toISOString()}'
    );
  `;

  return [
    insertAudio,
    ...audio.parts.map((part, index) => insertAudioPart(part, index, audioId, audioMeta)),
  ];
}

function insertAudioPart(
  part: AudioPart,
  index: number,
  audioId: string,
  meta: EditionMeta['audio'],
): string {
  return /* sql */ `
    INSERT INTO "edition_audio_parts"
    (
      "id",
      "audio_id",
      "title",
      "duration",
      "chapters",
      "order",
      "mp3_size_hq",
      "mp3_size_lq",
      "external_id_hq",
      "external_id_lq",
      "created_at",
      "updated_at"
    ) VALUES (
      '${uuid()}',
      '${audioId}',
      '${part.title}',
      ${meta!.durations[index].toFixed(2)},
      '{ ${part.chapters.join(`, `)} }',
      ${index + 1},
      ${meta!.HQ.parts[index].mp3Size},
      ${meta!.LQ.parts[index].mp3Size},
      '${part.externalIdHq}',
      '${part.externalIdLq}',
      '${part.audio.added.toISOString()}',
      '${part.audio.added.toISOString()}'
    );
  `;
}
