import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DonationPanel } from "../components/DonationPanel";
import { EventTopBar } from "../components/EventTopBar";
import { Modal } from "../components/Modal";
import { SlideOver } from "../components/SlideOver";
import { GuestbookCanvas, type CanvasStatus } from "./GuestbookCanvasPage";
import { connectNdk } from "../lib/ndk";
import { createEntry, loadEntries, subscribeEntries } from "../lib/guestbook";
import { parseNeventParam } from "../lib/nevent";
import { fetchPop, type Pop } from "../lib/pop";
import { parsePubkeyParam } from "../lib/pubkey";
import { useDonations } from "../hooks/useDonations";
import type { Post } from "../types/post";
import { useAuthStore } from "../store/auth";

type Load = "loading" | "ready" | "notfound";

/**
 * Unified guestbook page for a single Pop, addressed by `nevent`. Shows the
 * host's donation panel above the live guestbook canvas, and lets a logged-in
 * visitor sign the book (a NIP-22 comment scoped to the Pop).
 */
export function EventGuestbookPage({
  onLoginClick,
}: {
  onLoginClick: () => void;
}) {
  const { nevent = "" } = useParams();
  const ref = useMemo(() => parseNeventParam(nevent), [nevent]);

  const [state, setState] = useState<Load>("loading");
  const [pop, setPop] = useState<Pop | null>(null);

  useEffect(() => {
    if (!ref) return;
    let cancelled = false;
    connectNdk()
      .then(() => fetchPop(ref.id))
      .then((p) => {
        if (cancelled) return;
        setPop(p);
        setState(p ? "ready" : "notfound");
      })
      .catch(() => !cancelled && setState("notfound"));
    return () => {
      cancelled = true;
    };
  }, [ref]);

  if (!ref || state === "notfound") {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink">Guestbook not found</h1>
        <p className="mt-2 text-muted">
          “{nevent}” isn’t a valid Pop event, or it couldn’t be found on the
          connected relays.
        </p>
        <Link to="/" className="mt-6 inline-block font-semibold text-ink hover:underline">
          ← Back home
        </Link>
      </div>
    );
  }

  if (state === "loading" || !pop) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-hairline border-t-muted" />
        <p className="mt-4 text-sm text-muted">Developing the prints…</p>
      </div>
    );
  }

  return <EventGuestbook pop={pop} onLoginClick={onLoginClick} />;
}

function EventGuestbook({
  pop,
  onLoginClick,
}: {
  pop: Pop;
  onLoginClick: () => void;
}) {
  const recipient = useMemo(() => parsePubkeyParam(pop.host), [pop.host]);

  const [posts, setPosts] = useState<Post[] | null>(null);
  useEffect(() => {
    let alive = true;
    // Merge a post in by id (newest wins), keeping the list de-duplicated as the
    // initial fetch and the live subscription both feed in.
    const merge = (incoming: Post[]) =>
      setPosts((prev) => {
        const byId = new Map((prev ?? []).map((p) => [p.id, p]));
        for (const p of incoming) byId.set(p.id, p);
        return [...byId.values()];
      });

    loadEntries(pop).then((list) => alive && merge(list));
    // Live: new signatures from anyone stream onto the wall as they arrive.
    const unsub = subscribeEntries(pop, (post) => alive && merge([post]));
    return () => {
      alive = false;
      unsub();
    };
  }, [pop]);

  // Live zap totals for the event host, folded into an author -> sats map so the
  // canvas can gild + centre cards whose author zapped.
  const { donations } = useDonations(recipient?.hex ?? null);
  const zappedSats = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of donations) {
      if (!d.senderHex) continue;
      m.set(d.senderHex, (m.get(d.senderHex) ?? 0) + d.sats);
    }
    return m;
  }, [donations]);

  const [query, setQuery] = useState("");
  const [zapOpen, setZapOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  // Bumped each time a note is signed; remounts the flash so it fires again.
  const [flash, setFlash] = useState(0);

  // Measure the floating top chrome so the canvas can keep panned content out
  // from under it (worst on mobile, where the placard + search are much taller).
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(0);
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) =>
      setHeaderH(entry.contentRect.height),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const status: CanvasStatus =
    posts === null ? "loading" : posts.length ? "ready" : "empty";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* The wall, full-screen by default */}
      <GuestbookCanvas
        posts={posts ?? []}
        status={status}
        query={query}
        flashSignal={flash}
        topInset={headerH + 8}
        zappedSats={zappedSats}
      />

      <CameraFlash trigger={flash} />

      {/* Floating chrome */}
      <EventTopBar
        headerRef={headerRef}
        title={pop.name}
        picture={pop.picture}
        banner={pop.banner}
        hostHex={recipient?.hex ?? ""}
        query={query}
        onQueryChange={setQuery}
        onZap={recipient ? () => setZapOpen(true) : undefined}
        onSign={() => setSignOpen(true)}
        onLoginClick={onLoginClick}
      />

      {/* Zap → full donation panel */}
      {recipient && (
        <Modal open={zapOpen} onClose={() => setZapOpen(false)} size="lg">
          <DonationPanel
            hex={recipient.hex}
            npub={recipient.npub}
            title={pop.name}
            description={pop.description}
          />
        </Modal>
      )}

      {/* Sign → right slide-over, the wall stays visible behind */}
      <SlideOver
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title="Sign the guestbook"
        subtitle={pop.name}
      >
        <SignGuestbook
          pop={pop}
          onLoginClick={onLoginClick}
          onSigned={(post) => {
            setPosts((prev) => [post, ...(prev ?? [])]);
            setSignOpen(false);
            setFlash((n) => n + 1);
          }}
        />
      </SlideOver>
    </div>
  );
}

