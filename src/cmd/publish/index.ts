import { CommandBuilder } from 'yargs';

export const command = `publish`;

export const describe = `publish book assets`;

export const builder: CommandBuilder = function (yargs) {
  return yargs
    .option(`check`, {
      alias: `c`,
      type: `boolean`,
      description: `perform epub check`,
      default: false,
      demand: false,
    })
    .option(`force`, {
      alias: `f`,
      type: `boolean`,
      description: `publish even if doc doesn't need re-publishing`,
      default: false,
      demand: false,
    })
    .option(`allow-status`, {
      type: `boolean`,
      description: `allow publishing when CLI has non-clean git status`,
      default: false,
      demand: false,
    })
    .option(`pattern`, {
      alias: `p`,
      type: `string`,
      description: `pattern to restrict published assets`,
      demand: false,
    })
    .option(`cover-server-port`, {
      alias: `d`,
      type: `number`,
      describe: `use already running cover web-app server at given port`,
      demand: false,
    });
};

export { default as handler } from './handler';
