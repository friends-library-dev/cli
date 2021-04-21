import { CommandBuilder } from 'yargs';

export const command = `parse`;

export const describe = `lex and parse all (or limited by pattern) documents, asserting all nodes have tokens`;

export const builder: CommandBuilder = function (yargs) {
  return yargs
    .option(`pattern`, {
      alias: `p`,
      type: `string`,
      required: false,
      describe: `optional pattern to limit repo dirs`,
    })
    .option(`lex-only`, {
      alias: `l`,
      type: `boolean`,
      describe: `only lex, do not parse`,
      default: false,
    });
};

export { default as handler } from './handler';
