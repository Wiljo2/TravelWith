import { Group, Mesh, PerspectiveCamera, Scene, Vector3, WebGLRenderer, type Material } from "three";
import { frontRotation, landDots, toVec3, type LatLng } from "@/components/landing/globe/geo";
import {
  buildBody,
  buildDots,
  buildHalo,
  buildMarker,
  buildPulse,
  buildRoute,
  easeOut,
} from "@/components/landing/globe/meshes";
import { createMotion } from "@/components/landing/globe/motion";

export interface GlobePalette {
  body: string;
  rim: string;
  dots: string;
  halo: string;
  destination: string;
}

export interface ProjectedAnchor {
  x: number;
  y: number;
  opacity: number;
}

export interface GlobeSceneOptions {
  host: HTMLElement;
  center: LatLng;
  destination: LatLng;
  routes: { from: LatLng; color: string }[];
  palette: GlobePalette;
  still: boolean;
  // One anchor per route origin, then the destination; positions in CSS px within the host.
  onFrame(anchors: readonly ProjectedAnchor[]): void;
  onReady(): void;
}

const FOV = 30;
// Share of the host's shorter side covered by the globe; HeroGlobe's placeholder matches it.
export const GLOBE_FILL = 0.72;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export function createGlobeScene(options: GlobeSceneOptions): (() => void) | null {
  const { host, destination, palette, still } = options;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const canvas = renderer.domElement;
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 20);
  const globe = new Group();
  const routes = options.routes.map((r, i) => buildRoute(r.from, destination, r.color, i));
  const pulses = [0, 0.5].map((offset) => buildPulse(destination, palette.destination, offset));
  const destinationDot = buildMarker(destination, palette.destination, 0.024);
  globe.add(
    buildHalo(palette.halo),
    buildBody(palette.body, palette.rim),
    buildDots(landDots(), palette.dots),
    destinationDot,
    ...pulses.map((p) => p.object),
    ...routes.map((r) => r.object),
  );
  scene.add(globe);

  const motion = createMotion(frontRotation(options.center), still);
  const anchors = [...options.routes.map((r) => r.from), destination].map((p) => new Vector3(...toVec3(p, 1.01)));
  const projected: ProjectedAnchor[] = anchors.map(() => ({ x: 0, y: 0, opacity: 0 }));
  const world = new Vector3();
  const toCamera = new Vector3();

  let width = 0;
  let height = 0;
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let scroll = 0;
  let visible = true;
  let ready = false;
  let lastMove = 0;

  const request = () => {
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
  };

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    if (!still) elapsed += dt;

    const { x, y } = motion.step(dt, elapsed, scroll);
    globe.rotation.set(x, y, 0);
    globe.scale.setScalar(still ? 1 : 0.94 + 0.06 * easeOut(clamp01(elapsed / 1.2)));
    let arrival = 0;
    for (const route of routes) arrival = Math.max(arrival, route.update(elapsed, still));
    destinationDot.scale.setScalar(1 + 0.7 * arrival);
    for (const pulse of pulses) pulse.update(elapsed);
    globe.updateMatrixWorld();

    const labelsIn = still ? 1 : easeOut(clamp01((elapsed - 1.1) / 0.6));
    anchors.forEach((local, i) => {
      world.copy(local).applyMatrix4(globe.matrixWorld);
      const facing = toCamera.copy(camera.position).sub(world).normalize().dot(world) / world.length();
      world.project(camera);
      const p = projected[i];
      p.x = ((world.x + 1) / 2) * width;
      p.y = ((1 - world.y) / 2) * height;
      p.opacity = smoothstep(0.08, 0.32, facing) * labelsIn;
    });
    options.onFrame(projected);

    renderer.render(scene, camera);
    if (!ready) {
      ready = true;
      options.onReady();
    }
    if (!still || motion.moving) request();
  }

  const resize = () => {
    width = host.clientWidth;
    height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const tanHalf = Math.tan((FOV * Math.PI) / 360) * Math.min(1, camera.aspect);
    camera.position.z = 1 / Math.sin(Math.atan(GLOBE_FILL * tanHalf));
    camera.updateProjectionMatrix();
    request();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    request();
  });
  intersection.observe(host);

  const onVisibility = () => request();
  const onScroll = () => {
    const rect = host.getBoundingClientRect();
    scroll = clamp01(-rect.top / rect.height);
  };
  const onDown = (e: PointerEvent) => {
    canvas.setPointerCapture(e.pointerId);
    motion.grab(e.clientX, e.clientY, width);
    lastMove = e.timeStamp;
    request();
  };
  const onMove = (e: PointerEvent) => {
    if (motion.moving) {
      motion.drag(e.clientX, e.clientY, (e.timeStamp - lastMove) / 1000);
      lastMove = e.timeStamp;
      request();
    } else if (e.pointerType === "mouse") {
      const rect = host.getBoundingClientRect();
      motion.hover(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1);
    }
  };
  const onUp = () => {
    motion.release();
    request();
  };
  const onLeave = () => motion.hover(0, 0);

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("scroll", onScroll, { passive: true });
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  return () => {
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersection.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("scroll", onScroll);
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.geometry.dispose();
        (object.material as Material).dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  };
}
