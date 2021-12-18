import { Asciidoc } from '@friends-library/types';

export function processAsciidoc(adoc: Asciidoc): Asciidoc {
  return adoc
    .replace(/(?<!footnote:)\[/gm, `+++[+++`)
    .replace(/\n\n(1[678][0-9]{2})\. /gm, `\n\n$1+++.+++ `)
    .replace(/\n\n\*\s+\*\s+\*\s*\n\n/gm, `\n\n[.asterism]\n'''\n\n`)
    .replace(/\n\n----*\n\n/gm, `\n\n[.asterism]\n'''\n\n`)
    .replace(/\n\n        /gm, `\n\n`) // eslint-disable-line no-irregular-whitespace
    .replace(/(____*)/g, `+++$1+++`)
    .replace(/^=(==+) ([A-Za-z])/gm, `$1 $2`) // === Chap. 1 -> == Chap. 1 (decrease heading level)
    .replace(/\n\n +(.)/gm, `\n\n$1`)
    .replace(/^\.\.\.([A-Za-z0-9])/gm, `&hellip;$1`) // ...went to meeting -> &hellip;went to meeting
    .replace(/\n([A-Z])\. ([A-Z])/gm, `\n$1+++.+++ $2`) // E. Evans -> E+++.+++ Evans
    .replace(/\n([0-9]+)\. ([A-Z])/gm, `\n$1+++.+++ $2`) // 3. Foo -> 3+++.+++ Foo
    .replace(/\n\n[0-9]+(\n)?$/g, `\n`);
}
