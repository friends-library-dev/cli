import exec from 'x-exec';
import { Friend } from '@friends-library/friends';
import { red } from 'x-chalk';
import { connectAltLanguageDoc, insertDocument } from './handle-document';

export default function handleFriend(friend: Friend): string[] {
  const dates = friendDates(friend);

  const insertFriend = /* sql */ `
    INSERT INTO "friends"
    (
      "id",
      "lang",
      "name",
      "slug",
      "gender",
      "description",
      "born",
      "died",
      "published",
      "created_at",
      "updated_at"
    ) VALUES (
      '${friend.id}',
      '${friend.lang}',
      '${friend.name}',
      '${friend.slug}',
      '${friend.gender}',
      '${friend.description}',
      ${friend.born ?? `NULL`},
      ${friend.died ?? `NULL`},
      ${dates.published ? `'${dates.published}'` : 'NULL'},
      '${dates.createdAt}',
      '${dates.updatedAt}'
    );
  `;

  return [
    insertFriend,
    ...friend.documents.map(insertDocument),
    ...friend.documents.flatMap(connectAltLanguageDoc),
  ];
}

function friendDates(friend: Friend): {
  published: string | null;
  createdAt: string;
  updatedAt: string;
} {
  const [, output] = exec(
    `git log --format=%aD yml/${friend.path}.yml`,
    `/Users/jared/fl/libs/friends`,
  );
  const dates = output
    .trim()
    .split(`\n`)
    .map((r) => new Date(r).toISOString());

  if (dates.length < 1) {
    red(`unable to get dates for friend ${friend.path}`);
    process.exit(1);
  }
  return {
    published: friend.added?.toISOString() ?? null,
    createdAt: dates[dates.length - 1],
    updatedAt: dates[0],
  };
}
