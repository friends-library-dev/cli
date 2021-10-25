import fs from 'fs';

const edition = 'original';
const docSlug = `piety-promoted-v1`;
const compDir = `/Users/jared/fl/en/compilations`;

export default function handler(): void {
  const path = `${compDir}/${docSlug}/${edition}/raw.adoc`;
  const adoc = fs.readFileSync(path).toString();

  const parts = adoc
    .replace(/\n\n([A-Z]{3,}( [A-Z]+\.?)? [A-Z]{3,})/g, '~~~$1')
    .trim()
    .split('~~~')
    .slice(1);

  const chapters: [string, string[], number][] = [['', [], 0]];
  let chapterIdx = 0;

  const namePattern = /([A-Z]{3,}( [A-Z]+\.?)? [A-Z]{3,})/;
  parts.forEach((part, idx) => {
    const match = part.match(namePattern);
    if (!match) {
      console.log('Part has no name!', idx, part);
      return;
    }

    const name = match[0]
      .toLowerCase()
      .split(' ')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');

    let chapter = chapters[chapterIdx];
    let [, , linesInChapter] = chapter;

    if (linesInChapter > MAX_CHAPTER_LINES) {
      chapterIdx++;
      chapter = ['', [], 0];
      chapters[chapterIdx] = chapter;
    }

    chapter[0] = `${chapter[0]}\n${part}`;
    chapter[1].push(name);
    chapter[2] += part.split('\n').length;
  });

  chapters.forEach(([mainText, names], idx) => {
    const title = `== Chapter ${idx + 1}`;
    const cs = ['[.chapter-synopsis]']
      .concat(names.map((name) => `* ${name}`))
      .join('\n');
    let chapterText = `${title}\n\n${cs}\n\n${mainText}`;
    const lines = chapterText.split('\n\n');
    if (lines[lines.length - 1].trim() === "[.asterism]\n'''") {
      chapterText = lines.slice(0, lines.length - 1).join('\n\n');
    }
    const fileNum = String(idx + 2).padStart(2, '0');
    const chNum = String(idx + 1).padStart(2, '0');
    const path = `${compDir}/${docSlug}/${edition}/${edition}/${fileNum}-chapter-${chNum}.adoc`;
    fs.writeFileSync(path, chapterText);
  });
}

const MAX_CHAPTER_LINES = 800;
