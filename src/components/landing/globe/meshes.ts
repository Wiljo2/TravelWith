import {
  BackSide,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from "three";
import { flightPath, toVec3, type LatLng } from "@/components/landing/globe/geo";
import {
  ARC_FRAGMENT,
  ARC_VERTEX,
  BODY_FRAGMENT,
  BODY_VERTEX,
  COMET_FRAGMENT,
  DOTS_FRAGMENT,
  DOTS_VERTEX,
  HALO_FRAGMENT,
} from "@/components/landing/globe/shaders";

const COMET_DELAY = 1.8;
const COMET_STAGGER = 1.45;
const COMET_PERIOD = 6.2;
const COMET_TRAVEL = 3.2;
const COMET_TAIL = 0.3;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOut = (t: number) => 1 - (1 - t) ** 3;

// Transparent layers skip depth writes, so this fixes who draws over whom.
function layered<T extends Object3D>(object: T, order: number): T {
  object.renderOrder = order;
  return object;
}

function faceOutward(object: Object3D, at: LatLng, radius: number) {
  const [x, y, z] = toVec3(at, radius);
  object.position.set(x, y, z);
  object.lookAt(x * 2, y * 2, z * 2);
}

export function buildBody(base: string, rim: string): Mesh {
  return new Mesh(
    new SphereGeometry(1, 96, 64),
    new ShaderMaterial({
      uniforms: { uBase: { value: new Color(base) }, uRim: { value: new Color(rim) } },
      vertexShader: BODY_VERTEX,
      fragmentShader: BODY_FRAGMENT,
    }),
  );
}

export function buildHalo(color: string): Mesh {
  return new Mesh(
    new SphereGeometry(1.16, 64, 48),
    new ShaderMaterial({
      uniforms: { uColor: { value: new Color(color) } },
      vertexShader: BODY_VERTEX,
      fragmentShader: HALO_FRAGMENT,
      side: BackSide,
      transparent: true,
      depthWrite: false,
    }),
  );
}

export function buildDots(dots: LatLng[], color: string): InstancedMesh {
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 0.62 } },
    vertexShader: DOTS_VERTEX,
    fragmentShader: DOTS_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const mesh = layered(new InstancedMesh(new CircleGeometry(0.0072, 8), material, dots.length), 1);
  const dummy = new Object3D();
  dots.forEach((dot, i) => {
    faceOutward(dummy, dot, 1.002);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  return mesh;
}

export function buildMarker(at: LatLng, color: string, radius: number): Mesh {
  const material = new MeshBasicMaterial({ color, transparent: true, depthWrite: false });
  const mesh = layered(new Mesh(new CircleGeometry(radius, 24), material), 2);
  faceOutward(mesh, at, 1.004);
  return mesh;
}

export interface Pulse {
  object: Mesh;
  update(elapsed: number): void;
}

export function buildPulse(at: LatLng, color: string, offset: number): Pulse {
  const material = new MeshBasicMaterial({ color, transparent: true, depthWrite: false });
  const object = layered(new Mesh(new RingGeometry(0.82, 1, 48), material), 2);
  faceOutward(object, at, 1.005);
  return {
    object,
    update(elapsed) {
      const t = (elapsed / 2.4 + offset) % 1;
      object.scale.setScalar(0.02 + easeOut(t) * 0.11);
      material.opacity = (1 - t) * 0.7;
    },
  };
}

export interface Route {
  object: Group;
  // Returns how strongly the comet is arriving right now (0..1), to flash the destination.
  update(elapsed: number, still: boolean): number;
}

export function buildRoute(from: LatLng, to: LatLng, color: string, index: number): Route {
  const curve = new CatmullRomCurve3(flightPath(from, to).map(([x, y, z]) => new Vector3(x, y, z)));
  const tint = new Color(color);
  const arc = new ShaderMaterial({
    uniforms: { uColor: { value: tint }, uDraw: { value: 0 }, uOpacity: { value: 0.5 } },
    vertexShader: ARC_VERTEX,
    fragmentShader: ARC_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const comet = new ShaderMaterial({
    uniforms: { uColor: { value: tint }, uHead: { value: -1 }, uTail: { value: COMET_TAIL } },
    vertexShader: ARC_VERTEX,
    fragmentShader: COMET_FRAGMENT,
    transparent: true,
    depthWrite: false,
  });
  const head = new Mesh(new SphereGeometry(0.016, 16, 12), new MeshBasicMaterial({ color }));
  const object = new Group();
  object.add(
    layered(new Mesh(new TubeGeometry(curve, 96, 0.0045, 6), arc), 3),
    layered(new Mesh(new TubeGeometry(curve, 128, 0.0085, 8), comet), 4),
    head,
    buildMarker(from, color, 0.018),
  );

  return {
    object,
    update(elapsed, still) {
      arc.uniforms.uDraw.value = still ? 1 : easeOut(clamp01((elapsed - 0.35 - index * 0.18) / 1.1));
      const local = elapsed - COMET_DELAY - index * COMET_STAGGER;
      const travel = still || local < 0 ? 2 : (local % COMET_PERIOD) / COMET_TRAVEL;
      const progress = travel <= 1 ? easeInOut(travel) * (1 + COMET_TAIL) : -1;
      comet.uniforms.uHead.value = progress;
      head.visible = progress >= 0 && progress <= 1;
      if (head.visible) curve.getPointAt(progress, head.position);
      return progress > 1 ? 1 - (progress - 1) / COMET_TAIL : 0;
    },
  };
}
