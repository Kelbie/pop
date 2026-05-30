import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { Post } from "../types/post";
import { CARD_COLORS } from "../canvas/cardTheme";
import { PostCardContent } from "./PostCardContent";

/** Focused detail: enlarged card centered over a blurred/dimmed backdrop. */
export function DetailModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="pop-modal-fade fixed inset-0 z-30 flex items-center justify-center p-6 backdrop-blur-md"
      style={{ backgroundColor: "rgba(36, 30, 26, 0.32)" }}
      onClick={onClose}
    >
      <div
        className="pop-modal-pop w-[380px] max-w-full overflow-hidden rounded-2xl"
        style={{ backgroundColor: CARD_COLORS.surface, boxShadow: "0 12px 28px rgba(54, 43, 37, 0.22)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <PostCardContent post={post} large />
      </div>
    </div>,
    document.body,
  );
}
