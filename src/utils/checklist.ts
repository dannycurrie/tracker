function deterministicUUID(s: string): string {
  const PRIME = 0x01000193;
  const h = [0x811c9dc5, 0x6b43a9b5, 0x3d7c7b5e, 0xa1b2c3d4];
  for (let i = 0; i < s.length; i++) {
    h[i & 3] = (Math.imul(h[i & 3] ^ s.charCodeAt(i), PRIME) >>> 0);
  }
  const hex = h.map((n) => n.toString(16).padStart(8, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    '4' + hex.slice(13, 16),
    ((parseInt(hex[16], 16) & 3) | 8).toString(16) + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

export function stableChecklistItemId(
  metricId: string,
  itemIndex: number,
  periodStart: Date
): string {
  return deterministicUUID(`${metricId}\x00${itemIndex}\x00${periodStart.getTime()}`);
}
