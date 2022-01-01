import uuid from 'uuid/v4';
import { FsDocPrecursor, hydrate } from '@friends-library/dpc-fs';

export function createMap(dpcs: FsDocPrecursor[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const dpc of dpcs) {
    hydrate.entities(dpc);
    map[`${dpc.documentId}/${dpc.editionType}`] = uuid();
  }
  return map;
}

export function createSwiftDict(map: Record<string, string>): string {
  const lines = [`let editionIdMigrationMap: [String: String] = [`];
  for (const [key, id] of Object.entries(map)) {
    lines.push(`  "${key}": "${id}",`);
  }
  lines.push(`]\n`);
  return lines.join(`\n`);
}
