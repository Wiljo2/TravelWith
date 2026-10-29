import { Euler, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { angularDistance, fibonacciPoint, flightPath, frontRotation, landDots, toVec3, type LatLng } from "@/components/landing/globe/geo";
import { DOT_COUNT } from "@/components/landing/globe/landDots";

const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe("toVec3", () => {
  it("puts (0, 0) in front, the north pole up and 90°E to the right", () => {
    close(toVec3({ lat: 0, lng: 0 }), [0, 0, 1]);
    close(toVec3({ lat: 90, lng: 0 }), [0, 1, 0]);
    close(toVec3({ lat: 0, lng: 90 }), [1, 0, 0]);
  });
});

describe("frontRotation", () => {
  it("turns the globe so the point faces the camera", () => {
    for (const p of [
      { lat: 10.39, lng: -75.51 },
      { lat: -34.6, lng: -58.38 },
      { lat: 62, lng: 140 },
    ]) {
      const { x, y } = frontRotation(p);
      const v = new Vector3(...toVec3(p)).applyEuler(new Euler(x, y, 0));
      close(v.toArray(), [0, 0, 1]);
    }
  });
});

describe("landDots", () => {
  const land = landDots();
  const nearest = (points: LatLng[], p: LatLng) => Math.min(...points.map((q) => angularDistance(p, q)));
  const all = Array.from({ length: DOT_COUNT }, (_, i) => fibonacciPoint(i, DOT_COUNT));
  const isLand = (p: LatLng) => Math.abs(nearest(land, p) - nearest(all, p)) < 1e-9;

  it("covers about as much of the sphere as Earth's land", () => {
    expect(land.length / DOT_COUNT).toBeGreaterThan(0.25);
    expect(land.length / DOT_COUNT).toBeLessThan(0.32);
  });

  it("matches the generated mask on known land and sea", () => {
    expect(isLand({ lat: 23, lng: 13 })).toBe(true);
    expect(isLand({ lat: -10, lng: -55 })).toBe(true);
    expect(isLand({ lat: 62, lng: 100 })).toBe(true);
    expect(isLand({ lat: -80, lng: 30 })).toBe(true);
    expect(isLand({ lat: 0, lng: -150 })).toBe(false);
    expect(isLand({ lat: 30, lng: -40 })).toBe(false);
    expect(isLand({ lat: -30, lng: 80 })).toBe(false);
  });
});

describe("flightPath", () => {
  const bogota = { lat: 4.71, lng: -74.07 };
  const madrid = { lat: 40.42, lng: -3.7 };
  const cartagena = { lat: 10.39, lng: -75.51 };
  const peak = (path: number[][]) => Math.max(...path.map((p) => Math.hypot(p[0], p[1], p[2])));

  it("starts and ends on the surface at both cities", () => {
    const path = flightPath(madrid, cartagena);
    close(path[0], toVec3(madrid));
    close(path[path.length - 1], toVec3(cartagena));
  });

  it("flies higher on longer routes", () => {
    expect(peak(flightPath(bogota, cartagena))).toBeGreaterThan(1);
    expect(peak(flightPath(madrid, cartagena))).toBeGreaterThan(peak(flightPath(bogota, cartagena)));
  });
});
