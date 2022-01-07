import { DocumentMeta } from '@friends-library/document-meta';
import { FsDocPrecursor } from '@friends-library/dpc-fs';
import { Edition, isbns } from '@friends-library/friends';
import uuid from 'uuid/v4';
import { magenta, red } from 'x-chalk';
import handleAudio from './handle-audio';
import handleChapters from './handle-chapters';
import { boolean, nullable } from './helpers';

export default function handleEdition(
  edition: Edition,
  meta: DocumentMeta,
  dpc: FsDocPrecursor,
  idMap: Record<string, string>,
): string[] {
  const editionMeta = meta.get(edition.path);
  if (!editionMeta) {
    magenta(`missing edition meta for ${edition.path}`);
    if (!edition.isDraft) {
      red(`non-draft edition missing meta: ${edition.path}`);
      process.exit(1);
    }
  }

  const editionId = idMap[`${dpc.documentId}/${dpc.editionType}`];
  if (!editionId) {
    red(`failed to find edition id in map for ${edition.path}`);
    process.exit(1);
  }

  const insertEdition = /* sql */ `
    INSERT INTO "editions"
    (
      "id",
      "document_id",
      "type",
      "editor",
      "is_draft",
      "paperback_splits",
      "paperback_override_size",
      "created_at",
      "updated_at",
      "deleted_at"
    ) VALUES (
      '${editionId}',
      '${edition.document.id}',
      '${edition.type}',
      ${nullable(edition.editor)},
      ${boolean(edition.isDraft)},
      ${edition.splits ? `'{ ${edition.splits.join(`, `)} }'` : `NULL`},
      ${nullable(edition.document.printSize)},
      ${editionMeta ? `'${editionMeta.published}'` : `current_timestamp`},
      ${editionMeta ? `'${editionMeta.updated}'` : `current_timestamp`},
      NULL
    );`;

  let statements = [insertEdition];

  // handle special deleted sewel history modernized (for download FK relationship)
  if (
    edition.document.id === `69c5fc26-76e3-4302-964e-ba46d889003b` &&
    edition.type === `original`
  ) {
    statements.push(/* sql */ `
      INSERT INTO "editions"
      (
        "id",
        "document_id",
        "type",
        "editor",
        "is_draft",
        "paperback_splits",
        "paperback_override_size",
        "created_at",
        "updated_at",
        "deleted_at"
      ) VALUES (
        '0a4e9e87-3a4a-4bd3-8361-457f78893983',
        '${edition.document.id}',
        'modernized',
        NULL,
        ${boolean(edition.isDraft)},
        ${edition.splits ? `'{ ${edition.splits.join(`, `)} }'` : `NULL`},
        ${nullable(edition.document.printSize)},
        '2018-07-24T15:15:44.000Z',
        '2021-09-30T02:13:58.157Z',
        '2021-12-02T14:41:07.619Z'
      );`);
  }

  if (editionMeta) {
    const paperback = editionMeta.paperback;
    const sizeVariant = `${paperback.size}${paperback.condense ? `Condensed` : ``}`;
    const insertImpression = /* sql */ `
      INSERT INTO "edition_impressions" 
      (
        "id",
        "edition_id",
        "adoc_length",
        "paperback_size",
        "paperback_volumes",
        "published_revision",
        "production_toolchain_revision",
        "created_at"
      ) VALUES (
        '${uuid()}',
        '${editionId}',
        ${editionMeta.adocLength},
        '${sizeVariant}',
        '{ ${paperback.volumes.join(`, `)} }',
        '${editionMeta.revision}',
        '${editionMeta.productionRevision}',
        '${editionMeta.updated}'
      );
    `;
    statements.push(insertImpression);
  }

  if (editionMeta) {
    statements.push(/* sql */ `
      UPDATE "isbns"
      SET
        "edition_id" = '${editionId}',
        "updated_at" = '${editionMeta.published}'
      WHERE "code" = '${edition.isbn}';
    `);
  } else {
    statements.push(/* sql */ `
      UPDATE "isbns"
      SET "edition_id" = '${editionId}'
      WHERE "code" = '${edition.isbn}';
    `);
  }

  if (edition.audio) {
    statements = [...statements, ...handleAudio(edition.audio, editionId, editionMeta!)];
  }

  if (!edition.isDraft && editionMeta) {
    statements = [...statements, ...handleChapters(editionId, editionMeta.updated, dpc)];
  }

  return statements;
}

export function insertIsbns(): string[] {
  return isbns.map((code) => {
    return /* sql */ `
      INSERT INTO "isbns"
      (
        "id",
        "code",
        "edition_id",
        "created_at",
        "updated_at"
      ) VALUES (
        '${uuid()}',
        '${code}',
        NULL,
        '2018-09-27T12:00:00.000Z',
        '2018-09-27T12:00:00.000Z'
      );
    `;
  });
}
