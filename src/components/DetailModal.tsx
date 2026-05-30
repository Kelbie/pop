import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Post } from "../types/post";
import { CARD_COLORS, CARD_GOLD } from "../canvas/cardTheme";
import { ENTRY_KIND } from "../lib/guestbook";
import { nostrComEventUrl } from "../lib/nevent";
import { RELAYS } from "../lib/ndk";
import { PostCardContent } from "./PostCardContent";

/** Focused detail: enlarged card centered over a blurred/dimmed backdrop. */
export function DetailModal({
  post,
  onClose,
  gold = false,
  medal = 0,
}: {
  post: Post;
  onClose: () => void;
  /** author zapped -> gold ring + glow on the enlarged card */
  gold?: boolean;
  /** podium place 1-3 -> 🥇/🥈/🥉 badge */
  medal?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nostrUrl = nostrComEventUrl({
    id: post.id,
    author: post.author.pubkey,
    kind: Number(ENTRY_KIND),
    relays: RELAYS,
  });

  return createPortal(
    <div
      className="pop-modal-fade fixed inset-0 z-30 flex items-center justify-center p-6 backdrop-blur-md"
      style={{ backgroundColor: "rgba(36, 30, 26, 0.32)" }}
      onClick={onClose}
    >
      <div
        className="pop-modal-pop w-[380px] max-w-full overflow-hidden rounded-2xl"
        style={{
          backgroundColor: CARD_COLORS.surface,
          boxShadow: gold
            ? `0 12px 28px rgba(54, 43, 37, 0.22), inset 0 0 0 1px ${CARD_GOLD.ring}`
            : "0 12px 28px rgba(54, 43, 37, 0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <PostCardContent post={post} large medal={medal} />
        <a
          href={nostrUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center justify-center gap-1.5 border-t border-hairline px-4 py-3 text-sm font-semibold text-terracotta transition hover:bg-paper"
        >
          View on nostr.com
          <span aria-hidden>↗</span>
        </a>
      </div>
    </div>,
    document.body,
  );
}
