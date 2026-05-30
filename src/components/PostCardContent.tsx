import type { Post } from "../types/post";
import { MONO_STACK } from "../canvas/cardGeometry";
import { CARD_COLORS, CARD_GOLD } from "../canvas/cardTheme";
import { slashesForRank } from "../lib/medals";
import { formatRelative } from "../lib/time";
import { proxyImage } from "../lib/img";

/** Gold slash rank marks: /// 1st, // 2nd, / 3rd. */
function GoldSlashes({ count }: { count: number }) {
  const slant = 4;
  const h = 11;
  const gap = 5;
  const w = (count - 1) * gap + slant + 2;
  return (
    <svg
      width={w}
      height={h + 2}
      viewBox={`0 0 ${w} ${h + 2}`}
      stroke={CARD_GOLD.ring}
      strokeWidth={2}
      strokeLinecap="round"
      fill="none"
      aria-hidden
    >
      {Array.from({ length: count }, (_, i) => (
        <line key={i} x1={i * gap + 1} y1={h + 1} x2={i * gap + 1 + slant} y2={1} />
      ))}
    </svg>
  );
}

/**
 * The real (DOM) rendering of a post. Used for the zoomed-in HtmlCard and the
 * detail modal — crisp text, selectable, real <img>, clickable links.
 *
 * `medal` (1-3) shows gold slash rank marks (/// // /), mirroring the canvas
 * texture (the gold ring for any patron is applied by the caller).
 */
export function PostCardContent({
  post,
  large = false,
  medal = 0,
}: {
  post: Post;
  large?: boolean;
  medal?: number;
}) {
  return (
    <div className="flex h-full flex-col p-4">
      <div className="flex items-center gap-2.5">
        {post.author.avatarUrl ? (
          <img
            src={proxyImage(post.author.avatarUrl, 96)}
            alt=""
            crossOrigin="anonymous"
            className="h-10 w-10 shrink-0 rounded-full object-cover"
            style={{ backgroundColor: CARD_COLORS.avatarFill }}
          />
        ) : (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ backgroundColor: CARD_COLORS.avatarFill, color: CARD_COLORS.avatarInk }}
          >
            {post.author.displayName[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="min-w-0">
          <div
            className="truncate text-[15px] font-semibold leading-tight"
            style={{ color: CARD_COLORS.ink }}
          >
            {post.author.displayName}
          </div>
          <div
            className="truncate text-xs"
            style={{
              color: CARD_COLORS.mutedInk,
              fontFamily: MONO_STACK,
              letterSpacing: "0.02em",
            }}
          >
            {post.author.nip05 ? `${post.author.nip05} · ` : ""}
            {formatRelative(post.createdAt)}
          </div>
        </div>
      </div>

      {post.message && (
        <p
          className={
            "mt-2.5 whitespace-pre-wrap break-words " +
            (large ? "text-base" : "text-sm")
          }
          style={{ color: CARD_COLORS.ink }}
        >
          {post.message}
        </p>
      )}

      {post.media && (
        <img
          src={proxyImage(post.media.url, large ? 960 : 640)}
          alt=""
          crossOrigin="anonymous"
          loading="lazy"
          className="mt-3 w-full rounded-[10px] object-cover"
          style={{
            maxHeight: large ? 480 : 320,
            minHeight: 120,
            backgroundColor: CARD_COLORS.mediaPlaceholder,
          }}
        />
      )}

      {(medal > 0 || post.reactions || post.zaps) && (
        <div
          className="mt-auto flex items-center gap-3.5 pt-2.5 text-xs"
          style={{ color: CARD_COLORS.mutedInk, fontFamily: MONO_STACK, letterSpacing: "0.02em" }}
        >
          {medal > 0 ? <GoldSlashes count={slashesForRank(medal)} /> : null}
          {post.reactions ? <span>♥ {post.reactions}</span> : null}
          {post.zaps ? <span>⚡ {post.zaps}</span> : null}
        </div>
      )}
    </div>
  );
}
