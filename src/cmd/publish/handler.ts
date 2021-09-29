import fs from 'fs-extra';
import gql from 'x-syntax';
import sharp from 'sharp';
import { dirname } from 'path';
import { log, c, red } from 'x-chalk';
import { isDefined } from 'x-ts-utils';
import * as docMeta from '@friends-library/document-meta';
import * as cloud from '@friends-library/cloud';
import {
  DocPrecursor,
  ArtifactType,
  SQUARE_COVER_IMAGE_SIZES,
  THREE_D_COVER_IMAGE_WIDTHS,
  LARGEST_THREE_D_COVER_IMAGE_WIDTH,
} from '@friends-library/types';
import * as artifacts from '@friends-library/doc-artifacts';
import * as manifest from '@friends-library/doc-manifests';
import { appEbook as appEbookCss } from '@friends-library/doc-css';
import { hydrate, query as dpcQuery, FsDocPrecursor } from '@friends-library/dpc-fs';
import { Edition } from '@friends-library/friends';
import { ParserError } from '@friends-library/parser';
import * as coverServer from './cover-server';
import { ScreenshotTaker } from './cover-server';
import validate from './validate';
import { logDocStart, logDocComplete, logPublishComplete, logPublishStart } from './log';
import { publishPaperback } from './paperback';
import * as graphql from '../../graphql';
import * as git from './git';

interface PublishOptions {
  check: boolean;
  pattern?: string;
  coverServerPort?: number;
  allowStatus: boolean;
  force: boolean;
}

export default async function publish(argv: PublishOptions): Promise<void> {
  if (!argv.allowStatus && !git.cliStatusClean()) {
    log(c`\n{red.bold Error: git status not clean} {gray --allow-status to override}\n`);
    process.exit(1);
  }

  logPublishStart();

  // concurrently wait for startup meta tasks...
  const [revisionResult, meta, COVER_PORT] = await Promise.all([
    graphql.send<{ version: { sha: string } }>(REVISION_QUERY),
    docMeta.fetch(),
    argv.coverServerPort ? Promise.resolve(argv.coverServerPort) : coverServer.start(),
  ]);

  if (!revisionResult.success) {
    log(c`\n{red.bold Error retrieving latest artifact production version:}`);
    log(c`{gray ${revisionResult.error.body}}`);
    process.exit(1);
  }

  const productionRevision = revisionResult.value.version.sha;
  const [makeScreenshot, closeHeadlessBrowser] = await coverServer.screenshot(COVER_PORT);
  const dpcs = dpcQuery.getByPattern(argv.pattern);
  const errors: string[] = [];

  for (let i = 0; i < dpcs.length; i++) {
    const dpc = dpcs[i];
    const assetStart = Date.now();
    const progress = c`{gray (${String(i + 1)}/${String(dpcs.length)})}`;

    try {
      logDocStart(dpc, progress);
      if (!argv.force && shouldSkip(dpc, meta, productionRevision)) {
        log(c`   {gray re-publish not needed, skipping}`);
        continue;
      }

      hydrate.all([dpc]);
      if (dpc.edition?.isDraft) {
        continue;
      }

      await validate(dpc);
      const uploads = new Map<string, string>();
      const fileId = getFileId(dpc);
      const namespace = `fl-publish/${fileId}`;
      const opts = { namespace, srcPath: fileId };
      artifacts.deleteNamespaceDir(namespace);

      await handleAppEbook(dpc, opts, uploads, i);
      await handlePaperbackAndCover(dpc, opts, uploads, meta, productionRevision);
      await handleWebPdf(dpc, opts, uploads);
      await handleEbooks(dpc, opts, uploads, makeScreenshot);
      await handle3dPaperbackCoverImages(dpc, opts, uploads, makeScreenshot);
      await handleSquareCoverImages(dpc, opts, uploads, makeScreenshot);
      await handleSpeech(dpc, opts, uploads);
      log(c`   {gray Uploading generated files to cloud storage...}`);
      await cloud.uploadFiles(uploads);
      log(c`   {gray Saving edition meta...}`);
      await docMeta.save(meta);
    } catch (err) {
      if (err instanceof ParserError) {
        console.log(err.codeFrame);
        errors.push(`${dpc.path} ${err.codeFrame}`);
      } else {
        red(err);
        errors.push(`${dpc.path} ${err}`);
      }
    }

    logDocComplete(dpc, assetStart, progress);
  }

  if (!argv.coverServerPort) coverServer.stop(COVER_PORT);
  await closeHeadlessBrowser();
  logPublishComplete();

  if (errors.length) {
    red(`Encountered ${errors.length} errors:\n`);
    red(`\t${errors.join(`\n\t`)}`);
    process.exit(1);
  }
}

