import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseCsvText, toCsvText } from '../src/services/csv';

// A single lossless spreadsheet-readable file. Paths describe nested records;
// long strings (PDF base64, signatures) are split to fit spreadsheet cells.
export function encodeState(value: unknown): string {
  const rows: (string | number)[][] = [];
  function visit(item: any, location: string[]) {
    const address = JSON.stringify(location);
    if (item !== null && typeof item === 'object') {
      rows.push([address, Array.isArray(item) ? 'array' : 'object', 0, '']);
      for (const [key, child] of Object.entries(item)) visit(child, [...location, key]);
    } else {
      const encoded = JSON.stringify(item);
      for (let i = 0; i < encoded.length; i += 12000) {
        // JSON encoding the chunk prevents spreadsheet formula interpretation.
        rows.push([address, 'value', i / 12000, JSON.stringify(encoded.slice(i, i + 12000))]);
      }
    }
  }
  visit(value, []);
  return toCsvText(['record_path', 'type', 'part', 'value'], rows);
}

export function decodeState(text: string): any {
  const [header, ...rows] = parseCsvText(text);
  if (header?.join(',') !== 'record_path,type,part,value') throw new Error('Invalid CSV storage header');
  let root: any;
  const chunks = new Map<string, string[]>();
  function assign(address: string[], value: any) {
    if (!address.length) { root = value; return; }
    let parent = root;
    for (const key of address.slice(0, -1)) {
      if (!Object.hasOwn(parent, key)) throw new Error('Invalid CSV record path');
      parent = parent[key];
    }
    Object.defineProperty(parent, address.at(-1)!, { value, writable: true, enumerable: true, configurable: true });
  }
  for (const [address, type, part, value] of rows) {
    if (type === 'object' || type === 'array') assign(JSON.parse(address), type === 'array' ? [] : {});
    else if (type === 'value') {
      const parts = chunks.get(address) || [];
      if (Number(part) !== parts.length) throw new Error('Invalid CSV chunk order');
      parts.push(JSON.parse(value)); chunks.set(address, parts);
    } else throw new Error('Invalid CSV value type');
  }
  for (const [address, parts] of chunks) assign(JSON.parse(address), JSON.parse(parts.join('')));
  return root;
}

export interface DiskState { revision: number; values: Record<string, any>; files: Record<string, { dataUrl: string; fileName: string }> }

export class CsvStore {
  state: DiskState = { revision: 0, values: {}, files: {} };
  private queue: Promise<unknown> = Promise.resolve();
  constructor(public directory: string) {}
  async load() {
    await mkdir(this.directory, { recursive: true });
    try {
      this.state = decodeState(await readFile(path.join(this.directory, 'capstone.csv'), 'utf8'));
      if (!Number.isInteger(this.state.revision) || !this.state.values || !this.state.files) throw new Error('Invalid CSV database');
    } catch (error: any) {
      if (error.code !== 'ENOENT') throw error;
      await this.commit(this.state);
    }
  }
  private async commit(state: DiskState) {
    const target = path.join(this.directory, 'capstone.csv');
    const tmp = `${target}.tmp`;
    await writeFile(tmp, encodeState(state), 'utf8');
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await rename(tmp, target);
        break;
      } catch (err: any) {
        if ((err.code === 'EPERM' || err.code === 'EBUSY') && attempt < 4) {
          await new Promise(r => setTimeout(r, 25 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
    this.state = state;
  }
  update(action: (state: DiskState) => DiskState) {
    const work = this.queue.then(async () => {
      const next = action(structuredClone(this.state));
      await this.commit(next);
      return next;
    });
    this.queue = work.catch(() => {});
    return work;
  }
}
