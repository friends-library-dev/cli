import fs from 'fs-extra';
import { execSync } from 'child_process';
import { Arguments } from 'yargs';
import { sync as glob } from 'glob';
import { log, red } from 'x-chalk';
import * as manifest from '@friends-library/doc-manifests';
import * as artifacts from '@friends-library/doc-artifacts';
import { appEbook as appEbookCss } from '@friends-library/doc-css';
import { hydrate, query as dpcQuery, FsDocPrecursor } from '@friends-library/dpc-fs';
import { ParserError } from '@friends-library/parser';
import {
  ArtifactType,
  DocPrecursor,
  FileManifest,
  PaperbackInteriorConfig,
  EbookConfig,
  PrintSize,
} from '@friends-library/types';
import lintFixPath from '../../lint/lint-fix-path';
import lintPath from '../../lint/lint-path';
import { printLints } from '../../lint/display';
import send from './send';

export interface MakeOptions {
  pattern: string;
  isolate?: number;
  noOpen: boolean;
  noFrontmatter: boolean;
  target: ArtifactType[];
  condense: boolean;
  check: boolean;
  printSize?: PrintSize;
  email?: string;
  send: boolean;
  fix: boolean;
  skipLint: boolean;
  head: boolean;
  toc: boolean;
}

export default async function handler(argv: Arguments<MakeOptions>): Promise<void> {
  const { noOpen, pattern, isolate, email, skipLint, fix } = argv;
  const dpcs = dpcQuery.getByPattern(pattern);
  if (dpcs.length === 0) {
    red(`Pattern: \`${pattern}\` matched 0 docs.`);
    process.exit(1);
  }

  if (argv.toc) {
    argv.noFrontmatter = false;
  }

  hydrate.all(dpcs, {
    isolate,
    chapterHeadingsOnly: argv.toc === true,
  });

  if (argv.head) {
    // @TODO reimplement (if needed) after parser/evaluator refactor
  }

  if (!skipLint) {
    dpcs.forEach((dpc) => lint(dpc.fullPath, fix, isolate));
  }

  const namespace = `fl-make`;
  artifacts.deleteNamespaceDir(namespace);

  let files: string[] = [];
  for (const dpc of dpcs) {
    try {
      files = files.concat(await makeDpc(dpc, argv, namespace));
    } catch (err) {
      if (err instanceof ParserError) {
        console.log(err.codeFrame);
      } else {
        red(err instanceof Error ? err.message : err);
      }
      process.exit(1);
    }
  }

  !noOpen && files.forEach((file) => execSync(`open "${file}"`));
  argv.send && send(files, email);
}

export async function makeDpc(
  dpc: FsDocPrecursor,
  argv: Arguments<MakeOptions>,
  namespace: string,
): Promise<string[]> {
  const files: string[] = [];
  for (const type of argv.target) {
    const manifests = await getTypeManifests(type, dpc, argv);
    for (let idx = 0; idx < manifests.length; idx++) {
      const filename = makeFilename(dpc, type);
      const srcPath = makeSrcPath(dpc, type);
      const options = { namespace, srcPath, check: argv.check };
      files.push(await artifacts.create(type, manifests[idx], filename, options));
    }
  }
  return files;
}

async function getTypeManifests(
  type: ArtifactType,
  dpc: DocPrecursor,
  argv: MakeOptions,
): Promise<FileManifest[]> {
  switch (type) {
    case `web-pdf`:
      return manifest.webPdf(dpc);
    case `paperback-interior`: {
      const conf: PaperbackInteriorConfig = {
        frontmatter: !argv.noFrontmatter,
        printSize: argv.printSize || `m`,
        condense: argv.condense,
        allowSplits: false,
      };
      return manifest.paperbackInterior(dpc, conf);
    }
    case `speech`:
      return manifest.speech(dpc);
    case `app-ebook`:
      return appEbookWithCss(dpc);
    case `mobi`:
    case `epub`: {
      const conf: EbookConfig = {
        frontmatter: !argv.noFrontmatter,
        subType: type,
        randomizeForLocalTesting: true,
      };
      return manifest[type](dpc, conf);
    }
  }
  return [];
}

function makeFilename(dpc: DocPrecursor, type: ArtifactType): string {
  let suffix = ``;
  if (type === `paperback-cover`) suffix = `(cover)`;
  if (type === `web-pdf`) suffix = `(web)`;
  if (type === `app-ebook`) suffix = `(app-ebook)`;
  if (type === `mobi`) suffix = `${Math.floor(Date.now() / 1000)}`;
  return [
    dpc.friendInitials.join(``),
    dpc.documentSlug,
    dpc.documentId.substring(0, 8),
    dpc.editionType,
    suffix,
  ]
    .filter((p) => !!p)
    .join(`--`);
}

function makeSrcPath(dpc: DocPrecursor, type: ArtifactType): string {
  let path = makeFilename(dpc, type);
  if (type === `mobi` || type === `epub`) {
    path += `/${type}`;
  }
  return path;
}

function lint(dpcPath: string, fix: boolean, isolate?: number): void {
  let path = dpcPath;

  if (isolate) {
    const pattern = `${isolate < 10 ? `0` : ``}${isolate}*`;
    const matches = glob(`${path}/${pattern}`);
    if (matches.length !== 1) {
      throw new Error(`Unexpected result isolating ${isolate}`);
    }
    [path] = matches;
  }

  if (fix === true) {
    const { unfixable, numFixed } = lintFixPath(path);
    if (unfixable.count() > 0) {
      printLints(unfixable);
      log(`\n\n`);
      red(`ERROR: ${unfixable.count()} remaining lint errors (fixed ${numFixed}). 😬 `);
      process.exit(1);
    }
  }

  const lints = lintPath(path);
  if (lints.count() > 0) {
    printLints(lints);
    red(`\n\nERROR: ${lints.count()} lint errors must be fixed. 😬 `);
    process.exit(1);
  }
}

async function appEbookWithCss(dpc: DocPrecursor): Promise<[FileManifest]> {
  const [appManifest] = await manifest.appEbook(dpc);
  const htmlFilename = Object.keys(appManifest)[0];
  const { ARTIFACT_DIR } = artifacts.dirs({ namespace: `fl-make/_app-ebook-css` });
  const cssPath = `${ARTIFACT_DIR}/app-ebook.css`;
  fs.ensureDirSync(ARTIFACT_DIR);
  fs.writeFileSync(cssPath, appEbookCss());
  const inner = appManifest[htmlFilename];
  const wrappedHtml = `
    <html>
      <head>
        <link href="file://${cssPath}" rel="stylesheet">
      </head>
      <body>
        ${inner}
      </body>
    </html>
  `;
  appManifest[htmlFilename] = wrappedHtml;
  return [appManifest];
}
