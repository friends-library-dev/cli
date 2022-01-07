import uuid from 'uuid/v4';
import { FsDocPrecursor, hydrate } from '@friends-library/dpc-fs';

export function createMap(dpcs: FsDocPrecursor[]): Record<string, string> {
  const map: Record<string, string> = {
    // deleted sewel history modernized edition
    '69c5fc26-76e3-4302-964e-ba46d889003b/modernized': `0a4e9e87-3a4a-4bd3-8361-457f78893983`,
  };
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
