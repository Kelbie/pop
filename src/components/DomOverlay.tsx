import { useEffect, useRef, type CSSProperties } from "react";
import type { CanvasController, LodMode } from "../canvas/CanvasController";
import {
  CARD_COLORS,
  CARD_GOLD,
  CARD_SHADOW_LIFT,
  CARD_SHADOW_REST,
} from "../canvas/cardTheme";
import { PostCardContent } from "./PostCardContent";

/**
 * The HTML layer that floats over the WebGL canvas. A single wrapper element is
 * transformed every frame (synced inside the Pixi ticker via onCameraChange) so
 * the cards inherit the exact world transform with no per-card JS. Only the
 * cards visible while zoomed in (near LOD) get mounted, and they cross-fade in
 * over the always-present sprite — reading as "sharpen", not "jump".
 */
export function DomOverlay({
  controller,
  lod,
  matches,
  zappedSats,
  medals,
  onSelect,
}: {
  controller: CanvasController;
  lod: { mode: LodMode; ids: string[] };
  matches: Set<string> | null;
  /** author hex -> sats; passed (not read off the controller) so a live zap
   * re-renders the gold ring on an already-mounted card. */
  zappedSats: Map<string, number>;
  /** author hex -> podium place 1-3 for the top zappers. */
  medals: Map<string, number>;
  onSelect: (id: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    controller.onCameraChange((cam) => {
      const el = wrapperRef.current;
      if (el) {
        el.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.scale})`;
      }
    });
    return () => controller.onCameraChange(() => {});
  }, [controller]);

  const ids = lod.mode === "near" ? lod.ids : [];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        ref={wrapperRef}
        className="absolute left-0 top-0"
        style={{ transformOrigin: "0 0", willChange: "transform" }}
      >
        {ids.map((id) => {
          const rect = controller.getRect(id);
          const post = controller.getPost(id);
          if (!rect || !post) return null;
          const dim = matches && !matches.has(id);
          const gold = (zappedSats.get(post.author.pubkey) ?? 0) > 0;
          const medal = medals.get(post.author.pubkey) ?? 0;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              aria-label={`Open note from ${post.author.displayName}`}
              className="pop-card-fade pop-print pointer-events-auto absolute overflow-hidden rounded-2xl text-left"
              style={
                {
                  left: rect.x,
                  top: rect.y,
                  width: rect.w,
                  height: rect.h,
                  opacity: dim ? 0.18 : undefined,
                  "--print-surface": CARD_COLORS.surface,
                  "--print-shadow-rest": CARD_SHADOW_REST,
                  "--print-shadow-lift": CARD_SHADOW_LIFT,
                  "--print-ring": gold ? CARD_GOLD.ring : CARD_COLORS.ink,
                  ...(gold
                    ? { boxShadow: `inset 0 0 0 1px ${CARD_GOLD.ring}` }
                    : null),
                } as CSSProperties
              }
            >
              <PostCardContent post={post} medal={medal} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
