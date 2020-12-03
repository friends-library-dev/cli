import crypto from 'crypto';

export function md5String(str: string): string {
  return crypto.createHash(`md5`).update(str).digest(`hex`);
}
