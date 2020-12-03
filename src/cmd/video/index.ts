import { CommandBuilder } from 'yargs';

export const command = `video`;

export const describe = `handle video-related tasks`;

export const builder: CommandBuilder = function (yargs) {
  return yargs
    .option(`limit`, {
      type: `number`,
      alias: `l`,
      description: `limit the number of video resources operated upon`,
      default: 999999,
      demand: false,
    })
    .option(`pattern`, {
      type: `string`,
      alias: `p`,
      describe: `pattern to match audio paths`,
      demand: false,
    })
    .option(`dry-run`, {
      type: `boolean`,
      describe: `dry run only`,
      default: false,
      demand: false,
    })
    .option(`lang`, {
      type: `string`,
      describe: `which languages`,
      choices: [`en`, `es`, `both`],
      default: `both`,
      demand: false,
    })
    .option(`poster-server-port`, {
      alias: `d`,
      type: `number`,
      describe: `use already running poster web-app server at given port`,
      demand: false,
    });
};

export { default as handler } from './handler';
