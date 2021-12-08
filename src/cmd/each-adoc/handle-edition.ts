import { DocumentMeta } from '@friends-library/document-meta';
import { Edition } from '@friends-library/friends';
import uuid from 'uuid/v4';
import { magenta } from 'x-chalk';
import { boolean, nullable } from './helpers';

export default function handleEdition(edition: Edition, meta: DocumentMeta): string[] {
  const editionMeta = meta.get(edition.path);
  if (!editionMeta) {
    magenta(`missing edition meta for ${edition.path}`);
    return [];
  }

  const insert = /* sql */ `
    INSERT INTO "editions"
    (
      "id",
      "document_id",
      "type",
      "editor",
      "is_draft",
      "paperback_override_size",
      "created_at",
      "updated_at",
      "deleted_at"
    ) VALUES (
      '${uuid()}',
      '${edition.document.id}',
      '${edition.type}',
      ${nullable(edition.editor)},
      ${boolean(edition.isDraft)},
      ${nullable(edition.document.printSize)},
      '${editionMeta.published}',
      '${editionMeta.updated}',
      NULL
    );`;

  return [insert];
}
