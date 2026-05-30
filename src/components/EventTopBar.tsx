import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { SearchPill } from "./SearchPill";
import { useProfile } from "../hooks/useProfile";
import { useAuthStore } from "../store/auth";
import { shortNpub } from "../lib/pubkey";

/**
 * Slim floating bar over the full-screen guestbook canvas. Carries the event
 * identity (host avatar + title), the search input, and the primary actions
 * (Zap / Sign) plus the auth control. Translucent + blurred like the search
 * pill so the wall reads full-bleed behind it.
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

  return (
    <div className="absolute inset-x-0 top-0 z-30 border-b border-hairline bg-polaroid/80 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Left: home + host identity */}
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <Link to="/" className="hidden shrink-0 sm:block" aria-label="Pop home">
            <img src="/logo-dark.jpeg" alt="Pop" className="h-7 w-7 rounded-lg" />
          </Link>
          {avatar ? (
            <img
              src={avatar}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-hairline"
            />
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-avatar text-xs font-bold text-avatar-ink">
              {(title || displayName).slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-ink">
              {title || displayName}
            </div>
            {title && (
              <div className="truncate font-mono text-xs text-muted">
                Hosted by {displayName}
              </div>
            )}
          </div>
        </div>

        {/* Center: search */}
        <div className="hidden md:block">
          <SearchPill value={query} onChange={onQueryChange} className="w-72" />
        </div>

        {/* Right: actions */}
        <div className="flex flex-1 items-center justify-end gap-2">
          {onZap && (
            <button
              type="button"
              onClick={onZap}
              className="flex items-center gap-1.5 rounded-full border border-hairline bg-polaroid px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-paper"
            >
              <span aria-hidden>⚡</span>
              <span className="hidden sm:inline">Zap</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSign}
            className="rounded-full bg-ink px-3.5 py-2 text-sm font-semibold text-polaroid transition hover:bg-avatar-ink"
          >
            <span className="sm:hidden">Sign</span>
            <span className="hidden sm:inline">Sign the guestbook</span>
          </button>
          <AuthControl onLoginClick={onLoginClick} />
        </div>
      </div>

      {/* Search on small screens, below the row */}
      <div className="px-4 pb-2.5 md:hidden">
        <SearchPill value={query} onChange={onQueryChange} className="w-full" />
      </div>
    </div>
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
        className="hidden rounded-full border border-hairline bg-polaroid px-3.5 py-2 text-sm font-semibold text-ink transition hover:bg-paper disabled:opacity-50 sm:block"
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
        className="flex items-center rounded-full ring-1 ring-hairline transition hover:ring-muted"
        aria-label={displayName}
      >
        {avatar ? (
          <img src={avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-avatar-ink">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-xl border border-hairline bg-polaroid py-1 shadow-2xl">
          <button
            type="button"
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
