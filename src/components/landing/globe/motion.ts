export interface Orientation {
  x: number;
  y: number;
}

export interface GlobeMotion {
  grab(x: number, y: number, width: number): void;
  drag(x: number, y: number, dt: number): void;
  release(): void;
  hover(nx: number, ny: number): void;
  step(dt: number, elapsed: number, scroll: number): Orientation;
  readonly moving: boolean;
}

const MAX_PITCH = 0.6;
const RETURN_AFTER = 2.5;

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v: number, limit: number) => Math.min(limit, Math.max(-limit, v));

// Drag spins the globe with inertia; after a pause it eases back to the framed
// view. `still` (reduced motion) keeps only direct dragging.
export function createMotion(base: Orientation, still: boolean): GlobeMotion {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let radPerPx = 0;
  let offX = 0;
  let offY = 0;
  let velX = 0;
  let velY = 0;
  let idle = RETURN_AFTER;
  let tiltX = 0;
  let tiltY = 0;
  let targetTiltX = 0;
  let targetTiltY = 0;

  return {
    grab(x, y, width) {
      dragging = true;
      lastX = x;
      lastY = y;
      radPerPx = Math.PI / Math.max(width, 1);
      velX = 0;
      velY = 0;
    },
    drag(x, y, dt) {
      if (!dragging) return;
      const dy = (y - lastY) * radPerPx;
      const dx = (x - lastX) * radPerPx;
      lastX = x;
      lastY = y;
      offX = clamp(offX + dy, MAX_PITCH);
      offY = offY + dx;
      if (dt > 0) {
        velX = velX * 0.6 + (dy / dt) * 0.4;
        velY = velY * 0.6 + (dx / dt) * 0.4;
      }
    },
    release() {
      dragging = false;
      idle = 0;
      if (still) velX = velY = 0;
    },
    hover(nx, ny) {
      targetTiltX = ny * 0.07;
      targetTiltY = nx * 0.1;
    },
    step(dt, elapsed, scroll) {
      offY = wrap(offY);
      if (!dragging && !still) {
        offX = clamp(offX + velX * dt, MAX_PITCH);
        offY += velY * dt;
        const friction = Math.exp(-dt * 3.2);
        velX *= friction;
        velY *= friction;
        idle += dt;
        if (idle > RETURN_AFTER) {
          const pull = 1 - Math.exp(-dt * 1.1);
          offX -= offX * pull;
          offY -= offY * pull;
        }
      }
      const ease = 1 - Math.exp(-dt * 3);
      tiltX += (targetTiltX - tiltX) * ease;
      tiltY += (targetTiltY - tiltY) * ease;
      const sway = still ? 0 : Math.sin(elapsed * 0.21) * 0.14;
      return {
        x: base.x + offX + (still ? 0 : tiltX),
        y: base.y + offY + sway + (still ? 0 : tiltY + scroll * 0.6),
      };
    },
    get moving() {
      return dragging;
    },
  };
}
