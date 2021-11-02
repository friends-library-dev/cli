import fs from 'fs';
import { Friend } from '@friends-library/friends';
import { allFriends } from '@friends-library/friends/query';
import env from '@friends-library/env';
import { c, log, red } from 'x-chalk';
import { diff } from 'jest-diff';

export default async function handler(): Promise<void> {
  // const mod = parseFile(`piety-promoted-v1/modernized/04-part-1.adoc`);
  // const orig = parseFile(`piety-promoted-v1/original/04-part-1.adoc`);

  // const mod = parseFile(`piety-promoted-v1/modernized/32-part-2.adoc`);
  // const orig = parseFile(`piety-promoted-v1/original/32-part-2.adoc`);

  // const mod = parseFile(`piety-promoted-v1/modernized/35-part-3.adoc`);
  // const orig = parseFile(`piety-promoted-v1/original/35-part-3.adoc`);

  // const mod = parseFile(`piety-promoted-v1/modernized/39-part-4.adoc`);
  // const orig = parseFile(`piety-promoted-v1/original/39-part-4.adoc`);

  // const mod = parseFile(`piety-promoted-v2/modernized/103-part-5.adoc`);
  // const orig = parseFile(`piety-promoted-v2/original/103-part-5.adoc`);

  // const mod = parseFile(`piety-promoted-v2/modernized/106-part-6.adoc`);
  // const orig = parseFile(`piety-promoted-v2/original/106-part-6.adoc`);

  // const mod = parseFile(`piety-promoted-v2/modernized/109-part-7.adoc`);
  // const orig = parseFile(`piety-promoted-v2/original/109-part-7.adoc`);

  // const mod = parseFile(`piety-promoted-v2/modernized/112-part-8.adoc`);
  // const orig = parseFile(`piety-promoted-v2/original/112-part-8.adoc`);

  // const mod = parseFile(`piety-promoted-v3/modernized/102-part-8-continued.adoc`);
  // const orig = parseFile(`piety-promoted-v3/original/102-part-8-continued.adoc`);

  // const mod = parseFile(`piety-promoted-v3/modernized/106-part-9.adoc`);
  // const orig = parseFile(`piety-promoted-v3/original/106-part-9.adoc`);

  const mod = parseFile(`piety-promoted-v3/modernized/109-part-10.adoc`);
  const orig = parseFile(`piety-promoted-v3/original/109-part-10.adoc`);

  // const mod = parseFile(`piety-promoted-v3/modernized/113-part-11.adoc`);
  // const orig = parseFile(`piety-promoted-v3/original/13-part-11.adoc`);

  if (!same(mod.synopsisNames, orig.synopsisNames)) {
    red(`chapter synopsis names not the same!`);
    console.log(diff(mod.synopsisNames, orig.synopsisNames));
    process.exit(1);
  }

  validate(mod);
  validate(orig);

  // for (const data of [mod, orig]) {
  const MAX_CHAPTER_LINES = 800;
  let fileNum = 15;
  const partNum = 10;
  let chNum = 1;
  let numCurrentLines = 0;
  let current = {
    mod: newChapter(),
    orig: newChapter(),
  };
  let chapters: { mod: Chapter[]; orig: Chapter[] } = {
    mod: [],
    orig: [],
  };
  let nameIndex = 0;

  for (let i = 0; i < mod.testimonies.length; i++) {
    if (numCurrentLines === 0) {
      current.mod.number = chNum;
      current.mod.dir = mod.absPath.split(`/`).slice(0, -1).join(`/`);
      current.mod.filename = `${pad(fileNum)}-part-${partNum}-chapter-${chNum}.adoc`;
      current.orig.number = chNum;
      current.orig.dir = orig.absPath.split(`/`).slice(0, -1).join(`/`);
      current.orig.filename = `${pad(fileNum++)}-part-${partNum}-chapter-${chNum}.adoc`;
    }

    numCurrentLines += mod.testimonies[i].numLines;
    current.mod.names.push(mod.synopsisNames[nameIndex]);
    current.mod.chunks.push(mod.testimonies[i].chunk);
    current.orig.names.push(orig.synopsisNames[nameIndex++]);
    current.orig.chunks.push(orig.testimonies[i].chunk);

    if (numCurrentLines > MAX_CHAPTER_LINES) {
      chapters.mod.push(current.mod);
      chapters.orig.push(current.orig);
      current = { mod: newChapter(), orig: newChapter() };
      chNum++;
      numCurrentLines = 0;
    }
  }

  if (numCurrentLines !== 0) {
    // we have some leftover lines
    chapters.mod.push(current.mod);
    chapters.orig.push(current.orig);
  }

  if (process.argv.includes(`--perform`)) {
    chapters.mod.forEach(writeChapter);
    chapters.orig.forEach(writeChapter);
  } else {
    console.log(`lines (mod):\n\t${chapters.mod.map(numChapterLines).join(`\n\t`)}\n\n`);
    console.log(
      `lines (orig):\n\t${chapters.orig.map(numChapterLines).join(`\n\t`)}\n\n`,
    );
    console.log(
      `(mod) would write ${
        chapters.mod.length
      } chapters, with filenames:\n\t${chapters.mod
        .map((c) => `${c.dir}/${c.filename}`)
        .join(`\n\t`)}\n`,
    );
    console.log(
      `(orig) would write ${
        chapters.orig.length
      } chapters, with filenames:\n\t${chapters.orig
        .map((c) => `${c.dir}/${c.filename}`)
        .join(`\n\t`)}\n`,
    );
  }
}

