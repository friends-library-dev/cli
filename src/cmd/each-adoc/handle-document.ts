import { DocumentMeta } from '@friends-library/document-meta';
import { Document } from '@friends-library/friends';
import { isNotNull } from 'x-ts-utils';
import handleEdition from './handle-edition';
import { nullable, nullableInt } from './helpers';

export default function handleDocument(document: Document, meta: DocumentMeta): string[] {
  const metas = [
    meta.get(`${document.path}/original`),
    meta.get(`${document.path}/updated`),
    meta.get(`${document.path}/modernized`),
  ].filter(isNotNull);

  let createdAt = `current_timestamp`;
  let updatedAt = `current_timestamp`;
  if (metas.length > 0) {
    createdAt = metas[0].published;
    updatedAt = metas[0].updated;
    metas.forEach((editionMeta) => {
      if (editionMeta.published < createdAt) {
        createdAt = editionMeta.published;
      }
      if (editionMeta.updated > updatedAt) {
        updatedAt = editionMeta.updated;
      }
    });
    createdAt = `'${createdAt}'`;
    updatedAt = `'${updatedAt}'`;
  }

  const insert = /* sql */ `
    INSERT INTO "documents"
    (
      "id",
      "friend_id",
      "alt_language_id",
      "title",
      "slug",
      "filename",
      "published",
      "original_title",
      "incomplete",
      "description",
      "partial_description",
      "featured_description",
      "created_at",
      "updated_at",
      "deleted_at"
     ) VALUES (
      '${document.id}',
      '${document.friend.id}',
      NULL, -- alt_language_id placeholder
      '${document.title}',
      '${document.slug}',
      '${document.filenameBase}',
      ${nullableInt(document.published)},
      ${nullable(document.originalTitle)},
      ${document.isComplete ? `FALSE` : `TRUE`},
      '${document.description}',
      '${document.partialDescription}',
      ${nullable(document.featuredDescription)},
      ${createdAt},
      ${updatedAt},
      NULL
    );`;

  return [
    insert,
    ...connectAltLanguageDoc(document),
    ...document.editions.flatMap((edition) => handleEdition(edition, meta)),
  ];
}

function connectAltLanguageDoc(document: Document): string[] {
  if (!document.altLanguageId) {
    return [];
  }
  const connect = /* sql */ `
    UPDATE "documents"
    SET "alt_language_id" = '${document.altLanguageId}'
    WHERE "id" = '${document.id}';
  `;
  return [connect];
}
