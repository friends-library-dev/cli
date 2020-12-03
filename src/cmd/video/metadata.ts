import { utf8ShortTitle } from '@friends-library/adoc-convert';
import { Audio } from '@friends-library/friends';
import { Lang } from '@friends-library/types';

export function metadata(
  audio: Audio,
  startIdx: number,
  nextVolIdx: number | undefined,
  volNum: number,
  numVols: number,
  durations: number[],
): string {
  const lang = audio.edition.document.friend.lang;
  let meta = delim(`Title`, title(audio, volNum, numVols, lang));
  meta += delim(
    `Description`,
    description(audio, startIdx, nextVolIdx, volNum, numVols, durations, lang),
  );
  meta += delim(
    `Tags`,
    lang === `en`
      ? `Quakers, Early Quakers, Christianity`
      : `Cuáqueros, Primeros Cuáqueros, Cristiandad`,
  );
  meta += `Remember to DISABLE comments!`;
  return meta;
}

function description(
  audio: Audio,
  startIdx: number,
  nextVolIdx: number | undefined,
  volNum: number,
  numVols: number,
  durations: number[],
  lang: Lang,
): string {
  const domain =
    lang === `en`
      ? `https://www.friendslibrary.com`
      : `https://www.bibliotecadelosamigos.org`;
  const document = audio.edition.document;
  const friend = document.friend;
  const title = utf8ShortTitle(document.title);
  let desc =
    lang === `en`
      ? `The complete audiobook of “${title}” by ${friend.name}, an early member of the Religious Society of Friends (Quakers). Presented by Friends Library Publishing - ${domain}\n\n`
      : `El audiolibro completo de “${title}” escrito por ${friend.name}, un miembro antiguo de la Sociedad de los Amigos (Cuáqueros). Puesto a su disposición por la Biblioteca de Los Amigos - ${domain}\n\n`;

  if (numVols > 1) {
    desc +=
      lang === `en`
        ? `The rest of this audiobook can be found here:\n`
        : `Puedes encontrar el resto del audiolibro aquí:\n`;
    for (let num = 1; num <= numVols; num++) {
      if (num !== volNum) {
        desc += `Part${
          lang === `en` ? `` : `e`
        } ${num} - https://youtu.be/ID_GOES_HERE\n`;
      }
    }
    desc += `\n`;
  }

  desc += document.description;

  const urlPath = document.path.replace(/^e(n|s)\//, ``);

  if (lang === `en`) {
    desc += `\n\nEbook and PDF versions of this entire book are available for free download at ${domain}/${urlPath}\n\n`;
    desc += `Listen to this, or any other of our free audiobooks on our free iOS and Android apps: ${domain}/app`;
    desc += `\n\nFriends Library Publishing exists to freely share the writings of early members of the Religious Society of Friends (Quakers), believing that no other collection of Christian writings more accurately communicates or powerfully illustrates the soul-transforming power of the gospel of Jesus Christ.`;
  } else {
    desc += `\n\nDescarga gratuitamente este libro completo en Ebook o PDF a través de este enlace: ${domain}/${urlPath}\n\n`;
    desc += `Escucha este, o cualquier otro de nuestros audiolibros en nuestra aplicación gratuita (disponible en iOS y Android): ${domain}/app`;
    desc += `\n\nBiblioteca de los Amigos existe para compartir gratuitamente los escritos de los primeros miembros de la Sociedad de Amigos (Cuáqueros), ya que creemos que no existe ninguna otra colección de escritos cristianos que comunique con mayor precisión, o que ilustre con más pureza, el poder del evangelio de Jesucristo que transforma el alma.`;
  }

  if ((nextVolIdx || audio.parts.length - 1) - startIdx > 2) {
    desc += `\n\n${lang === `en` ? `Table of Contents` : `Índice`}:\n`;
    desc += timestamps(audio, startIdx, nextVolIdx, durations);
  }

  return desc;
}

function timestamps(
  audio: Audio,
  startIdx: number,
  nextVolIdx: number | undefined,
  durations: number[],
): string {
  let runningTotal = 0;
  return audio.parts
    .slice(startIdx, nextVolIdx || Infinity)
    .map((part, idx) => {
      const line = `${durationStr(runningTotal)} - ${part.title}`;
      runningTotal += durations[idx];
      return line;
    })
    .join(`\n`);
}

function title(audio: Audio, volNum: number, numVols: number, lang: Lang): string {
  let title = utf8ShortTitle(audio.edition.document.title);
  if (numVols > 1) {
    title += ` ${volNum}/${numVols}`;
  }

  const fullAudiobook = lang === `en` ? ` (full audiobook)` : ` (audiolibro completo)`;
  if (title.length + fullAudiobook.length <= MAX_TITLE_LENGTH) {
    title += fullAudiobook;
  }

  return title;
}

const MAX_TITLE_LENGTH = 100;

function delim(label: string, content: string): string {
  return `${label}:\n\n\`\`\`\n${content}\n\`\`\`\n\n`;
}

function durationStr(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / (60 * 60));
  const minutes = Math.floor((totalSeconds - hours * 60 * 60) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return [hours, minutes, seconds]
    .map(String)
    .map((part) => part.padStart(2, `0`))
    .join(`:`);
}
