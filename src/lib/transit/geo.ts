const R = 6_371_000;
export const COLOMBO_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
export const WALK_PATH_FACTOR = 1.2;

export function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function walkMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return haversineM(a, b) * WALK_PATH_FACTOR;
}

export function bearingDeg(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const rad = Math.PI / 180;
  const y = Math.sin((b.lng - a.lng) * rad) * Math.cos(b.lat * rad);
  const x =
    Math.cos(a.lat * rad) * Math.sin(b.lat * rad) -
    Math.sin(a.lat * rad) * Math.cos(b.lat * rad) * Math.cos((b.lng - a.lng) * rad);
  return (Math.atan2(y, x) * 180) / Math.PI;
}

/** UTC epoch of 00:00 in Asia/Colombo on the same civil day as `epochMs`. */
export function colomboDayStart(epochMs: number): number {
  const d = new Date(epochMs + COLOMBO_OFFSET_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - COLOMBO_OFFSET_MS;
}
