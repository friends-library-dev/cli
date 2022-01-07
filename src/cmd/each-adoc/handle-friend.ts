import exec from 'x-exec';
import { Friend } from '@friends-library/friends';
import { red } from 'x-chalk';
import handleDocument from './handle-document';
import { DocumentMeta } from '@friends-library/document-meta';
import uuid from 'uuid/v4';
import { nullableJson } from './helpers';
import { FsDocPrecursor } from '@friends-library/dpc-fs';

export default function handleFriend(
  friend: Friend,
  meta: DocumentMeta,
  dpc: FsDocPrecursor,
): string[] {
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
    ...friend.documents.flatMap((doc) => handleDocument(doc, meta, dpc)),
    ...friendQuotes(friend),
    ...friendResidences(friend),
  ];
}

function friendResidences(friend: Friend): string[] {
  return (
    friend.residences?.flatMap((residence) => {
      if (residence.durations && residence.durations.length > 1) {
        red(`friend ${friend.path} has residence with multiple durations!`);
        process.exit();
      }
      const inserts: string[] = [];
      const friendResidenceId = uuid();
      inserts.push(/* sql */ `
        INSERT INTO "friend_residences"
        (
          "id",
          "friend_id",
          "city",
          "region",
          "created_at",
          "updated_at"
        ) VALUES (
          '${friendResidenceId}',
          '${friend.id}',
          '${residence.city}',
          '${residence.region}',
          current_timestamp,
          current_timestamp
        );
      `);

      (residence.durations ?? []).forEach((duration) => {
        inserts.push(/* sql */ `
          INSERT INTO "friend_residence_durations"
          (
            "id",
            "friend_residence_id",
            "start",
            "end",
            "created_at"
          ) VALUES (
            '${uuid()}',
            '${friendResidenceId}',
            ${duration.start},
            ${duration.end},
            current_timestamp
          );
        `);
      });
      return inserts;
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
