import { DocumentMeta } from '@friends-library/document-meta';
import { Edition } from '@friends-library/friends';
import uuid from 'uuid/v4';
import { magenta, red } from 'x-chalk';
import { boolean, nullable, nullableJson } from './helpers';

export default function handleEdition(edition: Edition, meta: DocumentMeta): string[] {
  const editionMeta = meta.get(edition.path);
  if (!editionMeta) {
    magenta(`missing edition meta for ${edition.path}`);
    if (!edition.isDraft) {
      red(`non-draft edition missing meta: ${edition.path}`);
      process.exit(1);
    }
  }

  const editionId = uuid();
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

  const statements = [insertEdition];

  if (editionMeta) {
    const paperback = editionMeta.paperback;
    const sizeVariant = `${paperback.size}${paperback.condense ? `--condensed` : ``}`;
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

  return statements;
}