async function handleAppEbook(
  dpc: FsDocPrecursor,
  opts: { namespace: string; srcPath: string },
  uploads: Map<string, string>,
  index: number,
): Promise<void> {
  log(c`   {gray Creating app-ebook artifact...}`);
  const [appEbookManifest] = await manifest.appEbook(dpc);
  const filenameNoExt = edition(dpc)
    .filename(`app-ebook`)
    .replace(/\.html$/, ``);

  const path = await artifacts.appEbook(appEbookManifest, filenameNoExt, opts);
  uploads.set(path, cloudPath(dpc, `app-ebook`));

  // create and upload the shared app-ebook css only once
  if (index === 0) {
    const rootPublishDir = dirname(dirname(path));
    const cssPath = `${rootPublishDir}/_app-ebook.css`;
    fs.ensureDirSync(rootPublishDir);
    fs.writeFileSync(cssPath, appEbookCss());
    uploads.set(cssPath, `static/app-ebook.css`);
  }
}

async function handleSquareCoverImages(
  dpc: FsDocPrecursor,
  opts: { namespace: string; srcPath: string },
  uploads: Map<string, string>,
  makeScreenshot: ScreenshotTaker,
): Promise<void> {
  log(c`   {gray Creating square cover images...}`);
  if (!dpc.edition) throw new Error(`Unexpected missing dpc.edition ${dpc.path}`);
  const dirname = artifacts.dirs(opts).ARTIFACT_DIR;
  fs.ensureDirSync(dirname);
  const buffer = await makeScreenshot(dpc.path, `audio`);
  const files = await Promise.all(
    SQUARE_COVER_IMAGE_SIZES.flatMap((size) => {
      const filenames = [dpc.edition!.squareCoverImageFilename(size)];
      if (size === 1400) {
        // legacy filename, before split out into multiple square image sizes
        filenames.push(`${dpc.edition!.filenameBase}--audio.png`);
      }
      return filenames.filter(isDefined).map((filename) => ({
        size,
        localPath: `${dirname}/${filename}`,
        cloudPath: filename.endsWith(`--audio.png`)
          ? `${dpc.path}/${filename}`
          : dpc.edition!.squareCoverImagePath(size),
      }));
    }).map(async ({ size, localPath, cloudPath }) => {
      if (size === 1400) {
        await fs.writeFile(localPath, buffer);
      } else {
        await sharp(buffer).resize(size).toFile(localPath);
      }
      return { localPath, cloudPath };
    }),
  );

  files.forEach(({ localPath, cloudPath }) => uploads.set(localPath, cloudPath));
}

async function handle3dPaperbackCoverImages(
  dpc: FsDocPrecursor,
  opts: { namespace: string; srcPath: string },
  uploads: Map<string, string>,
  makeScreenshot: ScreenshotTaker,
): Promise<void> {
  log(c`   {gray Creating 3d cover images...}`);
  if (!dpc.edition) throw new Error(`Unexpected missing dpc.edition ${dpc.path}`);
  const dirname = artifacts.dirs(opts).ARTIFACT_DIR;
  fs.ensureDirSync(dirname);
  const buffer = await makeScreenshot(dpc.path, `threeD`);
  const files = await Promise.all(
    THREE_D_COVER_IMAGE_WIDTHS.map((size) => ({
      size,
      localPath: `${dirname}/${dpc.edition!.threeDCoverImageFilename(size)}`,
      cloudPath: dpc.edition!.threeDCoverImagePath(size),
    })).map(async ({ size, localPath, cloudPath }) => {
      if (size === LARGEST_THREE_D_COVER_IMAGE_WIDTH) {
        await fs.writeFile(localPath, buffer);
      } else {
        await sharp(buffer).resize(size).toFile(localPath);
      }
      return { localPath, cloudPath };
    }),
  );

  files.forEach(({ localPath, cloudPath }) => uploads.set(localPath, cloudPath));
}

async function handleWebPdf(
  dpc: FsDocPrecursor,
  opts: { namespace: string; srcPath: string },
  uploads: Map<string, string>,
): Promise<void> {
  log(c`   {gray Creating web-pdf artifact...}`);
  const [webManifest] = await manifest.webPdf(dpc);
  const filename = edition(dpc)
    .filename(`web-pdf`)
    .replace(/\.pdf$/, ``);
  const path = await artifacts.pdf(webManifest, filename, opts);
  uploads.set(path, cloudPath(dpc, `web-pdf`));
}

