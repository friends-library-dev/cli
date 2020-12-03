export function slideshowConcatFileLines(
  durations: number[],
  startIdx: number,
  complete: boolean,
): string[] {
  const multiChapter = durations.length > 1 || startIdx !== 0 || !complete;
  const lines: string[] = [cover];
  durations.forEach((duration, idx) =>
    handlePart(duration, idx + startIdx, multiChapter, idx === 0, lines),
  );
  addSilentOutro(lines, complete);
  return lines;
}

function handlePart(
  duration: number,
  partIdx: number,
  isMultiChapter: boolean,
  isFirstPart: boolean,
  lines: string[],
): void {
  if (duration < INTERVAL * 2) {
    throw new Error(`Unexpected extremely short part duration`);
  }
  !isMultiChapter
    ? handleSinglepartAudio(duration, lines)
    : handleMultipartAudio(duration, partIdx, isFirstPart, lines);
}

function handleMultipartAudio(
  duration: number,
  partIdx: number,
  isFirstPart: boolean,
  lines: string[],
): void {
  let remainingDuration = duration;
  if (isFirstPart) {
    lines.push(durationLine(10));
    lines.push(part(partIdx));
    lines.push(durationLine(10));
    lines.push(cover);
    remainingDuration -= 20;
  } else {
    lines.push(part(partIdx));
    lines.push(durationLine(INTERVAL));
    remainingDuration -= INTERVAL;
    lines.push(cover);
  }
  handleSinglepartAudio(remainingDuration, lines);
}

function handleSinglepartAudio(duration: number, lines: string[]): void {
  let remainingDuration = duration;
  const coverSlideLength = Math.min(INTERVAL, duration);
  remainingDuration -= coverSlideLength;
  lines.push(durationLine(coverSlideLength));

  let typeIdx = 0;
  const types: [string, string, string] = [freeBooks, appTease, cover];
  while (remainingDuration > 0) {
    lines.push(types[typeIdx]);
    let slideLength = Math.min(INTERVAL, remainingDuration);
    remainingDuration -= slideLength;
    if (remainingDuration < INTERVAL / 3) {
      slideLength += remainingDuration;
      remainingDuration = 0;
    }
    lines.push(durationLine(slideLength));
    typeIdx = typeIdx < types.length - 1 ? typeIdx + 1 : 0;
  }
}

function part(idx: number): string {
  return `file 'part-${idx}.png'`;
}

function durationLine(seconds: number): string {
  return `duration ${seconds}`;
}

function addSilentOutro(lines: string[], isComplete: boolean): void {
  lines.push(isComplete ? freeBooks : continued);
  lines.push(durationLine(10));
  lines.push(isComplete ? appTease : continued);
  lines.push(durationLine(10));
  lines.push(isComplete ? freeBooks : continued);
  lines.push(durationLine(10));
  lines.push(isComplete ? freeBooks : continued);
}

const INTERVAL = 60;
const cover = `file 'cover.png'`;
const appTease = `file 'app-tease.png'`;
const freeBooks = `file 'free-books.png'`;
const continued = `file 'goto-nextpart.png'`;
