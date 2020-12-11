import { getFriend } from '@friends-library/friends/query';
import { trackAttrs } from '../soundcloud';

const turfordEn = getFriend(`hugh-turford`, `en`).documents[0].editions[0].audio!;
const webbEs = getFriend(`elizabeth-webb`, `es`).documents[0].editions[0].audio!;

describe(`trackAttrs()`, () => {
  it(`should create correct attrs for english track`, () => {
    const attrs = trackAttrs(turfordEn, 0, `HQ`);
    expect(attrs.label_name).toBe(`Friends Library Publishing`);
    expect(attrs.title).toBe(`Walk in the Spirit — pt. 1`);
    expect(attrs.description).toBe(turfordEn.edition.document.description);
    expect(attrs.tags).toMatchObject([
      ...turfordEn.edition.document.tags,
      `quakers`,
      `early-quakers`,
      `christianity`,
      `friends-library`,
      `HQ`,
    ]);
    expect(trackAttrs(turfordEn, 1, `HQ`).title).toBe(`Walk in the Spirit — pt. 2`);
    expect(trackAttrs(turfordEn, 2, `HQ`).title).toBe(`The Grace that Brings Salvation`);
  });

  it(`should create correct attrs for spanish track`, () => {
    const attrs = trackAttrs(webbEs, 0, `HQ`);
    expect(attrs.label_name).toBe(`Biblioteca de los Amigos`);
    expect(attrs.tags).toMatchObject([
      `diario`,
      `cartas`,
      `cuáqueros`,
      `primeros-cuáqueros`,
      `cristiandad`,
      `biblioteca-de-los-amigos`,
      `HQ`,
    ]);
  });
});
