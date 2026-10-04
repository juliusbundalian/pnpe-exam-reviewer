import { createHash } from 'node:crypto';
import manifest from '../../data/source-manifest.json';

export const sourceRegistry = manifest;

export function verifySource(sourceId: string, bytes: Uint8Array): void {
  const source = sourceRegistry.find((entry) => entry.sourceId === sourceId);
  if (!source) throw new Error(`Unknown source: ${sourceId}`);
  if (createHash('sha256').update(bytes).digest('hex') !== source.sha256) {
    throw new Error(`Source checksum mismatch: ${sourceId}`);
  }
}
