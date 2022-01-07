import { DocumentMeta } from '@friends-library/document-meta';
import { Document } from '@friends-library/friends';
import { red } from 'x-chalk';
import uuid from 'uuid/v4';
import { isNotNull } from 'x-ts-utils';
import { nullable, nullableInt } from './helpers';
import { FsDocPrecursor } from '@friends-library/dpc-fs';

export default function handleDocument(
  document: Document,
  meta: DocumentMeta,
  dpc: FsDocPrecursor,
): string[] {
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
    );
  `;

  return [
    insert,
    ...insertDocumentTags(document),
    ...connectAltLanguageDoc(document),
    ...insertRelatedDocuments(document, createdAt),
  ];
}

function insertRelatedDocuments(document: Document, createdAt: string): string[] {
  if (!document.relatedDocuments) {
    return [];
  }

  return document.relatedDocuments.map((related) => {
    return /* sql */ `
      -- __DELAY__ dont insert until all docs are inserted
      INSERT INTO "related_documents"
      (
        "id",
        "parent_document_id",
        "document_id",
        "description",
        "created_at",
        "updated_at"
      ) VALUES (
        '${uuid()}',
        '${document.id}',
        '${related.id}',
        '${related.description}',
        ${createdAt},
        ${createdAt}
      );
    `;
  });
}

function insertDocumentTags(document: Document): string[] {
  return document.tags.map((tag) => {
    return /* sql */ `
      INSERT INTO "document_tags" 
      (
        "id",
        "document_id",
        "type",
        "created_at"
      ) VALUES (
        '${uuid()}',
        '${document.id}',
        '${tag === `spiritual life` ? `spiritualLife` : tag}',
        current_timestamp
      );
    `;
  });
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
