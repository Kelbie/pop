import { Application, Container, Sprite } from "pixi.js";
import type { Post } from "../types/post";
import { buildCardTexture, type CardTextureHandle } from "./cardTexture";
import { layoutMasonry, type Layout, type Rect } from "./layoutMasonry";
import {
  fitCamera,
  LOD_NEAR_IN,
  LOD_NEAR_OUT,
  NO_INSETS,
  panLimits,
  screenToWorld,
  zoomAt,
  type Camera,
  type EdgeInsets,
} from "./camera";

export type LodMode = "far" | "near";

interface CardNode {
  post: Post;
  rect: Rect;
  sprite: Sprite;
  handle: CardTextureHandle;
  baseScale: number; // texture->world scale (1); reveal multiplies this
  dim: number; // search alpha (1 or DIM_ALPHA)
  revealed: boolean; // first-reveal done -> never animates again
  revealing: boolean;
  revealT: number; // ms elapsed since entering the reveal viewport
  delay: number; // ms stagger before the fade starts
}

const FRICTION = 0.9; // per-frame velocity decay
const BOUNDS_EASE = 0.18; // spring strength easing back inside the pan bounds
const OVERSCROLL_FRICTION = 0.5; // extra per-frame velocity bleed past an edge
const SETTLE_EPS = 0.5; // px: snap to the bound and stop when this close
const TARGET_EASE = 0.18;
const RUBBER = 0.4;
const DIM_ALPHA = 0.18;

// Card reveal (Emil: subtle, <300ms, fires once per card, ease-out).
const REVEAL_MS = 260;
const REVEAL_DELAY_MAX = 140; // cap on the distance-from-center stagger
const REVEAL_SCALE_FROM = 0.96; // never from scale(0)
const REVEAL_MARGIN = 0.4; // pre-roll: start fading before the card is on-screen

