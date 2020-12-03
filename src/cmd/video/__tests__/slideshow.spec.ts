import { slideshowConcatFileLines as lines } from '../slideshow';

describe(`slideshowConcatFileLines()`, () => {
  it(`starts with cover file`, () => {
    expect(lines([120], 0, true)).toEqual([
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 60`,
      ...silentOutro,
    ]);
  });

  it(`changes slides after one minute`, () => {
    expect(lines([150.5], 0, true)).toEqual([
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 60`,
      `file 'app-tease.png'`,
      `duration 30.5`,
      ...silentOutro,
    ]);
  });

  it(`cycles through 3 slides during single-part audio`, () => {
    expect(lines([60 * 4], 0, true)).toEqual([
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 60`,
      `file 'app-tease.png'`,
      `duration 60`,
      `file 'cover.png'`,
      `duration 60`,
      ...silentOutro,
    ]);
  });

  test(`incomplete video shows "continuation" slide instead of outro`, () => {
    expect(lines([120], 0, false)).toEqual([
      `file 'cover.png'`,
      `duration 10`,
      `file 'part-0.png'`,
      `duration 10`,
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 40`,
      `file 'goto-nextpart.png'`,
      `duration 10`,
      `file 'goto-nextpart.png'`,
      `duration 10`,
      `file 'goto-nextpart.png'`,
      `duration 10`,
      `file 'goto-nextpart.png'`,
    ]);
  });

  it(`second "volume" starts with correct part slide`, () => {
    expect(lines([125, 125], 12, true).slice(0, 6)).toEqual([
      `file 'cover.png'`,
      `duration 10`,
      `file 'part-12.png'`,
      `duration 10`,
      `file 'cover.png'`,
      `duration 60`,
    ]);
  });

  it(`multipart briefly shows part one slide shortly after start`, () => {
    expect(lines([125, 125], 0, true).slice(0, 6)).toEqual([
      `file 'cover.png'`,
      `duration 10`,
      `file 'part-0.png'`,
      `duration 10`,
      `file 'cover.png'`,
      `duration 60`,
    ]);
  });

  it(`multipart works good`, () => {
    const firstPartDuration = 60 * 5 + 10.5;
    const secondPartDuration = 60 * 7 + 3;
    const result = lines([firstPartDuration, secondPartDuration], 0, true);
    const expected = [
      `file 'cover.png'`,
      `duration 10`,
      `file 'part-0.png'`,
      `duration 10`,
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 60`,
      `file 'app-tease.png'`,
      `duration 60`,
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 50.5`,
      `file 'part-1.png'`,
      `duration 60`,
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 60`,
      `file 'app-tease.png'`,
      `duration 60`,
      `file 'cover.png'`,
      `duration 60`,
      `file 'free-books.png'`,
      `duration 60`,
      `file 'app-tease.png'`,
      `duration 63`,
      ...silentOutro,
    ];
    expect(result).toEqual(expected);

    let elapsed = 0;
    expected.forEach((line) => {
      elapsed += getNum(line);
      if (line === `file 'part-1.png'`) {
        expect(elapsed).toBe(firstPartDuration);
      }
    });

    const outroLength = 30;
    expect(elapsed).toBe(firstPartDuration + secondPartDuration + outroLength);
  });
});

function getNum(duration: string): number {
  const num = Number(duration.replace(/^duration /, ``));
  return Number.isNaN(num) ? 0 : num;
}

const silentOutro = [
  `file 'free-books.png'`,
  `duration 10`,
  `file 'app-tease.png'`,
  `duration 10`,
  `file 'free-books.png'`,
  `duration 10`,
  `file 'free-books.png'`,
];
