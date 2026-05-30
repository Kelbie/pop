import type { Post } from "../types/post";
import { CARD, computeCardGeometry } from "./cardGeometry";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layout {
  rects: Map<string, Rect>;
  bounds: { width: number; height: number };
  columnCount: number;
}

const GAP = 24;

/** Column indices ordered from the centre outward: [.. ,c-1, c+1, c, c+1, ..]. */
function centerOutColumns(count: number): number[] {
  const center = (count - 1) / 2;
  return Array.from({ length: count }, (_, i) => i).sort((a, b) => {
    const da = Math.abs(a - center);
    const db = Math.abs(b - center);
    return da - db || a - b; // stable left-before-right on equal distance
  });
}

/**
 * Deterministic masonry in world units, ranked by zap support. Patrons (anyone
 * whose author zapped) are packed into a contiguous block of central columns —
 * highest sats first, shortest-column-first so the gilded cluster stays centred
 * and balanced — while unzapped notes fill the outer columns around them. Stable
 * (id tiebreak) so the wall is identical across reloads and camera focus/fit
 * stays put. Pure: (Post[], sats map) -> positions.
 *
 * `zappedSats` maps an author's hex pubkey -> total sats they zapped; omit it
 * (or pass an empty map) and the wall collapses to plain newest-first masonry.
 */
export function layoutMasonry(
  posts: Post[],
  zappedSats?: Map<string, number>,
): Layout {
  const satsOf = (p: Post) => zappedSats?.get(p.author.pubkey) ?? 0;
  const newestFirst = (a: Post, b: Post) =>
    b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1);

  const zappers = posts
    .filter((p) => satsOf(p) > 0)
    .sort((a, b) => satsOf(b) - satsOf(a) || newestFirst(a, b));
  const others = posts.filter((p) => satsOf(p) === 0).sort(newestFirst);

  // A roughly square wall: derive column count from N, clamped to a sane range.
  const columnCount = Math.max(3, Math.min(12, Math.round(Math.sqrt(posts.length))));
  const centerOrder = centerOutColumns(columnCount);
  const center = (columnCount - 1) / 2;
  const distFromCenter = (c: number) => Math.abs(c - center);

  const colW = CARD.width;
  const colHeights = new Array<number>(columnCount).fill(0);
  const rects = new Map<string, Rect>();

  const place = (post: Post, col: number) => {
    const geo = computeCardGeometry(post);
    rects.set(post.id, { x: col * (colW + GAP), y: colHeights[col], w: colW, h: geo.height });
    colHeights[col] += geo.height + GAP;
  };

  // Pick the shortest column from `cols`; tie-break by `prefer` (a comparator
  // returning the column to keep). Keeps placement deterministic.
  const shortest = (cols: number[], prefer: (a: number, b: number) => number) =>
    cols.reduce((best, c) => {
      if (colHeights[c] < colHeights[best] - 0.001) return c;
      if (colHeights[c] <= colHeights[best] + 0.001) return prefer(c, best);
      return best;
    }, cols[0]);

  // Zappers -> a centred block of columns sized to their count, filled
  // shortest-first (most-central on ties) so the gilded cards stay clustered.
  const zCols = Math.min(columnCount, Math.max(1, Math.round(Math.sqrt(zappers.length))));
  const central = centerOrder.slice(0, zCols);
  for (const post of zappers) {
    place(post, shortest(central, (a, b) => (distFromCenter(a) < distFromCenter(b) ? a : b)));
  }

  // Others -> every column, shortest-first, biased toward the edges so they
  // wrap around the gilded centre instead of splitting it.
  const allCols = Array.from({ length: columnCount }, (_, c) => c);
  for (const post of others) {
    place(post, shortest(allCols, (a, b) => (distFromCenter(a) > distFromCenter(b) ? a : b)));
  }

  const width = columnCount * (colW + GAP) - GAP;
  const height = Math.max(0, ...colHeights) - GAP;

  return { rects, bounds: { width, height }, columnCount };
}
