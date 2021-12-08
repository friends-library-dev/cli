import { FsDocPrecursor, hydrate } from '@friends-library/dpc-fs';
import { evaluate, ParserError, PdfSrcResult } from '@friends-library/evaluator';
import { Edition } from '@friends-library/friends';
import uuid from 'uuid/v4';
import { boolean, nullable, nullableInt } from './helpers';

export default function handleChapters(
  editionId: string,
  timestamp: string,
  dpc: FsDocPrecursor,
): string[] {
  return getPdfSrcResult(dpc).chapters.map((ch, index) => {
    let customId: unknown = (ch as any).customId;
    if (typeof customId === `string` && customId === `chapter-${index + 1}`) {
      customId = `NULL`;
    } else if (customId === undefined || customId === null) {
      customId = `NULL`;
    } else {
      customId = `'${customId}'`;
    }
    return /* sql */ `
      INSERT INTO "edition_chapters" 
      (
        "id",
        "edition_id",
        "order",
        "custom_id",
        "short_heading",
        "is_intermediate_title",
        "sequence_number",
        "non_sequence_title",
        "created_at",
        "updated_at"
      ) VALUES (
        '${uuid()}',
        '${editionId}',
        ${index + 1},
        ${customId},
        '${ch.shortHeading.replace(/'/g, "''")}',
        ${boolean(ch.isIntermediateTitle)},
        ${nullableInt(ch.sequenceNumber)},
        ${nullable(ch.nonSequenceTitle?.replace(/'/g, "''"))},
        '${timestamp}',
        '${timestamp}'
      );
    `;
  });
}

function getPdfSrcResult(dpc: FsDocPrecursor): PdfSrcResult {
  try {
    hydrate.asciidoc(dpc, { chapterHeadingsOnly: true });
    return evaluate.toPdfSrcHtml(dpc);
  } catch (err) {
    if (err instanceof ParserError) {
      console.log(err.codeFrame);
    }
    process.exit(1);
  }
}
