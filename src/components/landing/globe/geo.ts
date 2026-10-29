import { DOT_COUNT, LAND_BITS } from "@/components/landing/globe/landDots";

export interface LatLng {
  lat: number;
  lng: number;
}

export type Vec3 = [number, number, number];

const DEG = Math.PI / 180;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// +Z faces the viewer at (0, 0); +Y is the north pole.
export function toVec3({ lat, lng }: LatLng, radius = 1): Vec3 {
  const phi = lat * DEG;
  const lambda = lng * DEG;
  return [radius * Math.cos(phi) * Math.sin(lambda), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(lambda)];
}

// Kept identical to scripts/build-land-dots.mjs, which computed LAND_BITS from it.
export function fibonacciPoint(i: number, n: number): LatLng {
  const lat = (Math.asin(1 - (2 * (i + 0.5)) / n) * 180) / Math.PI;
  const lng = (((i * GOLDEN_ANGLE * 180) / Math.PI) % 360) - 180;
  return { lat, lng };
}

export function landDots(): LatLng[] {
  const bits = Uint8Array.from(atob(LAND_BITS), (c) => c.charCodeAt(0));
  const dots: LatLng[] = [];
  for (let i = 0; i < DOT_COUNT; i++) {
    if (bits[i >> 3] & (1 << (i & 7))) dots.push(fibonacciPoint(i, DOT_COUNT));
  }
  return dots;
}

export function angularDistance(a: LatLng, b: LatLng): number {
  const [ax, ay, az] = toVec3(a);
  const [bx, by, bz] = toVec3(b);
  return Math.acos(Math.min(1, Math.max(-1, ax * bx + ay * by + az * bz)));
}

// Points of a great-circle arc lifted off the surface, highest at the middle
// and higher for longer flights.
export function flightPath(from: LatLng, to: LatLng, segments = 64): Vec3[] {
  const a = toVec3(from);
  const b = toVec3(to);
  const omega = angularDistance(from, to);
  const lift = 0.03 + omega * 0.3;
  const points: Vec3[] = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    const wa = omega === 0 ? 1 - t : Math.sin((1 - t) * omega) / Math.sin(omega);
    const wb = omega === 0 ? t : Math.sin(t * omega) / Math.sin(omega);
    const r = 1 + lift * Math.sin(Math.PI * t);
    points.push([(a[0] * wa + b[0] * wb) * r, (a[1] * wa + b[1] * wb) * r, (a[2] * wa + b[2] * wb) * r]);
  }
  return points;
}

// Euler angles (XYZ order) that bring a point to the front of the globe.
export function frontRotation({ lat, lng }: LatLng): { x: number; y: number } {
  return { x: lat * DEG, y: -lng * DEG };
}
