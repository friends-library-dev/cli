import fs from 'fs';
import { allFriends, Friend } from '@friends-library/friends';
import env from '@friends-library/env';

export default async function handler(): Promise<void> {
  const ymls = getYmls();
  console.log(ymls.length);
}

function getYmls(): { friend: Friend; path: string; raw: string; repoPath: string }[] {
  const { DOCS_REPOS_ROOT, DEV_LIBS_PATH } = env.require(
    `DOCS_REPOS_ROOT`,
    `DEV_LIBS_PATH`,
  );

  return allFriends().map((friend) => {
    const path = `${DEV_LIBS_PATH}/friends/yml/${friend.path}.yml`;
    return {
      friend,
      path,
      raw: fs.readFileSync(path).toString(),
      repoPath: `${DOCS_REPOS_ROOT}/${friend.path}`,
    };
  });
}
