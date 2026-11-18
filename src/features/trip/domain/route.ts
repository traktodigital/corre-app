export type RoutePoint = { lat: number; lng: number };

export type RouteDrawing = {
  d: string;
  start: [number, number];
  end: [number, number];
};

export function parseRoute(csv: string): RoutePoint[] {
  return csv.split('\n').flatMap(line => {
    const [, lat, lng] = line.trim().split(',').map(Number);
    return Number.isFinite(lat) && Number.isFinite(lng) ? [{ lat, lng }] : [];
  });
}

export function drawRoute(
  points: RoutePoint[],
  width: number,
  height: number,
  padding = 32,
  maxPoints = 400,
): RouteDrawing | null {
  if (points.length < 2) {
    return null;
  }
  const step = Math.ceil(points.length / maxPoints);
  const sampled = points.filter(
    (_, i) => i % step === 0 || i === points.length - 1,
  );
  const lats = sampled.map(p => p.lat);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = sampled.map(p => p.lng * k);
  const ys = sampled.map(p => -p.lat);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  if (spanX === 0 && spanY === 0) {
    return null;
  }
  const scale = Math.min(
    spanX ? (width - 2 * padding) / spanX : Infinity,
    spanY ? (height - 2 * padding) / spanY : Infinity,
  );
  const offsetX = (width - spanX * scale) / 2;
  const offsetY = (height - spanY * scale) / 2;
  const coords = xs.map((x, i): [number, number] => [
    offsetX + (x - minX) * scale,
    offsetY + (ys[i] - minY) * scale,
  ]);
  const d = coords
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join('');
  return { d, start: coords[0], end: coords[coords.length - 1] };
}