function softClamp(v: number, min: number, max: number): number {
  if (v < min) return min + (v - min) * RUBBER;
  if (v > max) return max + (v - max) * RUBBER;
  return v;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * The single imperative bridge between React and Pixi. React talks to the
 * canvas only through this object; the eventual NDK swap is just a different
 * `setPosts` source.
 */
export class CanvasController {
  private app: Application | null = null;
  private world = new Container();
  private nodes = new Map<string, CardNode>();
  private layout: Layout = {
    rects: new Map(),
    bounds: { width: 0, height: 0 },
    columnCount: 0,
  };

  private cam: Camera = { x: 0, y: 0, scale: 1 };
  private vel = { x: 0, y: 0 };
  private target: Camera | null = null;
  private dragging = false;
  private vp = { width: 1, height: 1 };
  // Padding reserved for the floating chrome (top placard/search, zoom buttons)
  // so panned content always lands in the visible white space.
  private insets: EdgeInsets = NO_INSETS;

  private lodMode: LodMode = "far";
  private lastNearKey = "";
  private matches: Set<string> | null = null;

  private cameraCb: ((cam: Camera) => void) | null = null;
  private lodCb: ((mode: LodMode, ids: string[]) => void) | null = null;
  private destroyed = false;

  private reducedMotion = false;
  private lastDtMs = 1000 / 60;

  async mount(el: HTMLDivElement): Promise<void> {
    this.reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const app = new Application();
    await app.init({
      resizeTo: el,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      // Transparent so the ambient atmosphere layer shows through the gaps
      // between prints (AmbientBackground sits behind the stage).
      backgroundAlpha: 0,
      preference: "webgl",
    });
    if (this.destroyed) {
      // unmounted before async init resolved (StrictMode) -> throw it away
      app.destroy(true, { children: true, texture: true });
      return;
    }
    this.app = app;
    el.appendChild(app.canvas);
    app.stage.addChild(this.world);
    this.vp = { width: app.renderer.width, height: app.renderer.height };
    app.ticker.add(this.tick);
  }

  setPosts(posts: Post[]): void {
    this.clearNodes();
    this.layout = layoutMasonry(posts);
    for (const post of posts) {
      const rect = this.layout.rects.get(post.id);
      if (!rect) continue;
      const handle = buildCardTexture(post);
      const sprite = new Sprite(handle.texture);
      // anchor at centre so the reveal scales from the card's middle
      sprite.anchor.set(0.5);
      const baseScale = handle.cssWidth / (handle.texture.width || handle.cssWidth);
      sprite.position.set(rect.x + rect.w / 2, rect.y + rect.h / 2);
      const shown = this.reducedMotion;
      sprite.alpha = shown ? 1 : 0;
      sprite.scale.set(baseScale * (shown ? 1 : REVEAL_SCALE_FROM));
      this.world.addChild(sprite);
      this.nodes.set(post.id, {
        post,
        rect,
        sprite,
        handle,
        baseScale,
        dim: 1,
        revealed: shown,
        revealing: false,
        revealT: 0,
        delay: 0,
      });
    }
    this.applyMatches();
    this.fitAll(false);
  }

  setSearchMatches(ids: Set<string> | null): void {
    this.matches = ids && ids.size ? ids : null;
    this.applyMatches();
  }

  private applyMatches(): void {
    for (const [id, node] of this.nodes) {
      node.dim = this.matches ? (this.matches.has(id) ? 1 : DIM_ALPHA) : 1;
      // already-revealed cards update instantly; revealing cards pick it up
      // via the reveal loop (alpha = dim * eased).
      if (node.revealed) node.sprite.alpha = node.dim;
    }
  }

  // ---- input (called by the React gesture layer) --------------------------

  /**
   * Reserve space for the on-top chrome (header/search, zoom buttons). The
   * per-frame elastic ease-back in `tick()` pulls the camera into the new
   * limits, so a growing/shrinking header settles content gracefully.
   */
  setInsets(insets: EdgeInsets): void {
    this.insets = insets;
  }

  applyPan(dx: number, dy: number): void {
    const lim = panLimits(this.cam, this.vp, this.layout.bounds, this.insets);
    this.cam.x = softClamp(this.cam.x + dx, lim.minX, lim.maxX);
    this.cam.y = softClamp(this.cam.y + dy, lim.minY, lim.maxY);
    this.target = null;
  }

  applyZoomAt(factor: number, sx: number, sy: number): void {
    this.cam = zoomAt(this.cam, factor, sx, sy);
    this.target = null;
  }

  setDragging(d: boolean): void {
    this.dragging = d;
    if (d) this.vel = { x: 0, y: 0 };
  }

  endDrag(vx: number, vy: number): void {
    this.dragging = false;
    // use-gesture velocity is px/ms; convert to px/frame (~16.7ms)
    this.vel = { x: vx * 16, y: vy * 16 };
  }

  hitTest(sx: number, sy: number): string | null {
    const w = screenToWorld(this.cam, sx, sy);
    for (const [id, node] of this.nodes) {
      const r = node.rect;
      if (w.x >= r.x && w.x <= r.x + r.w && w.y >= r.y && w.y <= r.y + r.h) {
        return id;
      }
    }
    return null;
  }

  focusPost(id: string): void {
    const node = this.nodes.get(id);
    if (!node) return;
    const r = node.rect;
    const margin = 1.4;
    // Centre within the visible window (viewport minus chrome), not the raw
    // viewport, so the opened note never sits behind the header/search.
    const winW = Math.max(1, this.vp.width - this.insets.left - this.insets.right);
    const winH = Math.max(1, this.vp.height - this.insets.top - this.insets.bottom);
    const scale = Math.min(winW / (r.w * margin), winH / (r.h * margin), 2);
    this.target = {
      scale,
      x: this.insets.left + winW / 2 - (r.x + r.w / 2) * scale,
      y: this.insets.top + winH / 2 - (r.y + r.h / 2) * scale,
    };
  }

  fitAll(animate = true): void {
    const cam = fitCamera(this.vp, this.layout.bounds, this.insets);
    if (animate) {
      this.target = cam;
    } else {
      this.cam = cam;
      this.target = null;
      this.vel = { x: 0, y: 0 };
    }
  }

  resize(): void {
    if (!this.app) return;
    this.vp = { width: this.app.renderer.width, height: this.app.renderer.height };
  }

  screenToWorld(sx: number, sy: number) {
    return screenToWorld(this.cam, sx, sy);
  }

  getCamera(): Camera {
    return this.cam;
  }

  getRect(id: string): Rect | undefined {
    return this.nodes.get(id)?.rect;
  }

  getPost(id: string): Post | undefined {
    return this.nodes.get(id)?.post;
  }

  onCameraChange(cb: (cam: Camera) => void): void {
    this.cameraCb = cb;
  }

  onLodChange(cb: (mode: LodMode, ids: string[]) => void): void {
    this.lodCb = cb;
  }

  // ---- the single per-frame integration loop ------------------------------

  private tick = (ticker: { deltaTime: number }): void => {
    const dt = Math.min(ticker.deltaTime, 3); // clamp huge frame gaps
    this.lastDtMs = dt * (1000 / 60);
    const lim = panLimits(this.cam, this.vp, this.layout.bounds, this.insets);

    if (this.target) {
      this.cam.x += (this.target.x - this.cam.x) * TARGET_EASE * dt;
      this.cam.y += (this.target.y - this.cam.y) * TARGET_EASE * dt;
      this.cam.scale += (this.target.scale - this.cam.scale) * TARGET_EASE * dt;
      if (
        Math.abs(this.target.x - this.cam.x) < 0.5 &&
        Math.abs(this.target.y - this.cam.y) < 0.5 &&
        Math.abs(this.target.scale - this.cam.scale) < 0.001
      ) {
        this.cam = { ...this.target };
        this.target = null;
      }
    } else if (!this.dragging) {
      // inertia — rubber-clamped on each step so a fling *decelerates into* the
      // edge instead of shooting far past it and then crawling back (the old
      // behavior, which read as clunky).
      if (this.vel.x || this.vel.y) {
        this.cam.x = softClamp(this.cam.x + this.vel.x * dt, lim.minX, lim.maxX);
        this.cam.y = softClamp(this.cam.y + this.vel.y * dt, lim.minY, lim.maxY);
        const f = Math.pow(FRICTION, dt);
        this.vel.x *= f;
        this.vel.y *= f;
        if (Math.abs(this.vel.x) < 0.05) this.vel.x = 0;
        if (Math.abs(this.vel.y) < 0.05) this.vel.y = 0;
      }
      // settle back inside bounds with a frame-rate-independent spring; bleed
      // any leftover velocity hard and snap to rest within a pixel so the edge
      // never shimmers or oscillates.
      const ease = 1 - Math.pow(1 - BOUNDS_EASE, dt);
      const bleed = Math.pow(OVERSCROLL_FRICTION, dt);
      this.cam.x = this.settleAxis(this.cam.x, "x", lim.minX, lim.maxX, ease, bleed);
      this.cam.y = this.settleAxis(this.cam.y, "y", lim.minY, lim.maxY, ease, bleed);
    }

    // write transform
    this.world.position.set(this.cam.x, this.cam.y);
    this.world.scale.set(this.cam.scale);

    // sync DOM overlay on the SAME frame
    this.cameraCb?.(this.cam);

    // reveal newly-visible cards, then LOD + culling
    this.updateReveals();
    this.updateLod();
  };

  /**
   * Ease one camera axis back inside [min,max] when it's been pushed past an
   * edge. `ease` is the (frame-rate-independent) spring factor and `bleed`
   * drains the axis velocity while overscrolled. Snaps to the bound and stops
   * when within SETTLE_EPS so the camera comes fully to rest.
   */
  private settleAxis(
    pos: number,
    axis: "x" | "y",
    min: number,
    max: number,
    ease: number,
    bleed: number,
  ): number {
    const target = pos < min ? min : pos > max ? max : null;
    if (target === null) return pos;
    let next = pos + (target - pos) * ease;
    this.vel[axis] *= bleed;
    if (Math.abs(target - next) < SETTLE_EPS) {
      next = target;
      this.vel[axis] = 0;
    }
    return next;
  }

  /** Expanded viewport rect in world coords (margin as a fraction of size). */
  private viewportWorld(margin: number) {
    const tl = screenToWorld(this.cam, 0, 0);
    const br = screenToWorld(this.cam, this.vp.width, this.vp.height);
    const mx = (br.x - tl.x) * margin;
    const my = (br.y - tl.y) * margin;
    return { x0: tl.x - mx, y0: tl.y - my, x1: br.x + mx, y1: br.y + my };
  }

  /**
   * First-reveal fade for cards entering the viewport. Each card animates
   * exactly once (Emil's restraint: re-entering must not re-animate, or panning
   * becomes constant noise). Opacity + subtle scale, ease-out, with a
   * distance-from-centre stagger so the initial wall cascades in.
   */
  private updateReveals(): void {
    if (this.reducedMotion) return;
    const v = this.viewportWorld(REVEAL_MARGIN);
    const cx = this.vp.width / 2;
    const cy = this.vp.height / 2;

    for (const node of this.nodes.values()) {
      if (node.revealed) continue;
      const r = node.rect;
      const inView =
        r.x < v.x1 && r.x + r.w > v.x0 && r.y < v.y1 && r.y + r.h > v.y0;

      if (!node.revealing) {
        if (!inView) continue;
        node.revealing = true;
        node.revealT = 0;
        const sx = (r.x + r.w / 2) * this.cam.scale + this.cam.x;
        const sy = (r.y + r.h / 2) * this.cam.scale + this.cam.y;
        node.delay = Math.min(
          REVEAL_DELAY_MAX,
          Math.hypot(sx - cx, sy - cy) * 0.18,
        );
      }

      node.revealT += this.lastDtMs;
      const t = Math.max(0, Math.min(1, (node.revealT - node.delay) / REVEAL_MS));
      const e = easeOutCubic(t);
      node.sprite.alpha = node.dim * e;
      node.sprite.scale.set(
        node.baseScale * (REVEAL_SCALE_FROM + (1 - REVEAL_SCALE_FROM) * e),
      );
      if (t >= 1) {
        node.revealed = true;
        node.revealing = false;
        node.sprite.alpha = node.dim;
        node.sprite.scale.set(node.baseScale);
      }
    }
  }

  private updateLod(): void {
    const prev = this.lodMode;
    if (this.cam.scale > LOD_NEAR_IN) this.lodMode = "near";
    else if (this.cam.scale < LOD_NEAR_OUT) this.lodMode = "far";
    // else: keep prev (hysteresis band)

    let ids: string[] = [];
    if (this.lodMode === "near") {
      const v = this.viewportWorld(0.3);
      for (const [id, node] of this.nodes) {
        const r = node.rect;
        if (r.x < v.x1 && r.x + r.w > v.x0 && r.y < v.y1 && r.y + r.h > v.y0) {
          ids.push(id);
        }
      }
    }

    const key = this.lodMode + "|" + ids.join(",");
    if (key !== this.lastNearKey || prev !== this.lodMode) {
      this.lastNearKey = key;
      this.lodCb?.(this.lodMode, ids);
    }
  }

  private clearNodes(): void {
    for (const node of this.nodes.values()) {
      this.world.removeChild(node.sprite);
      node.sprite.destroy();
      node.handle.destroy();
    }
    this.nodes.clear();
  }

  destroy(): void {
    this.destroyed = true;
    this.clearNodes();
    if (this.app) {
      this.app.ticker.remove(this.tick);
      this.app.destroy(true, { children: true, texture: true });
      this.app = null;
    }
  }
}
