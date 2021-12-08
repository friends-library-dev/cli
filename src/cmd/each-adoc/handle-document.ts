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
    const id = TAG_MAP[tag];
    if (!id) {
      red(`failed to resolve id for tag: ${tag}`);
      process.exit(1);
    }
    return /* sql */ `
      INSERT INTO "documents_tags_pivot" 
      (
        "id",
        "document_tag_id",
        "document_id",
        "created_at"
      ) VALUES (
        '${uuid()}',
        '${id}',
        '${document.id}',
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

const TAG_MAP = {
  journal: `01b6f96e-1b8c-4c59-80ae-558411af9930`,
  letters: `298c9069-7a93-4b0e-bee3-99200ed46893`,
  exhortation: `2f39ac54-3ec8-4fe3-b09f-4f38c051eac8`,
  doctrinal: `401f8cde-3b62-41e6-b32e-43fe22c88c96`,
  treatise: `48479858-f259-4d6c-ab33-4b9104adb8ca`,
  history: `50ff8a67-c42b-4d7b-9127-9224b10d5aa4`,
  allegory: `7f459198-6e67-4c67-b543-26b40103abe2`,
  'spiritual life': `fa070ac4-ccf2-4524-ac10-c4f1e1adb92f`,
  'spiritual-life': `fa070ac4-ccf2-4524-ac10-c4f1e1adb92f`,
  spiritualLife: `fa070ac4-ccf2-4524-ac10-c4f1e1adb92f`,
};
