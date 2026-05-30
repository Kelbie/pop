import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DonationPanel } from "../components/DonationPanel";
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
        <h1 className="text-2xl font-bold">Guestbook not found</h1>
        <p className="mt-2 text-neutral-500">
          “{nevent}” isn’t a valid Pop event, or it couldn’t be found on the
          connected relays.
        </p>
        <Link to="/" className="mt-6 inline-block text-indigo-600 hover:underline">
          ← Back home
        </Link>
      </div>
    );
  }

  if (state === "loading" || !pop) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
        <p className="mt-4 text-sm text-neutral-500">Loading guestbook…</p>
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

  const status: CanvasStatus =
    posts === null ? "loading" : posts.length ? "ready" : "empty";

  return (
    <div>
      {recipient && (
        <DonationPanel
          hex={recipient.hex}
          npub={recipient.npub}
          title={pop.name}
          description={pop.description}
        />
      )}

      <div className="mx-auto max-w-xl px-6">
        <SignGuestbook
          pop={pop}
          onLoginClick={onLoginClick}
          onSigned={(post) => setPosts((prev) => [post, ...(prev ?? [])])}
        />
      </div>

      <div className="mt-8 h-[80vh] w-full border-t border-neutral-200">
        <GuestbookCanvas posts={posts ?? []} status={status} />
      </div>
    </div>
  );
}

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
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!authed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-6 text-center">
        <p className="text-sm text-neutral-500">
          Log in with Nostr to sign this guestbook.
        </p>
        <button
          type="button"
          onClick={onLoginClick}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Log in to sign
        </button>
      </div>
    );
  }

  const canSubmit = message.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const post = await createEntry({
        pop,
        message: message.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      onSigned(post);
      setMessage("");
      setImageUrl("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sign.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-neutral-200 bg-white px-6 py-6"
    >
      <h2 className="text-lg font-semibold">Sign the guestbook</h2>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Leave a note…"
        rows={3}
        maxLength={1000}
        className="w-full resize-y rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
      />
      <input
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
        placeholder="Image URL (optional)"
        className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-400"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {submitting ? "Signing…" : "Sign guestbook"}
      </button>
    </form>
  );
}
