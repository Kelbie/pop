import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CanvasController, type LodMode } from "../canvas/CanvasController";
import type { Post } from "../types/post";
import { AmbientBackground } from "../components/AmbientBackground";
import { DetailModal } from "../components/DetailModal";
import { DomOverlay } from "../components/DomOverlay";
import { PixiStage } from "../components/PixiStage";
import { medalRanks } from "../lib/medals";

export type CanvasStatus = "loading" | "empty" | "ready";

// Stable empty map so a missing `zappedSats` prop doesn't churn DomOverlay.
const EMPTY_SATS: Map<string, number> = new Map();

/**
 * Presentational guestbook wall. Renders the supplied posts on the Pixi canvas
 * (pan / zoom / detail). Search is controlled by the caller (the event top bar
 * owns the input); we dim non-matching cards. Fills its parent — give it a
 * sized container.
 */
export function GuestbookCanvas({
  posts,
  status,
  query = "",
  flashSignal = 0,
  zappedSats,
}: {
  posts: Post[];
  status: CanvasStatus;
  query?: string;
  flashSignal?: number;
  /** author hex pubkey -> total sats they zapped; gilds + centres their cards */
  zappedSats?: Map<string, number>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CanvasController | null>(null);
  const getCamera = useCallback(() => controllerRef.current?.getCamera(), []);

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lod, setLod] = useState<{ mode: LodMode; ids: string[] }>({
    mode: "far",
    ids: [],
  });

  // ---- mount / teardown the Pixi controller (StrictMode-safe) ----
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;

    const c = new CanvasController();
    controllerRef.current = c;
    c.onLodChange((mode, ids) => {
      if (!cancelled) setLod({ mode, ids });
    });
    c.mount(host).then(() => {
      if (!cancelled) setReady(true);
    });

    const ro = new ResizeObserver(() => c.resize());
    ro.observe(host);

    return () => {
      cancelled = true;
      ro.disconnect();
      c.destroy();
      if (controllerRef.current === c) controllerRef.current = null;
      setReady(false);
    };
  }, []);

  // ---- push posts into the canvas once both are ready ----
  useEffect(() => {
    if (ready && controllerRef.current) {
      controllerRef.current.setPosts(posts);
    }
  }, [ready, posts]);

  // ---- push zap totals: gilds patron cards + re-ranks the wall ----
  useEffect(() => {
    if (ready && controllerRef.current) {
      controllerRef.current.setZappers(zappedSats ?? new Map());
    }
  }, [ready, zappedSats]);

  // ---- search: dim non-matching cards in both layers ----
  const matches = useMemo<Set<string> | null>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const set = new Set<string>();
    for (const p of posts) {
      if (
        p.message.toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q) ||
        p.author.nip05?.toLowerCase().includes(q)
      ) {
        set.add(p.id);
      }
    }
    return set;
  }, [query, posts]);

  useEffect(() => {
    if (ready) controllerRef.current?.setSearchMatches(matches);
  }, [ready, matches]);

  // ---- global keyboard: +/- zoom, 0 = fit all ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = controllerRef.current;
      if (!c) return;
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      if (e.key === "=" || e.key === "+") c.applyZoomAt(1.2, cx, cy);
      else if (e.key === "-") c.applyZoomAt(1 / 1.2, cx, cy);
      else if (e.key === "0") c.fitAll(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleTap = (id: string) => {
    controllerRef.current?.focusPost(id);
    setSelectedId(id);
  };

  const medals = useMemo(
    () => medalRanks(zappedSats ?? EMPTY_SATS),
    [zappedSats],
  );

  const selectedPost = selectedId
    ? posts.find((p) => p.id === selectedId) ?? null
    : null;
  const selectedGold = selectedPost
    ? (zappedSats?.get(selectedPost.author.pubkey) ?? 0) > 0
    : false;
  const selectedMedal = selectedPost
    ? medals.get(selectedPost.author.pubkey) ?? 0
    : 0;

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper">
      <AmbientBackground getCamera={getCamera} flashSignal={flashSignal} />

      <PixiStage
        hostRef={hostRef}
        controllerRef={controllerRef}
        onTap={handleTap}
      />

      {ready && controllerRef.current && (
        <DomOverlay
          controller={controllerRef.current}
          lod={lod}
          matches={matches}
          zappedSats={zappedSats ?? EMPTY_SATS}
          medals={medals}
          onSelect={handleTap}
        />
      )}

      <ZoomControls
        onZoom={(f) =>
          controllerRef.current?.applyZoomAt(
            f,
            window.innerWidth / 2,
            window.innerHeight / 2,
          )
        }
        onFit={() => controllerRef.current?.fitAll(true)}
      />

      {status === "loading" && (
        <Centered>
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-muted" />
          <span className="text-sm text-muted">Developing the prints…</span>
        </Centered>
      )}
      {status === "empty" && (
        <Centered>
          <span className="text-lg font-medium text-ink">A blank wall, for now</span>
          <span className="text-sm text-muted">
            Be the first to pin a note.
          </span>
        </Centered>
      )}

      {selectedPost && (
        <DetailModal
          post={selectedPost}
          gold={selectedGold}
          medal={selectedMedal}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
      {children}
    </div>
  );
}

function ZoomControls({
  onZoom,
  onFit,
}: {
  onZoom: (factor: number) => void;
  onFit: () => void;
}) {
  const btn =
    "flex h-9 w-9 items-center justify-center rounded-lg bg-polaroid/90 text-ink shadow-sm backdrop-blur hover:bg-polaroid";
  return (
    <div className="absolute bottom-5 right-5 z-20 flex flex-col gap-2">
      <button type="button" className={btn} onClick={() => onZoom(1.2)} aria-label="Zoom in">
        +
      </button>
      <button type="button" className={btn} onClick={() => onZoom(1 / 1.2)} aria-label="Zoom out">
        −
      </button>
      <button
        type="button"
        className={btn + " text-xs"}
        onClick={onFit}
        aria-label="Fit all"
      >
        ⤢
      </button>
    </div>
  );
}
