import fs from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';
import convertHandler from '../handler';

jest.mock(`x-chalk`);

describe(`convertHandler()`, () => {
  it(`converts a docbook file to asciidoc`, () => {
    if (process.env.CI || spawnSync(`docker`, [`--version`]).status !== 0) {
      expect(true).toBe(true);
      return;
    }

    const file = path.resolve(__dirname, `./docbook.xml`);
    const adoc = file.replace(/\.xml$/, `.adoc`);
    fs.existsSync(adoc) && fs.unlinkSync(adoc);
    convertHandler({ file, skipRefs: false });

    expect(fs.existsSync(adoc)).toBe(true);
    expect(fs.readFileSync(adoc).toString()).toBe(`\nTesting, 1, 2, 3.`);

    fs.unlinkSync(adoc);
  });

  it(`correctly handles self-closing empty footnote paragraph <para/>`, () => {
    if (process.env.CI || spawnSync(`docker`, [`--version`]).status !== 0) {
      expect(true).toBe(true);
      return;
    }

    const file = path.resolve(__dirname, `./footnote.xml`);
    const origContents = fs.readFileSync(file).toString();
    const adoc = file.replace(/\.xml$/, `.adoc`);
    fs.existsSync(adoc) && fs.unlinkSync(adoc);
    convertHandler({ file, skipRefs: false });

    expect(fs.existsSync(adoc)).toBe(true);
    expect(fs.readFileSync(adoc).toString()).toContain(`After empty p.`);

    fs.writeFileSync(file, origContents);
    fs.unlinkSync(adoc);
  });
});
