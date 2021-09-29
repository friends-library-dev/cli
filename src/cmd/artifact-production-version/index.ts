import { CommandBuilder } from 'yargs';

export const command = `artifact-production-version <sha>`;

export const describe = `set a new artifact production version`;

export const builder: CommandBuilder = function (yargs) {
  return yargs.positional(`sha`, {
    type: `string`,
    required: true,
    describe: `commit sha for new artifact production version`,
  });
};

export { default as handler } from './handler';
