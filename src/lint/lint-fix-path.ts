import fs from 'fs';
import { LintOptions, FilePath } from '@friends-library/types';
import lintPath from './lint-path';
import { lintFix } from '@friends-library/adoc-lint';
import DirLints from './DirLints';
import { langFromPath, editionTypeFromPath } from './path';

export default function lintFixPath(
  path: FilePath,
  options: LintOptions = { lang: `en` },
): { unfixable: DirLints; numFixed: number } {
  const lints = lintPath(path, options);
  const fixable = lints.numFixable();
  if (fixable === 0) {
    return { unfixable: lints, numFixed: 0 };
  }

  lints.toArray().forEach(([filepath, { adoc }]) => {
    const { fixed } = lintFix(adoc, {
      ...options,
      lang: langFromPath(filepath),
      editionType: editionTypeFromPath(filepath),
    });
    fs.writeFileSync(filepath, fixed);
  });

  return {
    unfixable: lintPath(path, options),
    numFixed: fixable,
  };
}
