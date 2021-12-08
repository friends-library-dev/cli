import exec from 'x-exec';
import { Friend } from '@friends-library/friends';
import { red } from 'x-chalk';
import handleDocument from './handle-document';
import { DocumentMeta } from '@friends-library/document-meta';
import uuid from 'uuid/v4';
import { nullableJson } from './helpers';

export default function handleFriend(friend: Friend, meta: DocumentMeta): string[] {
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
    ...friend.documents.flatMap((doc) => handleDocument(doc, meta)),
    ...friendQuotes(friend),
    ...friendResidences(friend),
  ];
}

function friendResidences(friend: Friend): string[] {
  return (
    friend.residences?.map((residence) => {
      if (residence.durations && residence.durations.length > 1) {
        red(`friend ${friend.path} has residence with multiple durations!`);
        process.exit();
      }
      return /* sql */ `
        INSERT INTO "friend_residences"
        (
          "id",
          "friend_id",
          "city",
          "region",
          "duration",
          "created_at",
          "updated_at"
        ) VALUES (
          '${uuid()}',
          '${friend.id}',
          '${residence.city}',
          '${residence.region}',
          ${nullableJson(residence.durations?.[0])},
          current_timestamp,
          current_timestamp
        );`;
    }) ?? []
  );
}

function friendQuotes(friend: Friend): string[] {
  return (
    friend.quotes?.map((quote, index) => {
      return /* sql */ `
        INSERT INTO "friend_quotes"
        (
          "id",
          "friend_id",
          "source",
          "text",
          "order",
          "context",
          "created_at",
          "updated_at"
        ) VALUES (
          '${uuid()}',
          '${friend.id}',
          '${quote.source}',
          '${quote.text}',
          ${index + 1},
          NULL,
          current_timestamp,
          current_timestamp
        );`;
    }) ?? []
  );
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