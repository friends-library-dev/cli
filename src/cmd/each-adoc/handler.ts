import fs from 'fs';
import { red } from 'x-chalk';
import { query as dpcQuery, hydrate } from '@friends-library/dpc-fs';
import handleFriend from './handle-friend';
import * as docMeta from '@friends-library/document-meta';
import editions from './cached-editions.json';
import handleEdition, { insertIsbns } from './handle-edition';
import * as editionIds from './edition-id-map';

export default async function handler({ pattern }: { pattern: string }): Promise<void> {
  // const meta = await docMeta.fetchSingleton();
  const meta = new docMeta.DocumentMeta(editions);
  const dpcs = dpcQuery.getByPattern(pattern === `ALL` ? undefined : pattern);
  if (dpcs.length === 0) {
    red(`Pattern: \`${pattern}\` matched 0 docs.`);
    process.exit(1);
  }

  const editionIdMap = editionIds.createMap(dpcs);
  const swiftDict = editionIds.createSwiftDict(editionIdMap);

  // 👋 TODO:need to handle the deleted sewel/modernized
  // `69c5fc26-76e3-4302-964e-ba46d889003b/modernized`

  const processedFriends: Array<string> = [];
  let sqlStatements: Array<string> = [
    /* sql */ `DELETE FROM "edition_chapters";`,
    /* sql */ `DELETE FROM "edition_audio_parts";`,
    /* sql */ `DELETE FROM "edition_audios";`,
    /* sql */ `DELETE FROM "isbns";`,
    /* sql */ `DELETE FROM "edition_impressions";`,
    /* sql */ `DELETE FROM "editions";`,
    /* sql */ `DELETE FROM "related_documents";`,
    /* sql */ `DELETE FROM "documents";`,
    /* sql */ `DELETE FROM "friend_quotes";`,
    /* sql */ `DELETE FROM "friend_residences";`,
    /* sql */ `DELETE FROM "friend_residence_durations";`,
    /* sql */ `DELETE FROM "friends";`,
    ...insertIsbns(),
  ];

  dpcs.forEach((dpc) => {
    // hydrate.entities(dpc); // think can skip now
    const friend = dpc.friend!;

    if (!processedFriends.includes(friend.id)) {
      processedFriends.push(friend.id);
      sqlStatements = [...sqlStatements, ...handleFriend(friend, meta, dpc)];
    }

    sqlStatements = [
      ...sqlStatements,
      ...handleEdition(dpc.edition!, meta, dpc, editionIdMap),
    ];
  });

  const resets = sqlStatements.filter((st) => st.includes(`DELETE FROM`));
  const inserts = sqlStatements.filter(
    (st) => st.includes(`INSERT INTO`) && !st.includes(`__DELAY__`),
  );
  const delays = sqlStatements.filter((st) => st.includes(`__DELAY__`));
  const updates = sqlStatements.filter((st) => st.includes(`UPDATE "`));

  fs.writeFileSync(
    `/Users/jared/fl/insert.sql`,
    [...resets, ...inserts, ...delays, ...updates].join(`\n\n`),
  );

  fs.writeFileSync(`/Users/jared/fl/EditionMigrationMap.swift`, swiftDict);
}
