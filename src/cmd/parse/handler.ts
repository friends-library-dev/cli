import { green, red } from 'x-chalk';
import { hydrate, query as dpcQuery } from '@friends-library/dpc-fs';
import {
  Lexer,
  Parser,
  assertAllNodesHaveTokens,
  TOKEN as t,
} from '@friends-library/parser';

interface Argv {
  pattern?: string;
  lexOnly: boolean;
}

export default async function handler({ pattern, lexOnly }: Argv): Promise<void> {
  const dpcs = dpcQuery.getByPattern(pattern);
  if (dpcs.length === 0) {
    red(`Pattern: \`${pattern}\` matched 0 docs.`);
    process.exit(1);
  }

  let illegalTokens: any[] = [];

  dpcs.forEach((dpc) => {
    hydrate.all([dpc]);
    if (lexOnly) {
      const lexer = new Lexer(...dpc.asciidocFiles);
      const illegal = lexer.tokens().filter((tok) => tok.type === t.ILLEGAL);
      illegalTokens = [...illegalTokens, ...illegal];
      return;
    }
    const document = Parser.parseDocument(...dpc.asciidocFiles);
    assertAllNodesHaveTokens(document);
  });

  if (illegalTokens.length) {
    illegalTokens.forEach((tok) => red(`Illegal token: ${tok}`));
    process.exit(1);
  }

  green(`No errors found in ${dpcs.length} editions ${lexOnly ? `lexed` : `parsed`}`);
}
