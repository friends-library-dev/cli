import { c, log } from 'x-chalk';

export function logAction(msg: string): void {
  log(c` {magenta.bold •} ${msg}`);
}

export function logDebug(msg: string): void {
  log(c` {green.dim •} {gray ${msg}}`);
}

export function logError(msg: string): void {
  log(c` {red.bold •} {red ${msg}}`);
}
