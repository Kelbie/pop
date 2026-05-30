import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DonationPanel } from "../components/DonationPanel";
import { EventTopBar } from "../components/EventTopBar";
import { Modal } from "../components/Modal";
import { SlideOver } from "../components/SlideOver";
import { GuestbookCanvas, type CanvasStatus } from "./GuestbookCanvasPage";
import { connectNdk } from "../lib/ndk";
import { createEntry, loadEntries } from "../lib/guestbook";
import { parseNeventParam } from "../lib/nevent";
import { fetchPop, type Pop } from "../lib/pop";
import { parsePubkeyParam } from "../lib/pubkey";
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
        <p className="mt-4 text-sm text-muted">Loading guestbook…</p>
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
    loadEntries(pop).then((list) => alive && setPosts(list));
    return () => {
      alive = false;
    };
  }, [pop]);

  const [query, setQuery] = useState("");
  const [zapOpen, setZapOpen] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  const status: CanvasStatus =
    posts === null ? "loading" : posts.length ? "ready" : "empty";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden">
      {/* The wall, full-screen by default */}
      <GuestbookCanvas posts={posts ?? []} status={status} query={query} />

      {/* Floating chrome */}
      <EventTopBar
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
          }}
        />
      </SlideOver>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-hairline bg-polaroid px-3 py-2 text-sm text-ink outline-none placeholder:text-muted focus:border-ink";
const signBtnCls =
  "w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-polaroid transition hover:bg-avatar-ink disabled:cursor-not-allowed disabled:opacity-40";

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
