import { CommandBuilder } from 'yargs';

export const command = `audio`;

export const describe = `handle audio-related tasks`;

export const builder: CommandBuilder = function (yargs) {
  return yargs
    .option(`limit`, {
      type: `number`,
      alias: `l`,
      description: `limit the number of audio resources operated upon`,
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
    .option(`clean-derived-dir`, {
      type: `boolean`,
      describe: `clean derived dir after completion`,
      default: false,
      demand: false,
    })
    .option(`skip-large-uploads`, {
      type: `boolean`,
      describe: `skip large uploads (m4b and mp3 zips)`,
      default: false,
      demand: false,
    })
    .option(`lang`, {
      type: `string`,
      describe: `which languages`,
      choices: [`en`, `es`, `both`],
      default: `both`,
      demand: false,
    });
};

export { default as handler } from './handler';