function writeChapter(chapter: Chapter, index: number): void {
  let adoc = `== Chapter ${chapter.number}\n\n[.chapter-synopsis]\n`;
  adoc += chapter.names.map((n) => `* ${n}`).join(`\n`);
  adoc += `\n\n`;
  adoc += chapter.chunks.join(`\n\n[.asterism]\n'''\n\n`);
  fs.writeFileSync(`${chapter.dir}/${chapter.filename}`, adoc);
}

function validate(fileData: FileData): void {
  const diffed = diff(
    fileData.synopsisNames.map((n) => n.toUpperCase().trim()),
    fileData.testimonies.map((t) => t.allCapsName.trim().replace(/\.$/, ``)),
  );
  if (diffed !== null && !diffed.includes(`no visual difference`)) {
    console.log(diffed);
  }
  if (fileData.synopsisNames.length !== fileData.testimonies.length) {
    red(`mismatched num testimonies vs. names, in ${fileData.relPath}`);
    process.exit(1);
  }
}

function same(a: any, b: any) {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface FileData {
  relPath: string;
  absPath: string;
  synopsisNames: string[];
  totalLinesInFile: number;
  testimonies: Testimony[];
}

function parseFile(relpath: string): FileData {
  const absPath = `${COMP_DIR}/${relpath}`;
  const fileContent = fs.readFileSync(absPath, `utf-8`);
  const lines = fileContent.split(`\n`);
  const totalLinesInFile = lines.length;

  // get past [.chapter-synopsis]
  lines.shift();
  lines.shift();
  lines.shift();

  const synopsisNames: string[] = [];

  let stop = false;
  while (!stop) {
    const line = lines.shift();
    if (line?.startsWith(`* `)) {
      synopsisNames.push(line.replace(/^\* /, ``));
    } else {
      stop = true;
    }
  }

  const testimonies: Testimony[] = [];
  let testimony: Testimony | undefined;

  while ((testimony = next(lines))) {
    testimonies.push(testimony);
  }

  return {
    relPath: relpath,
    absPath,
    synopsisNames,
    totalLinesInFile,
    testimonies,
  };
}

function next(lines: string[]): Testimony | undefined {
  const numLines = lines.length;
  if (numLines === 0) {
    return undefined;
  }

  const firstLine = lines.shift()!;
  const match = firstLine.match(/([A-Z \.]{6,})/);
  if (!match || !startsWithCapsName(firstLine)) {
    red(`failed to find name in line: ${firstLine}`);
    process.exit();
  }

  let stop = false;
  let chunkLines: string[] = [firstLine];
  while (!stop) {
    const line = lines.shift();
    if (line?.startsWith(`[.asterism]`)) {
      // console.log(`consume an asterism`);
      lines.shift(); // '''
      lines.shift(); // <empty>
      stop = true;
    } else if (startsWithCapsName(line)) {
      // console.log(`found the next person`);
      lines.unshift(line!);
      stop = true;
    } else if (line === undefined) {
      // console.log(`undefined line, prob end of file`);
      stop = true;
    } else {
      chunkLines.push(line!);
    }
  }

  return {
    allCapsName: match[0]!,
    chunk: chunkLines.join(`\n`),
    numLines: chunkLines.length,
  };
}

function startsWithCapsName(line: string | undefined): boolean {
  if (line === undefined) {
    return false;
  }

  const match = line.match(/([A-Z \.]{8,})/);
  if (match === null || match[0]!.match(/^[A-Z]\. [A-Z]\./) || match[0]! === `HOLINESS`) {
    return false;
  }

  if (line.includes(`signature of HOLINESS`)) {
    return false;
  }

  if (line.match(/^(THE END|END OF|POSTSCRIPT)/)) {
    return false;
  }

  return true;
}

const COMP_DIR = `/Users/jared/fl/en/compilations`;

interface Testimony {
  allCapsName: string;
  chunk: string;
  numLines: number;
}

type Chapter = {
  dir: string;
  filename: string;
  number: number;
  names: string[];
  chunks: string[];
};

function pad(num: number): string {
  return String(num).padStart(2, `0`);
}

function numChapterLines(chapter: Chapter): number {
  return chapter.chunks.reduce((total, chunk) => total + chunk.split(`\n`).length, 0);
}

function newChapter(): Chapter {
  return { number: 0, dir: ``, filename: ``, names: [], chunks: [] };
}