async function handleSpeech(
  dpc: FsDocPrecursor,
  opts: { namespace: string; srcPath: string },
  uploads: Map<string, string>,
): Promise<void> {
  log(c`   {gray Creating speech artifact...}`);
  const [speechManifest] = await manifest.speech(dpc);
  const filename = edition(dpc)
    .filename(`speech`)
    .replace(/\.html$/, ``);
  const path = await artifacts.speech(speechManifest, filename, opts);
  uploads.set(path, cloudPath(dpc, `speech`));
}

async function handlePaperbackAndCover(
  dpc: FsDocPrecursor,
  opts: { namespace: string; srcPath: string },
  uploads: Map<string, string>,
  meta: docMeta.DocumentMeta,
  productionRevision: string,
): Promise<void> {
  log(c`   {gray Starting paperback interior generation...}`);
  const [paperbackMeta, volumePaths] = await publishPaperback(dpc, opts);
  volumePaths.forEach((path, idx) => {
    const fauxVolNum = volumePaths.length > 1 ? idx + 1 : undefined;
    uploads.set(path, cloudPath(dpc, `paperback-interior`, fauxVolNum));
  });

  const existingMeta = meta.get(dpc.path);
  const now = new Date().toISOString();
  meta.set(dpc.path, {
    ...(existingMeta ? { ...existingMeta } : {}),
    published: existingMeta?.published || now,
    updated: now,
    adocLength: dpc.asciidocFiles.reduce((acc, file) => acc + file.adoc.length, 0),
    numSections: dpc.asciidocFiles.length,
    paperback: paperbackMeta,
    revision: git.dpcDocumentCurrentSha(dpc),
    productionRevision,
  });

  const coverManifests = await manifest.paperbackCover(dpc, {
    printSize: paperbackMeta.size,
    volumes: paperbackMeta.volumes,
  });

  for (let idx = 0; idx < coverManifests.length; idx++) {
    const manifest = coverManifests[idx];
    const fauxVolumeNumber = coverManifests.length > 1 ? idx + 1 : undefined;
    const filename = edition(dpc)
      .filename(`paperback-cover`, fauxVolumeNumber)
      .replace(/\.pdf$/, ``);
    const path = await artifacts.pdf(manifest, filename, opts);
    uploads.set(path, cloudPath(dpc, `paperback-cover`, fauxVolumeNumber));
  }
}

async function handleEbooks(
  dpc: FsDocPrecursor,
  opts: { namespace: string; srcPath: string },
  uploads: Map<string, string>,
  makeScreenshot: ScreenshotTaker,
): Promise<void> {
  const coverImg = await makeScreenshot(dpc.path, `ebook`);
  // to get a cover image .png file, see epub src files in `artifacts` dir after publish
  const config = { coverImg, frontmatter: true };
  const base = edition(dpc).filename(`epub`).replace(/\..*$/, ``);

  log(c`   {gray Creating epub artifact...}`);
  const [epubMan] = await manifest.epub(dpc, { ...config, subType: `epub` });
  const epub = await artifacts.create(`epub`, epubMan, base, { ...opts, check: true });

  log(c`   {gray Creating mobi artifact...}`);
  const [mobiMan] = await manifest.mobi(dpc, { ...config, subType: `mobi` });
  const mobi = await artifacts.create(`mobi`, mobiMan, base, { ...opts, check: false });

  uploads.set(epub, cloudPath(dpc, `epub`));
  uploads.set(mobi, cloudPath(dpc, `mobi`));
}

function cloudPath(dpc: FsDocPrecursor, type: ArtifactType, volNum?: number): string {
  return `${dpc.path}/${edition(dpc).filename(type, volNum)}`;
}

function getFileId(dpc: DocPrecursor): string {
  return [
    dpc.friendInitials.join(``),
    dpc.documentSlug,
    dpc.editionType,
    dpc.documentId.substring(0, 8),
  ].join(`--`);
}

function edition(dpc: FsDocPrecursor): Edition {
  if (!dpc.edition) throw new Error(`Unexpected lack of Edition on hydrated dpc`);
  return dpc.edition;
}

const REVISION_QUERY = gql`
  query GetLatestArtifactProductionVersion {
    version: getLatestArtifactProductionVersion {
      sha: version
    }
  }
`;

function shouldSkip(
  dpc: FsDocPrecursor,
  meta: docMeta.DocumentMeta,
  prodVersion: string,
): boolean {
  const edMeta = meta.get(dpc.path);
  if (!edMeta) {
    // if we have no edition meta, it's a first-time publish
    return false;
  }

  if (prodVersion !== edMeta.productionRevision) {
    return false;
  }

  const docSha = git.dpcDocumentCurrentSha(dpc);
  if (docSha !== edMeta.revision) {
    return false;
  }

  return true;
}
