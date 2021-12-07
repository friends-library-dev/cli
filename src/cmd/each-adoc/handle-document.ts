import { Document } from '@friends-library/friends';
import { nullable, nullableInt } from './helpers';

export function insertDocument(document: Document): string {
  return /* sql */ `
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
      '2021-12-07T19:57:36.391Z', -- TODO
      '2021-12-07T19:57:36.391Z',
      '2021-12-07T19:57:36.391Z'
    );`;
}

export function connectAltLanguageDoc(document: Document): string[] {
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
