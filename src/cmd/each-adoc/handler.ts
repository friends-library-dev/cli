import fs from 'fs';
import { red } from 'x-chalk';
import { query as dpcQuery, hydrate } from '@friends-library/dpc-fs';
import handleFriend from './handle-friend';
import * as docMeta from '@friends-library/document-meta';
import editions from './cached-editions.json';
import handleEdition, { insertIsbns } from './handle-edition';

export default async function handler({ pattern }: { pattern: string }): Promise<void> {
  // const meta = await docMeta.fetchSingleton();
  const meta = new docMeta.DocumentMeta(editions);
  const dpcs = dpcQuery.getByPattern(pattern === `ALL` ? undefined : pattern);
  if (dpcs.length === 0) {
    red(`Pattern: \`${pattern}\` matched 0 docs.`);
    process.exit(1);
  }

  const processedFriends: Array<string> = [];
  let sqlStatements: Array<string> = [
    /* sql */ `DELETE FROM "edition_chapters";`,
    /* sql */ `DELETE FROM "edition_audio_parts";`,
    /* sql */ `DELETE FROM "edition_audios";`,
    /* sql */ `DELETE FROM "isbns";`,
    /* sql */ `DELETE FROM "edition_impressions";`,
    /* sql */ `DELETE FROM "editions";`,
    /* sql */ `DELETE FROM "documents_tags_pivot";`,
    /* sql */ `DELETE FROM "documents";`,
    /* sql */ `DELETE FROM "friend_quotes";`,
    /* sql */ `DELETE FROM "friend_residences";`,
    /* sql */ `DELETE FROM "friends";`,
    ...insertIsbns(),
  ];

  dpcs.forEach((dpc) => {
    hydrate.entities(dpc);
    const friend = dpc.friend!;

    if (!processedFriends.includes(friend.id)) {
      processedFriends.push(friend.id);
      sqlStatements = [...sqlStatements, ...handleFriend(friend, meta, dpc)];
    }

    sqlStatements = [...sqlStatements, ...handleEdition(dpc.edition!, meta, dpc)];
  });

  const resets = sqlStatements.filter((st) => st.includes(`DELETE FROM`));
  const inserts = sqlStatements.filter((st) => st.includes(`INSERT INTO`));
  const updates = sqlStatements.filter((st) => st.includes(`UPDATE "`));

  fs.writeFileSync(
    `/Users/jared/fl/insert.sql`,
    [...resets, ...inserts, ...updates].join(`\n\n`),
  );
}
