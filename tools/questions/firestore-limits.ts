/** JSON DTO storage-size formula: https://firebase.google.com/docs/firestore/storage-size.
 * Includes the maximum 6 KiB document name as a conservative allowance.
 */
export function firestoreDocumentBytes(value: unknown): number {
  const stringBytes = (text: string) => Buffer.byteLength(text, 'utf8') + 1;
  function size(item: unknown, depth: number, parentArray = false): number {
    if (item === null || typeof item === 'boolean') return 1;
    if (typeof item === 'string') return stringBytes(item);
    if (typeof item === 'number' && Number.isFinite(item)) return 8;
    if (Array.isArray(item)) {
      if (parentArray) throw new Error('Unsupported nested array Firestore transport');
      if (depth > 20) throw new Error('Firestore field depth exceeds 20');
      return item.reduce(
        (total: number, child: unknown) => total + size(child, depth + 1, true),
        0,
      );
    }
    if (item && typeof item === 'object') {
      if (depth > 20) throw new Error('Firestore field depth exceeds 20');
      return (
        32 +
        Object.entries(item).reduce((total, [key, child]) => {
          if (Buffer.byteLength(key) > 1500 || /^__.*__$/.test(key))
            throw new Error('Unsafe Firestore field name');
          return child === undefined ? total : total + stringBytes(key) + size(child, depth + 1);
        }, 0)
      );
    }
    throw new Error('Unsupported Firestore field value');
  }
  return 6 * 1024 + size(value, 0);
}
export function assertFirestoreDocument(value: unknown): void {
  if (firestoreDocumentBytes(value) > 700 * 1024)
    throw new Error('Firestore document exceeds conservative 700 KiB storage-size bound');
}
