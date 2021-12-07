import fs from 'fs';
import { red } from 'x-chalk';
import { query as dpcQuery, hydrate } from '@friends-library/dpc-fs';
import handleFriend from './handle-friend';

export default async function handler({ pattern }: { pattern: string }): Promise<void> {
  const dpcs = dpcQuery.getByPattern(pattern === `ALL` ? undefined : pattern);
  if (dpcs.length === 0) {
    red(`Pattern: \`${pattern}\` matched 0 docs.`);
    process.exit(1);
  }

  const processedFriends: Array<string> = [];
  let sqlStatements: Array<string> = [
    /* sql */ `DELETE FROM "editions";`,
    /* sql */ `DELETE FROM "documents";`,
    /* sql */ `DELETE FROM "friends";`,
  ];

  dpcs.forEach((dpc) => {
    hydrate.entities(dpc);
    const friend = dpc.friend!;

    if (!processedFriends.includes(friend.id)) {
      processedFriends.push(friend.id);
      sqlStatements = [...sqlStatements, ...handleFriend(friend)];
    }
  });

  const inserts = sqlStatements.filter((st) => st.includes(`INSERT INTO`));
  const updates = sqlStatements.filter((st) => !st.includes(`INSERT INTO`));

  fs.writeFileSync(`/Users/jared/fl/insert.sql`, [...inserts, ...updates].join(`\n\n`));
}
