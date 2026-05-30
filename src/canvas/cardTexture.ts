import { CanvasSource, Texture } from "pixi.js";
import type { Post } from "../types/post";
import { CARD, computeCardGeometry, type CardGeometry } from "./cardGeometry";
import { CARD_COLORS, CARD_SHADOW_REST_COLOR } from "./cardTheme";
import { formatRelative } from "../lib/time";

// Device pixel ratio, capped at 2 to bound VRAM (200 tall media cards add up).
export const DPR = Math.min(
  typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
  2,
);

// Transparent margin baked into each texture so the card's drop-shadow has room
// (it lives inside the 24px masonry gap, so it never overlaps neighbours).
export const SHADOW_MARGIN = 14;

const BG = CARD_COLORS.surface;
const TEXT = CARD_COLORS.ink;
const META = CARD_COLORS.mutedInk;
const AVATAR_BG = CARD_COLORS.avatarFill;

// ---- shared image loader with a small concurrency limit -------------------

let inFlight = 0;
const queue: (() => void)[] = [];
const MAX_INFLIGHT = 8;

function pump() {
  while (inFlight < MAX_INFLIGHT && queue.length) {
    queue.shift()!();
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const start = () => {
      inFlight++;
      const img = new Image();
      img.crossOrigin = "anonymous"; // required to use as a WebGL texture
      img.onload = () => {
        inFlight--;
        resolve(img);
        pump();
      };
      img.onerror = (e) => {
        inFlight--;
        reject(e);
        pump();
      };
      img.src = url;
    };
    queue.push(start);
    pump();
  });
}

// ---- drawing ---------------------------------------------------------------

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  post: Post,
  cx: number,
  cy: number,
  size: number,
  img?: HTMLImageElement,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx + size / 2, cy + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (img) {
    ctx.drawImage(img, cx, cy, size, size);
  } else {
    ctx.fillStyle = AVATAR_BG;
    ctx.fillRect(cx, cy, size, size);
    ctx.fillStyle = CARD_COLORS.avatarInk;
    ctx.font = `600 ${Math.round(size * 0.42)}px ${CARD.nameFont.split("px ")[1]}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      (post.author.displayName[0] || "?").toUpperCase(),
      cx + size / 2,
      cy + size / 2 + 1,
    );
  }
  ctx.restore();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  post: Post,
  geo: CardGeometry,
  images: { avatar?: HTMLImageElement; media?: HTMLImageElement },
) {
  const M = SHADOW_MARGIN;
  const { padding, avatar, radius, messageLineHeight } = CARD;

  ctx.clearRect(-M, -M, geo.width + M * 2, geo.height + M * 2);

  // drop shadow + white card body
  ctx.save();
  ctx.shadowColor = CARD_SHADOW_REST_COLOR;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = BG;
  roundRectPath(ctx, 0, 0, geo.width, geo.height, radius);
  ctx.fill();
  ctx.restore();

  // header: avatar + name + meta
  drawAvatar(ctx, post, padding, geo.headerY, avatar, images.avatar);
  const textX = padding + avatar + 10;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = TEXT;
  ctx.font = CARD.nameFont;
  ctx.fillText(post.author.displayName, textX, geo.headerY + 17, geo.contentWidth - avatar - 10);
  ctx.fillStyle = META;
  ctx.font = CARD.stampFont;
  ctx.letterSpacing = "0.02em";
  const handle = post.author.nip05 ? `${post.author.nip05}` : "";
  ctx.fillText(
    `${handle ? handle + " · " : ""}${formatRelative(post.createdAt)}`,
    textX,
    geo.headerY + 34,
    geo.contentWidth - avatar - 10,
  );
  ctx.letterSpacing = "0px";

  // message
  if (geo.lines.length) {
    ctx.fillStyle = TEXT;
    ctx.font = CARD.messageFont;
    geo.lines.forEach((line, i) => {
      ctx.fillText(line, padding, geo.messageY + 14 + i * messageLineHeight);
    });
  }

  // media (cover-fit, rounded)
  if (geo.mediaHeight > 0) {
    const mw = geo.contentWidth;
    const mh = geo.mediaHeight;
    ctx.save();
    roundRectPath(ctx, padding, geo.mediaY, mw, mh, 10);
    ctx.clip();
    if (images.media) {
      const img = images.media;
      const scale = Math.max(mw / img.width, mh / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(
        img,
        padding + (mw - dw) / 2,
        geo.mediaY + (mh - dh) / 2,
        dw,
        dh,
      );
    } else {
      ctx.fillStyle = CARD_COLORS.mediaPlaceholder;
      ctx.fillRect(padding, geo.mediaY, mw, mh);
    }
    ctx.restore();
  }

  // footer (muted engagement line, in the stamp voice)
  ctx.fillStyle = META;
  ctx.font = CARD.stampFont;
  ctx.letterSpacing = "0.02em";
  const bits: string[] = [];
  if (post.reactions) bits.push(`♥ ${post.reactions}`);
  if (post.zaps) bits.push(`⚡ ${post.zaps}`);
  if (bits.length) ctx.fillText(bits.join("   "), padding, geo.footerY + 12);
  ctx.letterSpacing = "0px";
}

// ---- public: a managed texture per card -----------------------------------

export interface CardTextureHandle {
  texture: Texture;
  /** sprite world size + offset (texture includes the shadow margin) */
  cssWidth: number;
  cssHeight: number;
  offset: number; // place sprite at (rect.x - offset, rect.y - offset)
  destroy(): void;
}

export function buildCardTexture(post: Post): CardTextureHandle {
  const geo = computeCardGeometry(post);
  const M = SHADOW_MARGIN;
  const cssWidth = geo.width + M * 2;
  const cssHeight = geo.height + M * 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(cssWidth * DPR);
  canvas.height = Math.ceil(cssHeight * DPR);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(DPR, DPR);
  ctx.translate(M, M); // card-local (0,0) == card top-left

  const images: { avatar?: HTMLImageElement; media?: HTMLImageElement } = {};
  drawCard(ctx, post, geo, images); // immediate placeholder render

  const source = new CanvasSource({ resource: canvas, resolution: DPR });
  const texture = new Texture({ source });

  let destroyed = false;
  const redraw = () => {
    if (destroyed) return;
    drawCard(ctx, post, geo, images);
    source.update();
  };

  // draw-twice: load images, then patch the texture in place
  if (post.author.avatarUrl) {
    loadImage(post.author.avatarUrl)
      .then((img) => {
        images.avatar = img;
        redraw();
      })
      .catch(() => {});
  }
  if (post.media) {
    loadImage(post.media.url)
      .then((img) => {
        images.media = img;
        redraw();
      })
      .catch(() => {});
  }

  return {
    texture,
    cssWidth,
    cssHeight,
    offset: M,
    destroy() {
      destroyed = true;
      texture.destroy(true);
    },
  };
}
