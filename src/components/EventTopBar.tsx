import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SearchPill } from "./SearchPill";
import { useDonations } from "../hooks/useDonations";
import { useProfile } from "../hooks/useProfile";
import { useAuthStore } from "../store/auth";
import { shortNpub } from "../lib/pubkey";

const fmtSats = new Intl.NumberFormat("en-US");

/**
 * Floating chrome over the full-screen guestbook canvas. Two layers:
 *  - Quiet utility at the corners (home, search, auth) so the wall reads
 *    full-bleed behind them.
 *  - A prominent, centered event *placard* — avatar, name, host, and the
 *    primary actions (Zap / Sign / Share) — pinned to the top of the wall like
 *    a gallery label, so a guest instantly knows whose moment this is and how
 *    to add to it.
 */
export function EventTopBar({
  title,
  hostHex,
  query,
  onQueryChange,
  onZap,
  onSign,
  onLoginClick,
}: {
  title?: string;
  hostHex: string;
  query: string;
  onQueryChange: (v: string) => void;
  onZap?: () => void;
  onSign: () => void;
  onLoginClick: () => void;
}) {
  const { displayName, avatar } = useProfile(hostHex);
  const eventName = title || displayName;

  return (
    // pointer-events-none lets the wall stay grabbable in the gaps; each
    // interactive island opts back in.
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30">
      {/* Utility row — home (left), search + auth (right) */}
      <div className="flex items-start justify-between gap-3 px-3 pt-3 sm:px-4 sm:pt-4">
        <Link
          to="/"
          className="pointer-events-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-polaroid/90 shadow-sm ring-1 ring-hairline backdrop-blur transition hover:bg-polaroid"
          aria-label="Pop home"
        >
          <img src="/logo-dark.jpeg" alt="" className="h-6 w-6 rounded-md" />
        </Link>

        <div className="pointer-events-auto flex items-center gap-2">
          <SearchPill
            value={query}
            onChange={onQueryChange}
            className="hidden w-64 md:flex lg:w-72"
          />
          <AuthControl onLoginClick={onLoginClick} />
        </div>
      </div>

      {/* Event placard — the centerpiece */}
      <div className="mt-1 flex justify-center px-3 sm:mt-2">
        <div className="pop-placard-in pointer-events-auto w-full max-w-md rounded-2xl border border-hairline bg-polaroid/85 px-5 py-4 text-center shadow-[0_8px_28px_rgba(36,30,26,0.12)] backdrop-blur-md sm:px-7 sm:py-5">
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="mx-auto h-12 w-12 rounded-full object-cover ring-2 ring-hairline sm:h-14 sm:w-14"
            />
          ) : (
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-avatar text-lg font-bold text-avatar-ink sm:h-14 sm:w-14">
              {eventName.slice(0, 1).toUpperCase()}
            </span>
          )}

          <h1 className="mt-2.5 line-clamp-2 text-balance text-xl font-bold leading-tight tracking-tight text-ink sm:text-2xl">
            {eventName}
          </h1>
          {title && (
            <p className="mt-0.5 truncate font-mono text-xs text-muted">
              Hosted by {displayName}
            </p>
          )}

          {hostHex && <ZapTotals hex={hostHex} />}

          <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onSign}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-polaroid transition hover:bg-avatar-ink active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              Sign the guestbook
            </button>
            {onZap && (
              <button
                type="button"
                onClick={onZap}
                className="flex items-center gap-1.5 rounded-full border border-hairline bg-polaroid px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <span aria-hidden>⚡</span>
                Zap
              </button>
            )}
            <ShareButton title={eventName} />
          </div>
        </div>
      </div>

      {/* Search on small screens, below the placard */}
      <div className="pointer-events-auto mt-2 px-3 md:hidden">
        <SearchPill value={query} onChange={onQueryChange} className="w-full" />
      </div>
    </header>
  );
}

/**
 * Live zap tally for the event, in the monospace stamp voice. Hidden until the
 * first zap lands so a fresh guestbook stays uncluttered.
 */
function ZapTotals({ hex }: { hex: string }) {
  const { totalSats, count } = useDonations(hex);
  if (count === 0) return null;
  return (
    <p className="mt-2 font-mono text-xs text-muted">
      <span aria-hidden>⚡</span>{" "}
      <span className="font-semibold text-ink">
        {fmtSats.format(Math.round(totalSats))}
      </span>{" "}
      sats raised · {count} zap{count === 1 ? "" : "s"}
    </p>
  );
}

/**
 * Share the guestbook link. Uses the native share sheet on devices that have
 * one (the common case: a guest's phone at the venue), and falls back to
 * copy-to-clipboard with inline confirmation everywhere else.
 */
function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user dismissed the sheet, or it failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="flex items-center gap-1.5 rounded-full border border-hairline bg-polaroid px-4 py-2 text-sm font-semibold text-ink transition hover:bg-paper active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {copied ? (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m5 13 4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 15V4m0 0L8 8m4-4 4 4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M5 13v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Share
        </>
      )}
    </button>
  );
}

/** Compact auth affordance: avatar + logout menu, or a Log in pill. */
function AuthControl({ onLoginClick }: { onLoginClick: () => void }) {
  const status = useAuthStore((s) => s.status);
  const pubkey = useAuthStore((s) => s.pubkey);
  const profile = useAuthStore((s) => s.profile);
  const logout = useAuthStore((s) => s.logout);

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const authed = status === "authenticated" && pubkey;
  if (!authed) {
    return (
      <button
        type="button"
        onClick={onLoginClick}
        disabled={status === "connecting"}
        className="rounded-full border border-hairline bg-polaroid/90 px-4 py-2 text-sm font-semibold text-ink shadow-sm backdrop-blur transition hover:bg-polaroid disabled:opacity-50"
      >
        {status === "connecting" ? "…" : "Log in"}
      </button>
    );
  }

  const displayName =
    profile?.displayName || profile?.name || shortNpub(pubkey);
  const avatar = profile?.picture || profile?.image;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center rounded-full bg-polaroid/90 shadow-sm ring-1 ring-hairline backdrop-blur transition hover:ring-muted"
        aria-label={displayName}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
      >
        {avatar ? (
          <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-avatar-ink">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-hairline bg-polaroid py-1 shadow-2xl"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              logout();
              setMenuOpen(false);
            }}
            className="block w-full px-4 py-2 text-left text-sm text-ink transition hover:bg-paper"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
