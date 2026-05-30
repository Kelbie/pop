import type { Post } from "../types/post";

// Single source of truth for card dimensions. BOTH the masonry layout (needs
// exact height up front) and the texture drawer (needs the wrapped lines /
// media box) call computeCardGeometry, so they can never disagree and clip.
//
// Card text uses the Velvelyne web font (see src/index.css). main.tsx awaits
// the font before the first render, so the first layout already measures with
// final metrics — no font-swap reflow.

export const FONT_STACK =
  '"Velvelyne", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

// The "stamp" voice — for handles, timestamps, and the engagement footer.
// See DESIGN.md §3 (The Stamp Rule). Velvelyne is monospaced, so it carries
// the stamp voice too; the system monospace fallbacks keep metrics close if
// the web font ever fails to load.
export const MONO_STACK =
  '"Velvelyne", ui-monospace, SFMono-Regular, Menlo, "Cascadia Mono", monospace';

export const CARD = {
  width: 320,
  padding: 16,
  radius: 16,
  avatar: 40,
  headerGap: 10,
  nameFont: `600 15px ${FONT_STACK}`,
  metaFont: `400 12px ${FONT_STACK}`,
  stampFont: `400 12px ${MONO_STACK}`,
  messageFont: `400 14px ${FONT_STACK}`,
  messageLineHeight: 20,
  maxMessageLines: 8,
  blockGap: 12,
  mediaMinHeight: 120,
  mediaMaxHeight: 320,
  footerHeight: 16,
  footerGap: 10,
} as const;

export interface CardGeometry {
  width: number;
  height: number;
  contentWidth: number; // width - 2*padding
  lines: string[]; // wrapped message lines (already clamped + ellipsised)
  mediaHeight: number; // 0 if no media
  // y-offsets (in card-local px) for the texture drawer:
  headerY: number;
  messageY: number;
  mediaY: number;
  footerY: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;
function getMeasureCtx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement("canvas");
    measureCtx = c.getContext("2d");
  }
  return measureCtx!;
}

export function wrapText(
  text: string,
  font: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const ctx = getMeasureCtx();
  ctx.font = font;
  const lines: string[] = [];

  outer: for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    let line = "";
    for (const word of words) {
      const test = line ? line + " " + word : word;
      if (ctx.measureText(test).width <= maxWidth || !line) {
        line = test;
      } else {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break outer;
      }
    }
    if (line) {
      lines.push(line);
      if (lines.length >= maxLines) break outer;
    }
  }

  // Ellipsise if we truncated content.
  if (lines.length >= maxLines) {
    let last = lines[maxLines - 1];
    const ell = "…";
    while (last && ctx.measureText(last + ell).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[maxLines - 1] = last + ell;
    lines.length = maxLines;
  }
  return lines;
}

const geometryCache = new Map<string, CardGeometry>();

export function computeCardGeometry(post: Post): CardGeometry {
  const cached = geometryCache.get(post.id);
  if (cached) return cached;

  const { padding, width, avatar, headerGap, messageLineHeight } = CARD;
  const contentWidth = width - padding * 2;

  const lines = wrapText(
    post.message,
    CARD.messageFont,
    contentWidth,
    CARD.maxMessageLines,
  );

  let mediaHeight = 0;
  if (post.media) {
    const aspect =
      post.media.width && post.media.height
        ? post.media.height / post.media.width
        : 0.66;
    mediaHeight = Math.round(
      Math.min(
        CARD.mediaMaxHeight,
        Math.max(CARD.mediaMinHeight, contentWidth * aspect),
      ),
    );
  }

  let y = padding;
  const headerY = y;
  y += avatar; // header row height == avatar diameter

  let messageY = 0;
  if (lines.length > 0) {
    y += headerGap;
    messageY = y;
    y += lines.length * messageLineHeight;
  }

  let mediaY = 0;
  if (mediaHeight > 0) {
    y += CARD.blockGap;
    mediaY = y;
    y += mediaHeight;
  }

  y += CARD.footerGap;
  const footerY = y;
  y += CARD.footerHeight;
  y += padding;

  const geo: CardGeometry = {
    width,
    height: Math.round(y),
    contentWidth,
    lines,
    mediaHeight,
    headerY,
    messageY,
    mediaY,
    footerY,
  };
  geometryCache.set(post.id, geo);
  return geo;
}
