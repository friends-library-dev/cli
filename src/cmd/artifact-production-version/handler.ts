import '@friends-library/env/load';
import fetch from 'node-fetch';
import gql from 'x-syntax';
import { c, log } from 'x-chalk';
import env from '@friends-library/env';

interface Argv {
  sha: string;
}

export default async function handler({ sha }: Argv): Promise<void> {
  const ENDPOINT = env.requireVar(`CLI_FLP_API_ENDPOINT`);
  const TOKEN = env.requireVar(`CLI_FLP_API_TOKEN`);

  const res = await fetch(ENDPOINT, {
    method: `POST`,
    headers: {
      'Content-Type': `application/json`,
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      query: MUTATION,
      variables: { revision: sha },
    }),
  });

  if (res.status !== 200) {
    log(c`{red Error: unexpected status} {yellow ${res.status}}`);
    log(c`Response: {gray ${await res.text()}}`);
    process.exit(1);
  }

  const json = await res.json();
  if (`data` in json) {
    log(c`\nSuccessfully added version {green ${sha}}\n`);
    process.exit(0);
  }

  if (JSON.stringify(json).includes(`duplicate key value violates unique constraint`)) {
    log(c`\n{red Error: version {yellow ${sha}} already exists, must be unique}\n`);
    process.exit(1);
  }

  log(c`\n{red Unexpected error, see raw response below:}`);
  log(c`Response: {gray ${JSON.stringify(json)}}\n`);
  process.exit(1);
}

const MUTATION = gql`
  mutation CreateArtifactProductionVersion($revision: String!) {
    version: createArtifactProductionVersion(revision: $revision) {
      sha: version
    }
  }
`;
