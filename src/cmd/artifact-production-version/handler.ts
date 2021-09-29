import gql from 'x-syntax';
import { c, log } from 'x-chalk';
import * as graphql from '../../graphql';

interface Argv {
  sha: string;
}

export default async function handler({ sha }: Argv): Promise<void> {
  const result = await graphql.send(MUTATION, { revision: sha });
  if (result.success) {
    log(c`\nSuccessfully added version {green ${sha}}\n`);
    process.exit(0);
  }

  const { statusCode, body } = result.error;
  if (statusCode !== 200) {
    log(c`{red Error: unexpected status} {yellow ${statusCode}}`);
    log(c`Response: {gray ${body}}`);
    process.exit(1);
  }

  if (body.includes(`duplicate key value violates unique constraint`)) {
    log(c`\n{red Error: version {yellow ${sha}} already exists, must be unique}\n`);
    process.exit(1);
  }

  log(c`\n{red Unexpected error, see raw response below:}`);
  log(c`Response: {gray ${body}}\n`);
  process.exit(1);
}

const MUTATION = gql`
  mutation CreateArtifactProductionVersion($revision: String!) {
    version: createArtifactProductionVersion(revision: $revision) {
      sha: version
    }
  }
`;