/**
 * A brief warm flash over the whole wall when a note is signed: the disposable
 * camera firing (DESIGN.md §1). `trigger` bumps on each signing; keying on it
 * remounts the element so the animation replays. Decorative, so hidden from
 * assistive tech and silenced under prefers-reduced-motion (handled in CSS).
 */
function CameraFlash({ trigger }: { trigger: number }) {
  if (trigger === 0) return null;
  return (
    <div
      key={trigger}
      aria-hidden
      className="pop-camera-flash pointer-events-none fixed inset-0 z-50"
      style={{
        background:
          "radial-gradient(circle at center, #fffdf4 0%, var(--color-flash) 70%, transparent 100%)",
      }}
    />
  );
}

const inputCls =
  "w-full rounded-lg border border-hairline bg-polaroid px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-ink";
const signBtnCls =
  "w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-polaroid transition hover:bg-avatar-ink active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 disabled:active:translate-y-0";

/**
 * Sign-the-guestbook composer. Two paths:
 *  - Logged in: sign the note with the visitor's own Nostr account.
 *  - Guest: enter an optional name + note; we sign with a throwaway key minted
 *    in-browser. A "Log in with Nostr" option upgrades to the account path.
 */
function SignGuestbook({
  pop,
  onLoginClick,
  onSigned,
}: {
  pop: Pop;
  onLoginClick: () => void;
  onSigned: (post: Post) => void;
}) {
  const authed = useAuthStore(
    (s) => s.status === "authenticated" && !!s.pubkey,
  );
  const profile = useAuthStore((s) => s.profile);
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = message.trim().length > 0 && !submitting;

  async function sign(asGuest: boolean) {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await createEntry({
        pop,
        message: message.trim(),
        imageUrl: imageUrl.trim() || undefined,
        name: asGuest ? name.trim() || undefined : undefined,
        guest: asGuest,
      });
      onSigned(post);
      setMessage("");
      setImageUrl("");
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign.");
    } finally {
      setSubmitting(false);
    }
  }

  const note = (
    <>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Leave a note…"
        rows={4}
        maxLength={1000}
        autoFocus
        className={"resize-y " + inputCls}
      />
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="Image URL (optional)"
        className={inputCls}
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </>
  );

  // Logged in — sign with their account.
  if (authed) {
    const myName = profile?.displayName || profile?.name;
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sign(false);
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted">
          Signing as{" "}
          <span className="font-semibold text-ink">
            {myName || "your Nostr account"}
          </span>
          .
        </p>
        {note}
        <button type="submit" disabled={!canSubmit} className={signBtnCls}>
          {submitting ? "Signing…" : "Sign guestbook"}
        </button>
      </form>
    );
  }

  // Not logged in — guest signing, plus the option to log in with Nostr.
  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sign(true);
        }}
        className="space-y-3"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          maxLength={60}
          className={inputCls}
        />
        {note}
        <button type="submit" disabled={!canSubmit} className={signBtnCls}>
          {submitting ? "Signing…" : "Sign as guest"}
        </button>
      </form>
      <p className="text-xs text-muted">
        Signing as a guest mints a throwaway Nostr key in your browser, just for
        this note — no account needed.
      </p>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>

      <button
        type="button"
        onClick={onLoginClick}
        className="w-full rounded-lg border border-hairline bg-polaroid px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-paper"
      >
        Log in with Nostr
      </button>
    </div>
  );
}
