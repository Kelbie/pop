// Pure camera math. world->screen: screen = world * scale + {x, y}.
// The CanvasController owns a single mutable Camera in a ref and integrates it
// in the Pixi ticker; these helpers keep the math testable and side-effect free.

export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 4;

// Hybrid LOD thresholds (hysteresis gap prevents thrash at the boundary).
export const LOD_NEAR_IN = 1.4; // enter near (DOM) mode above this scale
export const LOD_NEAR_OUT = 1.2; // leave near mode below this scale

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

export function screenToWorld(cam: Camera, sx: number, sy: number) {
  return { x: (sx - cam.x) / cam.scale, y: (sy - cam.y) / cam.scale };
}

/** Zoom about a screen anchor, keeping the world point under it fixed. */
export function zoomAt(cam: Camera, factor: number, sx: number, sy: number): Camera {
  const newScale = clampScale(cam.scale * factor);
  const worldX = (sx - cam.x) / cam.scale;
  const worldY = (sy - cam.y) / cam.scale;
  return {
    scale: newScale,
    x: sx - worldX * newScale,
    y: sy - worldY * newScale,
  };
}

export interface Viewport {
  width: number;
  height: number;
}

export interface WorldBounds {
  width: number;
  height: number;
}

/**
 * Per-edge padding (px) reserved for floating chrome that sits *on top* of the
 * canvas — the event placard / search at the top, the zoom buttons bottom-right.
 * Pan/fit math clamps against this visible window so content can always be
 * dragged into the white space and never disappears under the overlays.
 */
export interface EdgeInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const NO_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

/**
 * The visible span on one axis: `[loInset, viewSize - hiInset]`. If the insets
 * exceed the viewport (a very small / short screen), fall back to the full
 * viewport so the window never inverts.
 */
function visibleSpan(viewSize: number, loInset: number, hiInset: number) {
  const start = loInset;
  const end = viewSize - hiInset;
  if (end - start < 1) return { start: 0, end: viewSize };
  return { start, end };
}

/**
 * The allowed [min,max] range for cam.x / cam.y so the world stays sensibly in
 * view. When the (scaled) world is smaller than the *visible window* on an axis
 * we center it there; otherwise we let it pan edge-to-edge within the window
 * with `pad` slack. With `NO_INSETS` this is the plain viewport behavior.
 */
export function panLimits(
  cam: Camera,
  vp: Viewport,
  world: WorldBounds,
  insets: EdgeInsets = NO_INSETS,
  pad = 64,
) {
  function axis(
    worldSize: number,
    viewSize: number,
    loInset: number,
    hiInset: number,
  ) {
    const { start, end } = visibleSpan(viewSize, loInset, hiInset);
    const win = end - start;
    const scaled = worldSize * cam.scale;
    if (scaled <= win) {
      // center within the visible window, with a little slack
      const c = start + (win - scaled) / 2;
      return { min: c - pad, max: c + pad };
    }
    // edge-to-edge within the window
    return { min: end - scaled - pad, max: start + pad };
  }
  const x = axis(world.width, vp.width, insets.left, insets.right);
  const y = axis(world.height, vp.height, insets.top, insets.bottom);
  return { minX: x.min, maxX: x.max, minY: y.min, maxY: y.max };
}

/** Camera that fits the whole world into the visible window with margin. */
export function fitCamera(
  vp: Viewport,
  world: WorldBounds,
  insets: EdgeInsets = NO_INSETS,
  margin = 0.9,
): Camera {
  const winW = Math.max(1, vp.width - insets.left - insets.right);
  const winH = Math.max(1, vp.height - insets.top - insets.bottom);
  if (world.width <= 0 || world.height <= 0) {
    return {
      x: insets.left + winW / 2,
      y: insets.top + winH / 2,
      scale: 1,
    };
  }
  const scale = clampScale(
    Math.min(winW / world.width, winH / world.height) * margin,
  );
  return {
    scale,
    x: insets.left + (winW - world.width * scale) / 2,
    y: insets.top + (winH - world.height * scale) / 2,
  };
}
