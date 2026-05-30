import { useEffect, useMemo, useRef, useState } from "react";
import { CanvasController, type LodMode } from "../canvas/CanvasController";
import type { Post } from "../types/post";
import { DetailModal } from "../components/DetailModal";
import { DomOverlay } from "../components/DomOverlay";
import { PixiStage } from "../components/PixiStage";
import { SearchPill } from "../components/SearchPill";

export type CanvasStatus = "loading" | "empty" | "ready";

/**
 * Presentational guestbook wall. Renders the supplied posts on the Pixi canvas
 * (pan / zoom / search / detail). Fills its parent — give it a sized container.
 */
export function GuestbookCanvas({
  posts,
  status,
}: {
  posts: Post[];
  status: CanvasStatus;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<CanvasController | null>(null);

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
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

  const selectedPost = selectedId
    ? posts.find((p) => p.id === selectedId) ?? null
    : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f2f1ee]">
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
          onSelect={handleTap}
        />
      )}

      <SearchPill value={query} onChange={setQuery} />

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
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          <span className="text-sm text-neutral-500">Loading the guestbook…</span>
        </Centered>
      )}
      {status === "empty" && (
        <Centered>
          <span className="text-lg font-medium text-neutral-700">
            No posts yet
          </span>
          <span className="text-sm text-neutral-500">
            Be the first to sign this guestbook.
          </span>
        </Centered>
      )}

      {selectedPost && (
        <DetailModal post={selectedPost} onClose={() => setSelectedId(null)} />
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
    "flex h-9 w-9 items-center justify-center rounded-lg bg-white/90 text-neutral-700 shadow hover:bg-white";
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
