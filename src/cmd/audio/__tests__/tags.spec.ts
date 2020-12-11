import { getFriend } from '@friends-library/friends/query';
import { getPartTags } from '../tags';

const turfordEn = getFriend(`hugh-turford`, `en`).documents[0].editions[0].audio!;
const story = getFriend(`thomas-story`, `en`).documents[0].editions[0].audio!;
const webbEs = getFriend(`elizabeth-webb`, `es`).documents[0].editions[0].audio!;
const titipEn = getFriend(`compilations`, `en`).documents[0].editions[0].audio!;
const wayOfLife = getFriend(`charles-marshall`, `en`).documents[2].editions[0].audio!;

describe(`getPartTags()`, () => {
  it(`should create correct tags for non-compilation (en)`, () => {
    const tags = getPartTags(turfordEn, 0);
    expect(tags.artist).toBe(`Hugh Turford`);
    expect(tags.album).toBe(`Walk in the Spirit`);
    expect(tags.track).toBe(`1/3`);
    expect(tags[`artist-sort`]).toBe(`Turford, Hugh`);
  });

  it(`should create correct tags for non-compilation (es)`, () => {
    const tags = getPartTags(webbEs, 0);
    expect(tags.artist).toBe(`Elizabeth Webb`);
    expect(tags.title).toBe(`La Carta de Elizabeth Webb`);
    expect(tags.album).toBe(`La Carta de Elizabeth Webb`);
  });

  it(`should create correct tags for compilation`, () => {
    const tags = getPartTags(titipEn, 0);
    expect(tags.album).toBe(`Friends Library`);
    expect(tags.artist).toBe(`Truth in the Inward Parts – Vol. I`);
    expect(tags.title).toBe(`Introduction`);
  });

  test(`generic part titles shortened and combined with book title`, () => {
    const tags = getPartTags(turfordEn, 0);
    expect(tags.title).toBe(`Walk in the Spirit — pt. 1`);
  });

  test(`for single-part audios, title should be doc title not part title`, () => {
    const tags = getPartTags(story, 0);
    expect(tags.title).toBe(`Selection from the Journal of Thomas Story`);
  });

  test(`sorted fields correct`, () => {
    const tags = getPartTags(wayOfLife, 0);
    expect(tags[`artist-sort`]).toBe(`Marshall, Charles`);
    expect(tags[`album-sort`]).toBe(
      `Way of Life Revealed and the Way of Death Discovered, The`,
    );
    expect(tags[`title-sort`]).toBe(
      `Way of Life Revealed and the Way of Death Discovered, The`,
    );
  });
});
